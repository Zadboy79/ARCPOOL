import { useState } from 'react'
import { Info, ShieldCheck, X } from 'lucide-react'
import { USDC_DECIMALS } from '@/lib/pool'
import { formatApr, formatFixed } from '@/lib/format'
import { Link } from '@/lib/router'
import { CubeArt } from '@/components/CubeArt'
import { StrategyPanel } from '@/components/StrategyPanel'
import type { PageProps } from './types'

export function EarnPage({ data, isLoading, refetch }: PageProps) {
  const [showNotice, setShowNotice] = useState(true)
  const dash = isLoading ? '...' : '--'

  const streaming = (data.streamAprBps ?? 0n) > 0n
  const apr = data.streamAprBps !== undefined ? formatApr(data.streamAprBps) : dash
  const tvl = data.totalAssets !== undefined ? `${formatFixed(data.totalAssets, USDC_DECIMALS, 2)} USDC` : dash

  return (
    <div className="page-col">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold sm:text-4xl" style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>
          Earn
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-pretty" style={{ color: 'var(--text-2)' }}>
          Put USDC to work in the ArcPool vault and earn rewards onchain.
        </p>
        <Link to="/" className="link mt-1 inline-block text-sm">
          How ArcPool works
        </Link>
      </div>

      {showNotice ? (
        <div className="card mb-4 flex items-start gap-3 rounded-2xl p-4 text-sm">
          <Info className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--primary)' }} />
          <p className="flex-1 text-pretty" style={{ color: 'var(--text-2)' }}>
            <strong style={{ color: 'var(--text)' }}>Rewards are not guaranteed.</strong> They come from two Arc
            Testnet vaults the pool lends to and from USDC people add directly, so the rate is zero whenever nothing is
            streaming.
          </p>
          <button
            type="button"
            onClick={() => setShowNotice(false)}
            aria-label="Dismiss notice"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--card-2)]"
            style={{ color: 'var(--muted)' }}
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      <section className="card relative overflow-hidden p-6 sm:p-7" aria-labelledby="vault-title">
        <div
          className="pointer-events-none absolute -right-10 -top-10 size-64 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(0,163,255,0.28), transparent 70%)' }}
        />
        <CubeArt className="pointer-events-none absolute right-2 top-3 size-28 sm:right-6 sm:size-32" />

        <div className="relative">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="vault-title" className="text-3xl font-extrabold" style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>
              EarnUSDC
            </h2>
            <span
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider"
              style={{ background: 'rgba(83,186,149,0.16)', color: 'var(--success)' }}
            >
              <ShieldCheck className="size-3" /> No lockup
            </span>
          </div>
          <p className="mt-3 max-w-[62%] text-sm text-pretty" style={{ color: 'var(--text-2)' }}>
            EarnUSDC is the ArcPool vault. Deposit USDC, hold rUSDC, and redeem any time at the pool rate.
          </p>

          <div className="my-6 h-px" style={{ background: 'var(--border)' }} />

          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs" style={{ color: 'var(--text-2)' }}>
                APR (current stream)
              </dt>
              <dd
                className="mt-1 text-xl sm:text-2xl font-extrabold tabular-nums"
                style={{ color: streaming ? 'var(--success)' : 'var(--text)' }}
              >
                {apr}
              </dd>
            </div>
            <div>
              <dt className="text-xs" style={{ color: 'var(--text-2)' }}>
                TVL
              </dt>
              <dd className="mt-1 text-xl sm:text-2xl font-extrabold tabular-nums" style={{ color: 'var(--text)' }}>
                {tvl}
              </dd>
            </div>
          </dl>

          <Link to="/" className="btn-soft mt-6">
            Deposit
          </Link>
        </div>
      </section>

      <StrategyPanel data={data} refetch={refetch} />
    </div>
  )
}
