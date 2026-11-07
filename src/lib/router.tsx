import { useEffect, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'

function currentPath(): string {
  return window.location.pathname.replace(/\/+$/, '') || '/'
}

export function navigate(to: string): void {
  if (to === currentPath()) return
  window.history.pushState({}, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo({ top: 0 })
}

export function usePath(): string {
  const [path, setPath] = useState(currentPath)
  useEffect(() => {
    const onChange = () => setPath(currentPath())
    window.addEventListener('popstate', onChange)
    return () => window.removeEventListener('popstate', onChange)
  }, [])
  return path
}

interface LinkProps {
  to: string
  children: ReactNode
  className?: string
  style?: CSSProperties
  onNavigate?: () => void
  'aria-current'?: 'page'
}

export function Link({ to, children, className, onNavigate, ...rest }: LinkProps) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    navigate(to)
    onNavigate?.()
  }
  return (
    <a href={to} onClick={onClick} className={className} {...rest}>
      {children}
    </a>
  )
}
