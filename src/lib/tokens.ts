import { getAddress, type Address } from 'viem'
import type { SwapParams } from '@circle-fin/app-kit'
import { USDC_ADDRESS, USDC_DECIMALS, SHARE_DECIMALS, POOL_ADDRESS } from '@/lib/pool'

export type SwapSymbol = 'USDC' | 'EURC' | 'cirBTC' | 'rUSDC'
export type KitToken = SwapParams['tokenIn']

export interface SwapToken {
  symbol: SwapSymbol
  name: string
  address: Address
  decimals: number
  /** Symbol the swap kit uses for market routes. Absent for tokens only the pool handles. */
  kitSymbol?: KitToken
}

function envAddress(value: string | undefined, name: string): Address {
  if (!value) throw new Error(`${name} is not set in .env`)
  return getAddress(value)
}

/** EURC and cirBTC are not in the generated onchain facts, so their Arc Testnet addresses live in .env. */
export const SWAP_TOKENS: readonly SwapToken[] = [
  { symbol: 'USDC', name: 'USD Coin', address: USDC_ADDRESS, decimals: USDC_DECIMALS, kitSymbol: 'USDC' },
  {
    symbol: 'EURC',
    name: 'Euro Coin',
    address: envAddress(import.meta.env.VITE_ARC_EURC_ADDRESS as string | undefined, 'VITE_ARC_EURC_ADDRESS'),
    decimals: 6,
    kitSymbol: 'EURC',
  },
  {
    symbol: 'cirBTC',
    name: 'Circle Bitcoin',
    address: envAddress(import.meta.env.VITE_ARC_CIRBTC_ADDRESS as string | undefined, 'VITE_ARC_CIRBTC_ADDRESS'),
    decimals: 8,
    kitSymbol: 'CIRBTC',
  },
  { symbol: 'rUSDC', name: 'ArcPool USDC', address: POOL_ADDRESS, decimals: SHARE_DECIMALS },
]

export function tokenBySymbol(symbol: SwapSymbol): SwapToken {
  const token = SWAP_TOKENS.find((t) => t.symbol === symbol)
  if (!token) throw new Error(`Unknown token ${symbol}`)
  return token
}

export type RouteKind = 'pool' | 'market' | 'none'

/** rUSDC only trades against USDC, through the ArcPool contract. Everything else goes to market liquidity. */
export function routeKind(from: SwapSymbol, to: SwapSymbol): RouteKind {
  if (from === to) return 'none'
  if (from === 'rUSDC') return to === 'USDC' ? 'pool' : 'none'
  if (to === 'rUSDC') return from === 'USDC' ? 'pool' : 'none'
  return 'market'
}
