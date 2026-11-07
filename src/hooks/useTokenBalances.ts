import { useMemo } from 'react'
import { erc20Abi, zeroAddress } from 'viem'
import { useAccount, useReadContracts } from 'wagmi'
import { CHAIN_ID } from '@/lib/pool'
import { SWAP_TOKENS, type SwapSymbol } from '@/lib/tokens'

export type Balances = Partial<Record<SwapSymbol, bigint>>

/** ERC-20 balances of every swappable token for the connected wallet. */
export function useTokenBalances() {
  const { address } = useAccount()
  const user = address ?? zeroAddress

  const query = useReadContracts({
    contracts: SWAP_TOKENS.map((token) => ({
      address: token.address,
      abi: erc20Abi,
      chainId: CHAIN_ID,
      functionName: 'balanceOf' as const,
      args: [user] as const,
    })),
    query: { enabled: address !== undefined, refetchInterval: 8_000 },
  })

  const balances: Balances = useMemo(() => {
    const result: Balances = {}
    SWAP_TOKENS.forEach((token, index) => {
      const row = query.data?.[index]
      if (row && row.status === 'success') result[token.symbol] = row.result
    })
    return result
  }, [query.data])

  return { balances, refetch: query.refetch }
}
