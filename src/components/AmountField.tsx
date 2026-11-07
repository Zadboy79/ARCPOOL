import type { ReactNode } from 'react'

interface AmountFieldProps {
  value: string
  onChange: (value: string) => void
  symbol: string
  icon?: ReactNode
  balanceText?: string
  onMax?: () => void
  invalid?: boolean
  readOnly?: boolean
  size?: 'md' | 'lg'
}

export function AmountField({
  value,
  onChange,
  symbol,
  icon,
  balanceText,
  onMax,
  invalid,
  readOnly,
  size = 'md',
}: AmountFieldProps) {
  return (
    <div>
      <div
        className="well flex items-stretch overflow-hidden transition-colors focus-within:border-[var(--primary)]"
        style={invalid ? { borderColor: 'var(--danger)' } : undefined}
      >
        <div
          className="flex shrink-0 items-center gap-2 px-4 text-sm font-bold"
          style={{ borderRight: '1px solid var(--border)', color: 'var(--text)' }}
        >
          {icon}
          {symbol}
        </div>
        <input
          inputMode="decimal"
          aria-label={`${symbol} amount`}
          value={value}
          readOnly={readOnly}
          onChange={(event) => {
            const next = event.target.value.replace(/,/g, '.')
            if (next === '' || /^\d*\.?\d*$/.test(next)) onChange(next)
          }}
          placeholder={`${symbol} amount`}
          className={`min-w-0 flex-1 bg-transparent px-4 font-semibold tabular-nums outline-none placeholder:font-medium ${
            size === 'lg' ? 'py-5 text-2xl' : 'py-4 text-base'
          }`}
          style={{ color: 'var(--text)' }}
        />
        {onMax ? (
          <button
            type="button"
            onClick={onMax}
            className="m-2 shrink-0 rounded-lg px-3 text-xs font-extrabold tracking-wide transition-colors"
            style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}
          >
            MAX
          </button>
        ) : null}
      </div>
      {balanceText ? (
        <p className="mt-2 px-1 text-xs" style={{ color: invalid ? 'var(--danger)' : 'var(--muted)' }}>
          {balanceText}
        </p>
      ) : null}
    </div>
  )
}
