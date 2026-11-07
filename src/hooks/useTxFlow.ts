import { useCallback, useState } from 'react'
import type { Hash } from 'viem'
import { useAccount, usePublicClient, useSwitchChain } from 'wagmi'
import { toast } from 'sonner'
import { CHAIN_ID } from '@/lib/pool'
import { parseOnchainError } from '@/lib/format'

export type TxPhase = 'idle' | 'wallet' | 'confirming' | 'processing'

/**
 * Runs one wallet transaction at a time and waits for its real receipt.
 * `submit` sends the transaction and returns its hash.
 */
export function useTxFlow(onConfirmed: () => void) {
  const { isConnected, chainId } = useAccount()
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain()
  const publicClient = usePublicClient({ chainId: CHAIN_ID })
  const [phase, setPhase] = useState<TxPhase>('idle')
  const [lastHash, setLastHash] = useState<Hash>()

  const wrongChain = isConnected && chainId !== CHAIN_ID

  const switchToArc = useCallback(async () => {
    try {
      await switchChainAsync({ chainId: CHAIN_ID })
    } catch (error) {
      const message = parseOnchainError(error)
      if (message) toast.error(message)
    }
  }, [switchChainAsync])

  const run = useCallback(
    async (successMessage: string, submit: () => Promise<Hash>): Promise<boolean> => {
      if (!publicClient) return false
      try {
        setPhase('wallet')
        const hash = await submit()
        setLastHash(hash)
        setPhase('confirming')
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        if (receipt.status !== 'success') throw new Error('Transaction reverted')
        toast.success(successMessage)
        onConfirmed()
        return true
      } catch (error) {
        const message = parseOnchainError(error)
        if (message) toast.error(message)
        return false
      } finally {
        setPhase('idle')
      }
    },
    [publicClient, onConfirmed],
  )

  return { phase, run, lastHash, wrongChain, switchToArc, isSwitching, isConnected }
}
