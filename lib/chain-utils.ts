"use client"

// EIP-3085 request shape for wallet_addEthereumChain
export interface ChainConfig {
  chainId: string // 0x-prefixed hex (required)
  chainName: string
  rpcUrls: string[]
  blockExplorerUrls?: string[]
  nativeCurrency: { name: string; symbol: string; decimals: number }
}

// Build from env and validate upfront.
// During Next.js static prerendering env vars may be absent — return a
// placeholder so the build completes. Client-side renders will pick up the
// real values inlined by Next.js at build time.
export function requiredChainFromEnv(): ChainConfig {
  const chainIdHex = (process.env.NEXT_PUBLIC_CHAIN_ID || "").toLowerCase()
  const chainName = process.env.NEXT_PUBLIC_CHAIN_NAME || "Custom EVM"
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL
  const explorer = process.env.NEXT_PUBLIC_EXPLORER_URL

  if (!/^0x[0-9a-f]+$/.test(chainIdHex) || !rpcUrl) {
    // Return a safe placeholder during prerender / missing-env builds
    return {
      chainId: "0x0",
      chainName,
      rpcUrls: [],
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    }
  }

  return {
    chainId: chainIdHex,
    chainName,
    rpcUrls: [rpcUrl],
    blockExplorerUrls: explorer ? [explorer] : undefined,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  }
}
