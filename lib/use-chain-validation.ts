"use client"

import { requiredChainFromEnv } from "./chain-utils"

/**
 * Chain validation hook. With smart-account wallets the account is
 * permanently bound to the configured chain, so chain switching is never needed.
 * The hook preserves its return shape for consumers that destructure it.
 */
export function useChainValidation() {
  const required = requiredChainFromEnv()

  return {
    isCorrectChain: true,
    ensureCorrectChain: async () => true,
    isSwitching: false,
    error: null as string | null,
    showManualInstructions: false,
    chainConfig: {
      chainName: required.chainName,
      rpcUrl: required.rpcUrls[0],
      chainId: parseInt(required.chainId, 16),
      chainIdHex: required.chainId,
      symbol: required.nativeCurrency.symbol,
      explorerUrl: required.blockExplorerUrls?.[0] || "",
    },
    requiredChainName: required.chainName,
    requiredChainId: parseInt(required.chainId, 16),
  }
}
