import { useMemo, useState } from 'react'
import { erc20Abi } from 'viem'
import { useAccount, useReadContract, useWriteContract } from 'wagmi'
import { Amount, parseUsdc } from '@/onchain-money'
import { CHAIN_ID, POOL_ADDRESS, SHARE_DECIMALS, USDC_ADDRESS, USDC_DECIMALS, poolAbi } from '@/lib/pool'
import { formatFixed } from '@/lib/format'
import { useTxFlow } from '@/hooks/useTxFlow'
import type { PoolData } from '@/hooks/usePoolData'

export type ConvertMode = 'stake' | 'unstake'

/** Keeps a little USDC back when staking "Max" so the wallet can still pay network fees. */
const FEE_RESERVE = parseUsdc('0.1')

/**
 * Shared stake / unstake logic: parses the amount, previews the result from the
 * pool, handles the one-time USDC allowance and sends the real transaction.
 */
export function useConvert(
  mode: ConvertMode,
  data: PoolData,
  refetch: () => void,
  controlled?: { input: string; setInput: (value: string) => void },
) {
  const { address } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const flow = useTxFlow(refetch)
  const [innerInput, setInnerInput] = useState('')
  const input = controlled ? controlled.input : innerInput
  const setInput = controlled ? controlled.setInput : setInnerInput

  const decimals = mode === 'stake' ? USDC_DECIMALS : SHARE_DECIMALS
  const amount = useMemo(() => {
    if (input === '' || input === '.') return 0n
    try {
      return Amount.parse(input, decimals).raw
    } catch {
      return null
    }
  }, [input, decimals])
  const hasAmount = amount !== null && amount > 0n

  const depositPreview = useReadContract({
    address: POOL_ADDRESS,
    abi: poolAbi,
    chainId: CHAIN_ID,
    functionName: 'previewDeposit',
    args: [amount ?? 0n],
    query: { enabled: mode === 'stake' && hasAmount },
  })
  const redeemPreview = useReadContract({
    address: POOL_ADDRESS,
    abi: poolAbi,
    chainId: CHAIN_ID,
    functionName: 'previewRedeem',
    args: [amount ?? 0n],
    query: { enabled: mode === 'unstake' && hasAmount },
  })
  const preview = hasAmount ? (mode === 'stake' ? depositPreview.data : redeemPreview.data) : undefined
  const previewDecimals = mode === 'stake' ? SHARE_DECIMALS : USDC_DECIMALS

  const balance = mode === 'stake' ? data.usdcBalance : data.maxRedeem
  const symbol = mode === 'stake' ? 'USDC' : 'rUSDC'
  const needsApproval = mode === 'stake' && hasAmount && (data.allowance ?? 0n) < amount

  let problem: string | null = null
  if (amount === null) problem = `Use at most ${decimals} decimal places`
  else if (hasAmount && balance !== undefined && amount > balance) problem = 'Amount exceeds your balance'
  else if (mode === 'stake' && hasAmount && data.paused) problem = 'Staking is paused. You can still unstake.'
  else if (mode === 'stake' && hasAmount && data.maxDeposit !== undefined && amount > data.maxDeposit) {
    problem = 'Amount exceeds remaining pool capacity'
  }

  const balanceText =
    balance === undefined
      ? address
        ? 'Loading balance...'
        : 'Connect a wallet to see your balance'
      : `Balance: ${formatFixed(balance, decimals, 4)} ${symbol}`

  function setMax() {
    if (mode === 'stake') {
      const bal = data.usdcBalance ?? 0n
      const max = bal > FEE_RESERVE ? bal - FEE_RESERVE : 0n
      setInput(Amount.fromRaw(max, USDC_DECIMALS).toString())
    } else {
      setInput(Amount.fromRaw(data.maxRedeem ?? 0n, SHARE_DECIMALS).toString())
    }
  }

  async function onAction() {
    if (!hasAmount || !address) return
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
    const ok =
      mode === 'stake'
        ? await flow.run('Staked. rUSDC is in your wallet.', () =>
            writeContractAsync({
              address: POOL_ADDRESS,
              abi: poolAbi,
              chainId: CHAIN_ID,
              functionName: 'deposit',
              args: [amount, address],
            }),
          )
        : await flow.run('Unstaked. USDC is back in your wallet.', () =>
            writeContractAsync({
              address: POOL_ADDRESS,
              abi: poolAbi,
              chainId: CHAIN_ID,
              functionName: 'redeem',
              args: [amount, address, address],
            }),
          )
    if (ok) setInput('')
  }

  const ctaLabel = !hasAmount
    ? 'Enter an amount'
    : needsApproval
      ? 'Allow USDC'
      : mode === 'stake'
        ? 'Stake USDC'
        : 'Unstake rUSDC'

  return {
    input,
    setInput,
    amount,
    hasAmount,
    preview,
    previewDecimals,
    symbol,
    balance,
    balanceText,
    problem,
    needsApproval,
    ctaLabel,
    setMax,
    onAction,
    flow,
    canSubmit: hasAmount && problem === null,
  }
}
