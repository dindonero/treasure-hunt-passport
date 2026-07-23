"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useWallet } from "@/lib/wallet-context"
import { useRouter } from "next/navigation"
import { ethers } from "ethers"
import { useChainValidation } from "@/lib/use-chain-validation"
import { AlertCircle, ArrowLeft, Coins, ShoppingBag, Image as ImageIcon } from "lucide-react"
import Link from "next/link"
import AppHeader from "@/components/app-header"
import { MerchSkeleton } from "@/components/skeletons"
import TransactionModal from "@/components/transaction-modal"
import MerchConfirmModal from "@/components/merch-confirm-modal"
import { getSigner } from "@/lib/wallet-provider-utils"
import { useTokenBalanceContext } from "@/hooks/use-token-balance"
import { purchaseMerchAbi } from "@/lib/contracts/abi"
import { useTokenMetadata } from "@/lib/token-metadata-context"
import { useContractAddress } from "@/lib/contract-address-context"

interface MerchItem {
  id: string
  name: string
  description: string
  price: string
  image: string
  category: string
  stock: number | null
  claimed: number
  focal: string
  fit: boolean
}

interface CategoryTab {
  id: string
  label: string
}

// "All" is always pinned to the front. Per-category tabs are derived
// from the distinct `merch.category` values currently in use; items with
// no category land in the "Other" tab.
const ALL_TAB: CategoryTab = { id: "all", label: "All" }
const OTHER_ID = "__other__"

const PALETTE = {
  bgPrimary: "var(--bg-primary, #06080F)",
  bgCard: "var(--bg-card, #131921)",
  bgElevated: "var(--bg-elevated, #1C2431)",
  cyan: "#58A6FF",
  green: "#56D364",
  pink: "#F0605D",
  orange: "#FF9A76",
  textPrimary: "#E6EDF3",
  textSecondary: "#8B949E",
  textMuted: "#484F58",
}

