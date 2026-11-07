import { ExternalLink } from 'lucide-react'
import { useWriteContract } from 'wagmi'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { CHAIN_ID, POOL_ADDRESS, SHARE_DECIMALS, USDC_DECIMALS, poolAbi } from '@/lib/pool'
import { formatFixed } from '@/lib/format'
import { Link } from '@/lib/router'
import { useTxFlow } from '@/hooks/useTxFlow'
import { usePosition } from '@/hooks/usePosition'
import type { PoolData } from '@/hooks/usePoolData'
import { TxButton } from './TxButton'

/** Smallest reward worth a transaction: 0.0001 USDC. */
const MIN_CLAIM = 100n

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'success' }) {
  return (
    <div className="well p-4">
      <dt className="text-xs" style={{ color: 'var(--muted)' }}>
        {label}
      </dt>
      <dd
        className="mt-1 text-lg font-extrabold tabular-nums sm:text-xl"
        style={{ color: tone === 'success' ? 'var(--success)' : 'var(--text)' }}
      >
        {value}
      </dd>
    </div>
  )
}

interface PositionCardProps {
  data: PoolData
  refetch: () => void
  /** On the Stake page the card stays out of the way until a wallet is connected. */
  hideWhenDisconnected?: boolean
}

export function PositionCard({ data, refetch, hideWhenDisconnected }: PositionCardProps) {
  const position = usePosition(data)
  const { writeContractAsync } = useWriteContract()
  const flow = useTxFlow(refetch)
  const { address } = position

  if (!address && hideWhenDisconnected) return null

  const dash = address ? '...' : '--'
  const usdc = (raw?: bigint) => (raw === undefined ? dash : `${formatFixed(raw, USDC_DECIMALS, 4)} USDC`)
  const claimable = position.claimable ?? 0n
  const canClaim = claimable >= MIN_CLAIM

  async function claim() {
    if (!address || !canClaim) return
    await flow.run('Rewards claimed. Your original stake stays in the pool.', () =>
      writeContractAsync({
        address: POOL_ADDRESS,
        abi: poolAbi,
        chainId: CHAIN_ID,
        functionName: 'withdraw',
        // Rounded down by one unit so rounding can never ask for more than the position holds.
        args: [claimable - 1n, address, address],
      }),
    )
  }

  return (
    <section className="card p-6" aria-label="Your position">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-extrabold" style={{ color: 'var(--text)' }}>
          Your position
        </h2>
        {hideWhenDisconnected ? (
          <Link to="/rewards" className="link text-xs">
            Reward history
          </Link>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <Stat label="Staked value" value={address ? usdc(position.stakedValue) : '--'} />
        <Stat
          label="rUSDC balance"
          value={address ? `${formatFixed(position.shares, SHARE_DECIMALS, 4)} rUSDC` : '--'}
        />
        <Stat label="Original stake" value={position.principal !== undefined ? usdc(position.principal) : dash} />
        <Stat
          label="Rewards earned"
          value={position.earned === undefined ? dash : usdc(position.earned)}
          tone={position.earned !== undefined && position.earned > 0n ? 'success' : undefined}
        />
      </dl>

      <div className="well mt-3 flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Ready to claim
          </p>
          <p className="mt-1 text-lg font-extrabold tabular-nums" style={{ color: canClaim ? 'var(--success)' : 'var(--text)' }}>
            {address ? usdc(claimable) : '--'}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <TxButton
          label={canClaim ? 'Claim rewards' : address ? 'No rewards to claim yet' : 'Claim rewards'}
          onClick={claim}
          phase={flow.phase}
          isConnected={flow.isConnected}
          wrongChain={flow.wrongChain}
          isSwitching={flow.isSwitching}
          onSwitch={flow.switchToArc}
          disabled={!canClaim}
        />
      </div>

      <p className="mt-3 text-xs text-pretty" style={{ color: 'var(--muted)' }}>
        {address
          ? 'Rewards are already inside your rUSDC, so there is nothing you must claim. Claiming withdraws only the earned USDC and keeps your original stake earning. To take everything out, use Withdrawals. Figures are estimated from your deposits and withdrawals in this pool.'
          : 'Connect a wallet to see how much you have staked and earned.'}
      </p>

      {flow.lastHash ? (
        <a
          href={buildTxExplorerUrl(CHAIN_ID, flow.lastHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="link mt-3 inline-flex items-center gap-1 text-xs"
        >
          Latest transaction <ExternalLink className="size-3" />
        </a>
      ) : null}
    </section>
  )
}
