import { useMemo } from 'react'
import { USDC_DECIMALS } from '@/lib/pool'
import { formatFixed, shortAddress } from '@/lib/format'
import { formatEventTime, usePoolEvents } from '@/hooks/usePoolEvents'
import { HistoryCard, type HistoryRow } from '@/components/HistoryCard'
import { PageTitle } from '@/components/PageTitle'
import { PositionCard } from '@/components/PositionCard'
import { RewardsCard } from '@/components/RewardsCard'
import type { PageProps } from './types'

export function RewardsPage({ data, refetch }: PageProps) {
  const events = usePoolEvents()

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

  return (
    <div className="page-col">
      <PageTitle title="Rewards" subtitle="Track what your rUSDC has earned and see rewards added to the pool" />

      <PositionCard data={data} refetch={refetch} />

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
