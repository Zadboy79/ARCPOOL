import { useMemo } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { CHAIN_ID, POOL_ADDRESS, poolAbi } from '@/lib/pool'
import { usePoolEvents } from '@/hooks/usePoolEvents'
import type { PoolData } from '@/hooks/usePoolData'

/**
 * One wallet's position in the pool: what it is worth now, what went in and out, and the part that is
 * pure reward. Deposits and withdrawals come from pool events, so rUSDC received by transfer is not counted.
 */
export function usePosition(data: PoolData) {
  const { address } = useAccount()
  const events = usePoolEvents({ enabled: address !== undefined })
  const shares = data.shareBalance ?? 0n

  const value = useReadContract({
    address: POOL_ADDRESS,
    abi: poolAbi,
    chainId: CHAIN_ID,
    functionName: 'previewRedeem',
    args: [shares],
    query: { enabled: shares > 0n, refetchInterval: 15_000 },
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

  const principal = totals ? (totals.deposited > totals.withdrawn ? totals.deposited - totals.withdrawn : 0n) : undefined
  /** Total reward earned so far, claimed or not. */
  const earned = totals && stakedValue !== undefined ? stakedValue + totals.withdrawn - totals.deposited : undefined
  /** Reward still sitting inside the position: what it is worth beyond the USDC still put in. */
  const claimable =
    principal !== undefined && stakedValue !== undefined && stakedValue > principal ? stakedValue - principal : 0n

  return {
    address,
    shares,
    stakedValue,
    totals,
    principal,
    earned: earned !== undefined && earned < 0n ? 0n : earned,
    claimable: principal === undefined || stakedValue === undefined ? undefined : claimable,
    isLoading: events.isLoading || (shares > 0n && value.isLoading),
  }
}
