import type { ReactNode } from 'react'
import type { FallbackPlan } from '@/lib/swapPlan'
import type { SwapToken } from '@/lib/tokens'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="row-label shrink-0">{label}</dt>
      <dd className="text-right text-sm font-semibold tabular-nums" style={{ color: 'var(--text)' }}>
        {children}
      </dd>
    </div>
  )
}

interface PlanDetailsProps {
  plan: FallbackPlan
  from: SwapToken
  to: SwapToken
  slippageBps: number
}

/** Review panel for a multi-swap route. Every swap needs its own wallet confirmation. */
export function PlanDetails({ plan, from, to, slippageBps }: PlanDetailsProps) {
  const swaps = plan.kind === 'via' ? 2 : plan.parts
  return (
    <>
      <dl className="well mt-3 divide-y px-4 py-1" style={{ borderColor: 'var(--border)' }}>
        <Row label="Route">
          {plan.kind === 'via' ? (
            <>
              <span className="block">
                {from.symbol} to USDC to {to.symbol}
              </span>
              <span className="block text-xs font-medium" style={{ color: 'var(--text-2)' }}>
                No direct pool, so the order goes through USDC
              </span>
            </>
          ) : (
            <>
              <span className="block">
                {plan.parts} swaps of {plan.chunk} {from.symbol}
              </span>
              <span className="block text-xs font-medium" style={{ color: 'var(--text-2)' }}>
                One pool cannot fill the whole amount, so it is split
              </span>
            </>
          )}
        </Row>
        <Row label="Wallet confirmations">{swaps}</Row>
        {plan.kind === 'split' ? (
          <Row label="Total paid">
            {plan.totalIn} {from.symbol}
          </Row>
        ) : null}
        <Row label="Estimated received">
          {plan.totalOut} {to.symbol}
        </Row>
        <Row label={`Minimum received (${(slippageBps / 100).toFixed(1)}% slippage per swap)`}>
          {plan.minOut} {to.symbol}
        </Row>
      </dl>
      <p className="mt-2 px-1 text-xs text-pretty" style={{ color: 'var(--muted)' }}>
        The swaps run one after another and you confirm each one. If a later swap fails, the earlier ones stay completed and
        you keep what they paid out.
      </p>
    </>
  )
}
