"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useWallet } from "@/lib/wallet-context"
import AppHeader from "@/components/app-header"
import TransactionModal from "@/components/transaction-modal"
import { ExternalLink, CheckCircle2, Coins, ArrowLeft, AlertCircle, Send, Loader2 } from "lucide-react"
import { Linkedin, Instagram, Twitter } from "@/components/ui/brand-icons"
import Link from "next/link"
import { ethers } from "ethers"
import { useChainValidation } from "@/lib/use-chain-validation"
import { getSigner } from "@/lib/wallet-provider-utils"
import { claimSocialRewardAbi, claimedRewardsAbi } from "@/lib/contracts/abi"
import { getClaimErrorMessage } from "@/lib/utils"
import { useTokenMetadata } from "@/lib/token-metadata-context"
import { useTokenBalanceContext } from "@/hooks/use-token-balance"
import { useContractAddress } from "@/lib/contract-address-context"
import { getPreferredSocialUrl, openSocialLink, getSocialDisplayLabel } from "@/lib/social-links"

interface SocialAccount {
  id: number
  platform: string
  handle: string
  profile_url: string
  token_reward: string
  action_type: string
  tweet_template: string | null
}

type CardState = "initial" | "verifying" | "ready" | "claiming" | "claimed"

const VERIFY_DURATION = 15000

const platformIcons: Record<string, React.ReactNode> = {
  linkedin: <Linkedin className="w-5 h-5" />,
  instagram: <Instagram className="w-5 h-5" />,
  twitter: <Twitter className="w-5 h-5" />,
  x: <Twitter className="w-5 h-5" />,
  link: <ExternalLink className="w-5 h-5" />,
}

const platformColors: Record<string, string> = {
  linkedin: "var(--neon-cyan)",
  instagram: "var(--neon-pink)",
  twitter: "var(--neon-blue)",
  x: "var(--neon-blue)",
  link: "var(--neon-cyan)",
}

// Amount-independent claim key — must match the contract's
// `keccak256(abi.encode(address(this), msg.sender, "social", id))`.
function computeSocialClaimKey(contractAddress: string, walletAddress: string, accountId: number): string {
  const abi = ethers.AbiCoder.defaultAbiCoder()
  const encoded = abi.encode(
    ["address", "address", "string", "string"],
    [contractAddress, walletAddress, "social", accountId.toString()],
  )
  return ethers.keccak256(encoded)
}

function isTwitterPlatform(platform: string): boolean {
  const p = platform.toLowerCase()
  return p === "twitter" || p === "x"
}

// Per-account verification flag, persisted in localStorage so the
// "Verification failed — follow again" prompt only ever fires once per
// social account in this browser. Without this, every page reload reset
// the in-memory session ref and players hit the fake-error on a fresh
// account again — that's where the complaints were coming from.
const FOLLOWED_STORAGE_KEY = "th.socialRewards.followed"

function loadFollowedMap(): Record<number, boolean> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(FOLLOWED_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return {}
    const out: Record<number, boolean> = {}
    for (const [k, v] of Object.entries(parsed)) {
      const id = Number(k)
      if (Number.isFinite(id) && v === true) out[id] = true
    }
    return out
  } catch {
    return {}
  }
}

function persistFollowedMap(map: Record<number, boolean>) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(FOLLOWED_STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* quota / private mode — non-fatal, in-memory state still works for the session */
  }
}

