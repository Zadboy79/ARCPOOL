import { usePoolData } from '@/hooks/usePoolData'
import { useVaults } from '@/hooks/useVaults'
import { formatDuration } from '@/lib/format'
import { CHAIN_ID, LEGACY_POOL_ADDRESS, POOL_ADDRESS, USDC_ADDRESS } from '@/lib/pool'
import { requireChain } from '@/onchain-facts'
import { AddressRow, Callout, H2, H3, Lead, Table } from '../components'

const READS: string[][] = [
  ['totalAssets()', 'uint256', 'Net assets: idle + deployed - locked. The exit price is based on this.'],
  ['exchangeRate()', 'uint256', 'USDC (6 decimals) that one whole rUSDC redeems for at the exit price.'],
  ['previewDeposit(assets)', 'uint256', 'rUSDC minted for a deposit, at the gross entry price.'],
  ['previewMint(shares)', 'uint256', 'USDC needed to mint shares, at the gross entry price.'],
  ['previewRedeem(shares)', 'uint256', 'USDC for redeeming shares, at the net exit price.'],
  ['previewWithdraw(assets)', 'uint256', 'rUSDC burned to withdraw assets, at the net exit price.'],
  ['maxDeposit(addr) / maxMint(addr)', 'uint256', 'Remaining capacity under the deposit cap. 0 while deposits are paused.'],
  ['lockedRewards()', 'uint256', 'USDC still vesting.'],
  ['idleAssets() / deployed()', 'uint256', 'USDC in the pool and USDC lent to vaults, at cost.'],
  ['pendingYield()', 'uint256', 'Vault gain not yet harvested. 0 if any vault cannot be read.'],
  ['rebalanceAmount()', 'uint256', 'USDC that rebalance would lend right now.'],
  ['vaultsLength() / vaultAt(i) / vaultAssets(i)', '', 'The fixed vault list and what the pool holds in each.'],
  ['totalRewardsDistributed() / totalYieldHarvested()', 'uint256', 'Lifetime USDC added as rewards and harvested from vaults.'],
  ['vestingPeriod() / bufferBps() / commissionBps() / treasury()', '', 'Parameters. The first two never change.'],
  ['depositCap() / paused() / launchTime()', '', 'Admin-set cap, deposit pause flag and deployment time.'],
]

const WRITES: string[][] = [
  ['deposit(assets, receiver)', 'Anyone', 'Stake USDC for rUSDC. Needs prior USDC approval. Blocked while paused.'],
  ['mint(shares, receiver)', 'Anyone', 'Stake enough USDC to mint an exact amount of rUSDC.'],
  ['withdraw(assets, receiver, owner)', 'Owner or approved', 'Withdraw an exact USDC amount. Pulls from the vaults if idle USDC is short.'],
  ['redeem(shares, receiver, owner)', 'Owner or approved', 'Burn rUSDC for USDC.'],
  ['addRewards(amount)', 'Anyone', 'Add USDC rewards. Reverts with NoStakers when there is no rUSDC.'],
  ['harvest()', 'Anyone', 'Lock pending vault yield and start vesting it. Returns the gain.'],
  ['rebalance()', 'Anyone', 'Lend idle USDC above the buffer to the vaults. Returns the amount lent.'],
  ['sync()', 'Anyone', 'harvest() then rebalance() in one call.'],
  ['recallFromVault(i, assets)', 'Anyone', 'Move USDC from vault i into the pool. Use max uint256 for the whole position.'],
  ['setDepositCap(cap)', 'Admin', 'Limit total assets for new deposits. Exits are never limited.'],
  ['setCommission(bps, treasury)', 'Admin', 'Commission on addRewards only, up to 2000 bps (20%).'],
  ['pause() / unpause()', 'Admin', 'Close or reopen deposits and mints. Never affects exits.'],
]

const EVENTS: string[][] = [
  ['Deposit(sender, owner, assets, shares)', 'ERC-4626. A stake.'],
  ['Withdraw(sender, receiver, owner, assets, shares)', 'ERC-4626. A withdrawal.'],
  ['RewardsAdded(funder, amount, commissionAssets)', 'USDC added through addRewards.'],
  ['Harvested(caller, gain)', 'Vault yield locked for vesting.'],
  ['Rebalanced(vault, assets)', 'USDC lent to a vault (0 when the vault refused).'],
  ['VaultWithdrawn(vault, assets)', 'USDC pulled back from a vault.'],
  ['LossRealized(previousDeployed, newDeployed)', 'Deployed cost written down to the vaults\' value.'],
  ['DepositCapUpdated(previousCap, newCap) / CommissionUpdated(bps, treasury)', 'Admin changes.'],
]

