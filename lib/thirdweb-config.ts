import { createThirdwebClient } from "thirdweb"
import { defineChain } from "thirdweb/chains"
import { inAppWallet, createWallet } from "thirdweb/wallets"
import type { SmartWalletOptions } from "thirdweb/wallets/smart"

const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!
const chainId = Number.parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "0x539", 16)
const chainName = process.env.NEXT_PUBLIC_CHAIN_NAME || "Local Network"
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://localhost:8545"
const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL || "http://localhost:8545"
const factoryAddress = process.env.NEXT_PUBLIC_THIRDWEB_FACTORY_ADDRESS!
const bundlerUrl = process.env.NEXT_PUBLIC_BUNDLER_URL
const entrypointAddress = process.env.NEXT_PUBLIC_ENTRYPOINT_ADDRESS

export const thirdwebClient = createThirdwebClient({ clientId })

export const novaCidadeChain = defineChain({
  id: chainId,
  name: chainName,
  rpc: rpcUrl,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  testnet: true,
  blockExplorers: [{ name: "Explorer", url: explorerUrl }],
})

export const accountAbstraction: SmartWalletOptions = {
  chain: novaCidadeChain,
  factoryAddress,
  gasless: true,
  overrides: {
    bundlerUrl,
    entrypointAddress,
    signMessage: async ({ adminAccount, message }) => {
      return adminAccount.signMessage({ message })
    },
  },
}

// Phone auth disabled (thirdweb SMS unreliable to non-US numbers, attendees
// are EU-based). Guest auth disabled (ephemeral wallet loses all rewards on
// storage clear or device switch — too risky for an on-chain hunt).
export const thirdwebWallets = [
  inAppWallet({
    auth: {
      options: [
        "email",
        "passkey",
        "google",
        "apple",
        "x",
        "telegram",
        "tiktok",
      ],
    },
  }),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("walletConnect"),
]
