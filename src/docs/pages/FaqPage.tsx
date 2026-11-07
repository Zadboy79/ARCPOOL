import { ChevronDown } from 'lucide-react'
import { FAQ_ITEMS } from '@/components/Faq'
import { Lead } from '../components'

const EXTRA = [
  {
    q: 'Why has the exchange rate not changed?',
    a: 'The rate only rises when value reaches the pool: vault yield that has been harvested, or USDC added as rewards, released over the vesting window. If no vault is accruing and nobody has added rewards, the rate stays flat.',
  },
  {
    q: 'Why did I get back a little less than I put in?',
    a: 'Staking is priced at the gross value and withdrawing at the net value. While rewards are still vesting, redeeming soon after staking returns slightly less. Hold until the stream has vested and the gap closes.',
  },
  {
    q: 'Do I need to press Update pool?',
    a: 'Not for your own funds to be safe, but nothing runs on a schedule. Pressing it lends idle USDC to the vaults and starts vesting any waiting yield. Anyone can press it.',
  },
  {
    q: 'Where did my stake from before go?',
    a: 'The first ArcPool deployment is still live. If your wallet holds its rUSDC, the Withdrawals page shows a card to withdraw it. Then stake again in the current pool.',
  },
  {
    q: 'Who controls the pool?',
    a: 'An admin can pause new deposits, set a deposit cap and set a commission of up to 20% on USDC added as rewards. The admin cannot move your funds, change the vaults or stop withdrawals. On this testnet deployment the admin is the shared platform wallet.',
  },
  {
    q: 'My withdrawal failed with InsufficientLiquidity.',
    a: 'The idle buffer and the vaults could not release enough USDC at that moment. Try a smaller amount, or call recallFromVault for part of the amount first and then withdraw.',
  },
]

export function FaqPage() {
  return (
    <>
      <Lead>Short answers to the questions people ask most.</Lead>
      <div className="card divide-y px-6" style={{ borderColor: 'var(--border)' }}>
        {[...FAQ_ITEMS, ...EXTRA].map(({ q, a }) => (
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
    </>
  )
}
