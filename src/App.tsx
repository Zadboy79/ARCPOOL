import { usePoolData } from '@/hooks/usePoolData'
import { DocsApp } from '@/docs/DocsApp'
import { usePath } from '@/lib/router'
import { TopNav } from '@/components/TopNav'
import { EarnPage } from '@/pages/EarnPage'
import { RewardsPage } from '@/pages/RewardsPage'
import { StakePage } from '@/pages/StakePage'
import { SwapPage } from '@/pages/SwapPage'
import { WithdrawalsPage } from '@/pages/WithdrawalsPage'

export default function App() {
  const path = usePath()
  return path === '/docs' || path.startsWith('/docs/') ? <DocsApp /> : <AppShell path={path} />
}

function AppShell({ path }: { path: string }) {
  const { data, isLoading, isError, refetch } = usePoolData()
  const pageProps = {
    data,
    isLoading,
    refetch: () => {
      void refetch()
    },
  }

  return (
    <div className="min-h-dvh pb-24">
      <TopNav />
      <main className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
        {isError ? (
          <div
            className="page-col mb-4 rounded-xl px-4 py-3 text-sm"
            style={{ background: 'rgba(255,107,129,0.12)', color: 'var(--danger)' }}
          >
            Could not read the pool from Arc Testnet. Retrying automatically.
          </div>
        ) : null}

        {path === '/earn' ? (
          <EarnPage {...pageProps} />
        ) : path === '/swap' ? (
          <SwapPage {...pageProps} />
        ) : path === '/withdrawals' ? (
          <WithdrawalsPage {...pageProps} />
        ) : path === '/rewards' ? (
          <RewardsPage {...pageProps} />
        ) : (
          <StakePage {...pageProps} />
        )}
      </main>
    </div>
  )
}
