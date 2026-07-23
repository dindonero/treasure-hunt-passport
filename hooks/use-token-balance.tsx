"use client"

import { useEffect, useState, useCallback, useMemo, createContext, useContext, type ReactNode } from "react"
import { createPublicClient, http, formatEther } from "viem"
import { customChain } from "@/lib/chain-config"
import { balanceOfAbi } from "@/lib/contracts/abi"
import { useWallet } from "@/lib/wallet-context"
import { useContractAddress } from "@/lib/contract-address-context"

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL

interface UseTokenBalanceResult {
  balance: string | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

// --- Context for shared balance state ---

interface TokenBalanceContextValue {
  balance: string | null
  loading: boolean
  refetchBalance: () => Promise<void>
}

const TokenBalanceContext = createContext<TokenBalanceContextValue | null>(null)

export function TokenBalanceProvider({ children }: { children: ReactNode }) {
  // JWT-first: balanceOf is a public RPC read, so we can fetch as soon as
  // we know the address — no need to wait for the thirdweb signer. address
  // is JWT-first in WalletContext, so returning users see their balance
  // immediately on every navigation rather than after thirdweb hydrates.
  const { address } = useWallet()
  const contractAddr = useContractAddress()
  const { balance, loading, refetch } = useTokenBalance(address, contractAddr)
  const value = useMemo(() => ({ balance, loading, refetchBalance: refetch }), [balance, loading, refetch])

  return (
    <TokenBalanceContext.Provider value={value}>
      {children}
    </TokenBalanceContext.Provider>
  )
}

export function useTokenBalanceContext(): TokenBalanceContextValue {
  const ctx = useContext(TokenBalanceContext)
  if (!ctx) {
    throw new Error("useTokenBalanceContext must be used within a TokenBalanceProvider")
  }
  return ctx
}

// --- Standalone hook (kept for independent usage) ---

export function useTokenBalance(address: string | null, contractAddr?: string): UseTokenBalanceResult {
  const [balance, setBalance] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const contractAddress = (contractAddr || "") as `0x${string}` | ""

  const fetchBalance = useCallback(async () => {
    if (!address) {
      setBalance(null)
      return
    }

    if (!contractAddress) {
      setError("Contract address not configured")
      setBalance(null)
      return
    }

    if (!rpcUrl) {
      setError("RPC URL not configured")
      setBalance(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const client = createPublicClient({
        chain: customChain,
        transport: http(rpcUrl),
      })

      const code = await client.getCode({ address: contractAddress as `0x${string}` })
      if (!code || code === "0x") {
        setError("No contract found at address")
        setBalance(null)
        return
      }

      const rawBalance = await client.readContract({
        address: contractAddress as `0x${string}`,
        abi: balanceOfAbi,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      })
      setBalance(formatEther(rawBalance))
    } catch (err) {
      console.error("Error fetching token balance:", err)
      setError("Failed to fetch token balance")
      setBalance(null)
    } finally {
      setLoading(false)
    }
  }, [address, contractAddress])

  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  return { balance, loading, error, refetch: fetchBalance }
}
