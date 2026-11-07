import { ExternalLink } from 'lucide-react'
import { useWriteContract } from 'wagmi'
import { buildAddressExplorerUrl } from '@/onchain-facts'
import { CHAIN_ID, POOL_ADDRESS, USDC_DECIMALS, poolAbi } from '@/lib/pool'
import { formatFixed, shortAddress } from '@/lib/format'
import { useTxFlow } from '@/hooks/useTxFlow'
import { useVaults } from '@/hooks/useVaults'
import type { PoolData } from '@/hooks/usePoolData'
import { TxButton } from './TxButton'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="well p-4">
      <dt className="text-xs" style={{ color: 'var(--muted)' }}>
        {label}
      </dt>
      <dd className="mt-1 text-base font-extrabold tabular-nums sm:text-lg" style={{ color: 'var(--text)' }}>
        {value}
      </dd>
    </div>
  )
}

interface StrategyPanelProps {
  data: PoolData
  refetch: () => void
  title?: string
}

export function StrategyPanel({ data, refetch, title = 'Where rewards come from' }: StrategyPanelProps) {
  const { vaults, isLoading, metaFailed } = useVaults(data.vaultCount)
  const { writeContractAsync } = useWriteContract()
  const flow = useTxFlow(refetch)

  const usdc = (raw: bigint | undefined, digits = 2) =>
    raw === undefined ? '--' : `${formatFixed(raw, USDC_DECIMALS, digits)} USDC`
  const deployed = data.deployed ?? 0n
  const buffer = data.bufferBps !== undefined ? data.bufferBps / 100 : undefined

  async function updatePool() {
    await flow.run('Pool updated. Yield was harvested and idle USDC was lent out.', () =>
      writeContractAsync({
        address: POOL_ADDRESS,
        abi: poolAbi,
        chainId: CHAIN_ID,
        functionName: 'sync',
      }),
    )
  }

  return (
    <section className="mt-12" aria-labelledby="strategy-title">
      <h2 id="strategy-title" className="mb-1 text-xl font-extrabold" style={{ color: 'var(--text)' }}>
        {title}
      </h2>
      <p className="mb-4 text-sm text-pretty" style={{ color: 'var(--text-2)' }}>
        ArcPool lends idle USDC to the Arc Testnet vaults below
        {buffer !== undefined ? ` and keeps about ${buffer}% idle for withdrawals` : ''}. Their gains are harvested into
        the reward stream.
      </p>

      <div className="card p-6">
        <ul className="divide-y" aria-label="Vaults">
          {vaults.length === 0 ? (
            <li className="py-4 text-sm" style={{ color: 'var(--muted)' }}>
              {isLoading || data.vaultCount === undefined ? 'Loading vaults...' : 'No vaults found.'}
            </li>
          ) : (
            vaults.map((vault) => {
              const share = deployed > 0n ? Number((vault.allocated * 10_000n) / deployed) / 100 : 0
              return (
                <li key={vault.address} className="flex flex-col items-start justify-between gap-2 py-4 first:pt-0 sm:flex-row sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-bold" style={{ color: 'var(--text)' }}>
                      {vault.name ?? `Vault ${vault.index + 1}`}
                      {vault.protocol ? (
                        <span
                          className="rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
                          style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}
                        >
                          {vault.protocol}
                        </span>
                      ) : null}
                    </p>
                    <a
                      href={buildAddressExplorerUrl(CHAIN_ID, vault.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link mono mt-1 inline-flex items-center gap-1 text-xs"
                    >
                      {shortAddress(vault.address)} <ExternalLink className="size-3" />
                    </a>
                    {vault.reportedApy !== undefined ? (
                      <p className="mt-1 text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
                        {(vault.reportedApy * 100).toFixed(1)}% APY reported by Circle Earn
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 sm:text-right">
                    <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--text)' }}>
                      {usdc(vault.allocated)}
                    </p>
                    <p className="mt-0.5 text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
                      {deployed > 0n ? `${share.toFixed(0)}% of lent funds` : 'Nothing lent yet'}
                    </p>
                  </div>
                </li>
              )
            })
          )}
        </ul>

        <dl className="mt-4 grid grid-cols-2 gap-3">
          <Stat label="Idle in pool" value={usdc(data.idleAssets)} />
          <Stat label="Lent to vaults" value={usdc(data.deployed)} />
          <Stat label="Pending vault yield" value={usdc(data.pendingYield, 4)} />
          <Stat label="Harvested, all time" value={usdc(data.totalYieldHarvested, 4)} />
        </dl>

        <p className="mt-4 text-xs text-pretty" style={{ color: 'var(--muted)' }}>
          The APY figure is what Circle Earn reports for each vault. Stakers earn only when a vault's share price actually
          rises onchain, and that is what "Pending vault yield" shows. Right now there may be none.
          {metaFailed ? ' Vault names could not be loaded.' : ''}
        </p>

        <div className="mt-4">
          <TxButton
            label="Update pool"
            onClick={updatePool}
            phase={flow.phase}
            isConnected={flow.isConnected}
            wrongChain={flow.wrongChain}
            isSwitching={flow.isSwitching}
            onSwitch={flow.switchToArc}
          />
          <p className="mt-2 text-center text-xs" style={{ color: 'var(--muted)' }}>
            Anyone can run this. It harvests vault yield and lends out USDC above the idle buffer
            {data.rebalanceAmount !== undefined && data.rebalanceAmount > 0n
              ? ` (${usdc(data.rebalanceAmount)} ready to lend).`
              : '.'}
          </p>
        </div>
      </div>
    </section>
  )
}
