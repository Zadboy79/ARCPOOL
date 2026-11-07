import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { SwapEstimate } from '@circle-fin/app-kit'
import type { EIP1193Provider, Hash } from 'viem'
import { useAccount } from 'wagmi'
import { toast } from 'sonner'
import { Amount } from '@/onchain-money'
import { parseOnchainError } from '@/lib/format'
import { getKit } from '@/lib/kit'
import { MAX_SPLITS, isNoRouteError, multiplyAmount, splitAmount, type FallbackPlan } from '@/lib/swapPlan'
import { tokenBySymbol, type SwapToken } from '@/lib/tokens'

const SWAP_CHAIN = 'Arc_Testnet'

function useAdapter() {
  const { connector } = useAccount()
  return useCallback(async () => {
    if (!connector) throw new Error('Wallet not connected')
    const provider = (await connector.getProvider()) as EIP1193Provider
    const { createViemAdapterFromProvider } = await import('@circle-fin/adapter-viem-v2')
    return createViemAdapterFromProvider({ provider })
  }, [connector])
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(id)
  }, [value, delayMs])
  return debounced
}

interface QuoteArgs {
  from: SwapToken
  to: SwapToken
  amountIn: string
  slippageBps: number
  enabled: boolean
}

export function quoteErrorText(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (message.includes('no route') || message.includes('not found')) {
    return 'No liquidity route for this pair and amount right now. Try a different amount or pair.'
  }
  return 'Could not get a quote. Please try again.'
}

/** Live quote across Arc market liquidity, requested shortly after the amount stops changing. */
export function useMarketQuote({ from, to, amountIn, slippageBps, enabled }: QuoteArgs) {
  const { address } = useAccount()
  const getAdapter = useAdapter()
  const settled = useDebounced(amountIn, 600)
  const active = enabled && address !== undefined && Number(settled) > 0

  const query = useQuery<SwapEstimate>({
    queryKey: ['market-quote', from.symbol, to.symbol, settled, address, slippageBps],
    enabled: active,
    retry: false,
    staleTime: 10_000,
    queryFn: async () => {
      if (!from.kitSymbol || !to.kitSymbol) throw new Error('Token is not routed through the market')
      const [kit, adapter] = await Promise.all([getKit(), getAdapter()])
      return kit.estimateSwap({
        from: { adapter, chain: SWAP_CHAIN },
        tokenIn: from.kitSymbol,
        tokenOut: to.kitSymbol,
        amountIn: settled,
        config: { slippageBps },
      })
    },
  })

  return {
    estimate: active ? query.data : undefined,
    isFetching: active && (query.isFetching || settled !== amountIn),
    error: active && query.isError ? query.error : undefined,
    reviewedAmount: settled,
  }
}

interface FallbackArgs {
  from: SwapToken
  to: SwapToken
  amountIn: string
  slippageBps: number
  enabled: boolean
}

/**
 * Router fallback. It runs only after the direct quote found no route:
 * pairs with no direct pool go through USDC, and orders that are too big for one pool are split.
 */
