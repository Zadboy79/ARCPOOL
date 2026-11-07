import { Callout, H2, H3, Lead, Table } from '../components'

export function Rewards() {
  return (
    <>
      <Lead>
        The Rewards page shows what your rUSDC has earned, lets anyone add USDC rewards to the pool, and lists
        everything that has been added.
      </Lead>

      <H2>Check your stake</H2>
      <p>
        Connect your wallet and open the <strong>Stake</strong> page or the <strong>Rewards</strong> page. The
        &quot;Your position&quot; card shows everything about your stake in one place.
      </p>
      <Table
        head={['Row', 'Meaning']}
        rows={[
          ['Staked value', 'What your rUSDC would redeem for right now, at the exit price.'],
          ['rUSDC balance', 'The rUSDC in your wallet.'],
          ['Original stake', 'USDC you put in minus USDC you took out through this pool.'],
          ['Rewards earned', 'Staked value + withdrawn - deposited. This includes rewards you already took out.'],
          ['Ready to claim', 'Staked value minus your original stake: the reward still inside your position.'],
        ]}
      />

      <H2>Claim rewards</H2>
      <p>
        There is nothing you have to claim. Rewards are not paid out to your wallet; they raise the USDC value of your
        rUSDC, and they keep earning while you leave them in. When you want the USDC, you have two choices.
      </p>
      <Table
        head={['Button', 'What happens']}
        rows={[
          ['Claim rewards (Your position card)', 'Withdraws only the earned USDC. Your original stake stays in the pool and keeps earning.'],
          ['Withdrawals page', 'Turns rUSDC back into USDC, as much as you choose, including all of it.'],
        ]}
      />
      <p>
        Only rewards that have already vested can be claimed. Rewards still streaming in are not part of your exit value
        yet.
      </p>
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
