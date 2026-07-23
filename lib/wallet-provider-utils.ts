"use client"

import type { Account } from "thirdweb/wallets"
import type { ThirdwebClient } from "thirdweb"
import type { Chain } from "thirdweb/chains"

// Thirdweb signer refs (set by WalletProvider when a thirdweb wallet connects)
let _thirdwebAccount: Account | null = null
let _thirdwebClient: ThirdwebClient | null = null
let _thirdwebChain: Chain | null = null

export function setThirdwebSigner(account: Account, client: ThirdwebClient, chain: Chain) {
    _thirdwebAccount = account
    _thirdwebClient = client
    _thirdwebChain = chain
}

export function clearThirdwebSigner() {
    _thirdwebAccount = null
    _thirdwebClient = null
    _thirdwebChain = null
}

export async function getSigner() {
    if (!_thirdwebAccount || !_thirdwebClient || !_thirdwebChain) {
        throw new Error("No wallet connected")
    }
    const { ethers6Adapter } = await import("thirdweb/adapters/ethers6")
    return ethers6Adapter.signer.toEthers({
        client: _thirdwebClient,
        chain: _thirdwebChain,
        account: _thirdwebAccount,
    })
}