export function useFallbackPlan({ from, to, amountIn, slippageBps, enabled }: FallbackArgs) {
  const { address } = useAccount()
  const getAdapter = useAdapter()
  const active = enabled && address !== undefined && Number(amountIn) > 0

  const query = useQuery<FallbackPlan>({
    queryKey: ['market-fallback', from.symbol, to.symbol, amountIn, address, slippageBps],
    enabled: active,
    retry: false,
    staleTime: 10_000,
    queryFn: async () => {
      if (!from.kitSymbol || !to.kitSymbol) throw new Error('Token is not routed through the market')
      const tokenIn = from.kitSymbol
      const tokenOut = to.kitSymbol
      const [kit, adapter] = await Promise.all([getKit(), getAdapter()])
      const estimate = (a: typeof tokenIn, b: typeof tokenOut, amount: string) =>
        kit.estimateSwap({ from: { adapter, chain: SWAP_CHAIN }, tokenIn: a, tokenOut: b, amountIn: amount, config: { slippageBps } })

      if (from.symbol !== 'USDC' && to.symbol !== 'USDC') {
        const hop = tokenBySymbol('USDC')
        if (!hop.kitSymbol) throw new Error('USDC is not routed through the market')
        const first = await estimate(tokenIn, hop.kitSymbol, amountIn)
        const second = await estimate(hop.kitSymbol, tokenOut, first.estimatedOutput.amount)
        return {
          kind: 'via',
          legs: [first, second],
          totalOut: second.estimatedOutput.amount,
          minOut: second.stopLimit.amount,
        }
      }

      for (let parts = 2; parts <= MAX_SPLITS; parts += 1) {
        const split = splitAmount(amountIn, from, parts)
        if (!split) break
        try {
          const one = await estimate(tokenIn, tokenOut, split.chunk)
          return {
            kind: 'split',
            parts,
            chunk: split.chunk,
            estimate: one,
            totalIn: split.total,
            totalOut: multiplyAmount(one.estimatedOutput.amount, to, parts),
            minOut: multiplyAmount(one.stopLimit.amount, to, parts),
          }
        } catch (error) {
          if (!isNoRouteError(error)) throw error
        }
      }
      throw new Error('No route available')
    },
  })

  return {
    plan: active ? query.data : undefined,
    isFetching: active && query.isFetching,
    error: active && query.isError ? query.error : undefined,
  }
}

interface RoundTripArgs {
  from: SwapToken
  to: SwapToken
  estimate: SwapEstimate | undefined
  slippageBps: number
}

/**
 * Price sanity check: quotes the opposite swap for exactly the amount the main quote would
 * return, then compares what comes back with what was put in. A fair pool returns slightly
 * less (fees and spread); a large gap in either direction means the pool prices disagree.
 */
export function useRoundTripCheck({ from, to, estimate, slippageBps }: RoundTripArgs) {
  const { address } = useAccount()
  const getAdapter = useAdapter()
  const output = estimate?.estimatedOutput.amount
  const active = estimate !== undefined && output !== undefined && Number(output) > 0

  const query = useQuery<SwapEstimate>({
    queryKey: ['market-roundtrip', from.symbol, to.symbol, estimate?.amountIn, output, address, slippageBps],
    enabled: active,
    retry: false,
    staleTime: 10_000,
    queryFn: async () => {
      if (!from.kitSymbol || !to.kitSymbol || !output) throw new Error('Token is not routed through the market')
      const [kit, adapter] = await Promise.all([getKit(), getAdapter()])
      return kit.estimateSwap({
        from: { adapter, chain: SWAP_CHAIN },
        tokenIn: to.kitSymbol,
        tokenOut: from.kitSymbol,
        amountIn: output,
        config: { slippageBps },
      })
    },
  })

  const returned = active && query.data ? Number(query.data.estimatedOutput.amount) : undefined
  const paid = estimate ? Number(estimate.amountIn) : undefined
  return {
    /** Amount of the paid token a swap straight back would return, as a share of what was paid. */
    ratio: returned !== undefined && paid !== undefined && paid > 0 ? returned / paid : undefined,
    returned: query.data?.estimatedOutput.amount,
    isFetching: active && query.isFetching,
  }
}

