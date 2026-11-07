import { usePoolData } from '@/hooks/usePoolData'
import { useVaults } from '@/hooks/useVaults'
import { formatFixed, shortAddress } from '@/lib/format'
import { CHAIN_ID, USDC_DECIMALS } from '@/lib/pool'
import { buildAddressExplorerUrl } from '@/onchain-facts'
import { Callout, CodeBlock, H2, H3, Lead, Steps, Table } from '../components'

export function RewardSources() {
  const { data } = usePoolData()
  const { vaults } = useVaults(data.vaultCount)

  return (
    <>
      <Lead>
        The pool earns by lending its idle USDC to two ERC-4626 vaults on Arc Testnet. The yield those vaults earn is
        collected into the pool and released to stakers over time.
      </Lead>

      <H2>The two vaults</H2>
      <Table
        head={['Vault', 'Protocol', 'Address', 'Pool holds', 'Reported APY']}
        rows={
          vaults.length === 0
            ? [['Loading...', '', '', '', '']]
            : vaults.map((vault) => [
                vault.name ?? `Vault ${vault.index + 1}`,
                vault.protocol ?? 'n/a',
                <a
                  key={vault.address}
                  href={buildAddressExplorerUrl(CHAIN_ID, vault.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link mono text-xs"
                >
                  {shortAddress(vault.address)}
                </a>,
                `${formatFixed(vault.allocated, USDC_DECIMALS, 4)} USDC`,
                vault.reportedApy !== undefined ? `${(vault.reportedApy * 100).toFixed(1)}%` : 'n/a',
              ])
        }
      />
      <p className="text-xs" style={{ color: 'var(--muted)' }}>
        Names and APY come from Circle Earn; the amounts come from the pool contract. The vault list is fixed when the pool
        is deployed and cannot be changed afterwards.
      </p>

      <H2>From vault to staker</H2>
      <Steps>
        <li>
          <strong>Lend.</strong> <code>rebalance()</code> sends idle USDC above the 10% buffer to the vaults, split
          equally. A vault that refuses its share leaves that share idle.
        </li>
        <li>
          <strong>Accrue.</strong> If a vault&apos;s share price rises, the pool&apos;s position in it is worth more than
          what was lent. The extra is shown as pending yield and is <em>not</em> yet in the exit price.
        </li>
        <li>
          <strong>Harvest.</strong> <code>harvest()</code> locks the pending yield and starts releasing it linearly.
          Withdrawals and recalls do this automatically before they move any vault funds.
        </li>
        <li>
          <strong>Vest.</strong> Over the vesting window the exit price rises to include the yield, so every rUSDC
          becomes worth more.
        </li>
      </Steps>
      <p>
        <code>sync()</code> does harvest and rebalance in one transaction. It is what the Update pool button calls.
        Nothing runs by itself on a schedule, so someone has to press it. Anyone can, and it costs only gas.
      </p>

      <H2>What the vaults really earn</H2>
      <Callout tone="warn" title="Reported APY is not the same as yield on chain">
        The APY figures come from Circle&apos;s Earn data. A pool only receives yield when a vault&apos;s share price
        actually rises on chain. When this page was written (6 November 2026) the share price of both vaults had been
        flat for about three weeks, so the yield reaching the pool from them was zero. Pending yield on the Stake page
        is the number to trust.
      </Callout>
      <p>
        The reason is demand. The EarnKit vault lends everything into one Morpho market. On 6 November 2026 that market
        had about 104,336 USDC supplied and only about 19.8 USDC borrowed, a utilization of 0.02%. Suppliers are paid
        from borrowers&apos; interest, so almost no borrowing means almost no yield. Liquidity is not the problem:
        about 104,316 USDC could be withdrawn at that moment, far more than the pool lends. The mock vault holds its
        356 USDC itself and does not change its share price.
      </p>
      <H3>Check a vault yourself</H3>
      <p>Read what one share is worth now and at an older block. If the two match, the vault has not earned in between.</p>
      <CodeBlock
        language="ts"
        code={`const now = await client.readContract({ address: vault, abi, functionName: 'convertToAssets', args: [10n ** 18n] })
const before = await client.readContract({ address: vault, abi, functionName: 'convertToAssets', args: [10n ** 18n], blockNumber })`}
      />

      <H2>Vault compatibility</H2>
      <ul>
        <li>The pool only uses <code>asset</code>, <code>balanceOf</code>, <code>convertToAssets</code>, <code>deposit</code>, <code>withdraw</code> and <code>redeem</code> on vaults.</li>
        <li>
          The Morpho VaultV2 returns 0 from every <code>max*</code> function, so the pool never calls them.
        </li>
        <li>Each vault&apos;s asset must be the same USDC as the pool&apos;s, checked at deployment.</li>
      </ul>
    </>
  )
}
