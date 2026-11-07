import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'

/** A fair pool returns a little less than you put in (fees and spread). Beyond this gap, flag it. */
const FAIR_BAND = 0.02

interface PriceCheckProps {
  fromSymbol: string
  amountIn: string
  returned: string | undefined
  ratio: number | undefined
  isFetching: boolean
}

export function PriceCheck({ fromSymbol, amountIn, returned, ratio, isFetching }: PriceCheckProps) {
  if (ratio === undefined) {
    return isFetching ? (
      <p className="mt-3 flex items-center gap-2 px-1 text-xs" style={{ color: 'var(--muted)' }}>
        <Loader2 className="size-3 animate-spin" /> Checking this price against the reverse swap...
      </p>
    ) : null
  }

  const change = (ratio - 1) * 100
  const loses = ratio < 1 - FAIR_BAND
  const gains = ratio > 1 + FAIR_BAND

  if (!loses && !gains) {
    return (
      <p className="mt-3 flex items-center gap-2 px-1 text-xs" style={{ color: 'var(--muted)' }}>
        <CheckCircle2 className="size-3.5 shrink-0" style={{ color: 'var(--success)' }} />
        Price check passed: swapping back returns {(ratio * 100).toFixed(1)}% of your {fromSymbol}.
      </p>
    )
  }

  const tone = loses ? 'var(--danger)' : 'var(--primary)'
  return (
    <div
      role="alert"
      className="mt-3 flex items-start gap-3 rounded-xl p-3 text-xs"
      style={{ background: loses ? 'rgba(255,107,129,0.12)' : 'var(--primary-soft)', color: 'var(--text-2)' }}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" style={{ color: tone }} />
      <p className="text-pretty">
        <strong style={{ color: 'var(--text)' }}>
          {loses ? 'Wide spread on this pair.' : 'This pool prices the pair inconsistently.'}
        </strong>{' '}
        Swapping {amountIn} {fromSymbol} and then swapping straight back would return {returned} {fromSymbol} (
        {change > 0 ? '+' : ''}
        {change.toFixed(1)}%). {loses
          ? 'Try a smaller amount, or expect to lose value on the round trip.'
          : 'Testnet pools can be mispriced, so do not treat this rate as the market price.'}
      </p>
    </div>
  )
}
