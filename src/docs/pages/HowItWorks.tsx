import { Callout, CodeBlock, H2, H3, Lead, Table } from '../components'

export function HowItWorks() {
  return (
    <>
      <Lead>
        ArcPool is an ERC-4626 vault with two extra ideas: new stakers pay the full price including unvested value, and
        everything the pool earns is released gradually.
      </Lead>

      <H2>Shares and the exchange rate</H2>
      <p>
        When you stake you receive rUSDC. Your balance of rUSDC never changes by itself. What changes is the USDC each
        rUSDC is worth. rUSDC has 12 decimals: the 6 decimals of USDC plus 6 from a virtual-share offset that blocks the
        classic first-depositor inflation attack.
      </p>
      <p>
        The exchange rate shown in the app is the USDC that one whole rUSDC redeems for at the exit price, with 6
        decimals.
      </p>

      <H2>Three values the pool tracks</H2>
      <Table
        head={['Value', 'Definition']}
        rows={[
          ['Idle', 'USDC sitting in the pool contract.'],
          ['Deployed', 'USDC lent to the vaults, counted at cost. It also includes yield that has already been harvested.'],
          ['Locked', 'Rewards and harvested yield that are still vesting.'],
        ]}
      />
      <CodeBlock
        language="text"
        code={`gross   = idle + deployed + pending vault yield     (everything the pool owns)
net     = idle + deployed - locked                 (what is vested and withdrawable)`}
      />

      <H2>Entry at gross, exit at net</H2>
      <p>This is the rule that keeps staking fair.</p>
      <Table
        head={['Action', 'Priced at', 'Why']}
        rows={[
          ['Stake (previewDeposit, previewMint)', 'Gross', 'You pay for rewards and vault yield that earlier stakers already earned but that are still vesting.'],
          ['Withdraw (previewRedeem, previewWithdraw)', 'Net', 'You are paid only what has vested so far.'],
        ]}
      />
      <p>
        A late staker who joins at the gross price gets fewer rUSDC for the same USDC, and the pending value stays with
        the people who earned it. The result is that nobody can stake just before a reward or a harvest, even by
        calling harvest themselves, and take part of it.
      </p>
      <Callout title="What you may notice">
        While rewards are vesting, staking and then redeeming right away returns a little less than you put in. The
        difference disappears as the stream vests. The app&apos;s previews already use these prices, and{' '}
        <code>previewDeposit</code> can return fewer shares than <code>convertToShares</code> by design.
      </Callout>

      <H2>Vesting</H2>
      <p>
        Anything new that the pool earns, whether it is USDC added through <code>addRewards</code> or yield harvested
        from the vaults, is locked and released linearly. The window on the current deployment is 24 hours (the vesting
        period is fixed at deployment and must be between one hour and 30 days).
      </p>
      <H3>Overlapping rewards</H3>
      <p>
        If rewards are added while others are still vesting, the new unlock time is the weighted average of the time
        left on the old locked amount and a full window for the new amount:
      </p>
      <CodeBlock
        language="text"
        code={`newDuration = ceil( (locked * remaining + new * window) / (locked + new) )`}
      />
      <p>
        A tiny reward therefore barely moves the schedule, so nobody can keep postponing everyone&apos;s rewards by
        adding dust.
      </p>

      <H2>Idle buffer and lending</H2>
      <p>
        The pool aims to keep 10% of idle plus deployed USDC idle for exits. When someone calls <code>rebalance</code>{' '}
        (or <code>sync</code>), the rest is split equally between the two vaults. A vault that rejects a deposit is
        skipped and its share stays idle, so one broken vault cannot block the pool.
      </p>

      <H2>Losses</H2>
      <p>
        If the vaults are worth less than the pool&apos;s deployed cost, the shortfall is written down before the next
        stake or withdrawal is priced and a <code>LossRealized</code> event is emitted. If a vault cannot be read, the
        pool does not guess; it makes no write-down and the loss stays unrecognised until the vault can be read again.
      </p>

      <H2>Who can do what</H2>
      <Table
        head={['Who', 'Can', 'Cannot']}
        rows={[
          ['Anyone', 'Stake, withdraw, add rewards, harvest, rebalance, sync, recall USDC from a vault into the pool.', 'Take another person\'s funds.'],
          ['Admin', 'Pause new deposits, set a deposit cap, set a commission of up to 20% on USDC added as rewards.', 'Withdraw user funds, change the vault list, change the vesting window, block withdrawals.'],
        ]}
      />
      <p>
        On the current testnet deployment the admin is the shared platform deployer wallet, so there is no admin you can
        act as from your own wallet.
      </p>
    </>
  )
}
