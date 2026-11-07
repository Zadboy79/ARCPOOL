import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { SwapEstimate } from '@circle-fin/app-kit'
import type { EIP1193Provider, Hash } from 'viem'
import { useAccount } from 'wagmi'
import { toast } from 'sonner'
import { parseOnchainError } from '@/lib/format'
import { getKit } from '@/lib/kit'
import type { SwapToken } from '@/lib/tokens'

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
          toast.success(result.amountOut ? `Swapped. You received ${result.amountOut} ${to.symbol}.` : 'Swap complete.')
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

  return { execute, isExecuting, lastHash }
}