export default function MerchPage() {
  const { address, isConnected } = useWallet()
  const { symbol } = useTokenMetadata()
  const contractAddress = useContractAddress()
  const router = useRouter()
  const [merch, setMerch] = useState<MerchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const [activeCat, setActiveCat] = useState<string>("all")
  const { balance: tokenBalance, refetchBalance } = useTokenBalanceContext()
  const { isCorrectChain, ensureCorrectChain, isSwitching, error: chainError, requiredChainName } =
    useChainValidation()

  const purchaseLock = useRef(false)

  const [txModalOpen, setTxModalOpen] = useState(false)
  const [txStatus, setTxStatus] = useState<"success" | "error">("success")
  const [txHash, setTxHash] = useState<string>()
  const [txMessage, setTxMessage] = useState("")
  const [txMerchImage, setTxMerchImage] = useState<string>()

  // Confirmation modal — opens before the on-chain purchase so taps can't
  // accidentally burn tokens.
  const [confirmItem, setConfirmItem] = useState<MerchItem | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchMerch(controller.signal)
    return () => controller.abort()
  }, [isConnected, router, address])

  const fetchMerch = async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/merch", { signal, cache: "no-store" })
      const data = await response.json()
      const list: MerchItem[] = (data.merch || []).map((m: Record<string, unknown>) => ({
        id: String(m.id),
        name: String(m.name || ""),
        description: String(m.description || ""),
        price: String(m.price || "0"),
        image: String(m.image || ""),
        category: String(m.category || ""),
        stock: m.stock == null ? null : Number(m.stock),
        claimed: Number(m.claimed || 0),
        focal: String(m.focal || "50% 50%"),
        fit: !!m.fit,
      }))
      setMerch(list)
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") return
      console.error("Error fetching merch:", error)
      setMessage("Failed to load merch items")
    } finally {
      setLoading(false)
    }
  }

  // Tabs are derived from the categories currently typed on items.
  // Empty / null category collapses into a single "Other" tab.
  const { tabs, counts } = useMemo(() => {
    const seen = new Map<string, number>()
    let otherCount = 0
    for (const m of merch) {
      const c = (m.category || "").trim()
      if (!c) otherCount += 1
      else seen.set(c, (seen.get(c) || 0) + 1)
    }
    const sorted = [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    const cats: CategoryTab[] = sorted.map(([id]) => ({ id, label: id }))
    if (otherCount > 0) cats.push({ id: OTHER_ID, label: "Other" })
    const countMap: Record<string, number> = { all: merch.length, [OTHER_ID]: otherCount }
    for (const [id, n] of seen) countMap[id] = n
    return { tabs: [ALL_TAB, ...cats], counts: countMap }
  }, [merch])

  // If the admin removes the last item in the active category, fall back
  // to "All" so the user isn't stuck on an empty tab.
  useEffect(() => {
    if (activeCat === "all") return
    if (!tabs.find((t) => t.id === activeCat)) setActiveCat("all")
  }, [tabs, activeCat])

  const filtered = useMemo(() => {
    if (activeCat === "all") return merch
    if (activeCat === OTHER_ID) return merch.filter((m) => !(m.category || "").trim())
    return merch.filter((m) => (m.category || "").trim() === activeCat)
  }, [merch, activeCat])

  const handlePurchase = async (item: MerchItem) => {
    if (!address || purchaseLock.current) return
    purchaseLock.current = true

    if (!isCorrectChain) {
      const switched = await ensureCorrectChain()
      await new Promise((r) => setTimeout(r, 150))
      if (!switched) {
        setMessage(`Please switch to ${requiredChainName} to purchase`)
        purchaseLock.current = false
        return
      }
    }

    setPurchasing(item.id)
    setMessage("")

    try {
      const sigResponse = await fetch("/api/auth/buy-merch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ merchId: item.id }),
      })
      const sigData = await sigResponse.json()
      if (sigData.error) {
        setMessage(sigData.error)
        setPurchasing(null)
        purchaseLock.current = false
        return
      }
      const signer = await getSigner()
      const contract = new ethers.Contract(contractAddress, purchaseMerchAbi, signer)
      const tx = await contract.purchaseMerch(item.id, sigData.price, sigData.nonce, sigData.signature)
      const receipt = await tx.wait()
      if (receipt) {
        setTxStatus("success")
        setTxHash(receipt.hash)
        setTxMerchImage(item.image)
        setTxMessage(`Successfully purchased ${item.name}!`)
        setTxModalOpen(true)
        setMessage(`Successfully purchased ${item.name}!`)
        await refetchBalance()
        // Optimistically bump claimed count locally; the server will catch up.
        setMerch((prev) =>
          prev.map((m) => (m.id === item.id ? { ...m, claimed: m.claimed + 1 } : m)),
        )
      } else {
        setTxStatus("error")
        setTxMessage("Transaction failed. Please try again.")
        setTxModalOpen(true)
        setMessage("Transaction failed")
      }
    } catch (error) {
      console.error("Error purchasing merch:", error)
      setTxStatus("error")
      setTxMessage("Purchase failed. Please try again.")
      setTxModalOpen(true)
      setMessage("Purchase failed. Please try again.")
    } finally {
      setPurchasing(null)
      purchaseLock.current = false
    }
  }

  return (
    <main className="min-h-screen hero-gradient flex flex-col relative overflow-hidden">
      <div className="blob-pink top-10 -left-40 opacity-30" />
      <div className="blob-cyan bottom-20 -right-40 opacity-30" />

      <AppHeader />

      <div className="flex-1 max-w-2xl mx-auto w-full relative z-10 pb-24">
        {/* Header */}
        <div className="px-4 pt-3 pb-2 flex items-end gap-3">
          <Link href="/" className="hidden md:inline-flex">
            <Button variant="outline" size="sm" className="border-[var(--neon-cyan)]/30 text-[var(--neon-cyan)]">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1
              className="text-[28px] font-bold leading-none tracking-wider"
              style={{
                fontFamily: "var(--font-display)",
                color: PALETTE.textPrimary,
                textShadow: `0 0 12px ${PALETTE.pink}66`,
              }}
            >
              MERCH STORE
            </h1>
            <div className="text-[11px] mt-1" style={{ color: PALETTE.textSecondary, letterSpacing: 0.3 }}>
              Spend {symbol} tokens on official drops
            </div>
          </div>
          {isConnected && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{
                background: PALETTE.bgCard,
                border: `1px solid ${PALETTE.green}66`,
              }}
            >
              <Coins className="w-3 h-3" style={{ color: PALETTE.green }} />
              <span
                className="text-[11px] font-bold font-mono"
                style={{ color: PALETTE.green }}
              >
                {parseFloat(tokenBalance || "0").toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Sticky tabs */}
        <div
          className="sticky top-0 z-10 px-4 py-2"
          style={{
            background: `${PALETTE.bgPrimary}f0`,
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            borderBottom: `1px solid ${PALETTE.bgCard}`,
          }}
        >
          <div className="flex gap-1.5 overflow-x-auto -mx-2 px-2" style={{ scrollbarWidth: "none" }}>
            {tabs.map((c) => {
              const on = c.id === activeCat
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCat(c.id)}
                  className="whitespace-nowrap"
                  style={{
                    padding: "6px 11px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    border: `1px solid ${on ? PALETTE.cyan : PALETTE.bgElevated}`,
                    background: on ? `${PALETTE.cyan}15` : PALETTE.bgCard,
                    color: on ? PALETTE.cyan : PALETTE.textSecondary,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    cursor: "pointer",
                  }}
                >
                  {c.label}
                  <span
                    style={{
                      fontSize: 9,
                      padding: "1px 5px",
                      borderRadius: 999,
                      background: on ? `${PALETTE.cyan}25` : PALETTE.bgElevated,
                      color: on ? PALETTE.cyan : PALETTE.textMuted,
                    }}
                  >
                    {counts[c.id] || 0}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {!isCorrectChain && isConnected && (
          <Card className="glass-card mx-4 mt-3 p-3 border-[var(--neon-yellow)]/50">
            <div className="flex items-center gap-3 text-[var(--neon-yellow)]">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-sm">Wrong Network</p>
                <p className="text-xs text-[var(--text-secondary)]">Switch to {requiredChainName} to purchase</p>
              </div>
              <Button onClick={ensureCorrectChain} disabled={isSwitching} size="sm" className="btn-neon-yellow">
                {isSwitching ? "Switching..." : "Switch"}
              </Button>
            </div>
            {chainError && <p className="text-red-400 text-xs mt-2">{chainError}</p>}
          </Card>
        )}

        {/* Grid */}
        <div className="px-3.5 py-3">
          {loading ? (
            <MerchSkeleton />
          ) : filtered.length === 0 ? (
            <Card className="glass-card p-8 text-center">
              <ShoppingBag className="w-12 h-12 mx-auto mb-3" style={{ color: PALETTE.textMuted }} />
              <p className="text-sm" style={{ color: PALETTE.textMuted }}>
                {merch.length === 0
                  ? "No merch items available yet."
                  : "No items in this category yet."}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {filtered.map((item) => {
                const stock = item.stock
                const remaining = stock != null ? stock - item.claimed : null
                const out = stock != null && stock > 0 && remaining != null && remaining <= 0
                const low = !out && remaining != null && remaining > 0 && remaining <= 10
                const stockColor = out ? PALETTE.pink : low ? PALETTE.orange : PALETTE.green
                const stockLabel = out
                  ? "Sold out"
                  : remaining == null
                  ? "In stock"
                  : low
                  ? `Only ${remaining} left`
                  : `${remaining} in stock`
                const hasEnoughBalance =
                  Number.parseFloat(tokenBalance || "0") >= Number.parseFloat(item.price)
                const isBuying = purchasing === item.id
                const canBuy =
                  isConnected && isCorrectChain && hasEnoughBalance && !out && !isBuying
                const buyLabel = isBuying
                  ? "BUYING…"
                  : !isConnected
                  ? "CONNECT"
                  : !isCorrectChain
                  ? "SWITCH NETWORK"
                  : out
                  ? "SOLD OUT"
                  : !hasEnoughBalance
                  ? `NEED ${item.price} ${symbol}`
                  : `BUY · ${item.price} ${symbol}`
                const buyBg = canBuy ? PALETTE.green : out ? PALETTE.pink : PALETTE.bgElevated
                const buyFg = canBuy || out ? "#0a0a0a" : PALETTE.textMuted
                return (
                  <article
                    key={item.id}
                    className="flex flex-col gap-1.5"
                    style={{ opacity: out ? 0.78 : 1 }}
                  >
                    {/* Photo */}
                    <div
                      className="relative w-full overflow-hidden"
                      style={{
                        aspectRatio: "3 / 4",
                        borderRadius: 12,
                        background: item.fit ? "#000" : PALETTE.bgCard,
                        border: `1px solid ${PALETTE.bgElevated}`,
                      }}
                    >
                      {item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.image}
                          alt={item.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: item.fit ? "contain" : "cover",
                            objectPosition: item.focal,
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-7 h-7" style={{ color: PALETTE.textMuted }} />
                        </div>
                      )}
                      {out && (
                        <span
                          style={{
                            position: "absolute",
                            top: 8,
                            left: 8,
                            padding: "3px 7px",
                            borderRadius: 6,
                            background: PALETTE.pink,
                            color: "#0a0a0a",
                            fontSize: 9,
                            fontWeight: 800,
                            letterSpacing: 0.6,
                            fontFamily: "var(--font-mono, monospace)",
                          }}
                        >
                          SOLD OUT
                        </span>
                      )}
                      {out && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            background: "rgba(0,0,0,0.45)",
                          }}
                        />
                      )}
                      {isBuying && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            background: "rgba(6,8,15,0.7)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: PALETTE.cyan,
                            fontSize: 11,
                            fontWeight: 800,
                            letterSpacing: 0.5,
                            fontFamily: "var(--font-mono, monospace)",
                          }}
                        >
                          BUYING…
                        </div>
                      )}
                    </div>
                    {/* Name */}
                    <div
                      className="truncate"
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: PALETTE.textPrimary,
                      }}
                    >
                      {item.name}
                    </div>
                    {/* Description */}
                    {item.description && (
                      <div
                        style={{
                          fontSize: 10.5,
                          lineHeight: 1.35,
                          color: PALETTE.textSecondary,
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {item.description}
                      </div>
                    )}
                    {/* Stock dot row */}
                    <div
                      className="flex items-center gap-1.5"
                      style={{ fontSize: 10, color: PALETTE.textSecondary, fontWeight: 500 }}
                    >
                      <span
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: 999,
                          background: stockColor,
                          boxShadow: `0 0 4px ${stockColor}`,
                        }}
                      />
                      {stockLabel}
                    </div>
                    {/* Buy button */}
                    <button
                      type="button"
                      onClick={() => canBuy && setConfirmItem(item)}
                      disabled={!canBuy}
                      className="w-full mt-0.5 active:scale-[0.98] transition-transform"
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "none",
                        background: buyBg,
                        color: buyFg,
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: 0.5,
                        fontFamily: "var(--font-mono, monospace)",
                        cursor: canBuy ? "pointer" : "not-allowed",
                      }}
                    >
                      {buyLabel}
                    </button>
                  </article>
                )
              })}
            </div>
          )}

          {message && (
            <div
              className={`mt-4 p-3 rounded-lg glass-card ${
                message.includes("Successfully")
                  ? "border-[var(--neon-yellow)]/50"
                  : "border-red-500/50"
              }`}
            >
              <p
                className={`text-sm ${
                  message.includes("Successfully") ? "text-[var(--neon-yellow)]" : "text-red-400"
                }`}
              >
                {message}
              </p>
            </div>
          )}

          {/* Operator copy — kept from prior page */}
          <p
            className="text-center text-[11px] mt-4 px-2"
            style={{ color: PALETTE.pink, lineHeight: 1.45 }}
          >
            Please visit the merch booth before claiming to confirm availability.
          </p>
        </div>
      </div>

      <MerchConfirmModal
        isOpen={!!confirmItem}
        onClose={() => {
          if (purchasing) return
          setConfirmItem(null)
        }}
        onConfirm={async () => {
          if (!confirmItem) return
          const item = confirmItem
          // Close confirm modal first so the tx modal can take over the
          // surface without two stacked sheets on mobile.
          setConfirmItem(null)
          await handlePurchase(item)
        }}
        item={confirmItem}
        symbol={symbol}
        balance={tokenBalance || "0"}
        busy={!!purchasing}
      />

      <TransactionModal
        isOpen={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        status={txStatus}
        txHash={txHash}
        message={txMessage}
        isMerch={true}
        merchImage={txMerchImage}
      />
    </main>
  )
}
