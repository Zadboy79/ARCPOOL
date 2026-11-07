import { useMemo, useState } from 'react'
import { erc20Abi } from 'viem'
import { useAccount, useWriteContract } from 'wagmi'
import { Amount } from '@/onchain-money'
import { CHAIN_ID, POOL_ADDRESS, USDC_ADDRESS, USDC_DECIMALS, poolAbi } from '@/lib/pool'
import { formatDuration, formatFixed } from '@/lib/format'
import { useTxFlow } from '@/hooks/useTxFlow'
import type { PoolData } from '@/hooks/usePoolData'
import { AmountField } from './AmountField'
import { UsdcIcon } from './TokenIcons'
import { TxButton } from './TxButton'

export function RewardsCard({ data, refetch }: { data: PoolData; refetch: () => void }) {
  const { address } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const flow = useTxFlow(refetch)
  const [input, setInput] = useState('')

  const amount = useMemo(() => {
    if (input === '' || input === '.') return 0n
    try {
      return Amount.parse(input, USDC_DECIMALS).raw
    } catch {
      return null
    }
  }, [input])
  const hasAmount = amount !== null && amount > 0n

  const noStakers = data.totalSupply !== undefined && data.totalSupply === 0n
  const needsApproval = hasAmount && (data.allowance ?? 0n) < amount
  const insufficient = hasAmount && data.usdcBalance !== undefined && amount > data.usdcBalance

  async function onAction() {
    if (!hasAmount) return
    if (needsApproval) {
      await flow.run('USDC allowed', () =>
        writeContractAsync({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          chainId: CHAIN_ID,
          functionName: 'approve',
          args: [POOL_ADDRESS, amount],
        }),
      )
      return
    }
    const ok = await flow.run('Rewards added. They now stream to stakers.', () =>
      writeContractAsync({
        address: POOL_ADDRESS,
        abi: poolAbi,
        chainId: CHAIN_ID,
        functionName: 'addRewards',
        args: [amount],
      }),
    )
    if (ok) setInput('')
  }

  const period = data.vestingPeriod !== undefined ? formatDuration(Number(data.vestingPeriod)) : 'the vesting window'
  const balanceText = noStakers
    ? 'Rewards open once someone has staked'
    : insufficient
      ? 'Amount exceeds your balance'
      : amount === null
        ? `Use at most ${USDC_DECIMALS} decimal places`
        : data.usdcBalance !== undefined
          ? `Balance: ${formatFixed(data.usdcBalance, USDC_DECIMALS, 4)} USDC`
          : address
            ? 'Loading balance...'
            : 'Connect a wallet to see your balance'

  return (
    <section className="card p-6" aria-labelledby="add-rewards-title">
      <h2 id="add-rewards-title" className="text-lg font-extrabold" style={{ color: 'var(--text)' }}>
        Add rewards
      </h2>
      <p className="mb-4 mt-1 text-sm text-pretty" style={{ color: 'var(--text-2)' }}>
        Anyone can fund staker rewards. USDC you add streams to current stakers over about {period}, raising the value
        of every rUSDC. You cannot get it back.
      </p>

      <AmountField
        value={input}
        onChange={setInput}
        symbol="USDC"
        icon={<UsdcIcon />}
        balanceText={balanceText}
        invalid={insufficient || amount === null}
      />

      <div className="mt-4">
        <TxButton
          label={!hasAmount ? 'Enter an amount' : needsApproval ? 'Allow USDC' : 'Add rewards'}
          onClick={onAction}
          phase={flow.phase}
          isConnected={flow.isConnected}
          wrongChain={flow.wrongChain}
          isSwitching={flow.isSwitching}
          onSwitch={flow.switchToArc}
          disabled={!hasAmount || insufficient || noStakers}
        />
      </div>
    </section>
  )
}
