import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Menu, Moon, Search, Sun, X } from 'lucide-react'
import { Link, navigate } from '@/lib/router'
import { useTheme } from '@/lib/theme'
import { DOC_GROUPS, DOC_PAGES, pageIndex } from './nav'

interface Heading {
  id: string
  text: string
  level: number
}

function Brand() {
  return (
    <Link to="/docs" className="flex items-center gap-3" aria-label="ArcPool docs home">
      <svg width="24" height="24" viewBox="0 0 26 26" fill="none" aria-hidden="true">
        <path d="M3 21C3 11 7.5 4 13 4s10 7 10 17" stroke="var(--primary)" strokeWidth="3.2" strokeLinecap="round" />
        <circle cx="13" cy="19" r="3.2" fill="var(--primary)" />
      </svg>
      <span className="text-sm font-extrabold tracking-[0.28em]" style={{ color: 'var(--text)' }}>
        ARCPOOL
      </span>
      <span
        className="rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
        style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}
      >
        Docs
      </span>
    </Link>
  )
}

function SearchBox({ onPick }: { onPick: () => void }) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return DOC_PAGES.filter((page) =>
      `${page.title} ${page.summary} ${page.keywords}`.toLowerCase().includes(q),
    ).slice(0, 6)
  }, [query])

  function go(path: string) {
    navigate(path)
    setQuery('')
    onPick()
  }

  return (
    <div className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && results[0]) go(results[0].path)
          if (event.key === 'Escape') setQuery('')
        }}
        placeholder="Search the docs"
        aria-label="Search the docs"
        className="min-h-10 w-full rounded-xl border bg-[var(--card-2)] pl-9 pr-3 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--primary)]"
        style={{ color: 'var(--text)' }}
      />
      {query.trim() ? (
        <ul className="card absolute left-0 right-0 top-full z-50 mt-2 rounded-2xl p-2" role="listbox" style={{ boxShadow: 'var(--shadow)' }}>
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm" style={{ color: 'var(--muted)' }}>
              No pages match "{query.trim()}".
            </li>
          ) : (
            results.map((page) => (
              <li key={page.path} role="option" aria-selected="false">
                <button
                  type="button"
                  onClick={() => go(page.path)}
                  className="w-full rounded-xl px-3 py-2 text-left hover:bg-[var(--card-2)]"
                >
                  <span className="block text-sm font-bold" style={{ color: 'var(--text)' }}>
                    {page.title}
                  </span>
                  <span className="block text-xs" style={{ color: 'var(--muted)' }}>
                    {page.summary}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}

function SideNav({ path, onNavigate }: { path: string; onNavigate: () => void }) {
  return (
    <nav aria-label="Documentation" className="space-y-6">
      {DOC_GROUPS.map((group) => (
        <div key={group}>
          <p className="label-caps mb-2 px-3">{group}</p>
          <ul className="space-y-0.5">
            {DOC_PAGES.filter((page) => page.group === group).map((page) => (
              <li key={page.path}>
                <Link
                  to={page.path}
                  onNavigate={onNavigate}
                  aria-current={page.path === path ? 'page' : undefined}
                  className="doc-side-link"
                >
                  {page.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function useHeadings(path: string): { headings: Heading[]; active: string | undefined } {
  const [headings, setHeadings] = useState<Heading[]>([])
  const [active, setActive] = useState<string>()

  useEffect(() => {
    let observer: IntersectionObserver | undefined
    // Wait one frame so the page for this path has rendered its headings.
    const frame = window.requestAnimationFrame(() => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('.doc-article h2[id], .doc-article h3[id]'))
      setHeadings(nodes.map((node) => ({ id: node.id, text: node.textContent ?? '', level: node.tagName === 'H2' ? 2 : 3 })))
      setActive(nodes[0]?.id)
      if (nodes.length === 0) return
      observer = new IntersectionObserver(
        (entries) => {
          const visible = entries.filter((entry) => entry.isIntersecting)
          if (visible[0]) setActive(visible[0].target.id)
        },
        { rootMargin: '-90px 0px -65% 0px' },
      )
      nodes.forEach((node) => observer?.observe(node))
    })
    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [path])

  return { headings, active }
}

export function DocsLayout({ path, children }: { path: string; children: ReactNode }) {
  const { theme, toggle } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const { headings, active } = useHeadings(path)
  const index = pageIndex(path)
  const prev = DOC_PAGES[index - 1]
  const next = DOC_PAGES[index + 1]
  const page = DOC_PAGES[index]

  return (
    <div className="min-h-dvh">
      <header
        className="sticky top-0 z-40 border-b backdrop-blur"
        style={{ background: 'color-mix(in srgb, var(--bg-top) 85%, transparent)', borderColor: 'var(--border)' }}
      >
        <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              className="flex size-10 items-center justify-center rounded-xl lg:hidden"
              style={{ background: 'var(--nav-item)', color: 'var(--text)' }}
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <Brand />
          </div>
          <div className="hidden flex-1 justify-center md:flex">
            <SearchBox onPick={() => setMenuOpen(false)} />
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              aria-label="Launch app"
              className="flex min-h-10 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-bold text-white sm:px-4"
              style={{ background: 'var(--primary)' }}
            >
              <BookOpen className="size-4" /> <span className="hidden sm:inline">Launch app</span>
            </Link>
            <button
              type="button"
              onClick={toggle}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="flex size-10 items-center justify-center rounded-xl"
              style={{ background: 'var(--nav-item)', color: 'var(--text)' }}
            >
              {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1400px] gap-10 px-4 pb-24 pt-8 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_200px]">
        <aside
          className={`${menuOpen ? 'block' : 'hidden'} lg:sticky lg:top-24 lg:block lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto`}
        >
          <div className="mb-4 md:hidden">
            <SearchBox onPick={() => setMenuOpen(false)} />
          </div>
          <SideNav path={path} onNavigate={() => setMenuOpen(false)} />
        </aside>

        <main className="min-w-0">
          <article className="doc-article mx-auto max-w-[760px]">
            <p className="label-caps">{page?.group}</p>
            <h1 className="doc-title">{page?.title}</h1>
            {children}
          </article>

          <nav
            aria-label="Pages"
            className="mx-auto mt-14 grid max-w-[760px] gap-3 border-t pt-6 sm:grid-cols-2"
            style={{ borderColor: 'var(--border)' }}
          >
            {prev ? (
              <Link to={prev.path} className="card flex items-center gap-3 rounded-2xl p-4 hover:brightness-110">
                <ArrowLeft className="size-4 shrink-0" style={{ color: 'var(--muted)' }} />
                <span>
                  <span className="label-caps block">Previous</span>
                  <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                    {prev.title}
                  </span>
                </span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link to={next.path} className="card flex items-center justify-end gap-3 rounded-2xl p-4 text-right hover:brightness-110">
                <span>
                  <span className="label-caps block">Next</span>
                  <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                    {next.title}
                  </span>
                </span>
                <ArrowRight className="size-4 shrink-0" style={{ color: 'var(--muted)' }} />
              </Link>
            ) : null}
          </nav>
        </main>

        <aside className="hidden xl:sticky xl:top-24 xl:block xl:max-h-[calc(100dvh-7rem)] xl:self-start xl:overflow-y-auto">
          {headings.length > 0 ? (
            <nav aria-label="On this page">
              <p className="label-caps mb-3">On this page</p>
              <ul className="space-y-1 border-l" style={{ borderColor: 'var(--border)' }}>
                {headings.map((heading) => (
                  <li key={heading.id}>
                    <a
                      href={`#${heading.id}`}
                      className="-ml-px block border-l py-1 text-[13px] leading-snug transition-colors"
                      style={{
                        paddingLeft: heading.level === 2 ? 12 : 24,
                        borderColor: active === heading.id ? 'var(--primary)' : 'transparent',
                        color: active === heading.id ? 'var(--primary)' : 'var(--muted)',
                        fontWeight: active === heading.id ? 700 : 500,
                      }}
                    >
                      {heading.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
