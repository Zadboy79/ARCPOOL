import { Callout, H2, H3, Lead, Table } from '../components'

export function Rewards() {
  return (
    <>
      <Lead>
        The Rewards page shows what your rUSDC has earned, lets anyone add USDC rewards to the pool, and lists
        everything that has been added.
      </Lead>

      <H2>Your rewards</H2>
      <Table
        head={['Row', 'Meaning']}
        rows={[
          ['Staked value', 'What your rUSDC would redeem for right now, at the exit price.'],
          ['rUSDC balance', 'The rUSDC in your wallet.'],
          ['Net deposited', 'USDC you put in minus USDC you took out through this pool.'],
          ['Estimated rewards earned', 'Staked value + withdrawn - deposited.'],
        ]}
      />
      <Callout title="Why it is an estimate">
        The figures come from the pool&apos;s <code>Deposit</code> and <code>Withdraw</code> events for your wallet.
        rUSDC you received from, or sent to, another wallet is not counted, so the result is only accurate if all your
        rUSDC was minted and redeemed by you.
      </Callout>

      <H2>The reward rate</H2>
      <p>
        The rate shown across the app is the annualised speed of the reward stream that is still vesting: USDC still
        locked, scaled to a year, divided by what the pool holds. It reflects rewards that are streaming{' '}
        <em>now</em>. It is not a promise about the future, and it reads 0% whenever nothing is vesting.
      </p>
      <p>
        On a small test pool a modest reward can annualise to a huge number, so the app caps the display at
        &quot;1,000%+&quot;.
      </p>

      <H2>Add rewards</H2>
      <p>
        Anyone can send USDC to the pool as a reward. It is shared by everyone who holds rUSDC, in proportion to
        their rUSDC and the time they hold it.
      </p>
      <H3>What happens to the USDC you add</H3>
      <ol className="list-decimal pl-6">
        <li>You approve and call <code>addRewards(amount)</code>.</li>
        <li>If the admin set a commission, that part goes straight to the treasury in USDC. The rest enters the pool.</li>
        <li>
          The rest vests linearly over the vesting window (24 hours on the current deployment) instead of lifting the
          price at once.
        </li>
      </ol>
      <p>
        The call reverts with <code>NoStakers</code> if nobody holds rUSDC yet, so rewards cannot be claimed by the
        first depositor.
      </p>

      <H2>Reward history</H2>
      <p>
        The list at the bottom combines two kinds of entries read from chain logs: USDC added through{' '}
        <code>addRewards</code> and vault yield collected by <code>harvest</code> or <code>sync</code>. Each row links to
        its transaction.
      </p>
    </>
  )
}
