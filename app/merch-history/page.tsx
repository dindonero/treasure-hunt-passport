"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ethers } from "ethers"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import AppHeader from "@/components/app-header"
import { MerchHistorySkeleton } from "@/components/skeletons"
import { useTokenMetadata } from "@/lib/token-metadata-context"
import { useWallet } from "@/lib/wallet-context"
import { useContractAddress } from "@/lib/contract-address-context"
import { truncateAddress } from "@/lib/utils"
import { ArrowLeft, ExternalLink, ShoppingBag, Coins, RefreshCw, Radio } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

interface Purchase {
  buyer: string
  handle: string | null
  merchId: string
  merchName: string
  merchImage: string
  price: number
  timestamp: number
  txHash: string
}

const MERCH_PURCHASED_ABI = [
  "event MerchPurchased(address indexed user, uint256 merchId, uint256 price, uint256 nonce)",
]

export default function MerchHistoryPage() {
  const { symbol } = useTokenMetadata()
  const { isAdmin } = useWallet()
  const contractAddress = useContractAddress()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [liveConnected, setLiveConnected] = useState(false)
  const [lastEventAt, setLastEventAt] = useState<number | null>(null)
  const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL || ""
  const merchMapRef = useRef<Map<string, { name: string; image: string }>>(new Map())

  const fetchHistory = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/merch-history", { signal, cache: "no-store" })
      const data = await res.json()
      if (data.success) setPurchases(data.purchases)
    } catch (err) {
      if ((err as { name?: string })?.name !== "AbortError") console.error("Error fetching merch history:", err)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchHistory(controller.signal).finally(() => setLoading(false))
    return () => controller.abort()
  }, [fetchHistory])

  // Cache merch list (id → name/image) so the live listener can render
  // an enriched row instantly without waiting on Blockscout indexing.
  useEffect(() => {
    let cancelled = false
    fetch("/api/merch", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        const m = new Map<string, { name: string; image: string }>()
        for (const item of d?.merch || []) m.set(String(item.id), { name: item.name, image: item.image })
        merchMapRef.current = m
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Real-time chain listener: subscribe to MerchPurchased events on the active
  // contract. The event itself is the ground truth for purchases on our side.
  // Blockscout (which the API reads) lags chain by a few seconds, so we
  // optimistically prepend with the event payload and refetch shortly after
  // to fill in the handle and reconcile with the explorer view.
  useEffect(() => {
    if (!contractAddress) return
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL
    if (!rpcUrl) return

    const provider = new ethers.JsonRpcProvider(rpcUrl)
    provider.pollingInterval = 4000
    const contract = new ethers.Contract(contractAddress, MERCH_PURCHASED_ABI, provider)
    let detached = false
    let refetchTimer: ReturnType<typeof setTimeout> | null = null

    const handler = async (
      user: string,
      merchId: bigint,
      price: bigint,
      _nonce: bigint,
      ev: ethers.ContractEventPayload,
    ) => {
      if (detached) return
      const txHash = ev.log.transactionHash
      let ts = Math.floor(Date.now() / 1000)
      try {
        const block = await ev.log.getBlock()
        if (block?.timestamp) ts = block.timestamp
      } catch {
        /* fall back to wall-clock */
      }
      const info = merchMapRef.current.get(String(merchId))
      const buyer = user.toLowerCase()
      setPurchases((prev) => {
        if (prev.some((p) => p.txHash === txHash)) return prev
        const incoming: Purchase = {
          buyer,
          handle: null,
          merchId: String(merchId),
          merchName: info?.name || `Item #${merchId}`,
          merchImage: info?.image || "",
          price: Number(price) / 1e18,
          timestamp: ts,
          txHash,
        }
        return [incoming, ...prev]
      })
      setLastEventAt(Date.now())
      if (refetchTimer) clearTimeout(refetchTimer)
      refetchTimer = setTimeout(() => { fetchHistory().catch(() => {}) }, 4500)
    }

    contract.on("MerchPurchased", handler)
    setLiveConnected(true)

    return () => {
      detached = true
      setLiveConnected(false)
      if (refetchTimer) clearTimeout(refetchTimer)
      contract.off("MerchPurchased", handler).catch(() => {})
      provider.destroy()
    }
  }, [contractAddress, fetchHistory])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchHistory()
    setRefreshing(false)
  }

  const formatTime = (ts: number) => {
    const date = new Date(ts * 1000)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
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
          <h1 className="text-3xl font-bold gradient-text flex-1" style={{ fontFamily: "var(--font-display)" }}>
            MERCH HISTORY
          </h1>
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
            style={{
              background: liveConnected ? "rgba(86,211,100,0.16)" : "rgba(139,148,158,0.14)",
              border: `1px solid ${liveConnected ? "rgba(86,211,100,0.55)" : "rgba(139,148,158,0.45)"}`,
              color: liveConnected ? "#56D364" : "var(--text-muted)",
            }}
            title={
              liveConnected
                ? lastEventAt
                  ? `Live — last event ${new Date(lastEventAt).toLocaleTimeString()}`
                  : "Listening for MerchPurchased events"
                : "Live listener not connected"
            }
          >
            <Radio
              className="w-3 h-3"
              style={liveConnected ? { animation: "thPulse 1.6s ease-in-out infinite" } : undefined}
            />
            {liveConnected ? "Live" : "Offline"}
          </span>
          {isAdmin && (
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              size="sm"
              className="bg-[#9FD356] hover:bg-[#8fe044] text-black cursor-pointer"
              title="Admin: refresh purchase data"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          )}
        </div>

        {loading ? (
          <MerchHistorySkeleton />
        ) : purchases.length === 0 ? (
          <Card className="glass-card p-8 text-center">
            <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)]" />
            <p className="text-[var(--text-secondary)]">No merch purchases yet.</p>
            <p className="text-[var(--text-muted)] text-sm mt-2">Be the first to redeem!</p>
          </Card>
        ) : (
          <>
            <Card className="glass-card p-4 mb-4">
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-5 h-5 text-[var(--neon-pink)]" />
                <p className="text-sm text-[var(--text-secondary)]">
                  <span className="text-[var(--neon-pink)] font-bold">{purchases.length}</span> total purchases
                </p>
              </div>
            </Card>

            <div className="space-y-3 stagger-children">
              {purchases.map((purchase, i) => (
                <Card key={`${purchase.txHash}-${i}`} className="glass-card p-4">
                  <div className="flex items-center gap-3">
                    {purchase.merchImage ? (
                      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--bg-secondary)] relative">
                        <Image
                          src={purchase.merchImage}
                          alt={purchase.merchName}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg flex-shrink-0 bg-[var(--bg-secondary)] flex items-center justify-center">
                        <ShoppingBag className="w-6 h-6 text-[var(--text-muted)]" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">{purchase.merchName}</p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        by{" "}
                        {purchase.handle ? (
                          <span className="text-[var(--neon-cyan)]">{purchase.handle}</span>
                        ) : (
                          <span className="font-mono text-[var(--text-muted)]">{truncateAddress(purchase.buyer)}</span>
                        )}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">{formatTime(purchase.timestamp)}</p>
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <Coins className="w-4 h-4 text-[var(--neon-yellow)]" />
                        <span className="font-bold text-[var(--neon-yellow)]">{purchase.price}</span>
                        <span className="text-xs text-[var(--text-muted)]">{symbol}</span>
                      </div>
                      {explorerUrl && (
                        <a
                          href={`${explorerUrl}/tx/${purchase.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--neon-cyan)] hover:underline text-xs flex items-center gap-1"
                        >
                          View tx
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
