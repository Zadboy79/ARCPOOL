import { useCallback, useMemo, useState } from 'react'
import { ArrowDown, ExternalLink, Loader2, SlidersHorizontal } from 'lucide-react'
import { useAccount } from 'wagmi'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { Amount, parseUsdc } from '@/onchain-money'
import { CHAIN_ID, USDC_DECIMALS } from '@/lib/pool'
import { formatFixed } from '@/lib/format'
import { routeKind, tokenBySymbol, type SwapSymbol } from '@/lib/tokens'
import { useConvert } from '@/hooks/useConvert'
import { quoteErrorText, useMarketExecute, useMarketQuote, useRoundTripCheck } from '@/hooks/useMarketSwap'
import { useTokenBalances } from '@/hooks/useTokenBalances'
import { PageTitle } from '@/components/PageTitle'
import { PriceCheck } from '@/components/PriceCheck'
import { RouteDetails } from '@/components/RouteDetails'
import { TokenSelect } from '@/components/TokenSelect'
import { TxButton } from '@/components/TxButton'
import type { PageProps } from './types'

const SLIPPAGE_OPTIONS = [50, 100, 300] as const
/** Keeps a little USDC back when swapping "Max" so the wallet can still pay network fees. */
const FEE_RESERVE = parseUsdc('0.1')

