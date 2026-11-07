import { Link } from '@/lib/router'
import { Callout, H2, Lead, Steps } from '../components'

export function GettingStarted() {
  return (
    <>
      <Lead>Stake your first USDC in a few minutes. You need a browser wallet and some test USDC on Arc Testnet.</Lead>

      <H2>Before you begin</H2>
      <ul>
        <li>A browser wallet such as MetaMask. ArcPool connects to injected wallets.</li>
        <li>
          Test USDC on Arc Testnet. Request it from the Circle faucet at faucet.circle.com and pick Arc Testnet. Gas on
          Arc is paid in USDC too, so one balance covers both.
        </li>
      </ul>

      <H2>Make your first stake</H2>
      <Steps>
        <li>
          <strong>Connect your wallet.</strong> Choose Connect wallet at the top right. If your wallet is on another
          network the button changes to Switch to Arc Testnet.
        </li>
        <li>
          <strong>Enter an amount.</strong> On the Stake page type how much USDC to stake. Max keeps 0.1 USDC back for
          network fees. The page shows how much rUSDC you will receive.
        </li>
        <li>
          <strong>Allow USDC.</strong> The first time, and whenever you stake more than you allowed before, your wallet
          asks you to approve exactly that amount.
        </li>
        <li>
          <strong>Stake.</strong> Confirm the second transaction. When it is confirmed your rUSDC appears in your
          wallet.
        </li>
        <li>
          <strong>Update the pool (optional).</strong> Anyone can press Update pool under Reward sources to lend idle
          USDC to the vaults and collect any waiting yield.
        </li>
      </Steps>

      <Callout title="Add rUSDC to your wallet">
        rUSDC is a normal ERC-20 token with 12 decimals. If your wallet does not list it, add the pool address from the{' '}
        <Link to="/docs/contracts" className="link">Contracts</Link> page as a custom token.
      </Callout>

      <H2>Take your money out</H2>
      <Steps>
        <li>
          Open <strong>Stake, then Withdrawals</strong> from the top menu.
        </li>
        <li>Enter the rUSDC amount, or press Max for everything you hold.</li>
        <li>
          Confirm. You receive USDC at the current exit price. Large exits can fail if the vaults cannot release enough
          USDC right now; see <Link to="/docs/staking" className="link">Stake and withdraw</Link>.
        </li>
      </Steps>

      <H2>What to expect</H2>
      <ul>
        <li>
          Your rUSDC balance does not change. Its value in USDC goes up when yield or rewards arrive, so check the
          exchange rate on the Stake page.
        </li>
        <li>
          If no vault is earning and nobody has added rewards, the reward rate is 0% and the exchange rate stays flat.
        </li>
        <li>
          Right after staking, redeeming immediately returns slightly less than you put in whenever rewards are still
          vesting. That is the fair-entry rule described in <Link to="/docs/how-it-works" className="link">How it works</Link>.
        </li>
      </ul>
    </>
  )
}
