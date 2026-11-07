import { ExternalLink } from 'lucide-react'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { CHAIN_ID } from '@/lib/pool'

export interface HistoryRow {
  id: string
  time: string
  title: string
  detail: string
  txHash: string
}

interface HistoryCardProps {
  title: string
  rows: HistoryRow[]
  isLoading: boolean
  isError: boolean
  emptyText: string
}

export function HistoryCard({ title, rows, isLoading, isError, emptyText }: HistoryCardProps) {
  return (
    <section className="mt-10" aria-label={title}>
      <h2 className="mb-4 text-xl font-extrabold" style={{ color: 'var(--text)' }}>
        {title}
      </h2>
      <div className="card px-6 py-2">
        {isLoading ? (
          <p className="py-6 text-sm" style={{ color: 'var(--muted)' }}>
            Loading history from the chain...
          </p>
        ) : isError ? (
          <p className="py-6 text-sm" style={{ color: 'var(--danger)' }}>
            Could not load history. It will retry automatically.
          </p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-sm" style={{ color: 'var(--muted)' }}>
            {emptyText}
          </p>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-4 py-4" style={{ borderColor: 'var(--border)' }}>
                <div className="min-w-0">
                  <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--text)' }}>
                    {row.title}
                  </p>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                    {row.time}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-right">
                  <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-2)' }}>
                    {row.detail}
                  </span>
                  <a
                    href={buildTxExplorerUrl(CHAIN_ID, row.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="View transaction on explorer"
                    className="flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--card-2)]"
                    style={{ color: 'var(--primary)' }}
                  >
                    <ExternalLink className="size-4" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
