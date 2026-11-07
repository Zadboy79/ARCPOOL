import { useEffect } from 'react'
import { usePath } from '@/lib/router'
import { DocsLayout } from './DocsLayout'
import { Contracts } from './pages/Contracts'
import { FaqPage } from './pages/FaqPage'
import { GettingStarted } from './pages/GettingStarted'
import { HowItWorks } from './pages/HowItWorks'
import { Integrate } from './pages/Integrate'
import { Overview } from './pages/Overview'
import { RewardSources } from './pages/RewardSources'
import { Rewards } from './pages/Rewards'
import { Risks } from './pages/Risks'
import { Staking } from './pages/Staking'
import { Swap } from './pages/Swap'
import { DOC_PAGES } from './nav'

function Page({ path }: { path: string }) {
  switch (path) {
    case '/docs/getting-started':
      return <GettingStarted />
    case '/docs/staking':
      return <Staking />
    case '/docs/swap':
      return <Swap />
    case '/docs/rewards':
      return <Rewards />
    case '/docs/how-it-works':
      return <HowItWorks />
    case '/docs/reward-sources':
      return <RewardSources />
    case '/docs/risks':
      return <Risks />
    case '/docs/contracts':
      return <Contracts />
    case '/docs/integrate':
      return <Integrate />
    case '/docs/faq':
      return <FaqPage />
    default:
      return <Overview />
  }
}

export function DocsApp() {
  const path = usePath()
  const known = DOC_PAGES.some((page) => page.path === path) ? path : '/docs'

  useEffect(() => {
    const page = DOC_PAGES.find((item) => item.path === known)
    document.title = `${page?.title ?? 'Docs'} | ArcPool Docs`
    return () => {
      document.title = 'ArcPool | Stake USDC on Arc'
    }
  }, [known])

  return (
    <DocsLayout path={known}>
      <Page path={known} />
    </DocsLayout>
  )
}
