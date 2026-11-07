import { Sprout } from 'lucide-react'
import { useWriteContract } from 'wagmi'
import { CHAIN_ID, POOL_ADDRESS, USDC_DECIMALS, poolAbi } from '@/lib/pool'
import { formatFixed } from '@/lib/format'
import { useTxFlow } from '@/hooks/useTxFlow'
import type { PoolData } from '@/hooks/usePoolData'
import { TxButton } from './TxButton'

/**
 * Nothing runs the pool automatically: idle USDC is only lent to the vaults, and vault yield is only turned
 * into rewards, when someone sends an update. This banner shows when there is work waiting.
 */
export function UpdatePoolBanner({ data, refetch }: { data: PoolData; refetch: () => unknown }) {
  const { writeContractAsync } = useWriteContract()
  const flow = useTxFlow(refetch)

  const lendable = data.rebalanceAmount ?? 0n
  const pending = data.pendingYield ?? 0n
  if (lendable === 0n && pending === 0n) return null

  const usdc = (raw: bigint, digits = 2) => `${formatFixed(raw, USDC_DECIMALS, digits)} USDC`

  async function updatePool() {
    await flow.run('Pool updated. Idle USDC was lent out and vault yield was harvested.', () =>
      writeContractAsync({ address: POOL_ADDRESS, abi: poolAbi, chainId: CHAIN_ID, functionName: 'sync' }),
    )
  }

  return (
    <section
      className="card mt-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center"
      aria-label="Pool needs an update"
    >
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-full"
        style={{ background: 'rgba(0,163,255,0.14)', color: 'var(--primary)' }}
      >
        <Sprout className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
          {lendable > 0n ? `${usdc(lendable)} is idle and not earning yet` : `${usdc(pending, 4)} of vault yield is waiting`}
        </p>
        <p className="mt-1 text-xs text-pretty" style={{ color: 'var(--text-2)' }}>
          Nothing updates the pool by itself. Anyone can send the update: it lends idle USDC to the vaults
          {pending > 0n ? ` and starts streaming ${usdc(pending, 4)} of waiting yield to stakers` : ''}.
        </p>
      </div>
      <div className="sm:w-44">
        <TxButton
          label="Update pool"
          onClick={updatePool}
          phase={flow.phase}
          isConnected={flow.isConnected}
          wrongChain={flow.wrongChain}
          isSwitching={flow.isSwitching}
          onSwitch={flow.switchToArc}
        />
      </div>
    </section>
  )
}
