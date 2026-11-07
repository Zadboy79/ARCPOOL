import type { ReactNode } from 'react'
import type { SwapEstimate } from '@circle-fin/app-kit'

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

function rateText(estimate: SwapEstimate): string {
  const amountIn = Number(estimate.amountIn)
  const amountOut = Number(estimate.estimatedOutput.amount)
  if (!(amountIn > 0) || !Number.isFinite(amountOut)) return '--'
  const rate = amountOut / amountIn
  const digits = rate >= 100 ? 2 : rate >= 1 ? 4 : 8
  return `1 ${estimate.tokenIn} = ${rate.toFixed(digits)} ${estimate.tokenOut}`
}

export function RouteDetails({ estimate, slippageBps }: { estimate: SwapEstimate; slippageBps: number }) {
  const route = estimate.route
  return (
    <dl className="well mt-3 divide-y px-4 py-1" style={{ borderColor: 'var(--border)' }}>
      <Row label="Rate">{rateText(estimate)}</Row>
      <Row label={`Minimum received (${(slippageBps / 100).toFixed(1)}% slippage)`}>
        {estimate.stopLimit.amount} {estimate.stopLimit.token}
      </Row>
      {estimate.fees && estimate.fees.length > 0 ? (
        <Row label="Fees">
          {estimate.fees.map((fee, index) => (
            <span key={`${fee.type}-${index}`} className="block">
              {fee.amount} {fee.token} <span style={{ color: 'var(--muted)' }}>({fee.type})</span>
            </span>
          ))}
        </Row>
      ) : null}
      {route ? (
        <Row label="Route">
          <span className="block uppercase">{route.provider}</span>
          {route.steps.map((step, index) => (
            <span key={`${step.tool}-${index}`} className="block text-xs font-medium" style={{ color: 'var(--text-2)' }}>
              {step.toolName}: {step.fromToken.symbol} to {step.toToken.symbol}
            </span>
          ))}
        </Row>
      ) : null}
    </dl>
  )
}
