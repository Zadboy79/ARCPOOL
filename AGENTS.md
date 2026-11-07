# ArcPool

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

ArcPool: Rocket Pool style liquid staking for USDC on Arc Testnet. Users stake USDC and receive rUSDC (ERC-4626, 12 decimals). Rewards are added by anyone via addRewards and vest linearly (weighted-average schedule, 24h base) so deposit-before-reward sandwiching earns nothing. Unstaking is instant and never pausable.

## Deployed contracts

- ArcPool v2 on Arc Testnet: 0x24db067a894f2fdb7b9a7b8f3836cc748dd15c16 (admin: platform deployer wallet; constructor: USDC, admin, vestingPeriod=86400, vaults=[EarnKit USDC Vault 0xaabbef1d3971c710276ed41ec791bbe14cdb8e88, MockMorphoVault 0x8f2d33b5d4b9b5f02df635ae308f7b4c9da8d2dc], bufferBps=1000). In .env as VITE_ARC_POOL_ADDRESS. Entry priced at gross (incl. unvested/unharvested), exit at net. Vault gains vest via harvest()/sync(); recallFromVault frees partial liquidity.
- ArcPool v1 (legacy, no vaults): 0xf282faf8088c20b99b15a3dedc90ff88617ef7ff. Source backup in docs/legacy/. UI offers a withdraw card (VITE_ARC_LEGACY_POOL_ADDRESS).
- Note: on-chain vault share prices were flat for weeks when checked, so vault yield may be zero; Earn Kit APY is an estimate. Plain forge forks of Arc cannot run USDC transfers (needs Arc precompiles), so real-vault checks must be live.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Route switch (path-based, `src/lib/router.tsx`): `/` stake, `/withdrawals`, `/rewards`, `/earn`, `/swap`. Lido-style dark/light UI; pages in `src/pages/`, shared stake/unstake logic in `src/hooks/useConvert.ts`, chain history in `src/hooks/usePoolEvents.ts` (starts at VITE_ARC_POOL_DEPLOY_BLOCK).
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

- `src/docs/` - documentation site served at `/docs/*` (own layout in `DocsLayout.tsx`, page list in `nav.ts`, one file per page in `pages/`). Pages read live values from the pool; add a page by adding it to `nav.ts`, `DocsApp.tsx` and `pages/`. Keep claims in sync with the contract.

## Share links

- Starter apps already ship `getShareBase`, `buildShareLink` and `installShareSync` in `src/lib/share.ts`; import them instead of rewriting them.
- Keep shareable state in the URL path or query, not in the `#fragment`.
- Never put a secret (private key, claim secret, seed phrase, session token, API key) in the URL path or query, encoded or not: every in-app path and query is mirrored to the visitor's studio.arc.io address bar and browser history and reaches servers. A bearer claim secret goes only in the `#fragment` appended to the share link (`` `${await buildShareLink('/claim')}#${secret}` ``) and is read from `location.hash` on load. A link to the app's own share URL shown inside the app must be copy-only or open in a new tab with `target="_blank" rel="noopener noreferrer"`.
- Build every link a user copies or sends with `buildShareLink()` from `src/lib/share.ts`.
- Keep the `installShareSync()` call in `src/main.tsx` when editing it; it keeps the Studio address bar in step with in-app navigation.
- Navigate inside the app with relative links.

## To Run

```bash
bun install
bun run dev
```
