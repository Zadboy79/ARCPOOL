import type { SwapEstimate } from '@circle-fin/app-kit'
import { Amount } from '@/onchain-money'
import type { SwapToken } from '@/lib/tokens'

/**
 * Fallback routes used when no single pool can fill the order.
 * - via: two swaps through USDC (for pairs with no direct pool, such as EURC to cirBTC).
 * - split: the same order cut into equal smaller swaps (for pools that fill only small sizes).
 * Each swap is its own wallet confirmation and its own transaction.
 */
export type FallbackPlan =
  | {
      kind: 'via'
      legs: [SwapEstimate, SwapEstimate]
      /** Estimated tokens received after both swaps. */
      totalOut: string
      /** Minimum received after both swaps, based on the second swap's slippage limit. */
      minOut: string
    }
  | {
      kind: 'split'
      parts: number
      chunk: string
      estimate: SwapEstimate
      /** Total paid: the chunk size times the number of swaps (rounding dust stays in the wallet). */
      totalIn: string
      totalOut: string
      minOut: string
    }

export const MAX_SPLITS = 6

export function isNoRouteError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  return message.includes('no route') || message.includes('not found')
}

/** Splits an amount into `parts` equal chunks in base units. Returns null if the amount is too small to split. */
export function splitAmount(amountIn: string, token: SwapToken, parts: number) {
  const raw = Amount.parse(amountIn, token.decimals).raw
  const chunkRaw = raw / BigInt(parts)
  if (chunkRaw <= 0n) return null
  return {
    chunk: Amount.fromRaw(chunkRaw, token.decimals).toString(),
    total: Amount.fromRaw(chunkRaw * BigInt(parts), token.decimals).toString(),
  }
}

/** Multiplies a human decimal string by a whole number without losing precision. */
export function multiplyAmount(value: string, token: SwapToken, times: number): string {
  try {
    return Amount.fromRaw(Amount.parse(value, token.decimals).raw * BigInt(times), token.decimals).toString()
  } catch {
    return String(Number(value) * times)
  }
}
