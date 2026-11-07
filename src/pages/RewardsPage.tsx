import { useMemo } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { CHAIN_ID, POOL_ADDRESS, SHARE_DECIMALS, USDC_DECIMALS, poolAbi } from '@/lib/pool'
import { formatFixed, shortAddress } from '@/lib/format'
import { formatEventTime, usePoolEvents } from '@/hooks/usePoolEvents'
import { HistoryCard, type HistoryRow } from '@/components/HistoryCard'
import { PageTitle } from '@/components/PageTitle'
import { RewardsCard } from '@/components/RewardsCard'
import type { PageProps } from './types'

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'success' }) {
  return (
    <div className="well p-4">
      <dt className="text-xs" style={{ color: 'var(--muted)' }}>
        {label}
      </dt>
      <dd
        className="mt-1 text-xl font-extrabold tabular-nums"
        style={{ color: tone === 'success' ? 'var(--success)' : 'var(--text)' }}
      >
        {value}
      </dd>
    </div>
  )
}

export function RewardsPage({ data, refetch }: PageProps) {
  const { address } = useAccount()
  const events = usePoolEvents()
  const shares = data.shareBalance ?? 0n

  const value = useReadContract({
    address: POOL_ADDRESS,
    abi: poolAbi,
    chainId: CHAIN_ID,
    functionName: 'previewRedeem',
    args: [shares],
    query: { enabled: shares > 0n, refetchInterval: 6_000 },
  })
  const stakedValue = shares > 0n ? value.data : 0n

  const totals = useMemo(() => {
    const state = events.data
    if (!state || !address) return undefined
    const mine = address.toLowerCase()
    let deposited = 0n
    let withdrawn = 0n
    for (const e of state.events) {
      if (e.kind === 'deposit' && e.owner.toLowerCase() === mine) deposited += e.assets
      if (e.kind === 'withdraw' && e.owner.toLowerCase() === mine) withdrawn += e.assets
    }
    return { deposited, withdrawn }
  }, [events.data, address])

  const earned =
    totals && stakedValue !== undefined ? stakedValue + totals.withdrawn - totals.deposited : undefined

  const rewardRows: HistoryRow[] = useMemo(() => {
    const state = events.data
    if (!state) return []
    return state.events
      .flatMap((e): HistoryRow[] =>
        e.kind === 'reward'
          ? [
              {
                id: `${e.txHash}-${e.logIndex}`,
                time: formatEventTime(state.times, e.block),
                title: `${formatFixed(e.amount, USDC_DECIMALS, 4)} USDC added`,
                detail: `by ${shortAddress(e.funder)}`,
                txHash: e.txHash,
              },
            ]
          : e.kind === 'harvest'
            ? [
                {
                  id: `${e.txHash}-${e.logIndex}`,
                  time: formatEventTime(state.times, e.block),
                  title: `${formatFixed(e.gain, USDC_DECIMALS, 4)} USDC vault yield`,
                  detail: `harvested by ${shortAddress(e.caller)}`,
                  txHash: e.txHash,
                },
              ]
            : [],
      )
      .reverse()
      .slice(0, 20)
  }, [events.data])

  const dash = address ? '...' : '--'
  const usdc = (raw?: bigint) => (raw === undefined ? dash : `${formatFixed(raw, USDC_DECIMALS, 4)} USDC`)

  return (
    <div className="page-col">
      <PageTitle title="Rewards" subtitle="Track what your rUSDC has earned and see rewards added to the pool" />

      <section className="card p-6" aria-label="Your rewards">
        <dl className="grid grid-cols-2 gap-3">
          <Stat label="Staked value" value={address ? usdc(stakedValue) : '--'} />
          <Stat label="rUSDC balance" value={address ? `${formatFixed(shares, SHARE_DECIMALS, 4)} rUSDC` : '--'} />
          <Stat label="Net deposited" value={totals ? usdc(totals.deposited - totals.withdrawn) : dash} />
          <Stat
            label="Rewards earned (estimate)"
            value={earned === undefined ? dash : usdc(earned < 0n ? 0n : earned)}
            tone={earned !== undefined && earned > 0n ? 'success' : undefined}
          />
        </dl>
        <p className="mt-4 text-xs text-pretty" style={{ color: 'var(--muted)' }}>
          {address
            ? 'Estimated from your deposits and withdrawals in this pool. rUSDC received by transfer is not counted.'
            : 'Connect a wallet to see your rewards.'}
        </p>
      </section>

      <div className="mt-6">
        <RewardsCard data={data} refetch={refetch} />
      </div>

      <HistoryCard
        title="Rewards and vault yield added to the pool"
        rows={rewardRows}
        isLoading={events.isLoading}
        isError={events.isError}
        emptyText="No rewards or vault yield have been added yet."
      />
    </div>
  )
}
