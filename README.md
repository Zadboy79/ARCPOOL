# ArcPool

A liquid staking pool for USDC on Arc, inspired by Rocket Pool and Lido. Stake USDC and receive rUSDC, a token that is worth more USDC as rewards reach the pool. There is no lockup: unstake whenever you want.

Built with [Arc Studio](https://studio.arc.io)

> **Testnet only.** ArcPool runs on Arc Testnet with test USDC. It has had an automated review and a test suite, not a professional audit. Read [Risks and limits](#risks-and-limits) before you put in anything you care about.

## What you can do

- **Stake** USDC and receive rUSDC. Your rUSDC balance stays the same while the USDC it is worth goes up.
- **Withdraw** rUSDC for USDC at any time, with a history of your withdrawals.
- **Swap** USDC, EURC and cirBTC through the liquidity available on Arc, with live quotes, route details and slippage control. If one pool cannot fill an order, the router goes through USDC or splits the order into several swaps.
- **Swap USDC and rUSDC** at the pool rate with no slippage.
- **Earn** page with the pool's live reward rate, size and reward sources.
- **Rewards** page with your estimated earnings, a form to add USDC rewards that stream to stakers over 24 hours, and the history of rewards added.
- **Docs** at `/docs`: getting started, pricing and vesting, reward sources, risks, contract reference, integration examples and FAQ.
- Dark and light themes.

## How it works

1. **You stake USDC.** You receive rUSDC. It is a standard ERC-4626 share token with 12 decimals.
2. **Idle USDC is put to work.** The pool keeps about 10% idle for withdrawals and lends the rest, split evenly, to two ERC-4626 vaults on Arc Testnet: a Morpho VaultV2 and a simple mock vault.
3. **Rewards stream to stakers.** Vault gains, and USDC that anyone adds as rewards, are released linearly over 24 hours. Your rUSDC is worth a little more every second.
4. **You exit when you want.** The pool pays from its idle USDC and pulls the rest back from the vaults.

Two prices keep it fair. New stakers pay the full price, including rewards still vesting, so nobody can join just before a payout and take what earlier stakers earned. Withdrawals are paid at the price that has already vested.

## Reward sources

| Source | What it is |
|---|---|
| Vault yield | Interest earned by the two vaults the pool lends to. It enters the reward stream when someone presses **Update pool**. |
| Added rewards | USDC that anyone adds on the Rewards page. It streams to stakers over 24 hours. |

Be aware of what the vaults earn today. The APY figures shown next to them come from Circle Earn data. A pool only receives yield when a vault's share price actually rises. When this was written (6 November 2026) both vault share prices had been flat for about three weeks, and the Morpho market behind the main vault had about 104,336 USDC supplied and only about 19.8 USDC borrowed (0.02% utilization), so almost no interest was being paid. Liquidity is not the problem: about 104,316 USDC could be withdrawn at that moment. Pending yield on the Stake page is the number to trust.

## Contracts (Arc Testnet, chain id 5042002)

| Contract | Address |
|---|---|
| ArcPool (current) | `0x24db067a894f2fdb7b9a7b8f3836cc748dd15c16` |
| ArcPool (first version) | `0xf282faf8088c20b99b15a3dedc90ff88617ef7ff` |
| EarnKit USDC Vault (Morpho VaultV2) | `0xAabbeF1D3971c710276ed41eC791BbE14CdB8E88` |
| MockMorphoVault | `0x8f2D33B5D4B9B5F02DF635AE308F7B4C9dA8D2DC` |

The first version stays listed so people still staked there can withdraw from the Withdrawals page. The Solidity source is in `contracts/ArcPool.sol`; the first version is kept in `docs/legacy/`.

The admin can pause new staking, set a deposit cap, and set a commission of up to 20% on rewards that people add (off by default). The admin cannot move staked funds, block withdrawals, or change the vault list.

## Risks and limits

- Test USDC on a test network. Do not treat any rate or yield as real.
- The vaults are third-party contracts fixed when the pool was deployed. If a vault loses money or cannot pay out, the pool is affected.
- Withdrawals are instant only while the pool's idle USDC and the vaults can pay. When they cannot, a withdrawal fails and you can try a smaller amount.
- Testnet swap pools are shallow and can be mispriced. The Swap page shows a price check and says when no route exists.
- Reviewed with automated checks and 84 tests that use mock vaults. It has not been professionally audited, and it was not tested end to end against the real vaults.

## Tech stack

- React, Vite, TypeScript, Tailwind CSS
- wagmi, viem, ConnectKit
- Circle App Kit for market swaps
- Solidity 0.8.28 with OpenZeppelin and Foundry
- Arc Testnet (USDC)

## Development

Prerequisites: [Bun](https://bun.sh) and [Foundry](https://getfoundry.sh).

```bash
bun install
bun run dev
```

Other scripts: `bun run check` (lint and typecheck), `bun run contracts:build`, `bun run contracts:test`.

### Environment variables

Create a `.env` file in the project root. None of these are secrets.

- `VITE_ARC_POOL_ADDRESS`: address of the deployed ArcPool contract on Arc Testnet.
- `VITE_ARC_POOL_DEPLOY_BLOCK`: block the contract was deployed in, where history reading starts.
- `VITE_ARC_LEGACY_POOL_ADDRESS`: the first ArcPool deployment, so people still staked there can withdraw.
- `VITE_ARC_EURC_ADDRESS`: EURC token address on Arc Testnet.
- `VITE_ARC_CIRBTC_ADDRESS`: cirBTC token address on Arc Testnet.
