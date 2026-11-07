import { useMemo } from 'react'
import { useAccount } from 'wagmi'
import { SHARE_DECIMALS, USDC_DECIMALS } from '@/lib/pool'
import { formatFixed } from '@/lib/format'
import { useConvert } from '@/hooks/useConvert'
import { formatEventTime, usePoolEvents } from '@/hooks/usePoolEvents'
import { AmountField } from '@/components/AmountField'
import { HistoryCard, type HistoryRow } from '@/components/HistoryCard'
import { LegacyPoolCard } from '@/components/LegacyPoolCard'
import { PageTitle } from '@/components/PageTitle'
import { RusdcIcon } from '@/components/TokenIcons'
import { TxButton } from '@/components/TxButton'
import type { PageProps } from './types'

export function WithdrawalsPage({ data, refetch }: PageProps) {
  const { address } = useAccount()
  const unstake = useConvert('unstake', data, refetch)
  const events = usePoolEvents()
  const { flow } = unstake

  const rows: HistoryRow[] = useMemo(() => {
    const state = events.data
    if (!state || !address) return []
    const mine = address.toLowerCase()
    return state.events
      .flatMap((e): HistoryRow[] =>
        e.kind === 'withdraw' && e.owner.toLowerCase() === mine
          ? [
              {
                id: `${e.txHash}-${e.logIndex}`,
                time: formatEventTime(state.times, e.block),
                title: `${formatFixed(e.shares, SHARE_DECIMALS, 4)} rUSDC`,
                detail: `${formatFixed(e.assets, USDC_DECIMALS, 4)} USDC`,
                txHash: e.txHash,
              },
            ]
          : [],
      )
      .reverse()
      .slice(0, 20)
  }, [events.data, address])

  return (
    <div className="page-col">
      <PageTitle title="Withdrawals" subtitle="Unstake rUSDC and get USDC back. There is no queue. Large exits depend on the vaults having enough USDC to release." />

      <section className="card p-6">
        <AmountField
          value={unstake.input}
          onChange={unstake.setInput}
          symbol="rUSDC"
          icon={<RusdcIcon />}
          balanceText={unstake.problem ?? unstake.balanceText}
          invalid={unstake.problem !== null}
          onMax={flow.isConnected ? unstake.setMax : undefined}
        />
        <div className="mt-4">
          <TxButton
            label={unstake.ctaLabel}
            onClick={unstake.onAction}
            phase={flow.phase}
            isConnected={flow.isConnected}
            wrongChain={flow.wrongChain}
            isSwitching={flow.isSwitching}
            onSwitch={flow.switchToArc}
            disabled={!unstake.canSubmit}
          />
        </div>
        <dl className="mt-5 space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <dt className="row-label">You will receive</dt>
            <dd className="font-semibold tabular-nums" style={{ color: 'var(--text)' }}>
              {unstake.preview !== undefined ? formatFixed(unstake.preview, unstake.previewDecimals, 4) : '0.0'} USDC
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="row-label">Exchange rate</dt>
            <dd className="font-semibold tabular-nums" style={{ color: 'var(--text)' }}>
              {data.exchangeRate !== undefined ? `1 rUSDC = ${formatFixed(data.exchangeRate, USDC_DECIMALS, 6)} USDC` : '...'}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="row-label">Waiting time</dt>
            <dd className="font-semibold" style={{ color: 'var(--text)' }}>
              Instant if vaults can pay
            </dd>
          </div>
        </dl>
      </section>

      <LegacyPoolCard onDone={refetch} />

      {address ? (
        <HistoryCard
          title="Your withdrawals"
          rows={rows}
          isLoading={events.isLoading}
          isError={events.isError}
          emptyText="No withdrawals yet from this wallet."
        />
      ) : (
        <p className="mt-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Connect a wallet to see your withdrawal history.
        </p>
      )}
    </div>
  )
}