/** Sends the swap. It runs only from the user's click on the Swap button. */
export function useMarketExecute(onDone: () => void) {
  const getAdapter = useAdapter()
  const [isExecuting, setExecuting] = useState(false)
  const [lastHash, setLastHash] = useState<Hash>()
  const [progress, setProgress] = useState<string>()

  const execute = useCallback(
    async (from: SwapToken, to: SwapToken, amountIn: string, slippageBps: number): Promise<boolean> => {
      if (!from.kitSymbol || !to.kitSymbol) return false
      setExecuting(true)
      try {
        const [kit, adapter] = await Promise.all([getKit(), getAdapter()])
        const result = await kit.swap({
          from: { adapter, chain: SWAP_CHAIN },
          tokenIn: from.kitSymbol,
          tokenOut: to.kitSymbol,
          amountIn,
          config: { slippageBps },
        })
        if (result.txHash) setLastHash(result.txHash as Hash)
        if (result.progress.status === 'DONE') {
          toast.success(
            result.amountOut
              ? `Swapped. You received ${Amount.fromRaw(BigInt(result.amountOut), to.decimals).toString()} ${to.symbol}.`
              : 'Swap complete.',
          )
        } else {
          toast.message('Swap submitted. It is still settling.')
        }
        onDone()
        return true
      } catch (error) {
        const message = parseOnchainError(error)
        if (message) toast.error(message)
        return false
      } finally {
        setExecuting(false)
      }
    },
    [getAdapter, onDone],
  )

  /** Runs a fallback route one swap at a time. A later failure leaves the earlier swaps completed. */
  const executePlan = useCallback(
    async (plan: FallbackPlan, from: SwapToken, to: SwapToken, slippageBps: number): Promise<boolean> => {
      if (!from.kitSymbol || !to.kitSymbol) return false
      const tokenIn = from.kitSymbol
      const tokenOut = to.kitSymbol
      const total = plan.kind === 'via' ? 2 : plan.parts
      const tally = { completed: 0 }
      setExecuting(true)
      try {
        const [kit, adapter] = await Promise.all([getKit(), getAdapter()])
        const run = async (a: typeof tokenIn, b: typeof tokenOut, amount: string) => {
          const result = await kit.swap({
            from: { adapter, chain: SWAP_CHAIN },
            tokenIn: a,
            tokenOut: b,
            amountIn: amount,
            config: { slippageBps },
          })
          if (result.txHash) setLastHash(result.txHash as Hash)
          if (result.progress.status !== 'DONE') {
            throw new Error(`Swap ${tally.completed + 1} of ${total} was submitted but is still settling. Check the explorer, then try again.`)
          }
          tally.completed += 1
          return result
        }

        if (plan.kind === 'via') {
          const hop = tokenBySymbol('USDC')
          if (!hop.kitSymbol) return false
          setProgress('Swap 1 of 2...')
          const first = await run(tokenIn, hop.kitSymbol, plan.legs[0].amountIn)
          // Use what the first swap really paid out; fall back to its guaranteed minimum.
          const received = first.amountOut
            ? Amount.fromRaw(BigInt(first.amountOut), hop.decimals).toString()
            : plan.legs[0].stopLimit.amount
          setProgress('Swap 2 of 2...')
          const second = await run(hop.kitSymbol, tokenOut, received)
          toast.success(
            second.amountOut
              ? `Swapped in 2 steps. You received ${Amount.fromRaw(BigInt(second.amountOut), to.decimals).toString()} ${to.symbol}.`
              : 'Both swaps complete.',
          )
        } else {
          for (let index = 1; index <= plan.parts; index += 1) {
            setProgress(`Swap ${index} of ${plan.parts}...`)
            await run(tokenIn, tokenOut, plan.chunk)
          }
          toast.success(`Completed ${plan.parts} swaps of ${plan.chunk} ${from.symbol}.`)
        }
        onDone()
        return true
      } catch (error) {
        const message = error instanceof Error && error.message.includes('still settling') ? error.message : parseOnchainError(error)
        if (tally.completed > 0) {
          toast.error(`${tally.completed} of ${total} swaps completed. ${message ?? 'The next swap failed.'}`)
          onDone()
        } else if (message) {
          toast.error(message)
        }
        return false
      } finally {
        setExecuting(false)
        setProgress(undefined)
      }
    },
    [getAdapter, onDone],
  )

  return { execute, executePlan, isExecuting, lastHash, progress }
}
