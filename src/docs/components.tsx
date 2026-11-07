import { useState, type ReactNode } from 'react'
import { AlertTriangle, Check, Copy, ExternalLink, Info, Link2 } from 'lucide-react'
import { buildAddressExplorerUrl } from '@/onchain-facts'
import { CHAIN_ID } from '@/lib/pool'
import { shortAddress } from '@/lib/format'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function Heading({ level, children }: { level: 2 | 3; children: string }) {
  const id = slugify(children)
  const Tag = level === 2 ? 'h2' : 'h3'
  return (
    <Tag id={id} className="doc-heading group">
      {children}
      <a href={`#${id}`} className="doc-anchor" aria-label={`Link to ${children}`}>
        <Link2 className="size-4" />
      </a>
    </Tag>
  )
}

export const H2 = ({ children }: { children: string }) => <Heading level={2}>{children}</Heading>
export const H3 = ({ children }: { children: string }) => <Heading level={3}>{children}</Heading>

export function Lead({ children }: { children: ReactNode }) {
  return <p className="doc-lead">{children}</p>
}

export function Callout({
  tone = 'note',
  title,
  children,
}: {
  tone?: 'note' | 'warn'
  title: string
  children: ReactNode
}) {
  const warn = tone === 'warn'
  const Icon = warn ? AlertTriangle : Info
  return (
    <aside
      className="doc-callout"
      style={{
        background: warn ? 'rgba(255, 176, 32, 0.1)' : 'var(--primary-soft)',
        borderColor: warn ? 'rgba(255, 176, 32, 0.35)' : 'transparent',
      }}
    >
      <Icon className="mt-0.5 size-4 shrink-0" style={{ color: warn ? '#ffb020' : 'var(--primary)' }} />
      <div>
        <p className="font-bold" style={{ color: 'var(--text)' }}>
          {title}
        </p>
        <div className="mt-1 text-pretty" style={{ color: 'var(--text-2)' }}>
          {children}
        </div>
      </div>
    </aside>
  )
}

export function CodeBlock({ code, language = 'ts' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1_500)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className="doc-code">
      <div className="doc-code-bar">
        <span>{language}</span>
        <button type="button" onClick={() => void copy()} aria-label="Copy code">
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="doc-steps">{children}</ol>
}

export function AddressRow({ label, address, note }: { label: string; address: string | undefined; note?: string }) {
  return (
    <tr>
      <td>
        <strong>{label}</strong>
        {note ? <span className="doc-note">{note}</span> : null}
      </td>
      <td>
        {address ? (
          <a
            href={buildAddressExplorerUrl(CHAIN_ID, address)}
            target="_blank"
            rel="noopener noreferrer"
            className="link mono inline-flex items-center gap-1 break-all text-xs"
            title={address}
          >
            <span className="hidden sm:inline">{address}</span>
            <span className="sm:hidden">{shortAddress(address)}</span>
            <ExternalLink className="size-3 shrink-0" />
          </a>
        ) : (
          <span style={{ color: 'var(--muted)' }}>Loading...</span>
        )}
      </td>
    </tr>
  )
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="doc-table-wrap">
      <table className="doc-table">
        <thead>
          <tr>
            {head.map((cell) => (
              <th key={cell}>{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
