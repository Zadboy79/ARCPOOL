import { buildAddressExplorerUrl } from '@/onchain-facts'
import { CHAIN_ID, POOL_ADDRESS, SHARE_DECIMALS, USDC_DECIMALS } from '@/lib/pool'
import { formatApr, formatDuration, formatFixed } from '@/lib/format'
import type { PoolData } from '@/hooks/usePoolData'

function Row({ label, value, tone }: { label: string; value: string; tone?: 'success' }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-sm" style={{ color: 'var(--text)' }}>
        {label}
      </dt>
      <dd
        className="text-right text-sm font-semibold tabular-nums"
        style={{ color: tone === 'success' ? 'var(--success)' : 'var(--text)' }}
      >
        {value}
      </dd>
    </div>
  )
}

export function StatsPanel({ data, isLoading, nowSeconds }: { data: PoolData; isLoading: boolean; nowSeconds: number }) {
  const dash = isLoading ? '...' : '--'
  const usdc = (raw?: bigint, digits = 2) => (raw === undefined ? dash : `${formatFixed(raw, USDC_DECIMALS, digits)} USDC`)

  const remaining = data.vestEnd !== undefined ? Number(data.vestEnd) - nowSeconds : 0
  const streaming = (data.lockedRewards ?? 0n) > 0n && remaining > 0
  const apr = data.streamAprBps !== undefined ? formatApr(data.streamAprBps) : dash

  return (
    <section className="mt-12" aria-labelledby="stats-title">
      <div className="mb-4 flex items-end justify-between">
        <h2 id="stats-title" className="text-xl font-extrabold" style={{ color: 'var(--text)' }}>
          Statistics of the ArcPool protocol
        </h2>
        <a
          href={buildAddressExplorerUrl(CHAIN_ID, POOL_ADDRESS)}
          target="_blank"
          rel="noopener noreferrer"
          className="link shrink-0 text-xs"
        >
          View on explorer
        </a>
      </div>
      <dl className="card divide-y px-6 py-2" style={{ borderColor: 'var(--border)' }}>
        <Row label="Reward rate (APR, current stream)" value={apr} tone={streaming ? 'success' : undefined} />
        <Row label="Total staked with ArcPool" value={usdc(data.totalAssets)} />
        <Row
          label="rUSDC supply"
          value={data.totalSupply === undefined ? dash : `${formatFixed(data.totalSupply, SHARE_DECIMALS, 2)} rUSDC`}
        />
        <Row
          label="Rewards vesting"
          value={
            data.lockedRewards === undefined
              ? dash
              : streaming
                ? `${usdc(data.lockedRewards, 4)} (${formatDuration(remaining)} left)`
                : usdc(data.lockedRewards, 4)
          }
        />
        <Row label="Lent to vaults" value={usdc(data.deployed)} />
        <Row label="Waiting to be lent" value={usdc(data.rebalanceAmount)} />
        <Row label="Vault yield waiting to be harvested" value={usdc(data.pendingYield, 4)} />
        <Row label="Vault yield harvested, all time" value={usdc(data.totalYieldHarvested, 4)} />
        <Row label="Rewards added by contributors, all time" value={usdc(data.totalRewardsDistributed)} />
        <Row label="Status" value={data.paused === undefined ? dash : data.paused ? 'Staking paused' : 'Open for staking'} />
      </dl>
      {!streaming && !isLoading ? (
        <p className="mt-3 text-xs text-pretty" style={{ color: 'var(--muted)' }}>
          No rewards are streaming right now. Rewards start when vault yield is harvested or when someone adds USDC
          rewards.
        </p>
      ) : null}
    </section>
  )
}
