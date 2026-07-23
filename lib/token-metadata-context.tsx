"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { createPublicClient, http } from "viem"
import { customChain } from "@/lib/chain-config"
import { symbolAbi, nameAbi } from "@/lib/contracts/abi"
import { useContractAddress } from "@/lib/contract-address-context"

interface TokenMetadata {
  symbol: string
  name: string
}

const TokenMetadataContext = createContext<TokenMetadata>({
  symbol: "TH",
  name: "Treasure Hunt",
})

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL

export function TokenMetadataProvider({ children }: { children: ReactNode }) {
  const contractAddress = useContractAddress() as `0x${string}` | ""
  const [metadata, setMetadata] = useState<TokenMetadata>({
    symbol: "TH",
    name: "Treasure Hunt",
  })

  useEffect(() => {
    if (!rpcUrl || !contractAddress) return

    const client = createPublicClient({
      chain: customChain,
      transport: http(rpcUrl),
    })

    Promise.all([
      client.readContract({
        address: contractAddress as `0x${string}`,
        abi: symbolAbi,
        functionName: "symbol",
      }),
      client.readContract({
        address: contractAddress as `0x${string}`,
        abi: nameAbi,
        functionName: "name",
      }),
    ])
      .then(([symbol, name]) => setMetadata({ symbol, name }))
      .catch((err) => console.error("Failed to fetch token metadata:", err))
  }, [contractAddress])

  const value = useMemo(() => metadata, [metadata.symbol, metadata.name])

  return (
    <TokenMetadataContext.Provider value={value}>
      {children}
    </TokenMetadataContext.Provider>
  )
}

export function useTokenMetadata() {
  return useContext(TokenMetadataContext)
}
