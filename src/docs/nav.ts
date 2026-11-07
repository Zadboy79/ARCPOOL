export interface DocPage {
  path: string
  title: string
  group: 'Introduction' | 'Using ArcPool' | 'Protocol' | 'Developers'
  summary: string
  /** Extra words the sidebar search matches besides the title. */
  keywords: string
}

export const DOC_PAGES: readonly DocPage[] = [
  {
    path: '/docs',
    title: 'Overview',
    group: 'Introduction',
    summary: 'What ArcPool is, how rUSDC works and where to start.',
    keywords: 'introduction about rusdc liquid staking usdc arc',
  },
  {
    path: '/docs/getting-started',
    title: 'Getting started',
    group: 'Introduction',
    summary: 'Connect a wallet, get test USDC, stake and withdraw.',
    keywords: 'wallet faucet connect first stake tutorial',
  },
  {
    path: '/docs/staking',
    title: 'Stake and withdraw',
    group: 'Using ArcPool',
    summary: 'Stake USDC for rUSDC and redeem it again.',
    keywords: 'deposit redeem unstake approve max legacy',
  },
  {
    path: '/docs/swap',
    title: 'Swap',
    group: 'Using ArcPool',
    summary: 'Swap USDC, EURC and cirBTC on Arc, and USDC with rUSDC.',
    keywords: 'eurc cirbtc slippage price check route lifi app kit',
  },
  {
    path: '/docs/rewards',
    title: 'Rewards',
    group: 'Using ArcPool',
    summary: 'See what you earned and add rewards to the pool.',
    keywords: 'earnings apr add rewards history harvest',
  },
  {
    path: '/docs/how-it-works',
    title: 'How it works',
    group: 'Protocol',
    summary: 'Exchange rate, entry and exit prices, vesting and accounting.',
    keywords: 'gross net vesting buffer exchange rate shares erc-4626 loss pause admin',
  },
  {
    path: '/docs/reward-sources',
    title: 'Reward sources',
    group: 'Protocol',
    summary: 'The two vaults the pool lends to and how their yield reaches stakers.',
    keywords: 'vault morpho earnkit mock yield harvest rebalance sync apy',
  },
  {
    path: '/docs/risks',
    title: 'Risks and limits',
    group: 'Protocol',
    summary: 'What can go wrong and what has and has not been checked.',
    keywords: 'security audit testnet liquidity vault loss trust',
  },
  {
    path: '/docs/contracts',
    title: 'Contracts',
    group: 'Developers',
    summary: 'Addresses, parameters, functions, events and errors.',
    keywords: 'address abi function event error reference parameters admin',
  },
  {
    path: '/docs/integrate',
    title: 'Integrate',
    group: 'Developers',
    summary: 'Read and write the pool with viem.',
    keywords: 'viem code example sdk read write logs indexer',
  },
  {
    path: '/docs/faq',
    title: 'FAQ',
    group: 'Developers',
    summary: 'Short answers to common questions.',
    keywords: 'questions help support withdraw rewards',
  },
]

export const DOC_GROUPS = ['Introduction', 'Using ArcPool', 'Protocol', 'Developers'] as const

export function pageIndex(path: string): number {
  const index = DOC_PAGES.findIndex((page) => page.path === path)
  return index === -1 ? 0 : index
}
