import { CHAIN_ID, DEPLOY_BLOCK, POOL_ADDRESS, USDC_ADDRESS } from '@/lib/pool'
import { getChain } from '@/onchain-facts'
import { Callout, CodeBlock, H2, H3, Lead } from '../components'

export function Integrate() {
  const chain = getChain(CHAIN_ID)
  const rpc = chain?.rpcUrls[0] ?? ''

  const setup = `import { createPublicClient, createWalletClient, custom, http, parseAbi, erc20Abi } from 'viem'
import { arcTestnet } from 'viem/chains'

const POOL = '${POOL_ADDRESS}'
const USDC = '${USDC_ADDRESS}'

const poolAbi = parseAbi([
  'function totalAssets() view returns (uint256)',
  'function exchangeRate() view returns (uint256)',
  'function previewDeposit(uint256 assets) view returns (uint256)',
  'function previewRedeem(uint256 shares) view returns (uint256)',
  'function pendingYield() view returns (uint256)',
  'function deposit(uint256 assets, address receiver) returns (uint256)',
  'function redeem(uint256 shares, address receiver, address owner) returns (uint256)',
  'function sync() returns (uint256 gain, uint256 moved)',
])

const client = createPublicClient({ chain: arcTestnet, transport: http('${rpc}') })`

  const reads = `const [totalAssets, rate, pending] = await Promise.all([
  client.readContract({ address: POOL, abi: poolAbi, functionName: 'totalAssets' }),
  client.readContract({ address: POOL, abi: poolAbi, functionName: 'exchangeRate' }),
  client.readContract({ address: POOL, abi: poolAbi, functionName: 'pendingYield' }),
])

// All three are USDC with 6 decimals.
console.log({ totalAssets, rate, pending })

// Quote a stake of 10 USDC before sending it. rUSDC has 12 decimals.
const shares = await client.readContract({
  address: POOL,
  abi: poolAbi,
  functionName: 'previewDeposit',
  args: [10_000_000n],
})`

  const stake = `const wallet = createWalletClient({ chain: arcTestnet, transport: custom(window.ethereum) })
const [account] = await wallet.getAddresses()
const amount = 10_000_000n // 10 USDC

// 1. Approve exactly what you will stake.
const approveHash = await wallet.writeContract({
  account,
  address: USDC,
  abi: erc20Abi,
  functionName: 'approve',
  args: [POOL, amount],
})
await client.waitForTransactionReceipt({ hash: approveHash })

// 2. Stake.
const stakeHash = await wallet.writeContract({
  account,
  address: POOL,
  abi: poolAbi,
  functionName: 'deposit',
  args: [amount, account],
})
await client.waitForTransactionReceipt({ hash: stakeHash })`

  const exit = `// Redeem everything you hold.
const balance = await client.readContract({ address: POOL, abi: erc20Abi, functionName: 'balanceOf', args: [account] })
const usdcOut = await client.readContract({ address: POOL, abi: poolAbi, functionName: 'previewRedeem', args: [balance] })

const hash = await wallet.writeContract({
  account,
  address: POOL,
  abi: poolAbi,
  functionName: 'redeem',
  args: [balance, account, account],
})`

  const sync = `// Anyone can keep the pool working: lend idle USDC and lock waiting vault yield.
const hash = await wallet.writeContract({ account, address: POOL, abi: poolAbi, functionName: 'sync' })`

  const logs = `import { parseAbiItem } from 'viem'

const DEPLOY_BLOCK = ${DEPLOY_BLOCK}n // never scan from block 0
const head = await client.getBlockNumber()

const rewards = await client.getLogs({
  address: POOL,
  event: parseAbiItem('event RewardsAdded(address indexed funder, uint256 amount, uint256 commissionAssets)'),
  fromBlock: DEPLOY_BLOCK,
  toBlock: head,
})`

  return (
    <>
      <Lead>
        ArcPool is a standard ERC-4626 vault, so any ERC-4626 tooling can read it. These examples use viem and the live
        addresses on {chain?.name ?? 'Arc Testnet'}.
      </Lead>

      <H2>Setup</H2>
      <CodeBlock code={setup} />

      <H2>Read the pool</H2>
      <CodeBlock code={reads} />
      <Callout title="Use the previews, not the convert functions">
        Staking is priced at the gross value, so <code>previewDeposit</code> returns what you will really get and can be
        lower than <code>convertToShares</code>. Always quote with the preview functions.
      </Callout>

      <H2>Stake and withdraw</H2>
      <H3>Stake</H3>
      <CodeBlock code={stake} />
      <H3>Withdraw</H3>
      <CodeBlock code={exit} />
      <p>
        A withdrawal can revert with <code>InsufficientLiquidity</code> when the vaults cannot release enough USDC. Retry
        with a smaller amount, or call <code>recallFromVault(i, assets)</code> first.
      </p>

      <H2>Keep the pool working</H2>
      <CodeBlock code={sync} />

      <H2>Read history</H2>
      <p>
        Start event scans at the deployment block, never at block 0, and move forward in bounded ranges. Save the last
        block you scanned so a restart resumes where it stopped.
      </p>
      <CodeBlock code={logs} />

      <H2>Amounts and units</H2>
      <ul>
        <li>USDC amounts use the ERC-20 view with 6 decimals. Arc&apos;s gas balance uses 18 decimals for the same money, so never add the two.</li>
        <li>rUSDC has 12 decimals.</li>
        <li>Never ask the native USDC sentinel for <code>decimals()</code>; use the USDC ERC-20 address above.</li>
      </ul>
    </>
  )
}
