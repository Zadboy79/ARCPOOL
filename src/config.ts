/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arcTestnet } from 'viem/chains'
import { injected } from 'wagmi/connectors'
import { registerChain } from './tracing'

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arcTestnet.id, arcTestnet.rpcUrls.default.http[0])

export const config = createConfig({
  chains: [arcTestnet, mainnet], // mainnet needed for ENS resolution
  connectors: [injected()],
  transports: {
    // Batch concurrent reads into one request and retry gently: the public RPC rate limits bursts.
    [arcTestnet.id]: http(undefined, { batch: { wait: 30 }, retryCount: 2, retryDelay: 1_500 }),
    [mainnet.id]: http(undefined, { retryCount: 1 }), // ENS resolution uses mainnet
  },
})
