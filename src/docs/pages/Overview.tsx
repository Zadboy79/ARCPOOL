import { usePoolData } from '@/hooks/usePoolData'
import { formatApr, formatFixed } from '@/lib/format'
import { CHAIN_ID, USDC_DECIMALS } from '@/lib/pool'
import { Link } from '@/lib/router'
import { requireChain } from '@/onchain-facts'
import { Callout, H2, Lead, Table } from '../components'

function LiveStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--card-2)', border: '1px solid var(--border)' }}>
      <p className="label-caps">{label}</p>
      <p className="mt-1 text-lg font-extrabold tabular-nums" style={{ color: 'var(--text)' }}>
        {value}
      </p>
    </div>
  )
}

const START_HERE = [
  { to: '/docs/getting-started', title: 'Getting started', text: 'Connect a wallet and make your first stake.' },
  { to: '/docs/how-it-works', title: 'How it works', text: 'Prices, vesting and where the numbers come from.' },
  { to: '/docs/reward-sources', title: 'Reward sources', text: 'The two vaults that earn for the pool.' },
  { to: '/docs/contracts', title: 'Contracts', text: 'Addresses, functions, events and errors.' },
] as const

export function Overview() {
  const { data } = usePoolData()
  const chain = requireChain(CHAIN_ID)
  const dash = '...'
  const usdc = (raw?: bigint) => (raw === undefined ? dash : `${formatFixed(raw, USDC_DECIMALS, 2)} USDC`)

  return (
    <>
      <Lead>
        ArcPool is a liquid staking pool for USDC on {chain.name}. You stake USDC and receive rUSDC. Each rUSDC can be
        redeemed for more USDC over time as the pool earns, and you can hold, transfer or redeem it whenever you like.
      </Lead>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <LiveStat label="Total staked" value={usdc(data.totalAssets)} />
        <LiveStat
          label="1 rUSDC is worth"
          value={data.exchangeRate !== undefined ? `${formatFixed(data.exchangeRate, USDC_DECIMALS, 6)} USDC` : dash}
        />
        <LiveStat label="Lent to vaults" value={usdc(data.deployed)} />
        <LiveStat
          label="Reward rate"
          value={data.streamAprBps !== undefined ? formatApr(data.streamAprBps) : dash}
        />
      </div>
      <p className="text-xs" style={{ color: 'var(--muted)' }}>
        Live values read from the pool contract.
      </p>

      <H2>What ArcPool does</H2>
      <ul>
        <li>
          <strong>Stake USDC, get rUSDC.</strong> rUSDC is an ERC-4626 share token. Your balance stays the same while its
          USDC value rises.
        </li>
        <li>
          <strong>Idle USDC is put to work.</strong> The pool lends most of its USDC to two vaults on {chain.name} and
          streams the yield they earn to stakers.
        </li>
        <li>
          <strong>Exit when you want.</strong> There is no lockup and no queue. The pool pulls USDC back from the vaults
          when you redeem.
        </li>
        <li>
          <strong>Fair entry.</strong> New stakers pay the full price including rewards still vesting, so nobody can
          join just before a payout to take what earlier stakers earned.
        </li>
      </ul>

      <H2>At a glance</H2>
      <Table
        head={['', 'ArcPool']}
        rows={[
          ['Network', `${chain.name} (chain id ${chain.chainId})`],
          ['Staked asset', 'USDC, the ERC-20 interface with 6 decimals'],
          ['Receipt token', 'rUSDC, ERC-4626, 12 decimals'],
          ['Reward sources', 'Vault yield from two ERC-4626 vaults, plus USDC that anyone adds'],
          ['Withdrawals', 'Instant while the pool can pay from its idle USDC and the vaults'],
          ['Fees', 'None by default. The admin can set a commission of up to 20% on USDC added as rewards only'],
        ]}
      />

      <Callout tone="warn" title="Testnet only">
        ArcPool runs on {chain.name} with test USDC. It has had an automated review and a test suite, not a professional
        audit. Read <Link to="/docs/risks" className="link">Risks and limits</Link> before you put in anything you care
        about.
      </Callout>

      <H2>Start here</H2>
      <div className="grid gap-3 sm:grid-cols-2">
        {START_HERE.map((item) => (
          <Link key={item.to} to={item.to} className="card rounded-2xl p-4 hover:brightness-110">
            <p className="text-sm font-extrabold" style={{ color: 'var(--text)' }}>
              {item.title}
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
              {item.text}
            </p>
          </Link>
        ))}
      </div>
    </>
  )
}
