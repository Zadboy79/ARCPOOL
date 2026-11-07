# ArcPool

A liquid staking pool for USDC on Arc, inspired by Rocket Pool. Stake USDC to receive rUSDC, a liquid token that is worth more USDC as rewards stream into the pool. Unstake instantly at any time.

Built with [Arc Studio](https://studio.arc.io)

## What you can do

- Stake USDC and receive rUSDC
- Withdraw rUSDC for USDC instantly, with no lockup, and see your withdrawal history
- Swap USDC, EURC and cirBTC through the liquidity available on Arc, with live quotes, route details and slippage control. When one pool cannot fill an order, the router goes through USDC or splits the order into several swaps
- Swap USDC and rUSDC at the pool rate
- Earn page with the pool's live reward rate and size
- Rewards page with your estimated earnings, a way to add USDC rewards that stream to stakers over 24 hours, and the history of rewards added
- Built-in documentation at `/docs`: overview, getting started, how pricing and vesting work, reward sources, risks, contract reference, integration examples and FAQ, with search and live pool values
- Dark and light themes

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

- `VITE_ARC_POOL_ADDRESS`: address of the deployed ArcPool contract on Arc Testnet.
- `VITE_ARC_EURC_ADDRESS`: EURC token address on Arc Testnet.
- `VITE_ARC_CIRBTC_ADDRESS`: cirBTC token address on Arc Testnet.
- `VITE_ARC_LEGACY_POOL_ADDRESS`: the first ArcPool deployment, so people still staked there can withdraw.
- `VITE_ARC_POOL_DEPLOY_BLOCK`: block the contract was deployed in, where history reading starts.
