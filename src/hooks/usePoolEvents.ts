import { useQuery, useQueryClient } from '@tanstack/react-query'
import { parseAbi, type Address, type Hash } from 'viem'
import { usePublicClient } from 'wagmi'
import { CHAIN_ID, DEPLOY_BLOCK, POOL_ADDRESS } from '@/lib/pool'

const eventsAbi = parseAbi([
  'event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)',
  'event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)',
  'event RewardsAdded(address indexed funder, uint256 amount, uint256 commissionAssets)',
  'event Harvested(address indexed caller, uint256 gain)',
])

/** Blocks queried per request while catching up from the deployment block. */
const SCAN_STEP = 5_000n
/** Newest events that get a timestamp lookup. */
const TIMESTAMPED = 40

interface Base {
  block: bigint
  logIndex: number
  txHash: Hash
}
export type PoolEvent =
  | (Base & { kind: 'deposit'; owner: Address; assets: bigint; shares: bigint })
  | (Base & { kind: 'withdraw'; owner: Address; assets: bigint; shares: bigint })
  | (Base & { kind: 'reward'; funder: Address; amount: bigint; commission: bigint })
  | (Base & { kind: 'harvest'; caller: Address; gain: bigint })

interface EventsState {
  scanned: bigint
  head: bigint
  events: PoolEvent[]
  times: Record<string, number>
}

const KEY = ['pool-events', POOL_ADDRESS] as const

/**
 * Pool history read straight from chain logs. It starts at the block the pool was
 * deployed in and only fetches new blocks on each refresh.
 */
export function usePoolEvents() {
  const client = usePublicClient({ chainId: CHAIN_ID })
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: KEY,
    enabled: client !== undefined,
    refetchInterval: 15_000,
    queryFn: async (): Promise<EventsState> => {
      if (!client) throw new Error('No client')
      const prev = queryClient.getQueryData<EventsState>(KEY)
      const head = await client.getBlockNumber()
      const events = prev ? [...prev.events] : []
      let from = prev ? prev.scanned + 1n : DEPLOY_BLOCK

      while (from <= head) {
        const to = from + SCAN_STEP - 1n > head ? head : from + SCAN_STEP - 1n
        const logs = await client.getLogs({ address: POOL_ADDRESS, events: eventsAbi, fromBlock: from, toBlock: to })
        for (const log of logs) {
          const base = { block: log.blockNumber, logIndex: log.logIndex, txHash: log.transactionHash }
          if (log.eventName === 'Deposit') {
            const { owner, assets, shares } = log.args
            if (owner !== undefined && assets !== undefined && shares !== undefined) {
              events.push({ ...base, kind: 'deposit', owner, assets, shares })
            }
          } else if (log.eventName === 'Withdraw') {
            const { owner, assets, shares } = log.args
            if (owner !== undefined && assets !== undefined && shares !== undefined) {
              events.push({ ...base, kind: 'withdraw', owner, assets, shares })
            }
          } else if (log.eventName === 'Harvested') {
            const { caller, gain } = log.args
            if (caller !== undefined && gain !== undefined) {
              events.push({ ...base, kind: 'harvest', caller, gain })
            }
          } else {
            const { funder, amount, commissionAssets } = log.args
            if (funder !== undefined && amount !== undefined && commissionAssets !== undefined) {
              events.push({ ...base, kind: 'reward', funder, amount, commission: commissionAssets })
            }
          }
        }
        from = to + 1n
      }

      const times = { ...(prev?.times ?? {}) }
      const recent = events.slice(-TIMESTAMPED)
      const missing = [...new Set(recent.map((e) => e.block))].filter((b) => times[b.toString()] === undefined)
      await Promise.all(
        missing.map(async (blockNumber) => {
          const block = await client.getBlock({ blockNumber })
          times[blockNumber.toString()] = Number(block.timestamp)
        }),
      )

      return { scanned: head, head, events, times }
    },
  })
}

export function formatEventTime(times: Record<string, number>, block: bigint): string {
  const stamp = times[block.toString()]
  if (stamp === undefined) return `Block ${block.toString()}`
  return new Date(stamp * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