export default function SocialRewardsPage() {
  const { address, isConnected, isWalletReady, isAuthenticated } = useWallet()
  const { symbol } = useTokenMetadata()
  const { refetchBalance } = useTokenBalanceContext()
  const contractAddress = useContractAddress()
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [claimedMap, setClaimedMap] = useState<Record<number, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [checkingClaims, setCheckingClaims] = useState(false)
  const [claiming, setClaiming] = useState<number | null>(null)
  const [clickedLinks, setClickedLinks] = useState<Record<number, number>>({})
  const [verifyingAccounts, setVerifyingAccounts] = useState<Record<number, boolean>>({})
  const [verifyAttempts, setVerifyAttempts] = useState<Record<number, number>>({})
  const verifyTimeoutsRef = useRef<Record<number, NodeJS.Timeout>>({})
  // Accounts the user has already gone through the verification dance for
  // in this browser. Loaded from localStorage on mount (see effect below).
  // Kept in a ref so the setTimeout closure always reads the latest value
  // without us having to make it a state-dependency of the callback.
  const followedRef = useRef<Record<number, boolean>>({})

  const [txModalOpen, setTxModalOpen] = useState(false)
  const [txStatus, setTxStatus] = useState<"success" | "error">("success")
  const [txHash, setTxHash] = useState<string>()
  const [txMessage, setTxMessage] = useState("")

  const { isCorrectChain, ensureCorrectChain, isSwitching, requiredChainName } = useChainValidation()

  // Cleanup all verify timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(verifyTimeoutsRef.current).forEach(clearTimeout)
    }
  }, [])

  // Hydrate the per-account "already followed" map from localStorage.
  useEffect(() => {
    followedRef.current = loadFollowedMap()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchAccounts(controller.signal)
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (accounts.length > 0 && address && contractAddress) {
      checkOnChainClaims(accounts, address, contractAddress)
    }
  }, [accounts, address, contractAddress])

  const fetchAccounts = async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/social-rewards", { signal })
      const data = await res.json()
      if (data.success) {
        setAccounts(data.accounts)
      }
    } catch (error: any) {
      if (error?.name === "AbortError") return
      console.error("Error fetching social accounts:", error)
    } finally {
      setLoading(false)
    }
  }

  const checkOnChainClaims = async (accountList: SocialAccount[], walletAddress: string, contractAddr: string) => {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL
    if (!rpcUrl || !contractAddr) return

    setCheckingClaims(true)
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl)
      const contract = new ethers.Contract(contractAddr, claimedRewardsAbi, provider)

      const results: Record<number, boolean> = {}
      await Promise.all(
        accountList.map(async (account) => {
          const claimKey = computeSocialClaimKey(contractAddr, walletAddress, account.id)
          results[account.id] = await contract.claimedRewards(claimKey)
        })
      )
      setClaimedMap(results)
    } catch (error) {
      console.error("Error checking on-chain claims:", error)
    } finally {
      setCheckingClaims(false)
    }
  }

  const handleClaim = async (accountId: number) => {
    if (!isAuthenticated) {
      setTxStatus("error")
      setTxMessage("Please authenticate first")
      setTxModalOpen(true)
      return
    }

    // address (now JWT-first) can be set before thirdweb has hydrated.
    // Gate explicitly so getSigner() doesn't throw a generic "Wallet not
    // connected" mid-flow.
    if (!isWalletReady) {
      setTxStatus("error")
      setTxMessage("Wallet still connecting — try again in a moment.")
      setTxModalOpen(true)
      return
    }

    if (!isCorrectChain) {
      const switched = await ensureCorrectChain()
      await new Promise((resolve) => setTimeout(resolve, 150))
      if (!switched) {
        setTxStatus("error")
        setTxMessage("Please switch to the correct network")
        setTxModalOpen(true)
        return
      }
    }

    setClaiming(accountId)
    try {
      const res = await fetch("/api/social-rewards/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ socialAccountId: accountId }),
      })

      const data = await res.json()

      if (!data.success || !data.signature) {
        setTxStatus("error")
        setTxMessage(data.error || "Failed to get claim authorization")
        setTxModalOpen(true)
        return
      }

      const signer = await getSigner()
      const contract = new ethers.Contract(contractAddress, claimSocialRewardAbi, signer)
      const tx = await contract.claimSocialReward(
        data.socialAccountId,
        data.amount,
        data.signature
      )

      const receipt = await tx.wait()

      setTxStatus("success")
      setTxHash(receipt.hash)
      setTxMessage(`Successfully claimed ${ethers.formatEther(data.amount)} ${symbol} tokens!`)
      setTxModalOpen(true)

      setClaimedMap((prev) => ({ ...prev, [accountId]: true }))
      await refetchBalance()
    } catch (error: any) {
      console.error("Error claiming reward:", error)
      setTxStatus("error")
      setTxMessage(getClaimErrorMessage(error))
      setTxModalOpen(true)
    } finally {
      setClaiming(null)
    }
  }

  const handleLinkClick = (account: SocialAccount) => {
    const id = account.id
    setClickedLinks((prev) => ({ ...prev, [id]: Date.now() }))

    // Start 15-second verification timer
    setVerifyingAccounts((prev) => ({ ...prev, [id]: true }))

    // Clear any existing timeout for this account
    if (verifyTimeoutsRef.current[id]) {
      clearTimeout(verifyTimeoutsRef.current[id])
    }

    verifyTimeoutsRef.current[id] = setTimeout(() => {
      const isView = account.action_type === "view"
      const alreadyFollowed = followedRef.current[id] === true

      setVerifyAttempts((prev) => {
        // View links + accounts the user has already verified once before
        // (this browser, lifetime) skip the fake "Verification failed —
        // follow again" prompt entirely. The double-click gate only fires
        // on a player's first encounter with a given account.
        if (isView || alreadyFollowed) {
          return { ...prev, [id]: 2 }
        }
        return { ...prev, [id]: (prev[id] || 0) + 1 }
      })

      // Persist this account as "followed once" so future visits / reloads
      // never show the fake error for it again.
      if (!isView && !alreadyFollowed) {
        followedRef.current = { ...followedRef.current, [id]: true }
        persistFollowedMap(followedRef.current)
      }

      setVerifyingAccounts((prev) => ({ ...prev, [id]: false }))
      delete verifyTimeoutsRef.current[id]
    }, VERIFY_DURATION)
  }

  const canClaim = (accountId: number): boolean => {
    const clickTime = clickedLinks[accountId]
    if (!clickTime) return false
    if ((verifyAttempts[accountId] || 0) < 2) return false
    return Date.now() - clickTime >= VERIFY_DURATION
  }

  const getCardState = useCallback((account: SocialAccount): CardState => {
    if (claimedMap[account.id]) return "claimed"
    if (claiming === account.id) return "claiming"

    if (verifyingAccounts[account.id]) return "verifying"
    if (canClaim(account.id)) return "ready"
    return "initial"
  }, [claimedMap, claiming, clickedLinks, verifyingAccounts, verifyAttempts])

  // Force re-render to update button states after link clicks
  useEffect(() => {
    const pendingAccounts = Object.keys(clickedLinks).filter(
      (id) => !canClaim(parseInt(id))
    )
    if (pendingAccounts.length > 0) {
      const timer = setTimeout(() => {
        setClickedLinks((prev) => ({ ...prev }))
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [clickedLinks])

  const totalRewards = accounts.reduce(
    (sum, acc) => sum + (claimedMap[acc.id] ? 0 : parseFloat(acc.token_reward || "0")),
    0
  )
  const claimedCount = accounts.filter((acc) => claimedMap[acc.id]).length

  const getActionLabel = (account: SocialAccount): string => {
    if (account.action_type === "view") return "View Link"
    if (isTwitterPlatform(account.platform)) {
      if (account.action_type === "post") return "Post Tweet"
      return `Follow @${account.handle}`
    }
    if (account.platform.toLowerCase() === "linkedin") return `Follow on LinkedIn`
    if (account.platform.toLowerCase() === "instagram") return `Follow on Instagram`
    return `Follow @${account.handle}`
  }

  const getActionUrl = (account: SocialAccount): string => {
    return getPreferredSocialUrl(account)
  }

  const getActionIcon = (account: SocialAccount): React.ReactNode => {
    if (account.action_type === "view") return <ExternalLink className="w-4 h-4" />
    if (isTwitterPlatform(account.platform)) {
      if (account.action_type === "post") return <Send className="w-4 h-4" />
      return <Twitter className="w-4 h-4" />
    }
    return <ExternalLink className="w-4 h-4" />
  }

  return (
    <main className="min-h-screen hero-gradient flex flex-col relative overflow-hidden">
      <div className="blob-pink top-10 -left-40 opacity-30" />
      <div className="blob-cyan bottom-20 -right-40 opacity-30" />

      <AppHeader />

      <div className="flex-1 max-w-2xl mx-auto px-4 py-6 w-full relative z-10">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/" className="hidden md:inline-flex">
            <Button variant="outline" size="sm" className="border-[var(--neon-cyan)]/30 text-[var(--neon-cyan)]">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-3xl font-bold gradient-text" style={{ fontFamily: 'var(--font-display)' }}>
            SOCIAL REWARDS
          </h1>
        </div>

        {/* Network Warning */}
        {!isCorrectChain && isAuthenticated && (
          <Card className="glass-card p-4 mb-4 border-[var(--neon-yellow)]/50">
            <div className="flex items-center gap-3 text-[var(--neon-yellow)]">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-sm">Wrong Network</p>
                <p className="text-xs text-[var(--text-secondary)]">Switch to {requiredChainName}</p>
              </div>
              <Button onClick={ensureCorrectChain} disabled={isSwitching} size="sm" className="btn-neon-yellow">
                {isSwitching ? "..." : "Switch"}
              </Button>
            </div>
          </Card>
        )}

        {/* Stats Card */}
        <Card className="glass-card p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[var(--text-secondary)] text-sm">Follow our socials to earn tokens</p>
              <p className="text-[var(--text-muted)] text-xs mt-1">
                {claimedCount} of {accounts.length} claimed
              </p>
            </div>
            {totalRewards > 0 && (
              <div className="flex items-center gap-2 bg-[var(--neon-yellow)]/20 px-3 py-1.5 rounded-full">
                <Coins className="w-4 h-4 text-[var(--neon-yellow)]" />
                <span className="text-[var(--neon-yellow)] font-bold">{totalRewards} {symbol} available</span>
              </div>
            )}
          </div>
        </Card>

        {/* Social Accounts List */}
        {loading || checkingClaims ? (
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="w-12 h-12 border-4 border-[var(--neon-cyan)]/30 border-t-[var(--neon-cyan)] rounded-full animate-spin" />
            <p className="text-[var(--text-secondary)]">Loading social accounts...</p>
          </div>
        ) : accounts.length === 0 ? (
          <Card className="glass-card p-8 text-center">
            <p className="text-[var(--text-secondary)]">No social accounts available yet.</p>
            <p className="text-[var(--text-muted)] text-sm mt-2">Check back later!</p>
          </Card>
        ) : (
          <div className="space-y-4 stagger-children">
            {accounts.map((account) => {
              const color = platformColors[account.platform.toLowerCase()] || "var(--neon-cyan)"
              const icon = platformIcons[account.platform.toLowerCase()] || <ExternalLink className="w-5 h-5" />
              const cardState = getCardState(account)

              return (
                <Card
                  key={account.id}
                  className={`glass-card p-4 border transition-all ${
                    cardState === "claimed"
                      ? "border-[var(--neon-yellow)]/30 opacity-70"
                      : "border-[var(--neon-pink)]/30 hover:border-[var(--neon-pink)]"
                  }`}
                >
                  {/* Top Row: Icon + Handle + Reward Badge */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${color}20`, color }}
                    >
                      {icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white text-sm truncate">
                        {getSocialDisplayLabel(account)}
                      </p>
                      <p className="text-[var(--text-muted)] text-xs capitalize">
                        {account.platform}{account.action_type === "post" ? " · Post" : account.action_type === "view" ? " · View" : ""}
                      </p>
                    </div>

                    <div className="flex-shrink-0 bg-[var(--neon-yellow)]/15 px-2.5 py-1 rounded-full">
                      <p className="text-[var(--neon-yellow)] font-bold text-xs">+{account.token_reward} {symbol}</p>
                    </div>
                  </div>

                  {/* Bottom Row: Claim Box */}
                  <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
                    {cardState === "initial" && verifyAttempts[account.id] === 1 && account.action_type !== "view" && (
                      <p className="text-[var(--neon-pink)] text-xs text-center">
                        Verification failed — follow again to retry
                      </p>
                    )}

                    {/* Follow / action button — visible across states except during the on-chain claim tx */}
                    {cardState !== "claiming" && (
                      <a
                        href={getActionUrl(account)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          e.preventDefault()
                          // Only (re)start the 15s verify timer while the user
                          // is still in the verification phase. Once they've
                          // reached ready/claimed, tapping just re-opens the
                          // link without throwing them back into verifying.
                          if (cardState === "initial" || cardState === "verifying") {
                            handleLinkClick(account)
                          }
                          openSocialLink(account)
                        }}
                        className={`flex items-center justify-center gap-2 w-full py-3 rounded-lg border transition-all text-sm font-medium hover:bg-white/5 active:bg-white/10 active:scale-[0.98] ${
                          cardState === "initial" ? "" : "opacity-70 hover:opacity-100"
                        }`}
                        style={{
                          borderColor: cardState === "initial" ? `${color}50` : `${color}30`,
                          color: color,
                        }}
                      >
                        {getActionIcon(account)}
                        {getActionLabel(account)}
                      </a>
                    )}

                    {cardState === "verifying" && (
                      <>
                        <div className="flex items-center justify-center gap-2 py-0.5">
                          <Loader2 className="w-4 h-4 text-[var(--neon-cyan)] animate-spin" />
                          <span className="text-sm text-[var(--text-secondary)]">Verifying...</span>
                        </div>
                        <VerifyProgressBar />
                      </>
                    )}

                    {cardState === "ready" && (
                      <Button
                        onClick={() => handleClaim(account.id)}
                        className="w-full btn-neon-pink animate-neon-pulse text-sm py-2.5 h-auto font-semibold"
                      >
                        {`Claim +${account.token_reward} ${symbol}`}
                      </Button>
                    )}

                    {cardState === "claiming" && (
                      <div className="flex items-center justify-center gap-2 py-1">
                        <Loader2 className="w-5 h-5 text-[var(--neon-pink)] animate-spin" />
                        <span className="text-sm font-medium text-[var(--neon-pink)]">Claiming...</span>
                      </div>
                    )}

                    {cardState === "claimed" && (
                      <div className="flex items-center justify-center gap-2 py-1 transition-all">
                        <CheckCircle2 className="w-5 h-5 text-[var(--neon-yellow)]" />
                        <span className="text-sm font-medium text-[var(--neon-yellow)]">Claimed</span>
                      </div>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}

      </div>

      <TransactionModal
        isOpen={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        status={txStatus}
        txHash={txHash}
        message={txMessage}
      />
    </main>
  )
}

/** Progress bar that smoothly fills over VERIFY_DURATION using CSS transitions */
function VerifyProgressBar() {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = barRef.current
    if (!el) return
    // Start at 0, then trigger transition to 100% on next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.width = "100%"
      })
    })
  }, [])

  return (
    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
      <div
        ref={barRef}
        className="h-full rounded-full bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-pink)] shadow-[0_0_8px_rgba(34,209,238,0.4)]"
        style={{
          width: "0%",
          transition: `width ${VERIFY_DURATION}ms linear`,
        }}
      />
    </div>
  )
}
