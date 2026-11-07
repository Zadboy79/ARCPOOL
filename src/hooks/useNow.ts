import { useEffect, useState } from 'react'

/** Current unix time in seconds, refreshed every second for live countdowns. */
export function useNow(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}
