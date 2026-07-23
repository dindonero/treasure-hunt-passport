"use client"

import type React from "react"
import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from "react"
import { useActiveAccount, useActiveWallet, useDisconnect as useThirdwebDisconnect } from "thirdweb/react"
import { setThirdwebSigner, clearThirdwebSigner } from "./wallet-provider-utils"
import { thirdwebClient, novaCidadeChain } from "./thirdweb-config"

interface WalletContextType {
  // Logical user address. JWT-first when the auth cookie is valid; falls back
  // to the live thirdweb address during initial connect (before /api/auth/authenticate
  // has run). Available immediately on page load for returning users — does NOT
  // wait on the thirdweb SDK chunk to download or auto-reconnect to finish.
  address: string | null
  // True once the thirdweb wallet has hydrated/auto-reconnected. Display state
  // can render off `address` without this; sign-time callsites (anything that
  // calls getSigner() / on-chain writes) MUST gate on `isWalletReady` because
  // the thirdweb signer isn't available until then.
  isWalletReady: boolean
  // Legacy alias for isWalletReady — kept for back-compat with existing
  // consumers (merch / dashboard / claim / social-rewards / etc).
  isConnected: boolean
  signMessage: (message: string) => Promise<string>
  isAuthenticated: boolean
  isAuthenticating: boolean
  isAdmin: boolean
  disconnect: () => void
  authenticate: () => Promise<any>
  displayName: string | null
  isMembershipLoading: boolean
  needsUsername: boolean
  applyHandle: (handle: string) => void
  tagStatus: "loading" | "no-tag" | "registered" | "hidden"
  tagClaimCode: string | null
  needsTagSetup: boolean
  refreshTagStatus: () => Promise<void>
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

function normalizeAddress(addr: string | null | undefined) {
  return addr ? addr.toLowerCase() : null
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const thirdwebAccount = useActiveAccount()
  const thirdwebWallet = useActiveWallet()
  const { disconnect: thirdwebDisconnect } = useThirdwebDisconnect()

  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [authAddress, setAuthAddress] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [hasHandle, setHasHandle] = useState(false)
  const [isMembershipLoading, setIsMembershipLoading] = useState(false)

  const [tagStatus, setTagStatus] = useState<"loading" | "no-tag" | "registered" | "hidden">("loading")
  const [tagClaimCode, setTagClaimCode] = useState<string | null>(null)

  const [authCheckComplete, setAuthCheckComplete] = useState(false)
  const hasCheckedAuth = useRef(false)
  const clearingAuth = useRef(false)
  const thirdwebAutoAuthAttempted = useRef(false)

  // JWT-first address: returning users see their address (and any pages that
  // depend on it) render before the thirdweb SDK has finished hydrating.
  // Falls back to thirdweb during the first-ever connect, before /authenticate
  // has set the JWT cookie.
  const thirdwebAddress = normalizeAddress(thirdwebAccount?.address)
  const address = authAddress || thirdwebAddress
  const isWalletReady = !!thirdwebAccount
  const isConnected = isWalletReady

  // Helper: apply handle from any source (auth/status, auth/authenticate, set-username)
  const applyHandle = useCallback((handle: string) => {
    setDisplayName(handle)
    setHasHandle(true)
    setIsMembershipLoading(false)
    if (typeof window !== "undefined") {
      localStorage.setItem("user_handle", handle)
    }
  }, [])

  // Check auth status from cookie via API (5s timeout to avoid infinite spinner)
  const checkAuthStatus = useCallback(async () => {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      const res = await fetch("/api/auth/status", {
        credentials: "include",
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const data = await res.json()

      if (data.authenticated) {
        setIsAuthenticated(true)
        setAuthAddress(data.address)
        setIsAdmin(data.isAdmin)
        if (data.handle) {
          applyHandle(data.handle)
        } else {
          setIsMembershipLoading(false)
        }
      } else {
        setIsAuthenticated(false)
        setAuthAddress(null)
        setIsAdmin(false)
        setIsMembershipLoading(false)
      }
    } catch {
      setIsAuthenticated(false)
      setAuthAddress(null)
      setIsAdmin(false)
      setIsMembershipLoading(false)
    } finally {
      setAuthCheckComplete(true)
    }
  }, [applyHandle])

  const disconnect = useCallback(() => {
    if (thirdwebWallet) thirdwebDisconnect(thirdwebWallet)
    clearThirdwebSigner()
    fetch("/api/auth/status", { method: "DELETE", credentials: "include" }).catch((err) => console.error("Failed to clear auth session:", err))
    setIsAuthenticated(false)
    setAuthAddress(null)
    setIsAdmin(false)
    setDisplayName(null)
    setHasHandle(false)
    setIsMembershipLoading(false)
    setTagStatus("loading")
    setTagClaimCode(null)
    thirdwebAutoAuthAttempted.current = false
    if (typeof window !== "undefined") {
      localStorage.removeItem("user_handle")
      const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID
      if (clientId) localStorage.removeItem(`walletToken-${clientId}`)
      localStorage.removeItem("thirdweb:active-wallet-id")
      localStorage.removeItem("thirdweb:connected-wallet-ids")
    }
  }, [thirdwebWallet, thirdwebDisconnect])

  const signMessage = useCallback(async (message: string): Promise<string> => {
    if (!thirdwebAccount) throw new Error("Wallet not connected")
    return thirdwebAccount.signMessage({ message })
  }, [thirdwebAccount])

  const authenticate = useCallback(async () => {
    // Use the live thirdweb address explicitly: signing requires the wallet
    // to actually be connected, regardless of whether a JWT cookie is present.
    const connectedAddr = thirdwebAddress

    if (isAuthenticated && authAddress === connectedAddr) {
      return { success: true, isAdmin, address: connectedAddr }
    }

    if (!connectedAddr) {
      throw new Error("Connect your wallet first")
    }

    const messageToSign =
      `I am signing in to Treasure Hunt\n` + `Wallet: ${connectedAddr}\n` + `Timestamp: ${Date.now()}`

    const signature = await signMessage(messageToSign)

    const res = await fetch("/api/auth/authenticate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ address: connectedAddr, signature, messageToSign }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data?.error || "Authentication failed")
    }

    setIsAuthenticated(true)
    setAuthAddress(connectedAddr)

    if (typeof data?.isAdmin === "boolean") {
      setIsAdmin(data.isAdmin)
    }

    if (data.handle) {
      applyHandle(data.handle)
    }

    return data
  }, [isAuthenticated, authAddress, isAdmin, thirdwebAddress, signMessage, applyHandle])

  // Fetch tag status for the authenticated user
  const refreshTagStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/user-tag-status", { credentials: "include" })
      const data = await res.json()
      if (data.hasTag) {
        setTagStatus(data.tagStatus as "registered" | "hidden")
        setTagClaimCode(data.tagClaimCode)
      } else {
        setTagStatus("no-tag")
        setTagClaimCode(null)
      }
    } catch {
      setTagStatus("no-tag")
      setTagClaimCode(null)
    }
  }, [])

  // --- Effects ---

  // Check auth status on mount
  useEffect(() => {
    if (hasCheckedAuth.current) return
    hasCheckedAuth.current = true
    checkAuthStatus()
  }, [checkAuthStatus])

  // Resolve display name from localStorage cache
  useEffect(() => {
    if (!address || !isConnected || hasHandle) return
    if (typeof window === "undefined") return

    const savedHandle = localStorage.getItem("user_handle")
    if (savedHandle) {
      applyHandle(savedHandle)
      return
    }

    setIsMembershipLoading(false)
  }, [address, isConnected, hasHandle, applyHandle])

  // Auto-authenticate thirdweb ConnectButton users (zero-click auth)
  // Wait for auth cookie check to complete first — if the cookie is valid,
  // isAuthenticated will be true and we skip the signature prompt entirely.
  useEffect(() => {
    if (!authCheckComplete) return
    if (!thirdwebAccount || isAuthenticated || thirdwebAutoAuthAttempted.current) return
    thirdwebAutoAuthAttempted.current = true
    setIsAuthenticating(true)
    authenticate()
      .catch((err) => {
        console.error("[WalletContext] Thirdweb auto-auth failed:", err?.message || err)
        thirdwebAutoAuthAttempted.current = false
      })
      .finally(() => {
        setIsAuthenticating(false)
        setIsMembershipLoading(false)
      })
  }, [authCheckComplete, thirdwebAccount, isAuthenticated, authenticate])

  // Fetch tag status after authentication
  useEffect(() => {
    if (isAuthenticated) {
      refreshTagStatus()
    } else {
      setTagStatus("loading")
      setTagClaimCode(null)
    }
  }, [isAuthenticated, refreshTagStatus])

  // Sync thirdweb signer to wallet-provider-utils
  useEffect(() => {
    if (thirdwebAccount) {
      setThirdwebSigner(thirdwebAccount, thirdwebClient, novaCidadeChain)
    } else {
      clearThirdwebSigner()
    }
  }, [thirdwebAccount])

  // Handle wallet address changes - re-check auth when address changes
  useEffect(() => {
    if (thirdwebAddress && !isAuthenticated) {
      checkAuthStatus()
    }

    // If JWT is for wallet A but thirdweb has connected to wallet B, drop the
    // JWT — the user switched accounts. Compares against thirdwebAddress
    // explicitly because `address` is now JWT-first and would always equal
    // authAddress when both are present.
    if (thirdwebAddress && isAuthenticated && authAddress && authAddress !== thirdwebAddress && !clearingAuth.current) {
      clearingAuth.current = true
      fetch("/api/auth/status", { method: "DELETE", credentials: "include" })
        .catch((err) => console.error("Failed to clear auth session:", err))
        .finally(() => {
          clearingAuth.current = false
        })
      setIsAuthenticated(false)
      setAuthAddress(null)
      setIsAdmin(false)
    }
  }, [thirdwebAddress, isAuthenticated, authAddress, checkAuthStatus])

  const needsUsername = isAuthenticated && !hasHandle && !isMembershipLoading && !isAuthenticating
  const needsTagSetup = isAuthenticated && tagStatus === "registered"

  const providerValue = useMemo(() => ({
    address,
    isWalletReady,
    isConnected,
    signMessage,
    isAuthenticated,
    isAuthenticating,
    isAdmin,
    disconnect,
    authenticate,
    displayName,
    isMembershipLoading,
    needsUsername,
    applyHandle,
    tagStatus,
    tagClaimCode,
    needsTagSetup,
    refreshTagStatus,
  }), [address, isWalletReady, isConnected, signMessage, isAuthenticated, isAuthenticating, isAdmin, disconnect, authenticate, displayName, isMembershipLoading, needsUsername, applyHandle, tagStatus, tagClaimCode, needsTagSetup, refreshTagStatus])

  return (
    <WalletContext.Provider value={providerValue}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error("useWallet must be used within WalletProvider")
  }
  return context
}
