import { parseAbi } from 'viem'
import { useAccount, useReadContract, useWriteContract } from 'wagmi'
import { CHAIN_ID, LEGACY_POOL_ADDRESS, SHARE_DECIMALS, USDC_DECIMALS } from '@/lib/pool'
import { formatFixed } from '@/lib/format'
import { useTxFlow } from '@/hooks/useTxFlow'
import { TxButton } from './TxButton'

const legacyAbi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function previewRedeem(uint256) view returns (uint256)',
  'function redeem(uint256 shares, address receiver, address owner) returns (uint256)',
])

/** Lets anyone who staked in the first ArcPool deployment withdraw from it. Hidden when there is nothing to withdraw. */
export function LegacyPoolCard({ onDone }: { onDone: () => void }) {
  const { address } = useAccount()
  const { writeContractAsync } = useWriteContract()

  const shares = useReadContract({
    address: LEGACY_POOL_ADDRESS,
    abi: legacyAbi,
    chainId: CHAIN_ID,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: LEGACY_POOL_ADDRESS !== undefined && address !== undefined, refetchInterval: 10_000 },
  })
  const balance = shares.data
  const value = useReadContract({
    address: LEGACY_POOL_ADDRESS,
    abi: legacyAbi,
    chainId: CHAIN_ID,
    functionName: 'previewRedeem',
    args: balance !== undefined ? [balance] : undefined,
    query: { enabled: balance !== undefined && balance > 0n },
  })

  const flow = useTxFlow(() => {
    void shares.refetch()
    onDone()
  })

  if (!LEGACY_POOL_ADDRESS || !address || balance === undefined || balance === 0n) return null

  const legacy = LEGACY_POOL_ADDRESS
  const owner = address
  const redeemShares = balance

  async function withdrawAll() {
    await flow.run('Withdrawn from the previous ArcPool.', () =>
      writeContractAsync({
        address: legacy,
        abi: legacyAbi,
        chainId: CHAIN_ID,
        functionName: 'redeem',
        args: [redeemShares, owner, owner],
      }),
    )
  }

  return (
    <section className="card mt-4 p-6" aria-labelledby="legacy-title">
      <h2 id="legacy-title" className="text-base font-extrabold" style={{ color: 'var(--text)' }}>
        You still have rUSDC in the previous ArcPool
      </h2>
      <p className="mt-1 text-sm text-pretty" style={{ color: 'var(--text-2)' }}>
        ArcPool moved to a new contract that earns from vaults. Your rUSDC in the old pool is worth{' '}
        <strong className="tabular-nums" style={{ color: 'var(--text)' }}>
          {value.data !== undefined ? `${formatFixed(value.data, USDC_DECIMALS, 4)} USDC` : '...'}
        </strong>{' '}
        ({formatFixed(balance, SHARE_DECIMALS, 4)} rUSDC). Withdraw it, then stake again here.
      </p>
      <div className="mt-4">
        <TxButton
          label="Withdraw from previous pool"
          onClick={withdrawAll}
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
