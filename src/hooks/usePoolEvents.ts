import { useQuery } from '@tanstack/react-query'
import { parseAbi, type Address, type Hash } from 'viem'
import { usePublicClient } from 'wagmi'
import { CHAIN_ID, DEPLOY_BLOCK, POOL_ADDRESS } from '@/lib/pool'

const eventsAbi = parseAbi([
  'event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)',
  'event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)',
  'event RewardsAdded(address indexed funder, uint256 amount, uint256 commissionAssets)',
  'event Harvested(address indexed caller, uint256 gain)',
])

/** Blocks queried per request while catching up. The Arc RPC rejects ranges of 10,000 blocks or more. */
const SCAN_STEP = 9_000n
/** Pause between requests so a long catch-up does not trip the RPC rate limit. */
const SCAN_PAUSE_MS = 150
/** Tries per request when the RPC says to slow down. */
const MAX_TRIES = 4
const STORAGE_KEY = `arcpool-events-v2:${POOL_ADDRESS.toLowerCase()}`
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

// Progress lives outside React so a failed or interrupted scan resumes where it stopped,
// and a reload resumes from the browser's saved copy instead of starting from the deployment block.
let memory: EventsState | undefined

function reviveBigInt(_key: string, value: unknown): unknown {
  return typeof value === 'string' && /^\d+n$/.test(value) ? BigInt(value.slice(0, -1)) : value
}

function replaceBigInt(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? `${value}n` : value
}

function loadSaved(): EventsState | undefined {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw, reviveBigInt) as EventsState
    return typeof parsed.scanned === 'bigint' && Array.isArray(parsed.events) ? parsed : undefined
  } catch {
    return undefined
  }
}

function save(state: EventsState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state, replaceBigInt))
  } catch {
    // Storage can be full or blocked; the scan still works without it.
  }
}

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

function isRateLimited(error: unknown): boolean {
  const text = error instanceof Error ? `${error.message} ${'details' in error ? String(error.details) : ''}` : ''
  return /429|too many|rate limit/i.test(text)
}

/**
 * Pool history read straight from chain logs. It starts at the block the pool was
 * deployed in and only fetches new blocks on each refresh.
 */
export function usePoolEvents(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options
  const client = usePublicClient({ chainId: CHAIN_ID })

  return useQuery({
    queryKey: KEY,
    enabled: enabled && client !== undefined,
    refetchInterval: 30_000,
    retry: 2,
    retryDelay: (attempt) => 3_000 * (attempt + 1),
    queryFn: async (): Promise<EventsState> => {
      if (!client) throw new Error('No client')
      memory ??= loadSaved()
      let state: EventsState = memory ?? { scanned: DEPLOY_BLOCK - 1n, head: DEPLOY_BLOCK, events: [], times: {} }
      const head = await client.getBlockNumber()
      // Browser data from a different chain state (for example a reset testnet) is dropped.
      if (state.scanned > head) state = { scanned: DEPLOY_BLOCK - 1n, head, events: [], times: {} }

      let from = state.scanned + 1n
      while (from <= head) {
        const to = from + SCAN_STEP - 1n > head ? head : from + SCAN_STEP - 1n
        let logs: Awaited<ReturnType<typeof client.getLogs<undefined, typeof eventsAbi>>> | undefined
        for (let attempt = 1; attempt <= MAX_TRIES && logs === undefined; attempt += 1) {
          try {
            logs = await client.getLogs({ address: POOL_ADDRESS, events: eventsAbi, fromBlock: from, toBlock: to })
          } catch (error) {
            if (!isRateLimited(error) || attempt === MAX_TRIES) throw error
            await sleep(1_500 * attempt)
          }
        }
        const events = [...state.events]
        for (const log of logs ?? []) {
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
        // Keep progress after every request so a later failure never restarts the scan.
        state = { ...state, scanned: to, head, events }
        memory = state
        save(state)
        from = to + 1n
        if (from <= head) await sleep(SCAN_PAUSE_MS)
      }

      const times = { ...state.times }
      const recent = state.events.slice(-TIMESTAMPED)
      const missing = [...new Set(recent.map((e) => e.block))].filter((b) => times[b.toString()] === undefined)
      await Promise.all(
        missing.map(async (blockNumber) => {
          const block = await client.getBlock({ blockNumber })
          times[blockNumber.toString()] = Number(block.timestamp)
        }),
      )

      state = { ...state, head, times }
      memory = state
      save(state)
      return state
    },
  })
}

export function formatEventTime(times: Record<string, number>, block: bigint): string {
  const stamp = times[block.toString()]
  if (stamp === undefined) return `Block ${block.toString()}`
  return new Date(stamp * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
