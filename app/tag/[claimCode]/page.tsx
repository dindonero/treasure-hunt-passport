"use client"

import { useEffect, useState, useRef, use } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useWallet } from "@/lib/wallet-context"
import AppHeader from "@/components/app-header"
import TransactionModal from "@/components/transaction-modal"
import VenueMap from "@/components/venue-map"
import {
  Package, Sparkles, AlertCircle, User, Coins, MapPin, Eye, Pencil,
  CheckCircle2, Lock, HelpCircle, SkipForward,
} from "lucide-react"
import Link from "next/link"
import { ethers } from "ethers"
import { useChainValidation } from "@/lib/use-chain-validation"
import { getSigner } from "@/lib/wallet-provider-utils"
import { claimObjectRewardAbi } from "@/lib/contracts/abi"
import WalletConnectButton from "@/components/wallet-connect-button"
import UsernameForm from "@/components/username-form"
import { getClaimErrorMessage } from "@/lib/utils"
import { useTokenMetadata } from "@/lib/token-metadata-context"
import { useTokenBalanceContext } from "@/hooks/use-token-balance"
import { useContractAddress } from "@/lib/contract-address-context"
import { hasClaimedObjectReward as clientHasClaimedObjectReward } from "@/lib/client-onchain"

interface TagData {
  id: number
  chain_id: string
  name: string | null
  hint: string | null
  token_reward: string
  status: "blank" | "registered" | "hidden"
  owner_address: string | null
  location_x: number | null
  location_y: number | null
}

