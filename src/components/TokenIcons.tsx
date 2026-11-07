import { TokenBTC, TokenEURC, TokenUSDC } from '@web3icons/react'
import type { SwapSymbol } from '@/lib/tokens'

export function UsdcIcon({ size = 22 }: { size?: number }) {
  return <TokenUSDC variant="branded" size={size} />
}

export function RusdcIcon({ size = 22 }: { size?: number }) {
  return (
    <span
      className="relative inline-flex items-center justify-center rounded-full"
      style={{ width: size, height: size, background: 'linear-gradient(145deg, #35b6ff, #0a63c9)' }}
      aria-hidden="true"
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
        <path d="M4 18c0-7 3.5-12 8-12s8 5 8 12" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="12" cy="17" r="2.4" fill="#fff" />
      </svg>
    </span>
  )
}

export function TokenIcon({ symbol, size = 22 }: { symbol: SwapSymbol; size?: number }) {
  if (symbol === 'rUSDC') return <RusdcIcon size={size} />
  if (symbol === 'EURC') return <TokenEURC variant="branded" size={size} />
  if (symbol === 'cirBTC') return <TokenBTC variant="branded" size={size} />
  return <UsdcIcon size={size} />
}
