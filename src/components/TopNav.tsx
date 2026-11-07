import { useEffect, useRef, useState } from 'react'
import { BookOpen, ChevronDown, LineChart, Menu, Moon, RefreshCw, Sun, Wallet, X, Zap, Gift, ArrowUpFromLine } from 'lucide-react'
import { ConnectKitButton } from 'connectkit'
import { Link, usePath } from '@/lib/router'
import { useTheme } from '@/lib/theme'
import { shortAddress } from '@/lib/format'

const STAKE_ITEMS = [
  { to: '/', label: 'Stake', icon: Zap },
  { to: '/withdrawals', label: 'Withdrawals', icon: ArrowUpFromLine },
  { to: '/rewards', label: 'Rewards', icon: Gift },
] as const

const STAKE_PATHS: string[] = STAKE_ITEMS.map((item) => item.to)

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-3" aria-label="ArcPool home">
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
        <path d="M3 21C3 11 7.5 4 13 4s10 7 10 17" stroke="var(--primary)" strokeWidth="3.2" strokeLinecap="round" />
        <circle cx="13" cy="19" r="3.2" fill="var(--primary)" />
      </svg>
      <span className="text-base font-extrabold tracking-[0.32em]" style={{ color: 'var(--text)' }}>
        ARCPOOL
      </span>
    </Link>
  )
}

function navLabelClass(active: boolean) {
  return `flex min-h-11 items-center gap-2 rounded-xl px-3 text-[11px] font-extrabold uppercase tracking-[0.08em] transition-colors hover:bg-[var(--nav-item)] ${
    active ? 'text-[var(--text)]' : 'text-[var(--text-2)]'
  }`
}

export function TopNav() {
  const path = usePath()
  const { theme, toggle } = useTheme()
  const [stakeOpen, setStakeOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const stakeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!stakeOpen) return
    const onPointer = (event: PointerEvent) => {
      if (stakeRef.current && !stakeRef.current.contains(event.target as Node)) setStakeOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setStakeOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [stakeOpen])

  const stakeActive = STAKE_PATHS.includes(path)
  const iconColor = (active: boolean) => (active ? 'var(--primary)' : 'var(--text-2)')

  return (
    <header className="relative z-40 mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
      <div className="flex items-center gap-4 lg:gap-8">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          <div ref={stakeRef} className="relative">
            <button
              type="button"
              onClick={() => setStakeOpen((open) => !open)}
              aria-expanded={stakeOpen}
              aria-haspopup="menu"
              className={navLabelClass(stakeActive)}
            >
              <Zap className="size-5" style={{ color: iconColor(stakeActive) }} />
              Stake
              <ChevronDown className={`size-4 transition-transform ${stakeOpen ? 'rotate-180' : ''}`} />
            </button>
            {stakeOpen ? (
              <div
                role="menu"
                className="card absolute left-0 top-full mt-2 w-48 rounded-2xl p-2"
                style={{ boxShadow: 'var(--shadow)' }}
              >
                {STAKE_ITEMS.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    onNavigate={() => setStakeOpen(false)}
                    aria-current={path === to ? 'page' : undefined}
                    className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors hover:bg-[var(--card-2)]"
                  >
                    <Icon className="size-5" style={{ color: iconColor(path === to) }} />
                    <span style={{ color: 'var(--text)' }}>{label}</span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          <Link to="/earn" className={navLabelClass(path === '/earn')}>
            <LineChart className="size-5" style={{ color: iconColor(path === '/earn') }} />
            Earn
          </Link>
          <Link to="/swap" className={navLabelClass(path === '/swap')}>
            <RefreshCw className="size-5" style={{ color: iconColor(path === '/swap') }} />
            Swap
          </Link>
          <Link to="/docs" className={navLabelClass(false)}>
            <BookOpen className="size-5" style={{ color: iconColor(false) }} />
            Docs
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <ConnectKitButton.Custom>
          {({ isConnected, show, address }) => (
            <button
              type="button"
              onClick={show}
              className="flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-bold text-white transition-colors hover:brightness-110 sm:px-5"
              style={{ background: 'var(--primary)' }}
            >
              {isConnected && address ? (
                <>
                  <Wallet className="size-4" />
                  <span className="tabular-nums">{shortAddress(address)}</span>
                </>
              ) : (
                <>
                  <span>
                    Connect<span className="hidden sm:inline"> wallet</span>
                  </span>
                </>
              )}
            </button>
          )}
        </ConnectKitButton.Custom>
        <button
          type="button"
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          className="flex size-11 items-center justify-center rounded-xl transition-colors hover:brightness-125"
          style={{ background: 'var(--nav-item)', color: 'var(--text)', border: '1px solid var(--border)' }}
        >
          {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </button>
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          className="flex size-11 items-center justify-center rounded-xl md:hidden"
          style={{ background: 'var(--nav-item)', color: 'var(--text)', border: '1px solid var(--border)' }}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {mobileOpen ? (
        <nav
          className="card absolute inset-x-4 top-full mt-1 rounded-2xl p-2 md:hidden"
          aria-label="Mobile"
        >
          {[...STAKE_ITEMS, { to: '/earn', label: 'Earn', icon: LineChart }, { to: '/swap', label: 'Swap', icon: RefreshCw }, { to: '/docs', label: 'Docs', icon: BookOpen }].map(
            ({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onNavigate={() => setMobileOpen(false)}
                className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold"
              >
                <Icon className="size-5" style={{ color: iconColor(path === to) }} />
                <span style={{ color: 'var(--text)' }}>{label}</span>
              </Link>
            ),
          )}
        </nav>
      ) : null}
    </header>
  )
}
