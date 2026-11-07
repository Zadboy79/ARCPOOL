import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'arcpool-theme'
const listeners = new Set<() => void>()

function readStored(): Theme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

let current: Theme = readStored()
document.documentElement.dataset.theme = current

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setTheme(next: Theme): void {
  current = next
  document.documentElement.dataset.theme = next
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Storage can be unavailable in embedded previews; the theme still applies for this session.
  }
  listeners.forEach((listener) => listener())
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => current)
  const toggle = useCallback(() => setTheme(current === 'dark' ? 'light' : 'dark'), [])
  return { theme, toggle }
}
