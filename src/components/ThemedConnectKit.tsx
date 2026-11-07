import type { ReactNode } from 'react'
import { ConnectKitProvider } from 'connectkit'
import { useTheme } from '@/lib/theme'

/** ConnectKit provider whose wallet modal follows the app's light/dark theme. */
export function ThemedConnectKit({ children }: { children: ReactNode }) {
  const { theme } = useTheme()
  return (
    <ConnectKitProvider
      mode={theme}
      customTheme={{
        '--ck-font-family': "'Manrope', sans-serif",
        '--ck-primary-button-background': '#00a3ff',
        '--ck-accent-color': '#00a3ff',
      }}
    >
      {children}
    </ConnectKitProvider>
  )
}