export default function TagPage({ params }: { params: Promise<{ claimCode: string }> }) {
  const { claimCode } = use(params)
  const { address, isConnected, isWalletReady, isAuthenticated, isAuthenticating, authenticate, displayName, isAdmin, needsUsername } = useWallet()
  const { symbol } = useTokenMetadata()
  const { refetchBalance } = useTokenBalanceContext()
  const { isCorrectChain, ensureCorrectChain, isSwitching, requiredChainName } = useChainValidation()
  const contractAddress = useContractAddress()

  const [tag, setTag] = useState<TagData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Ownership claiming
  const [claimingOwnership, setClaimingOwnership] = useState(false)

  // Edit form state
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState("")
  const [hint, setHint] = useState("")
  const [hintExpanded, setHintExpanded] = useState(false)
  const [locationX, setLocationX] = useState<number | null>(null)
  const [locationY, setLocationY] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState("")

  // Form validation
  const formComplete = name.trim().length > 0 && locationX != null && locationY != null
  const canCancel = !!(tag?.name && tag?.location_x != null && tag?.location_y != null)

  // Find/claim state
  const [claiming, setClaiming] = useState(false)
  const [alreadyFound, setAlreadyFound] = useState(false)
  const [alreadyOwnsTag, setAlreadyOwnsTag] = useState(false)
  // True once an address-aware fetch has completed, so we know whether the user already found this tag.
  const [findStatusChecked, setFindStatusChecked] = useState(false)

  // Admin skip state
  const [adminSkipped, setAdminSkipped] = useState(false)
  const [adminSkipping, setAdminSkipping] = useState(false)

  // Concurrency guards
  const statusToggleLock = useRef(false)
  const findLock = useRef(false)
  const ownershipLock = useRef(false)
  // One-shot guard so the auto-find effect doesn't re-fire on every render
  // (or retry after a failure / user cancel).
  const autoFindRef = useRef(false)

  // Transaction modal
  const [txModalOpen, setTxModalOpen] = useState(false)
  const [txStatus, setTxStatus] = useState<"success" | "error">("success")
  const [txHash, setTxHash] = useState<string>()
  const [txMessage, setTxMessage] = useState("")

  // Fetch tag metadata — public, edge-cached, fires on mount independent of auth.
  useEffect(() => {
    const controller = new AbortController()
    fetchTag(controller.signal)
    return () => controller.abort()
  }, [claimCode])

  // Per-user claim status — runs as soon as we have an address (JWT-first, so
  // available immediately on return visits) and the tag has loaded. Goes
  // direct to the Nova Cidade RPC; bypasses Vercel and works while the
  // thirdweb SDK is still hydrating in the background.
  useEffect(() => {
    if (!tag) return
    if (tag.status !== "hidden") {
      // Non-claimable states: nothing to verify on-chain. Mark checked so
      // the owner / blank / registered branches render without a spinner.
      setFindStatusChecked(true)
      return
    }
    if (!address || !contractAddress) return
    let cancelled = false
    clientHasClaimedObjectReward(contractAddress, address, tag.chain_id)
      .then((claimed) => {
        if (cancelled) return
        if (claimed) setAlreadyFound(true)
        setFindStatusChecked(true)
      })
      .catch((err) => {
        console.error("[tag] client claim check failed:", err)
        if (!cancelled) setFindStatusChecked(true) // fail open — server's find/POST is the real guard
      })
    return () => { cancelled = true }
  }, [tag, address, contractAddress])

  // owns-any-tag — only matters for blank-tag claim flow. Fired only when the
  // tag is blank to avoid a per-user request on the common (hidden) path.
  useEffect(() => {
    if (!tag || tag.status !== "blank") return
    if (!isAuthenticated) return
    let cancelled = false
    fetch("/api/auth/owns-any-tag", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { if (!cancelled && data?.owns) setAlreadyOwnsTag(true) })
      .catch(() => { /* non-fatal */ })
    return () => { cancelled = true }
  }, [tag, isAuthenticated])

  // Auto-fire the find/claim transaction once the wallet has finished loading
  // and we've verified this player hasn't already claimed. Tapping the NFC
  // tag is unambiguous intent; the tx is gasless and signed by the smart
  // account in the background. One-shot via autoFindRef — failures don't
  // loop, and the manual button stays available for retry.
  useEffect(() => {
    if (autoFindRef.current) return
    if (!tag || tag.status !== "hidden") return
    if (!findStatusChecked) return
    if (alreadyFound) return
    if (!isWalletReady) return
    if (!isAuthenticated) return
    if (claiming) return
    if (!address || !tag) return
    if (tag.owner_address && tag.owner_address.toLowerCase() === address.toLowerCase()) return
    autoFindRef.current = true
    handleFind()
    // handleFind is intentionally not in deps — including it would loop on
    // every render. The ref guard makes this safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tag,
    findStatusChecked,
    alreadyFound,
    isWalletReady,
    isAuthenticated,
    claiming,
    address,
  ])

  const fetchTag = async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/nfc-tags/by-code/${claimCode}`, { signal })
      const data = await res.json()
      if (data.success && data.tag) {
        setTag(data.tag)
        populateForm(data.tag)
      } else {
        setError("Tag not found")
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return
      console.error("Error fetching tag:", err)
      setError("Failed to load tag")
    } finally {
      setLoading(false)
    }
  }

  const populateForm = (t: TagData) => {
    setName(t.name || "")
    setHint(t.hint || "")
    // Auto-expand the hint section when editing a tag that already has one,
    // so the existing text is visible without an extra tap.
    setHintExpanded(!!t.hint)
    setLocationX(t.location_x)
    setLocationY(t.location_y)
  }

  const handleClaimOwnership = async () => {
    if (ownershipLock.current) return
    ownershipLock.current = true

    if (!isAuthenticated) {
      const result = await authenticate()
      if (result.error) {
        ownershipLock.current = false
        setTxStatus("error")
        setTxMessage(result.error)
        setTxModalOpen(true)
        return
      }
    }

    if (!isCorrectChain) {
      const switched = await ensureCorrectChain()
      await new Promise((resolve) => setTimeout(resolve, 150))
      if (!switched) {
        ownershipLock.current = false
        setTxStatus("error")
        setTxMessage("Please switch to the correct network")
        setTxModalOpen(true)
        return
      }
    }

    setClaimingOwnership(true)
    try {
      // Step 1: Claim ownership in DB and get reward signature
      const res = await fetch("/api/nfc-tags/claim-ownership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ claimCode }),
      })
      const data = await res.json()

      if (!data.success) {
        if (res.status === 409 && data.error?.includes("already own")) {
          setAlreadyOwnsTag(true)
        }
        setTxStatus("error")
        setTxMessage(data.error || "Failed to claim ownership")
        setTxModalOpen(true)
        return
      }

      // Step 2: If signature returned, submit on-chain for ownership reward
      if (data.signature) {
        try {
          const signer = await getSigner()
          const contract = new ethers.Contract(contractAddress, claimObjectRewardAbi, signer)
          const tx = await contract.claimObjectReward(data.objectId, data.amount, data.signature)
          const receipt = await tx.wait()

          setTxStatus("success")
          setTxHash(receipt?.hash)
          setTxMessage(`Tag claimed! You earned 500 ${symbol} as the owner!`)
          setTxModalOpen(true)
          await refetchBalance()
        } catch (txErr: any) {
          // On-chain tx failed — revert DB ownership so tag goes back to blank
          console.error("On-chain ownership reward failed, reverting:", txErr)
          await fetch("/api/nfc-tags/unclaim-ownership", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ claimCode }),
          }).catch(() => {})
          throw txErr
        }
      }

      // Only advance UI after on-chain tx succeeds (or if no signature needed)
      setTag(data.tag)
      populateForm(data.tag)
      setEditing(true)
    } catch (err: any) {
      console.error("Error claiming ownership:", err)
      setTxStatus("error")
      setTxMessage(getClaimErrorMessage(err))
      setTxModalOpen(true)
    } finally {
      setClaimingOwnership(false)
      ownershipLock.current = false
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setSaveMessage("Name is required")
      return
    }

    setSaving(true)
    setSaveMessage("")
    try {
      const canAutoHide = locationX != null && locationY != null
      const res = await fetch("/api/nfc-tags/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tagId: tag?.id,
          name: name.trim(),
          hint: hint.trim() || null,
          location_x: locationX,
          location_y: locationY,
          ...(canAutoHide ? { status: "hidden" } : {}),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setTag(data.tag)
        populateForm(data.tag)
        setEditing(false)
        setSaveMessage(data.tag?.status === "hidden" ? "Saved — ready to be found!" : "Saved!")
        setTimeout(() => setSaveMessage(""), 2000)
      } else {
        setSaveMessage(data.error || "Failed to save")
      }
    } catch (err) {
      console.error("Error saving tag:", err)
      setSaveMessage("Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const handleStatusToggle = async () => {
    if (!tag || statusToggleLock.current) return
    statusToggleLock.current = true
    const newStatus = tag.status === "hidden" ? "registered" : "hidden"

    setSaving(true)
    try {
      const res = await fetch("/api/nfc-tags/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tagId: tag.id, status: newStatus }),
      })
      const data = await res.json()
      if (data.success) {
        setTag(data.tag)
        // tag status refreshed via re-fetch
      } else {
        setSaveMessage(data.error || "Failed to update status")
        setTimeout(() => setSaveMessage(""), 3000)
      }
    } catch (err) {
      console.error("Error toggling status:", err)
    } finally {
      setSaving(false)
      statusToggleLock.current = false
    }
  }

  const handleFind = async () => {
    if (findLock.current) return
    findLock.current = true

    if (!isAuthenticated) {
      const result = await authenticate()
      if (result.error) {
        findLock.current = false
        setTxStatus("error")
        setTxMessage(result.error)
        setTxModalOpen(true)
        return
      }
    }

    if (!isCorrectChain) {
      const switched = await ensureCorrectChain()
      await new Promise((resolve) => setTimeout(resolve, 150))
      if (!switched) {
        findLock.current = false
        setTxStatus("error")
        setTxMessage("Please switch to the correct network")
        setTxModalOpen(true)
        return
      }
    }

    setClaiming(true)
    try {
      // Step 1: Record find and get signature
      const res = await fetch("/api/nfc-tags/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ claimCode }),
      })

      const data = await res.json()

      if (!data.success || !data.signature) {
        if (data.error?.includes("already found")) {
          setAlreadyFound(true)
        }
        setTxStatus("error")
        setTxMessage(data.error || "Failed to claim find")
        setTxModalOpen(true)
        return
      }

      // Step 2: Submit to blockchain for reward
      const signer = await getSigner()
      console.log("[find] Contract call:", { contractAddress, objectId: data.objectId, amount: data.amount, sigLen: data.signature?.length, signerAddr: await signer.getAddress() })
      const contract = new ethers.Contract(contractAddress, claimObjectRewardAbi, signer)
      const tx = await contract.claimObjectReward(data.objectId, data.amount, data.signature)
      const receipt = await tx.wait()

      setAlreadyFound(true)
      setTxStatus("success")
      setTxHash(receipt?.hash)
      const earned = data.tag?.token_reward
      setTxMessage(
        data.message ?? `Found "${data.tag?.name}" and earned ${earned} ${symbol}!`,
      )
      setTxModalOpen(true)
      await refetchBalance()
    } catch (err: any) {
      console.error("Error finding tag:", err)
      setTxStatus("error")
      setTxMessage(getClaimErrorMessage(err))
      setTxModalOpen(true)
    } finally {
      setClaiming(false)
      findLock.current = false
    }
  }

  // Admin skip: bypass claim/find flow
  const handleAdminSkip = async () => {
    if (!tag) return
    setAdminSkipping(true)
    try {
      if (tag.status === "blank") {
        // Transition blank → registered via admin API (no owner)
        const res = await fetch("/api/admin/nfc-tags", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id: tag.id, status: "registered" }),
        })
        const data = await res.json()
        if (!data.success) {
          setTxStatus("error")
          setTxMessage(data.error || "Failed to skip")
          setTxModalOpen(true)
          return
        }
        setTag(data.tag)
        populateForm(data.tag)
        setEditing(true)
      } else if (!tag.name || tag.location_x == null || tag.location_y == null) {
        // Tag missing details — open edit form directly
        setEditing(true)
      }
      setAdminSkipped(true)
    } catch (err) {
      console.error("Admin skip error:", err)
      setTxStatus("error")
      setTxMessage("Failed to skip claim")
      setTxModalOpen(true)
    } finally {
      setAdminSkipping(false)
    }
  }

  const handleAdminSave = async () => {
    if (!tag || !name.trim()) {
      setSaveMessage("Name is required")
      return
    }
    setSaving(true)
    setSaveMessage("")
    try {
      const res = await fetch("/api/admin/nfc-tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: tag.id,
          name: name.trim(),
          hint: hint.trim() || null,
          location_x: locationX,
          location_y: locationY,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setTag(data.tag)
        populateForm(data.tag)
        setEditing(false)
        setSaveMessage("Saved!")
        setTimeout(() => setSaveMessage(""), 2000)
      } else {
        setSaveMessage(data.error || "Failed to save")
      }
    } catch (err) {
      console.error("Admin save error:", err)
      setSaveMessage("Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const handleAdminStatusToggle = async () => {
    if (!tag || statusToggleLock.current) return
    statusToggleLock.current = true
    const newStatus = tag.status === "hidden" ? "registered" : "hidden"
    setSaving(true)
    try {
      const res = await fetch("/api/admin/nfc-tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: tag.id, status: newStatus }),
      })
      const data = await res.json()
      if (data.success) {
        setTag(data.tag)
      } else {
        setSaveMessage(data.error || "Failed to update status")
        setTimeout(() => setSaveMessage(""), 3000)
      }
    } catch (err) {
      console.error("Admin status toggle error:", err)
    } finally {
      setSaving(false)
      statusToggleLock.current = false
    }
  }

  const activeSave = adminSkipped ? handleAdminSave : handleSave
  const activeStatusToggle = adminSkipped ? handleAdminStatusToggle : handleStatusToggle

  const isOwner = address && tag && tag.owner_address?.toLowerCase() === address.toLowerCase()
  const canFind = tag && tag.status === "hidden" && !isOwner && !alreadyFound && findStatusChecked

  return (
    <main className="min-h-screen hero-gradient flex flex-col relative overflow-hidden">
      <div className="blob-pink top-10 -left-40 opacity-30" />
      <div className="blob-cyan bottom-20 -right-40 opacity-30" />

      <AppHeader />

      <div className="flex-1 max-w-lg mx-auto px-4 py-6 w-full relative z-10">
        {loading ? (
          <Card className="glass-card p-8 text-center">
            <div className="w-12 h-12 border-4 border-[var(--neon-cyan)]/30 border-t-[var(--neon-cyan)] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[var(--text-secondary)]">Loading tag...</p>
          </Card>
        ) : error ? (
          <Card className="glass-card p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Tag Not Found</h2>
            <p className="text-[var(--text-secondary)] mb-4">{error}</p>
            <Link href="/">
              <Button className="btn-neon-cyan">Back to Home</Button>
            </Link>
          </Card>

        /* ===== BLANK TAG: First user claims ownership ===== */
        ) : tag?.status === "blank" && !adminSkipped ? (
          <Card className="glass-card p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-[var(--neon-cyan)]/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Package className="w-10 h-10 text-[var(--neon-cyan)]" />
            </div>
            <h1 className="text-2xl font-bold gradient-text mb-2" style={{ fontFamily: "var(--font-display)" }}>
              UNCLAIMED TAG
            </h1>
            <p className="text-[var(--text-secondary)] mb-6">
              This NFC tag has no owner yet. Claim it to earn 500 {symbol} and set it up as a treasure!
            </p>
            {!isConnected ? (
              <div>
                <p className="text-[var(--text-muted)] mb-4">Connect your wallet to claim this tag.</p>
                <WalletConnectButton label="Join the Game!" />
              </div>
            ) : alreadyOwnsTag ? (
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-[var(--neon-yellow)]/20 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6 text-[var(--neon-yellow)]" />
                </div>
                <p className="text-[var(--text-muted)]">You already own a tag. Each player can only claim one tag.</p>
                <Link href="/dashboard">
                  <Button className="mt-4 btn-neon-cyan">View Dashboard</Button>
                </Link>
                {isAdmin && (
                  <Button
                    onClick={handleAdminSkip}
                    disabled={adminSkipping}
                    variant="outline"
                    className="w-full mt-3 border-[var(--neon-cyan)]/30 text-[var(--neon-cyan)]"
                  >
                    {adminSkipping ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-[var(--neon-cyan)]/30 border-t-[var(--neon-cyan)] rounded-full animate-spin" />
                        Skipping...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <SkipForward className="w-4 h-4" />
                        Admin: Skip Claim
                      </span>
                    )}
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <Button
                  onClick={handleClaimOwnership}
                  disabled={claimingOwnership || adminSkipping}
                  className="w-full btn-neon-pink text-lg py-6"
                >
                  {claimingOwnership ? (
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Claiming...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      Claim This Tag (+500 {symbol})
                    </span>
                  )}
                </Button>
                {isAdmin && (
                  <Button
                    onClick={handleAdminSkip}
                    disabled={adminSkipping || claimingOwnership}
                    variant="outline"
                    className="w-full border-[var(--neon-cyan)]/30 text-[var(--neon-cyan)]"
                  >
                    {adminSkipping ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-[var(--neon-cyan)]/30 border-t-[var(--neon-cyan)] rounded-full animate-spin" />
                        Skipping...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <SkipForward className="w-4 h-4" />
                        Admin: Skip Claim
                      </span>
                    )}
                  </Button>
                )}
              </div>
            )}
          </Card>

        /* ===== OWNER VIEW: Edit and manage tag (or admin skip) ===== */
        ) : tag && (isOwner || adminSkipped) ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold gradient-text" style={{ fontFamily: "var(--font-display)" }}>
                {adminSkipped ? "MANAGE TAG" : "YOUR TAG"}
              </h1>
              <div className="flex items-center gap-2">
                <span
                  className="text-xs px-3 py-1 rounded-full font-medium"
                  style={{
                    backgroundColor: tag.status === "hidden" ? "rgba(0, 255, 255, 0.2)" : "rgba(159, 211, 86, 0.2)",
                    color: tag.status === "hidden" ? "var(--neon-cyan)" : "var(--neon-yellow)",
                  }}
                >
                  {tag.status === "hidden" ? "Ready to Be Found" : "Not Ready"}
                </span>
              </div>
            </div>

            {/* Tag Details / Edit Form */}
            <Card className="glass-card p-6">
              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-[var(--text-secondary)] mb-1">
                      Name <span className="text-red-400">*</span>
                    </label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Hidden Treasure"
                      className="bg-[var(--bg-secondary)] border-[var(--neon-pink)]/30"
                    />
                  </div>
                  {/* Hint is optional — collapsed behind a button so the
                      required fields (name + map location) read as the
                      only things to fill out on first glance. */}
                  {hintExpanded ? (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm text-[var(--text-secondary)] flex items-center gap-1">
                          <HelpCircle className="w-3 h-3" />
                          Hint
                          <span className="text-[var(--text-muted)] text-xs ml-1">(optional)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setHint("")
                            setHintExpanded(false)
                          }}
                          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                      <Input
                        value={hint}
                        onChange={(e) => setHint(e.target.value)}
                        placeholder="e.g., Near the coffee bar..."
                        className="bg-[var(--bg-secondary)] border-[var(--neon-cyan)]/30"
                        autoFocus
                      />
                      <p className="text-[var(--text-muted)] text-xs mt-1">
                        Shown blurred on the dashboard map until tapped.
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setHintExpanded(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md border border-dashed border-[var(--neon-cyan)]/30 text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/5 hover:border-[var(--neon-cyan)]/60 transition-colors cursor-pointer text-sm"
                    >
                      <HelpCircle className="w-4 h-4" />
                      Add optional hint
                    </button>
                  )}
                  {/* Map Pin Picker */}
                  <div>
                    <label className="block text-sm text-[var(--text-secondary)] mb-1">
                      <MapPin className="w-3 h-3 inline mr-1" />
                      Hiding Location <span className="text-red-400">*</span>
                    </label>
                    <p className="text-[var(--text-muted)] text-xs mb-2">
                      Click on the map to place the pin:
                    </p>
                    <VenueMap
                      interactive
                      pinX={locationX}
                      pinY={locationY}
                      onPinPlace={(x, y) => {
                        setLocationX(x)
                        setLocationY(y)
                      }}
                    />
                    {locationX != null && locationY != null ? (
                      <p className="text-[var(--text-muted)] text-xs mt-1">
                        Pin placed at ({locationX}%, {locationY}%)
                      </p>
                    ) : (
                      <p className="text-red-400 text-xs mt-1">
                        Tap the map to place your tag's location
                      </p>
                    )}
                  </div>

                  {saveMessage && (
                    <p className={`text-sm ${saveMessage === "Saved!" ? "text-[var(--neon-yellow)]" : "text-red-400"}`}>
                      {saveMessage}
                    </p>
                  )}

                  <div className="flex gap-3">
                    <Button onClick={activeSave} disabled={saving || !formComplete} className="flex-1 btn-neon-pink">
                      {saving ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      onClick={() => {
                        setEditing(false)
                        if (tag) populateForm(tag)
                      }}
                      variant="outline"
                      disabled={!canCancel}
                      className="flex-1 border-[var(--neon-cyan)]/30 text-[var(--neon-cyan)]"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-bold text-white">{tag.name || "Unnamed Tag"}</h2>
                    </div>
                    <Button onClick={() => setEditing(true)} size="sm" className="btn-neon-cyan">
                      <Pencil className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  </div>

                  {tag.hint && (
                    <div className="bg-[var(--bg-secondary)] rounded-lg p-3 mb-3">
                      <p className="text-xs text-[var(--neon-cyan)] font-medium mb-1">Hint</p>
                      <p className="text-[var(--text-secondary)] text-sm">{tag.hint}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-2 bg-[var(--neon-yellow)]/20 px-3 py-1 rounded-full">
                      <Coins className="w-4 h-4 text-[var(--neon-yellow)]" />
                      <span className="text-[var(--neon-yellow)] font-bold">{tag.token_reward} {symbol}</span>
                    </div>
                  </div>

                  {tag.location_x != null && tag.location_y != null && (
                    <VenueMap pinX={tag.location_x} pinY={tag.location_y} interactive={false} />
                  )}

                  {saveMessage && (
                    <p className={`text-sm mt-3 ${saveMessage.includes("!") ? "text-[var(--neon-yellow)]" : "text-red-400"}`}>
                      {saveMessage}
                    </p>
                  )}
                </div>
              )}
            </Card>

            {/* Prominent "Mark Ready" Banner */}
            {!editing && tag.status !== "hidden" && (
              <Card className="glass-card p-5 border-2 border-[var(--neon-yellow)]/60" style={{ boxShadow: "0 0 20px rgba(159, 211, 86, 0.15)" }}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[var(--neon-yellow)]/20 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-6 h-6 text-[var(--neon-yellow)]" />
                  </div>
                  <p className="text-white font-semibold text-base leading-snug">
                    When {adminSkipped ? "the" : "your"} tag is placed and ready to be discovered, mark it as <span className="text-[var(--neon-yellow)]">Ready to Be Found</span> below!
                  </p>
                </div>
              </Card>
            )}

            {/* Status Toggle */}
            {!editing && (
              <Card className="glass-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium text-sm">
                      {tag.status === "hidden" ? "Tag is ready to be found" : "Tag is not ready yet"}
                    </p>
                    <p className="text-[var(--text-muted)] text-xs">
                      {tag.status === "hidden"
                        ? "Other players can find this tag on the dashboard"
                        : "Mark as ready to put it in the game"}
                    </p>
                  </div>
                  <Button
                    onClick={activeStatusToggle}
                    disabled={saving}
                    className={
                      tag.status === "hidden"
                        ? "bg-[var(--neon-purple)]/20 border border-[var(--neon-purple)]/50 text-[var(--neon-purple)]"
                        : "btn-neon-cyan"
                    }
                    size="sm"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    {tag.status === "hidden" ? "Take Out of Game" : "Mark Ready to Be Found"}
                  </Button>
                </div>
              </Card>
            )}
          </div>

        /* ===== FINDER VIEW: Hidden tag found by another player ===== */
        ) : tag?.status === "hidden" && !adminSkipped ? (
          <Card className="glass-card p-6">
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-full bg-[var(--neon-pink)]/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Sparkles className="w-10 h-10 text-[var(--neon-pink)]" />
              </div>
              <h1 className="text-2xl font-bold gradient-text mb-2" style={{ fontFamily: "var(--font-display)" }}>
                {alreadyFound ? "ALREADY FOUND!" : "TREASURE FOUND!"}
              </h1>
            </div>

            <div className="bg-[var(--bg-secondary)] rounded-lg p-4 mb-6">
              <h2 className="text-xl font-bold text-white mb-2">{tag.name}</h2>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
                  <User className="w-4 h-4" />
                  <span>
                    Hidden by: {!tag.owner_address ? "Treasure Hunt" : tag.owner_address.toLowerCase() === address ? (displayName || `${tag.owner_address.slice(0, 6)}...${tag.owner_address.slice(-4)}`) : `${tag.owner_address.slice(0, 6)}...${tag.owner_address.slice(-4)}`}
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-[var(--neon-yellow)]/20 px-3 py-1 rounded-full">
                  <Coins className="w-4 h-4 text-[var(--neon-yellow)]" />
                  <span className="text-[var(--neon-yellow)] font-bold">{tag.token_reward} {symbol}</span>
                </div>
              </div>
            </div>

            {!isCorrectChain && canFind && (
              <div className="glass-card p-4 mb-4 border-[var(--neon-yellow)]/50">
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
              </div>
            )}

            {!isWalletReady ? (
              isAuthenticated ? (
                // Returning user: JWT cookie is valid, but the thirdweb SDK is
                // still hydrating in the background. Don't show a Connect button —
                // they're already logged in, just briefly waiting for the wallet
                // to become signable. This is the JWT-first → thirdweb gap.
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-[var(--neon-pink)]/30 border-t-[var(--neon-pink)] rounded-full animate-spin" />
                  <p className="text-[var(--text-secondary)] text-sm">Preparing wallet…</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-[var(--text-secondary)] mb-4">Connect your wallet to claim this treasure!</p>
                  <WalletConnectButton label="Join the Game!" />
                </div>
              )
            ) : alreadyFound ? (
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-[var(--neon-yellow)]/20 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6 text-[var(--neon-yellow)]" />
                </div>
                <p className="text-[var(--text-muted)]">You've already found this treasure!</p>
                <Link href="/dashboard">
                  <Button className="mt-4 btn-neon-cyan">View Dashboard</Button>
                </Link>
              </div>
            ) : !findStatusChecked && !isOwner ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-[var(--neon-pink)]/30 border-t-[var(--neon-pink)] rounded-full animate-spin" />
                <p className="text-[var(--text-secondary)] text-sm">Checking claim status...</p>
              </div>
            ) : canFind ? (
              !isAuthenticated ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-[var(--neon-pink)]/30 border-t-[var(--neon-pink)] rounded-full animate-spin" />
                  <p className="text-[var(--text-secondary)] text-sm">Authenticating...</p>
                </div>
              ) : (
                <Button onClick={handleFind} disabled={claiming} className="w-full btn-neon-pink text-lg py-6">
                  {claiming ? (
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Claiming...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      Claim {tag.token_reward} {symbol} Reward!
                    </span>
                  )}
                </Button>
              )
            ) : null}

            {isAdmin && (
              <Button
                onClick={handleAdminSkip}
                disabled={adminSkipping}
                variant="outline"
                className="w-full mt-4 border-[var(--neon-cyan)]/30 text-[var(--neon-cyan)]"
              >
                {adminSkipping ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-[var(--neon-cyan)]/30 border-t-[var(--neon-cyan)] rounded-full animate-spin" />
                    Skipping...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <SkipForward className="w-4 h-4" />
                    Admin: Skip & Manage Tag
                  </span>
                )}
              </Button>
            )}
          </Card>

        /* ===== REGISTERED TAG: Not hidden yet ===== */
        ) : tag?.status === "registered" && !adminSkipped ? (
          <Card className="glass-card p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--neon-purple)]/20 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-[var(--neon-purple)]" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Not Ready Yet</h2>
            <p className="text-[var(--text-secondary)] mb-4">
              This tag has been claimed but hasn't been hidden yet. Check back later!
            </p>
            <div className="space-y-3">
              <Link href="/">
                <Button className="btn-neon-cyan">Back to Home</Button>
              </Link>
              {isAdmin && (
                <Button
                  onClick={handleAdminSkip}
                  disabled={adminSkipping}
                  variant="outline"
                  className="w-full border-[var(--neon-cyan)]/30 text-[var(--neon-cyan)]"
                >
                  {adminSkipping ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-[var(--neon-cyan)]/30 border-t-[var(--neon-cyan)] rounded-full animate-spin" />
                      Skipping...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <SkipForward className="w-4 h-4" />
                      Admin: Skip & Manage Tag
                    </span>
                  )}
                </Button>
              )}
            </div>
          </Card>
        ) : null}

        {/* Optional name prompt — appears inline after a first claim (find or
            ownership) for players who haven't picked a handle yet. Username is
            decoupled from sign-up so the claim isn't interrupted; this is the
            gentle ask once the reward is in. Skipping is fine — they can set it
            from the header nudge, and it's required only on the leaderboard.
            Disappears the moment a handle is saved (needsUsername → false). */}
        {needsUsername && (alreadyFound || isOwner || adminSkipped) && (
          <Card className="glass-card p-5 mt-4">
            <h3 className="text-lg font-bold text-white mb-1">Pick your name</h3>
            <p className="text-[var(--text-muted)] text-xs mb-4">
              Optional. This is the name other players see on the leaderboard. You
              can skip it and set one anytime from the header.
            </p>
            <UsernameForm submitLabel="Save name" autoFocus={false} />
          </Card>
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
