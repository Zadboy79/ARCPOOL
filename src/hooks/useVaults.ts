import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { useReadContracts } from 'wagmi'
import { getKit } from '@/lib/kit'
import { CHAIN_ID, POOL_ADDRESS, poolAbi } from '@/lib/pool'

export interface VaultView {
  index: number
  address: Address
  /** USDC this pool currently has in the vault. */
  allocated: bigint
  name?: string
  protocol?: string
  /** APY as reported by Circle's Earn data. It is an estimate, not an onchain guarantee. */
  reportedApy?: number
  status?: string
}

interface VaultMeta {
  name?: string
  protocol?: string
  currentApy?: number
  status?: string
}

/** Vault names and reported APY from Circle Earn, keyed by lowercase vault address. */
function useVaultMeta() {
  return useQuery({
    queryKey: ['earn-vault-meta', CHAIN_ID],
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async (): Promise<Record<string, VaultMeta>> => {
      const kit = await getKit()
      const { vaults } = await kit.earn.exploreVaults({ chain: 'Arc_Testnet', sortBy: 'apy' })
      const result: Record<string, VaultMeta> = {}
      for (const vault of vaults) {
        result[vault.vaultAddress.toLowerCase()] = {
          name: vault.name,
          protocol: vault.protocol,
          currentApy: vault.currentApy,
          status: vault.status,
        }
      }
      return result
    },
  })
}

/** The vaults the pool lends to, with live allocation read from the pool contract. */
export function useVaults(count: number | undefined) {
  const indexes = useMemo(() => Array.from({ length: count ?? 0 }, (_, i) => i), [count])
  const pool = { address: POOL_ADDRESS, abi: poolAbi, chainId: CHAIN_ID } as const

  const reads = useReadContracts({
    contracts: indexes.flatMap((i) => [
      { ...pool, functionName: 'vaultAt' as const, args: [BigInt(i)] as const },
      { ...pool, functionName: 'vaultAssets' as const, args: [BigInt(i)] as const },
    ]),
    query: { enabled: indexes.length > 0, refetchInterval: 8_000 },
  })
  const meta = useVaultMeta()

  const vaults: VaultView[] = useMemo(() => {
    const rows = reads.data
    if (!rows) return []
    return indexes.flatMap((i): VaultView[] => {
      const addressRow = rows[i * 2]
      const assetsRow = rows[i * 2 + 1]
      if (!addressRow || addressRow.status !== 'success') return []
      const address = addressRow.result as Address
      const info = meta.data?.[address.toLowerCase()]
      return [
        {
          index: i,
          address,
          allocated: assetsRow && assetsRow.status === 'success' ? (assetsRow.result as bigint) : 0n,
          name: info?.name,
          protocol: info?.protocol,
          reportedApy: info?.currentApy,
          status: info?.status,
        },
      ]
    })
  }, [reads.data, indexes, meta.data])

  return { vaults, isLoading: reads.isLoading, metaFailed: meta.isError }
}
