import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { formatFixed } from '@/lib/format'
import { SWAP_TOKENS, type SwapSymbol } from '@/lib/tokens'
import type { Balances } from '@/hooks/useTokenBalances'
import { TokenIcon } from './TokenIcons'

interface TokenSelectProps {
  value: SwapSymbol
  onChange: (symbol: SwapSymbol) => void
  balances: Balances
  label: string
}

export function TokenSelect({ value, onChange, balances, label }: TokenSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${value}`}
        className="flex min-h-11 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-base font-bold transition-colors hover:brightness-125"
        style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)' }}
      >
        <TokenIcon symbol={value} size={28} />
        {value}
        <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--muted)' }} />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label={label}
          className="card absolute right-0 top-full z-30 mt-2 w-64 rounded-2xl p-2"
        >
          {SWAP_TOKENS.map((token) => {
            const balance = balances[token.symbol]
            const selected = token.symbol === value
            return (
              <li key={token.symbol} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(token.symbol)
                    setOpen(false)
                  }}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left transition-colors hover:bg-[var(--card-2)]"
                >
                  <TokenIcon symbol={token.symbol} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold" style={{ color: 'var(--text)' }}>
                      {token.symbol}
                    </span>
                    <span className="block text-xs" style={{ color: 'var(--muted)' }}>
                      {token.name}
                    </span>
                  </span>
                  <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-2)' }}>
                    {balance !== undefined ? formatFixed(balance, token.decimals, token.decimals === 8 ? 4 : 2) : ''}
                  </span>
                  {selected ? <Check className="size-4" style={{ color: 'var(--primary)' }} /> : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
