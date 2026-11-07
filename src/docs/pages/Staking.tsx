import { Link } from '@/lib/router'
import { Callout, H2, H3, Lead, Table } from '../components'

export function Staking() {
  return (
    <>
      <Lead>
        Staking turns USDC into rUSDC. Withdrawing turns rUSDC back into USDC at the current exit price. Both happen
        directly against the pool contract.
      </Lead>

      <H2>Stake</H2>
      <p>
        The Stake page is one form. Enter USDC, and the page reads the contract to show what you will get before you
        sign anything.
      </p>
      <Table
        head={['Row', 'Meaning']}
        rows={[
          ['You will receive', 'rUSDC minted for your deposit, at the entry price (see How it works).'],
          ['Exchange rate', 'How much USDC one rUSDC redeems for right now.'],
          ['Reward fee', 'Commission the admin takes on USDC added as rewards. 0% unless the admin sets it. It is never taken from your stake or from vault yield.'],
          ['Unstaking', 'Instant if the vaults can pay out. Large exits depend on vault liquidity.'],
        ]}
      />
      <H3>Approval</H3>
      <p>
        USDC must be approved before the pool can take it. ArcPool asks you to approve the exact amount you are about to
        stake, not an unlimited allowance.
      </p>
      <H3>Limits</H3>
      <ul>
        <li>
          The admin can set a deposit cap and can pause new deposits. When deposits are closed the form tells you; exits
          keep working.
        </li>
        <li>Max leaves 0.1 USDC in your wallet because gas on Arc is paid in USDC.</li>
      </ul>

      <H2>Withdraw</H2>
      <p>
        On the Withdrawals page enter the rUSDC you want to redeem. The page shows the USDC you will receive at the exit
        price. Withdrawals are priced on what is already vested, so rewards that are still streaming do not count yet.
      </p>
      <H3>Where the USDC comes from</H3>
      <ol className="list-decimal pl-6">
        <li>The pool pays from its idle USDC first. About 10% of the pool is kept idle on purpose.</li>
        <li>If that is not enough it recalls the missing amount from the two vaults, one at a time.</li>
        <li>
          If the vaults together cannot release enough right now, the transaction reverts with an{' '}
          <code>InsufficientLiquidity</code> error and nothing changes. Try a smaller amount.
        </li>
      </ol>
      <Callout title="Freeing liquidity in pieces">
        Anyone can call <code>recallFromVault(i, assets)</code> to move a smaller amount from vault <code>i</code> into
        the pool, then redeem. See <Link to="/docs/contracts" className="link">Contracts</Link>.
      </Callout>

      <H2>The previous pool</H2>
      <p>
        ArcPool first launched without vaults. If your wallet still holds rUSDC from that first deployment, the
        Withdrawals page shows a card with its value and a button to withdraw everything from it. Then stake again in
        the current pool.
      </p>

      <H2>Withdrawal history</H2>
      <p>
        Under the form, the page lists your recent withdrawals with date, rUSDC burned, USDC received and a link to the
        transaction. It is read from the pool&apos;s <code>Withdraw</code> events, starting at the block the pool was
        deployed in.
      </p>
    </>
  )
}
