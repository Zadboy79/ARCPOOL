import { ChevronDown } from 'lucide-react'

export const FAQ_ITEMS = [
  {
    q: 'What is ArcPool?',
    a: 'ArcPool is a liquid staking pool for USDC on Arc. You deposit USDC and receive rUSDC, a token that represents your share of the pool. You can hold, transfer or redeem rUSDC at any time.',
  },
  {
    q: 'How does rUSDC earn rewards?',
    a: 'rUSDC does not change in number. Instead, each rUSDC becomes redeemable for more USDC as rewards are added to the pool. Anyone can add USDC rewards, and they are released to stakers gradually over the vesting window.',
  },
  {
    q: 'Where do the rewards come from?',
    a: 'Idle USDC is lent to two ERC-4626 vaults on Arc Testnet (a Morpho-based EarnKit USDC vault and a mock Morpho vault). When a vault share price rises, anyone can harvest that gain into the pool. Contributors can also add USDC rewards directly. If no vault is accruing and nobody adds rewards, the reward rate is zero.',
  },
  {
    q: 'Can I unstake at any time?',
    a: 'Yes, as long as the pool can pay you. A slice of the pool stays idle and the rest is pulled back from the vaults when you redeem, so a large exit can fail if the vaults cannot release enough USDC right now. Redeeming still works while new staking is paused.',
  },
  {
    q: 'Why are rewards released gradually?',
    a: 'Harvested yield and added rewards vest over time, and new stakers pay the full price including rewards still vesting. Nobody can stake right before a reward or a harvest and take what earlier stakers earned.',
  },
  {
    q: 'What are the risks?',
    a: 'This is a testnet product. Your USDC can be lent to third-party vaults that the pool trusts, so a vault bug or loss would lower the rUSDC exchange rate. The contract has been reviewed and tested with mock vaults, but it has not had a professional audit.',
  },
]

export function Faq() {
  return (
    <section aria-labelledby="faq-title" className="mt-12">
      <h2 id="faq-title" className="mb-4 text-xl font-extrabold" style={{ color: 'var(--text)' }}>
        FAQ
      </h2>
      <div className="card divide-y px-6" style={{ borderColor: 'var(--border)' }}>
        {FAQ_ITEMS.map(({ q, a }) => (
          <details key={q} className="group py-5" style={{ borderColor: 'var(--border)' }}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold [&::-webkit-details-marker]:hidden">
              <span style={{ color: 'var(--text)' }}>{q}</span>
              <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" style={{ color: 'var(--muted)' }} />
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-pretty" style={{ color: 'var(--text-2)' }}>
              {a}
            </p>
          </details>
        ))}
      </div>
    </section>
  )
}
