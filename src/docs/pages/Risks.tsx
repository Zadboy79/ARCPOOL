import { Callout, H2, Lead, Table } from '../components'

export function Risks() {
  return (
    <>
      <Lead>
        ArcPool is a test-network product. This page lists what can go wrong and says plainly what has been checked and
        what has not.
      </Lead>

      <Callout tone="warn" title="Use test funds only">
        ArcPool is deployed on Arc Testnet. Do not treat it as production, and do not use it as the basis for a mainnet
        deployment without your own independent review.
      </Callout>

      <H2>Risks</H2>
      <Table
        head={['Risk', 'What it means for you']}
        rows={[
          ['Vault loss', 'Idle USDC is lent to two third-party vaults the pool trusts. If a vault loses money or is exploited, the pool writes the loss down and the rUSDC exchange rate falls.'],
          ['Vault liquidity', 'A large withdrawal can revert if the idle buffer and the vaults cannot release enough USDC right now. You can retry with a smaller amount or free liquidity in steps.'],
          ['No yield', 'Reported APY is not guaranteed. At the time of writing both vaults showed a flat share price on chain, so they added no yield.'],
          ['Mispriced swaps', 'Testnet swap pools are shallow and can quote inconsistent prices. The price check warns about this but cannot fix it.'],
          ['Early exit cost', 'Redeeming soon after staking while rewards are vesting returns slightly less than you put in.'],
          ['Admin powers', 'The admin can pause deposits, set a deposit cap and set a commission of up to 20% on USDC added as rewards. It cannot move user funds, change the vaults or stop withdrawals.'],
          ['Smart contract bugs', 'The code can contain bugs that tests and reviews did not find.'],
        ]}
      />

      <H2>What has been checked</H2>
      <ul>
        <li>
          Three rounds of automated review by two independent reviewers. The issues found were fixed: reward sandwiching,
          reward delay by dust amounts, exits blocked by partly illiquid vaults, and vault gains escaping vesting through
          recalls.
        </li>
        <li>
          A Foundry test suite with 84 tests: constructor checks, pricing, vesting, lending, losses, partial liquidity,
          pausing and caps, fuzz tests and invariants. The vaults in these tests are mocks, one of which behaves like the
          Morpho VaultV2.
        </li>
        <li>A static analysis pass. Its remaining notes concern state updates around calls to the trusted vaults, which is how the pool is designed to work.</li>
      </ul>

      <H2>What has not been checked</H2>
      <ul>
        <li>
          <strong>No professional audit.</strong> The reviews above are automated and do not replace one.
        </li>
        <li>
          <strong>Real-vault behaviour.</strong> Plain forks of Arc cannot run USDC transfers, so lending and recalling
          against the two real vaults can only be confirmed with live transactions. Check Pending yield and Lent to
          vaults on the Stake page after the first stake.
        </li>
        <li>The behaviour of the vaults under stress, such as a vault that pauses or caps withdrawals for a long time.</li>
      </ul>
    </>
  )
}
