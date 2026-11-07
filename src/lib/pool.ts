import { getAddress, parseAbi, type Address } from 'viem'
import { arcTestnet } from 'viem/chains'
import { getUsdc } from '@/onchain-facts'
import { usdcDecimalsFor } from '@/onchain-money'

export const CHAIN_ID = arcTestnet.id

const rawPool = import.meta.env.VITE_ARC_POOL_ADDRESS as string | undefined
if (!rawPool) throw new Error('VITE_ARC_POOL_ADDRESS is not set in .env')

export const POOL_ADDRESS: Address = getAddress(rawPool)

/** The first ArcPool deployment, kept so anyone still staked there can exit. */
const rawLegacy = import.meta.env.VITE_ARC_LEGACY_POOL_ADDRESS as string | undefined
export const LEGACY_POOL_ADDRESS: Address | undefined = rawLegacy ? getAddress(rawLegacy) : undefined

const usdcFact = getUsdc(CHAIN_ID)
if (!usdcFact) throw new Error('USDC is not registered for Arc Testnet')

export const USDC_ADDRESS: Address = usdcFact.address as Address
export const USDC_DECIMALS = usdcDecimalsFor(CHAIN_ID)
/** rUSDC carries USDC's decimals plus the pool's 6-digit virtual-share offset. */
export const SHARE_DECIMALS = USDC_DECIMALS + 6

export const SECONDS_PER_YEAR = 31_536_000n

/** Block the pool was deployed at; event history is never scanned from before it. */
export const DEPLOY_BLOCK = BigInt(import.meta.env.VITE_ARC_POOL_DEPLOY_BLOCK as string)

export const poolAbi = parseAbi([
  'function totalAssets() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function exchangeRate() view returns (uint256)',
  'function totalRewardsDistributed() view returns (uint256)',
  'function lockedRewards() view returns (uint256)',
  'function vestEnd() view returns (uint64)',
  'function vestingPeriod() view returns (uint256)',
  'function launchTime() view returns (uint256)',
  'function paused() view returns (bool)',
  'function commissionBps() view returns (uint16)',
  'function maxDeposit(address) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function maxRedeem(address) view returns (uint256)',
  'function previewDeposit(uint256) view returns (uint256)',
  'function previewRedeem(uint256) view returns (uint256)',
  'function deposit(uint256 assets, address receiver) returns (uint256)',
  'function redeem(uint256 shares, address receiver, address owner) returns (uint256)',
  'function withdraw(uint256 assets, address receiver, address owner) returns (uint256)',
  'function addRewards(uint256 amount)',
  'function idleAssets() view returns (uint256)',
  'function deployed() view returns (uint256)',
  'function pendingYield() view returns (uint256)',
  'function rebalanceAmount() view returns (uint256)',
  'function totalYieldHarvested() view returns (uint256)',
  'function bufferBps() view returns (uint16)',
  'function vaultsLength() view returns (uint256)',
  'function vaultAt(uint256 i) view returns (address)',
  'function vaultAssets(uint256 i) view returns (uint256)',
  'function sync() returns (uint256 gain, uint256 moved)',
  'function recallFromVault(uint256 i, uint256 assets) returns (uint256 got)',
  'event Harvested(address indexed caller, uint256 gain)',
  'event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)',
  'event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)',
  'event RewardsAdded(address indexed funder, uint256 amount, uint256 commissionAssets)',
])
