import { useMemo } from 'react'
import { erc20Abi, zeroAddress } from 'viem'
import { useAccount, useReadContracts } from 'wagmi'
import { CHAIN_ID, POOL_ADDRESS, SECONDS_PER_YEAR, USDC_ADDRESS, poolAbi } from '@/lib/pool'

export interface PoolData {
  totalAssets?: bigint
  totalSupply?: bigint
  exchangeRate?: bigint
  totalRewardsDistributed?: bigint
  lockedRewards?: bigint
  vestEnd?: bigint
  vestingPeriod?: bigint
  paused?: boolean
  commissionBps?: number
  idleAssets?: bigint
  deployed?: bigint
  pendingYield?: bigint
  rebalanceAmount?: bigint
  totalYieldHarvested?: bigint
  bufferBps?: number
  vaultCount?: number
  maxDeposit?: bigint
  shareBalance?: bigint
  maxRedeem?: bigint
  usdcBalance?: bigint
  allowance?: bigint
  /** Annualised rate of the reward stream currently vesting, in basis points. */
  streamAprBps?: bigint
}

export function usePoolData() {
  const { address } = useAccount()
  const user = address ?? zeroAddress
  const pool = { address: POOL_ADDRESS, abi: poolAbi, chainId: CHAIN_ID } as const

  const query = useReadContracts({
    contracts: [
      { ...pool, functionName: 'totalAssets' },
      { ...pool, functionName: 'totalSupply' },
      { ...pool, functionName: 'exchangeRate' },
      { ...pool, functionName: 'totalRewardsDistributed' },
      { ...pool, functionName: 'lockedRewards' },
      { ...pool, functionName: 'vestEnd' },
      { ...pool, functionName: 'vestingPeriod' },
      { ...pool, functionName: 'paused' },
      { ...pool, functionName: 'maxDeposit', args: [user] },
      { ...pool, functionName: 'balanceOf', args: [user] },
      { ...pool, functionName: 'maxRedeem', args: [user] },
      { address: USDC_ADDRESS, abi: erc20Abi, chainId: CHAIN_ID, functionName: 'balanceOf', args: [user] },
      { address: USDC_ADDRESS, abi: erc20Abi, chainId: CHAIN_ID, functionName: 'allowance', args: [user, POOL_ADDRESS] },
      { ...pool, functionName: 'commissionBps' },
      { ...pool, functionName: 'idleAssets' },
      { ...pool, functionName: 'deployed' },
      { ...pool, functionName: 'pendingYield' },
      { ...pool, functionName: 'rebalanceAmount' },
      { ...pool, functionName: 'totalYieldHarvested' },
      { ...pool, functionName: 'bufferBps' },
      { ...pool, functionName: 'vaultsLength' },
    ],
    query: { refetchInterval: 15_000 },
  })

  const data: PoolData = useMemo(() => {
    const rows = query.data
    const pick = <T,>(index: number): T | undefined => {
      const row = rows?.[index]
      return row && row.status === 'success' ? (row.result as T) : undefined
    }
    const totalAssets = pick<bigint>(0)
    const lockedRewards = pick<bigint>(4)
    const vestEnd = pick<bigint>(5)
    const now = BigInt(Math.floor(query.dataUpdatedAt / 1000))

    let streamAprBps: bigint | undefined
    if (totalAssets !== undefined && lockedRewards !== undefined && vestEnd !== undefined) {
      const remaining = vestEnd > now ? vestEnd - now : 0n
      streamAprBps =
        remaining > 0n && totalAssets > 0n && lockedRewards > 0n
          ? (lockedRewards * SECONDS_PER_YEAR * 10_000n) / (remaining * totalAssets)
          : 0n
    }

    const hasUser = address !== undefined
    return {
      totalAssets,
      totalSupply: pick<bigint>(1),
      exchangeRate: pick<bigint>(2),
      totalRewardsDistributed: pick<bigint>(3),
      lockedRewards,
      vestEnd,
      vestingPeriod: pick<bigint>(6),
      paused: pick<boolean>(7),
      maxDeposit: hasUser ? pick<bigint>(8) : undefined,
      shareBalance: hasUser ? pick<bigint>(9) : undefined,
      maxRedeem: hasUser ? pick<bigint>(10) : undefined,
      usdcBalance: hasUser ? pick<bigint>(11) : undefined,
      allowance: hasUser ? pick<bigint>(12) : undefined,
      commissionBps: pick<number>(13),
      idleAssets: pick<bigint>(14),
      deployed: pick<bigint>(15),
      pendingYield: pick<bigint>(16),
      rebalanceAmount: pick<bigint>(17),
      totalYieldHarvested: pick<bigint>(18),
      bufferBps: pick<number>(19),
      vaultCount: (() => {
        const n = pick<bigint>(20)
        return n === undefined ? undefined : Number(n)
      })(),
      streamAprBps,
    }
  }, [query.data, query.dataUpdatedAt, address])

  return { data, isLoading: query.isLoading, isError: query.isError, refetch: query.refetch }
}
