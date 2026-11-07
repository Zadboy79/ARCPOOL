import { formatUnitsFixed } from '@/onchain-money'

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function withCommas(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** Truncating fixed-point format with thousands separators. Never rounds up. */
export function formatFixed(raw: bigint, decimals: number, fractionDigits = 2): string {
  const fixed = formatUnitsFixed(raw, decimals, fractionDigits)
  const [whole, fraction] = fixed.split('.')
  const sign = whole.startsWith('-') ? '-' : ''
  const digits = sign ? whole.slice(1) : whole
  return `${sign}${withCommas(digits)}${fraction ? `.${fraction}` : ''}`
}

export function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return 'now'
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  if (days > 0 && hours === 0 && minutes === 0) return days === 1 ? '24 hours' : `${days} days`
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return 'under 1m'
}

export function parseOnchainError(error: unknown): string | null {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase()
  if (message.includes('user rejected') || message.includes('user denied')) return null
  if (message.includes('insufficient funds') || message.includes('exceeds balance')) {
    return 'Insufficient balance. Add funds and try again.'
  }
  if (message.includes('exceededmaxdeposit')) return 'Deposits are paused or the pool is at its cap.'
  if (message.includes('insufficientliquidity')) {
    return 'The vaults cannot release enough USDC right now. Try a smaller amount.'
  }
  if (message.includes('nostakers')) return 'Rewards can be added once someone has staked.'
  if (message.includes('reverted')) return 'The transaction was reverted. Please try again.'
  if (message.includes('network') || message.includes('timeout')) {
    return 'Network issue. Check your connection and retry.'
  }
  return 'Something went wrong. Please try again.'
}

/** APR from basis points. Very small pools annualise to huge numbers, so the display is capped. */
export function formatApr(bps: bigint): string {
  const pct = Number(bps) / 100
  if (pct >= 1000) return '1,000%+'
  return `${pct.toFixed(2)}%`
}