const ERRORS: string[][] = [
  ['InsufficientLiquidity(needed, available)', 'Idle USDC plus what the vaults can release does not cover the exit.'],
  ['NoStakers', 'addRewards with no rUSDC outstanding.'],
  ['ZeroRewardAmount / ZeroNetRewards', 'A reward of 0, or one that is 0 after commission.'],
  ['VaultReadFailed', 'harvest() or recallFromVault() could not read a vault.'],
  ['CommissionTooHigh(bps)', 'Commission above 2000 bps.'],
  ['InvalidVestingPeriod, InvalidVaultCount, DuplicateVault, VaultAssetMismatch, BufferTooHigh, ZeroAddress', 'Constructor checks.'],
]

export function Contracts() {
  const { data } = usePoolData()
  const { vaults } = useVaults(data.vaultCount)
  const chain = requireChain(CHAIN_ID)

  return (
    <>
      <Lead>
        Everything below is live on {chain.name}. The pool is one contract, <code>ArcPool</code>. Read it on the explorer
        before you trust any function name on this page.
      </Lead>

      <H2>Addresses</H2>
      <div className="doc-table-wrap">
        <table className="doc-table">
          <tbody>
            <AddressRow label="ArcPool" address={POOL_ADDRESS} note="Pool and rUSDC token" />
            <AddressRow label="USDC" address={USDC_ADDRESS} note="ERC-20 interface of Arc's native USDC" />
            {vaults.map((vault) => (
              <AddressRow
                key={vault.address}
                label={vault.name ?? `Vault ${vault.index + 1}`}
                address={vault.address}
                note="Lending vault"
              />
            ))}
            {LEGACY_POOL_ADDRESS ? (
              <AddressRow label="Previous ArcPool" address={LEGACY_POOL_ADDRESS} note="First deployment, no vaults" />
            ) : null}
          </tbody>
        </table>
      </div>

      <H2>Parameters</H2>
      <Table
        head={['Parameter', 'Value', 'Notes']}
        rows={[
          ['Vesting window', data.vestingPeriod !== undefined ? formatDuration(Number(data.vestingPeriod)) : '...', 'Fixed at deployment, 1 hour to 30 days.'],
          ['Idle buffer', data.bufferBps !== undefined ? `${data.bufferBps / 100}%` : '...', 'Share of the pool kept idle. Fixed at deployment.'],
          ['Commission', data.commissionBps !== undefined ? `${data.commissionBps / 100}%` : '...', 'On addRewards only. Admin-set, up to 20%.'],
          ['Deposits', data.paused === undefined ? '...' : data.paused ? 'Paused' : 'Open', 'Exits are never paused.'],
          ['Vaults', data.vaultCount !== undefined ? String(data.vaultCount) : '...', 'One to four allowed. Fixed at deployment.'],
          ['rUSDC decimals', '12', 'USDC decimals + 6 virtual-share offset.'],
        ]}
      />

      <H2>Functions</H2>
      <H3>Reads</H3>
      <Table head={['Function', 'Returns', 'What it gives you']} rows={READS} />
      <H3>Writes</H3>
      <Table head={['Function', 'Caller', 'What it does']} rows={WRITES} />
      <Callout title="Standard ERC-4626 and ERC-20">
        The pool also exposes the usual ERC-4626 and ERC-20 functions such as <code>asset</code>,{' '}
        <code>convertToShares</code>, <code>convertToAssets</code>, <code>balanceOf</code>, <code>transfer</code> and{' '}
        <code>approve</code>. Entry previews are intentionally not equal to the convert functions; see How it works.
      </Callout>

      <H2>Events</H2>
      <Table head={['Event', 'Emitted when']} rows={EVENTS} />

      <H2>Errors</H2>
      <Table head={['Error', 'Meaning']} rows={ERRORS} />
    </>
  )
}
