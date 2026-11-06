"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { BookUser, Camera, Loader2, Lock, Trash2 } from "lucide-react"
import AppHeader from "@/components/app-header"
import WalletConnectButton from "@/components/wallet-connect-button"
import { Button } from "@/components/ui/button"
import { useWallet } from "@/lib/wallet-context"
import { compressImage } from "@/lib/image-compress"

type Badge = {
  key: string
  edition: string
  editionName: string
  tagName: string
  claimTx: string
  foundAt: number
}

type PassportData = {
  edition: { slug: string; name: string }
  passport: { firstEdition: string; handle: string | null; photoNonce: string | null } | null
  badges: Badge[]
}

const explorer = (process.env.NEXT_PUBLIC_EXPLORER_URL || "").replace(/\/$/, "")

export default function PassportPage() {
  const { isAuthenticated, displayName } = useWallet()
  const [data, setData] = useState<PassportData | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setError("")
    const res = await fetch("/api/passport", { credentials: "include", cache: "no-store" })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return setError(body.error || "Could not load your passport")
    setData(body)
  }, [])

  useEffect(() => {
    if (isAuthenticated) load()
  }, [isAuthenticated, load])

  const upload = async (file: File) => {
    setBusy("upload")
    setError("")
    try {
      const fd = new FormData()
      fd.append("file", await compressImage(file))
      const res = await fetch("/api/passport/photo", { method: "POST", credentials: "include", body: fd })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Upload failed")
      await load()
    } catch (e: any) {
      setError(e.message || "Upload failed")
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    setBusy("remove")
    setError("")
    try {
      const res = await fetch("/api/passport/photo", { method: "DELETE", credentials: "include" })
      if (!res.ok) throw new Error("Could not remove your photo")
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  const photoNonce = data?.passport?.photoNonce
  const handle = data?.passport?.handle || displayName

  return (
    <main className="min-h-screen hero-gradient flex flex-col relative overflow-hidden pb-24">
      <div className="blob-pink top-10 -left-40 opacity-30" />
      <div className="blob-cyan bottom-20 -right-40 opacity-30" />
      <AppHeader />

      <div className="flex-1 p-4 relative z-10">
        <div className="max-w-2xl mx-auto py-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-[var(--neon-cyan)]/20 flex items-center justify-center flex-shrink-0">
              <BookUser className="w-5 h-5 text-[var(--neon-cyan)]" />
            </div>
            <h2 className="text-2xl font-bold gradient-text" style={{ fontFamily: "var(--font-display)" }}>
              PASSPORT
            </h2>
          </div>

          {!isAuthenticated ? (
            <div className="glass-card p-6 text-center space-y-4">
              <p className="text-[var(--text-secondary)]">
                Your passport keeps your badges and photo from every Treasure Hunt you play. Sign in to see it.
              </p>
              <WalletConnectButton />
            </div>
          ) : !data ? (
            <div className="glass-card p-6 flex justify-center">
              {error ? <p className="text-red-400 text-sm">{error}</p> : <Loader2 className="w-6 h-6 animate-spin" />}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Holder */}
              <div className="glass-card p-5 flex items-center gap-5">
                <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 bg-[var(--bg-card)] border border-[var(--neon-cyan)]/30 flex items-center justify-center">
                  {photoNonce ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/passport/photo?v=${photoNonce}`} alt="Your passport photo" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-8 h-8 text-[var(--text-muted)]" />
                  )}
                </div>
                <div className="min-w-0 space-y-2">
                  <p className="text-xl font-bold truncate">{handle || "Player"}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {data.badges.length} {data.badges.length === 1 ? "edition" : "editions"} played
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => fileInput.current?.click()}>
                      {busy === "upload" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4 mr-1" />}
                      {photoNonce ? "Change photo" : "Add photo"}
                    </Button>
                    {photoNonce && (
                      <Button size="sm" variant="ghost" disabled={!!busy} onClick={remove} aria-label="Remove photo">
                        {busy === "remove" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    )}
                  </div>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      e.target.value = ""
                      if (f) upload(f)
                    }}
                  />
                </div>
              </div>

              <p className="text-xs text-[var(--text-muted)] flex gap-2">
                <Lock className="w-4 h-4 flex-shrink-0" />
                Your photo is encrypted before it is stored on Swarm. Only you can see it, at any Treasure Hunt
                edition. Removing it makes the stored copy unreadable for good.
              </p>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              {/* Badges */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-3">Badges</h3>
                {data.badges.length === 0 ? (
                  <div className="glass-card p-5 text-sm text-[var(--text-secondary)]">
                    Find your first tag at {data.edition.name} to earn its badge.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {data.badges.map((b) => {
                      const here = b.edition === data.edition.slug
                      return (
                        <div
                          key={b.key}
                          className={`glass-card p-4 space-y-1 ${here ? "border border-[var(--neon-pink)]/60" : ""}`}
                        >
                          <p className="font-bold">{b.editionName}</p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {new Date(b.foundAt * 1000).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                          <p className="text-xs text-[var(--text-secondary)] truncate">First find: {b.tagName}</p>
                          {b.claimTx && explorer && (
                            <a href={`${explorer}/tx/${b.claimTx}`} target="_blank" rel="noreferrer" className="text-xs text-[var(--neon-cyan)] underline">
                              Claim transaction
                            </a>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