export function SwapPage({ data, refetch }: PageProps) {
  const { address } = useAccount()
  const [fromSym, setFromSym] = useState<SwapSymbol>('USDC')
  const [toSym, setToSym] = useState<SwapSymbol>('EURC')
  const [input, setInput] = useState('')
  const [slippageBps, setSlippageBps] = useState<number>(100)
  const [showSettings, setShowSettings] = useState(false)

  const from = tokenBySymbol(fromSym)
  const to = tokenBySymbol(toSym)
  const kind = routeKind(fromSym, toSym)

  const { balances, refetch: refetchBalances } = useTokenBalances()
  const refreshAll = useCallback(() => {
    refetch()
    void refetchBalances()
  }, [refetch, refetchBalances])

  // ArcPool route (USDC <-> rUSDC). Its input is only fed while that route is selected.
  const convert = useConvert(fromSym === 'rUSDC' ? 'unstake' : 'stake', data, refreshAll, {
    input: kind === 'pool' ? input : '',
    setInput,
  })

  // Market route (everything else), quoted across the liquidity available on Arc.
  const marketAmount = useMemo(() => {
    if (input === '' || input === '.') return 0n
    try {
      return Amount.parse(input, from.decimals).raw
    } catch {
      return null
    }
  }, [input, from.decimals])
  const hasMarketAmount = marketAmount !== null && marketAmount > 0n
  const fromBalance = balances[fromSym]
  const marketProblem =
    marketAmount === null
      ? `Use at most ${from.decimals} decimal places`
      : hasMarketAmount && fromBalance !== undefined && marketAmount > fromBalance
        ? 'Amount exceeds your balance'
        : null

  const quote = useMarketQuote({
    from,
    to,
    amountIn: input,
    slippageBps,
    enabled: kind === 'market' && hasMarketAmount && marketProblem === null,
  })
  const roundTrip = useRoundTripCheck({ from, to, estimate: quote.estimate, slippageBps })
  const market = useMarketExecute(() => {
    setInput('')
    refreshAll()
  })

  const { flow } = convert
  const phase = kind === 'market' ? (market.isExecuting ? 'processing' : 'idle') : flow.phase

  function pickFrom(symbol: SwapSymbol) {
    if (symbol === toSym) setToSym(fromSym)
    setFromSym(symbol)
    setInput('')
  }
  function pickTo(symbol: SwapSymbol) {
    if (symbol === fromSym) setFromSym(toSym)
    setToSym(symbol)
    setInput('')
  }
  function flip() {
    setFromSym(toSym)
    setToSym(fromSym)
    setInput('')
  }

  function setMax() {
    if (kind === 'pool') {
      convert.setMax()
      return
    }
    const balance = balances[fromSym] ?? 0n
    const reserve = fromSym === 'USDC' ? FEE_RESERVE : 0n
    const max = balance > reserve ? balance - reserve : 0n
    setInput(Amount.fromRaw(max, from.decimals).toString())
  }

  // What the bottom panel and the button show for the selected route.
  let output = ''
  let problem: string | null = null
  let ctaLabel = 'Enter an amount'
  let canSubmit = false
  let onAction: () => void | Promise<void> = () => undefined

  if (kind === 'none') {
    problem = 'rUSDC trades against USDC only. Pick USDC on the other side.'
    ctaLabel = 'Pair unavailable'
  } else if (kind === 'pool') {
    output = convert.preview !== undefined ? formatFixed(convert.preview, convert.previewDecimals, 6) : ''
    problem = convert.problem
    ctaLabel = convert.ctaLabel === 'Stake USDC' ? 'Swap USDC for rUSDC' : convert.ctaLabel === 'Unstake rUSDC' ? 'Swap rUSDC for USDC' : convert.ctaLabel
    canSubmit = convert.canSubmit
    onAction = convert.onAction
  } else {
    problem = marketProblem
    if (quote.estimate) output = quote.estimate.estimatedOutput.amount
    if (hasMarketAmount && marketProblem === null) {
      if (flow.isConnected && quote.error) {
        problem = quoteErrorText(quote.error)
        ctaLabel = 'No route available'
      } else if (quote.isFetching || !quote.estimate) {
        ctaLabel = flow.isConnected ? 'Getting best price...' : 'Enter an amount'
      } else {
        ctaLabel = `Swap ${fromSym} for ${toSym}`
        canSubmit = true
        onAction = async () => {
          await market.execute(from, to, quote.reviewedAmount, slippageBps)
        }
      }
    }
  }

  const balanceText =
    address === undefined
      ? 'Connect a wallet to see your balance'
      : fromBalance === undefined
        ? 'Loading balance...'
        : `Balance: ${formatFixed(fromBalance, from.decimals, from.decimals === 8 ? 6 : 4)} ${fromSym}`

  const lastHash = kind === 'market' ? market.lastHash : flow.lastHash
  const provider = quote.estimate?.route?.provider

  return (
    <div className="page-col">
      <PageTitle title="Swap" subtitle="Trade USDC, EURC and cirBTC across Arc liquidity, or swap USDC for rUSDC at the pool rate" />

      <section className="card p-3 sm:p-4">
        <div className="relative flex items-center justify-between px-3 pb-3 pt-2">
          <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>
            Swap
          </span>
          <button
            type="button"
            onClick={() => setShowSettings((s) => !s)}
            aria-label="Slippage settings"
            aria-expanded={showSettings}
            className="flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-[var(--card-2)]"
            style={{ color: showSettings ? 'var(--primary)' : 'var(--muted)' }}
          >
            <SlidersHorizontal className="size-5" />
          </button>
          {showSettings ? (
            <div className="well absolute right-2 top-full z-20 mt-1 w-64 p-3" style={{ boxShadow: 'var(--shadow)' }}>
              <p className="text-xs font-bold" style={{ color: 'var(--text)' }}>
                Slippage tolerance (market swaps)
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Slippage tolerance">
                {SLIPPAGE_OPTIONS.map((bps) => (
                  <button
                    key={bps}
                    type="button"
                    role="radio"
                    aria-checked={slippageBps === bps}
                    onClick={() => setSlippageBps(bps)}
                    className="min-h-10 rounded-lg text-sm font-bold transition-colors"
                    style={{
                      background: slippageBps === bps ? 'var(--primary)' : 'var(--card)',
                      color: slippageBps === bps ? '#fff' : 'var(--text-2)',
                    }}
                  >
                    {bps / 100}%
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-pretty" style={{ color: 'var(--muted)' }}>
                Lower slippage protects against price moves but can make a swap fail.
              </p>
            </div>
          ) : null}
        </div>

        <div className="relative space-y-1">
          <div className="well p-4 pb-6" style={{ background: 'var(--card-2)' }}>
            <div className="flex items-center gap-3">
              <input
                inputMode="decimal"
                aria-label={`${fromSym} amount to pay`}
                value={input}
                onChange={(event) => {
                  const next = event.target.value.replace(/,/g, '.')
                  if (next === '' || /^\d*\.?\d*$/.test(next)) setInput(next)
                }}
                placeholder="0"
                className="min-w-0 flex-1 bg-transparent text-3xl font-bold tabular-nums outline-none placeholder:text-[var(--muted)]"
                style={{ color: 'var(--text)' }}
              />
              <TokenSelect value={fromSym} onChange={pickFrom} balances={balances} label="Token to pay" />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span style={{ color: problem && kind !== 'none' ? 'var(--danger)' : 'var(--muted)' }}>
                {problem && kind !== 'none' ? problem : balanceText}
              </span>
              {flow.isConnected && kind !== 'none' ? (
                <button type="button" onClick={setMax} className="link text-xs font-extrabold">
                  MAX
                </button>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={flip}
            aria-label="Reverse swap direction"
            className="absolute left-1/2 top-1/2 z-10 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl transition-transform hover:rotate-180"
            style={{
              background: 'var(--card)',
              color: 'var(--primary)',
              border: '3px solid var(--card)',
              boxShadow: '0 0 0 1px var(--border), 0 0 18px rgba(0,163,255,0.35)',
            }}
          >
            <ArrowDown className="size-5" />
          </button>

          <div className="well p-4 pt-6" style={{ background: 'var(--card-2)' }}>
            <div className="flex items-center gap-3">
              <div className="relative min-w-0 flex-1">
                <input
                  readOnly
                  aria-label={`${toSym} amount to receive`}
                  value={output}
                  placeholder="0"
                  className="w-full bg-transparent text-3xl font-bold tabular-nums outline-none placeholder:text-[var(--muted)]"
                  style={{ color: 'var(--text)' }}
                />
                {kind === 'market' && quote.isFetching ? (
                  <Loader2 className="absolute right-0 top-1/2 size-4 -translate-y-1/2 animate-spin" style={{ color: 'var(--muted)' }} />
                ) : null}
              </div>
              <TokenSelect value={toSym} onChange={pickTo} balances={balances} label="Token to receive" />
            </div>
            <p className="mt-3 text-xs" style={{ color: kind === 'none' ? 'var(--danger)' : 'var(--muted)' }}>
              {kind === 'none'
                ? problem
                : kind === 'pool'
                  ? data.exchangeRate !== undefined
                    ? `Pool rate: 1 rUSDC = ${formatFixed(data.exchangeRate, USDC_DECIMALS, 6)} USDC`
                    : 'Loading pool rate...'
                  : address === undefined
                    ? 'Connect a wallet to get the best price across Arc liquidity'
                    : 'Best price across Arc market liquidity'}
            </p>
          </div>
        </div>

        {kind === 'market' && quote.estimate ? (
          <>
            <RouteDetails estimate={quote.estimate} slippageBps={slippageBps} />
            <PriceCheck
              fromSymbol={fromSym}
              amountIn={quote.estimate.amountIn}
              returned={roundTrip.returned}
              ratio={roundTrip.ratio}
              isFetching={roundTrip.isFetching}
            />
          </>
        ) : null}

        <div className="mt-3">
          <TxButton
            label={ctaLabel}
            onClick={onAction}
            phase={phase}
            isConnected={flow.isConnected}
            wrongChain={flow.wrongChain}
            isSwitching={flow.isSwitching}
            onSwitch={flow.switchToArc}
            disabled={!canSubmit}
          />
        </div>

        {lastHash ? (
          <a
            href={buildTxExplorerUrl(CHAIN_ID, lastHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="link mt-3 inline-flex items-center gap-1 px-1 text-xs"
          >
            Latest transaction <ExternalLink className="size-3" />
          </a>
        ) : null}

        <p className="mt-4 px-1 pb-1 text-center text-xs text-pretty" style={{ color: 'var(--muted)' }}>
          {kind === 'market'
            ? `Market swaps are routed through a third-party swap provider${
                provider ? ` (${provider})` : ''
              } that can change by route. You are subject to the provider's terms. This is Arc Testnet.`
            : 'USDC and rUSDC swaps are settled directly by the ArcPool contract, with no slippage.'}
        </p>
      </section>
    </div>
  )
}
