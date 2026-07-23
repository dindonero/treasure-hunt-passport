import { defineChain } from "viem"

const chainId = Number.parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "0x539", 16)
const chainName = process.env.NEXT_PUBLIC_CHAIN_NAME || "Local Network"
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://localhost:8545"
const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL || "http://localhost:8545"

export const customChain = defineChain({
  id: chainId,
  name: chainName,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [rpcUrl] },
  },
  blockExplorers: {
    default: {
      name: "Explorer",
      url: explorerUrl,
    },
  },
})
