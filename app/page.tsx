"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { ChevronRight, Map, Trophy, Users, ShoppingBag, Settings, Receipt, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useWallet } from "@/lib/wallet-context"
import { useTokenMetadata } from "@/lib/token-metadata-context"
import AppHeader from "@/components/app-header"
import WalletConnectButton from "@/components/wallet-connect-button"

const PALETTE = {
  bgCard: "var(--bg-card, #131921)",
  bgSecondary: "var(--bg-secondary, #0A0E14)",
  cyan: "#58A6FF",
  green: "#56D364",
  pink: "#F0605D",
  orange: "#FF9A76",
  textPrimary: "var(--text-primary, #E6EDF3)",
  textSecondary: "var(--text-secondary, #8B949E)",
  textMuted: "var(--text-muted, #484F58)",
}

interface DashboardStats {
  found: number
  total: number
}

const EMPTY_STATS: DashboardStats = {
  found: 0, total: 0,
}

export default function Home() {
  const { address, isConnected, isAuthenticated, isAuthenticating, isAdmin, authenticate } = useWallet()
  const { symbol } = useTokenMetadata()
  const router = useRouter()
  const [authBusy, setAuthBusy] = useState(false)
  const [authMsg, setAuthMsg] = useState("")
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS)

  // Pull live state for the home: dashboard tags (found/total).
  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    const load = async () => {
      try {
        const tagsRes = await fetch("/api/nfc-tags/dashboard", { credentials: "include", cache: "no-store" })
        if (cancelled) return
        const next: DashboardStats = { ...EMPTY_STATS }
        if (tagsRes.ok) {
          const data = await tagsRes.json()
          const tags = (data?.tags || []) as { found_by_user?: boolean; status?: string; is_own?: boolean }[]
          const inPlay = tags.filter((t) => t.status === "hidden" && !t.is_own)
          next.total = inPlay.length
          next.found = inPlay.filter((t) => t.found_by_user).length
        }
        if (!cancelled) setStats(next)
      } catch {
        /* ignore */
      }
    }
    load()
    const i = setInterval(load, 120_000)
    const onVis = () => { if (!document.hidden) load() }
    document.addEventListener("visibilitychange", onVis)
    return () => {
      cancelled = true
      clearInterval(i)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [isAuthenticated])

  const onAuth = async () => {
    if (!address || isAuthenticated) return
    setAuthBusy(true); setAuthMsg("")
    try {
      const data = await authenticate()
      if (data.error) setAuthMsg(data.error)
    } catch {
      setAuthMsg("Failed to authenticate. Please try again.")
    } finally {
      setAuthBusy(false)
    }
  }

  // ─── Connect screen (no JWT cookie AND thirdweb not connected) ────
  // JWT-first: returning users have isAuthenticated = true immediately, so
  // they skip both this branch and the Authenticate screen and render the
  // home directly while thirdweb hydrates in the background.
  if (!isAuthenticated && !isConnected) {
    return (
      <main className="min-h-screen hero-gradient flex flex-col relative overflow-hidden">
        <div className="blob-pink top-10 -left-40 opacity-50" />
        <div className="blob-cyan bottom-20 -right-40 opacity-50" />
        <AppHeader />
        <div className="flex-1 flex items-center justify-center p-4 relative z-10">
          <div className="text-center max-w-lg stagger-children">
            <div className="mb-10 flex justify-center">
              <div className="w-[22rem] h-[13rem] relative sm:w-[34rem] sm:h-[19rem]">
                <Image src="/treasure-hunt-logo.png" alt="Treasure Hunt Logo" fill className="object-contain drop-shadow-2xl"/>
              </div>
            </div>
            <p className="text-lg text-[var(--text-secondary)] mb-8 max-w-md mx-auto">
              Scan NFC tags to earn {symbol} tokens, discover hidden treasures, and climb the leaderboard
            </p>
            <div className="animate-fade-slide-up" style={{ animationDelay: '0.5s' }}>
              <WalletConnectButton />
            </div>
          </div>
        </div>
      </main>
    )
  }

  // ─── Authenticate screen (thirdweb connected, no JWT yet) ─────────
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen hero-gradient flex flex-col relative overflow-hidden">
        <div className="blob-pink top-10 -left-40 opacity-50" />
        <div className="blob-cyan bottom-20 -right-40 opacity-50" />
        <AppHeader />
        <div className="flex-1 flex items-center justify-center p-4 relative z-10">
          <div className="text-center max-w-md w-full">
            <div className="mb-6 flex justify-center animate-fade-slide-up">
              <div className="w-[17.5rem] h-[10.5rem] relative sm:w-[27rem] sm:h-[13rem]">
                <Image src="/treasure-hunt-logo.png" alt="Treasure Hunt Logo" fill className="object-contain drop-shadow-2xl" />
              </div>
            </div>
            {authBusy || isAuthenticating ? (
              <div className="flex flex-col items-center gap-4 animate-fade-slide-up">
                <div className="w-12 h-12 border-4 border-[var(--neon-pink)]/30 border-t-[var(--neon-pink)] rounded-full animate-spin" />
                <p className="text-[var(--text-secondary)]">Authenticating...</p>
              </div>
            ) : (
              <Button onClick={onAuth} className="btn-neon-pink w-full animate-fade-slide-up">
                Authenticate Wallet
              </Button>
            )}
            {authMsg && <p className="mt-4 text-sm text-red-400">{authMsg}</p>}
          </div>
        </div>
      </main>
    )
  }

  // ─── Stack home (chosen layout) ────────────────────────────────────
  const hidden = Math.max(0, stats.total - stats.found)

  return (
    <main className="min-h-screen hero-gradient flex flex-col relative overflow-hidden">
      <AppHeader />
      <div className="flex-1 px-3.5 py-3 pb-24 relative z-10 max-w-2xl mx-auto w-full flex flex-col gap-2.5">
        {/* 1 · Live ticker — rotates through what's happening right now */}
        <LiveTicker stats={stats} />

        {/* 2 · Treasure Map hero */}
        <Link href="/dashboard" className="block">
          <div className="rounded-[18px] flex items-center gap-3 px-4 py-4 active:scale-[0.985] transition-transform"
            style={{
              background: `linear-gradient(135deg, ${PALETTE.cyan}48 0%, ${PALETTE.green}30 100%)`,
              border: `1px solid ${PALETTE.cyan}88`,
              boxShadow: `0 0 22px ${PALETTE.cyan}40`,
            }}>
            <div className="flex items-center justify-center flex-shrink-0"
              style={{
                width: 52, height: 52, borderRadius: 14,
                background: `linear-gradient(135deg, ${PALETTE.cyan}73 0%, ${PALETTE.green}4D 100%)`,
                border: `1px solid ${PALETTE.cyan}99`,
              }}>
              <Map className="w-7 h-7" style={{ color: PALETTE.cyan }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bebas text-[22px] tracking-wider"
                style={{ color: PALETTE.textPrimary, textShadow: `0 0 10px ${PALETTE.cyan}AA, 0 0 20px ${PALETTE.cyan}55` }}>
                TREASURE MAP
              </div>
              <div className="text-[11px] truncate" style={{ color: PALETTE.textSecondary }}>
                <span style={{ color: PALETTE.green, fontWeight: 700 }}>{stats.found}</span> found ·{" "}
                <span style={{ color: PALETTE.pink, fontWeight: 700 }}>{hidden}</span> hidden · Cadaval
              </div>
            </div>
            <ChevronRight className="w-5 h-5" style={{ color: PALETTE.cyan }} />
          </div>
        </Link>

        {/* 3 · tile grid */}
        <div className="grid grid-cols-3 gap-2.5">
          <Tile color={PALETTE.orange} icon={ShoppingBag} label="Merch"       sub="Spend your TH"     href="/merch" />
          <Tile color={PALETTE.green}  icon={Trophy}     label="Leaderboard" sub="Climb the ranks"   href="/leaderboard" />
          <Tile color={PALETTE.pink}   icon={Users}      label="Social"      sub="X · LinkedIn"      href="/social-rewards" />
        </div>

        {/* Nova Cidade booth pointer — high-visibility callout: this is the
            primary CTA for organic tag growth at the venue, so it needs to
            read at a glance, not be a footnote. */}
        <div
          className="mt-1 rounded-[14px] flex items-center gap-3 px-4 py-3.5 relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${PALETTE.pink}33 0%, ${PALETTE.orange}26 100%)`,
            border: `1.5px solid ${PALETTE.pink}AA`,
            boxShadow: `0 0 18px ${PALETTE.pink}55, inset 0 0 18px ${PALETTE.pink}1A`,
          }}
        >
          <div
            className="flex items-center justify-center flex-shrink-0 animate-pulse"
            style={{
              width: 40, height: 40, borderRadius: 12,
              background: `linear-gradient(135deg, ${PALETTE.pink}66 0%, ${PALETTE.orange}55 100%)`,
              border: `1px solid ${PALETTE.pink}AA`,
              boxShadow: `0 0 12px ${PALETTE.pink}88`,
            }}
          >
            <Sparkles className="w-5 h-5" style={{ color: "#fff" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="font-bebas tracking-wider text-[16px] leading-tight"
              style={{
                color: "#fff",
                textShadow: `0 0 10px ${PALETTE.pink}AA, 0 0 18px ${PALETTE.pink}66`,
              }}
            >
              HIDE YOUR OWN TAG · EARN 500 {symbol}
            </div>
            <div className="text-[11.5px] mt-0.5" style={{ color: PALETTE.textSecondary, lineHeight: 1.35 }}>
              Stop by the <span style={{ color: PALETTE.orange, fontWeight: 700 }}>Nova Cidade · Nova IMS</span> booth
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="flex flex-col gap-2">
            <Link href="/merch-history" className="block">
              <div className="flex items-center justify-center gap-2 py-2.5 rounded-[10px]"
                style={{
                  background: "rgba(255,154,118,0.14)", border: "1px solid rgba(255,154,118,0.55)",
                  color: PALETTE.orange, fontSize: 13, fontWeight: 600,
                }}>
                <Receipt className="w-4 h-4" /> Merch History
              </div>
            </Link>
            <Link href="/admin" className="block">
              <div className="flex items-center justify-center gap-2 py-2.5 rounded-[10px]"
                style={{
                  background: "rgba(239,68,68,0.16)", border: "1px solid rgba(239,68,68,0.55)",
                  color: "#fca5a5", fontSize: 13, fontWeight: 600,
                }}>
                <Settings className="w-4 h-4" /> Admin Panel
              </div>
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}

interface TickerItem {
  text: string
  color: string
  href?: string
}

function buildTickerItems(stats: DashboardStats): TickerItem[] {
  const items: TickerItem[] = []
  if (stats.total > 0) {
    items.push({
      text: `${stats.found}/${stats.total} tags found · keep hunting`,
      color: PALETTE.green, href: "/dashboard",
    })
  }
  if (items.length === 0) {
    items.push({
      text: "Hunt tags around the venue · earn TH",
      color: PALETTE.green,
    })
  }
  return items
}

function LiveTicker({ stats }: { stats: DashboardStats }) {
  const items = buildTickerItems(stats)
  const [idx, setIdx] = useState(0)

  // Reset to first item when the underlying list shrinks (so we don't
  // freeze on a stale index past the end of the new array).
  useEffect(() => {
    setIdx((i) => (i >= items.length ? 0 : i))
  }, [items.length])

  // Cycle every ~4.5s. Pause if there's only one item.
  useEffect(() => {
    if (items.length < 2) return
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 4500)
    return () => clearInterval(t)
  }, [items.length])

  const item = items[Math.min(idx, items.length - 1)]
  const inner = (
    <div
      key={idx}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full"
      style={{
        background: `${item.color}1F`,
        border: `1px solid ${item.color}66`,
        animation: "fadeSlideUp 0.32s ease-out",
      }}
    >
      <span className="inline-block rounded-full flex-shrink-0"
        style={{
          width: 6, height: 6, background: item.color,
          boxShadow: `0 0 6px ${item.color}`,
          animation: "thPulse 1.6s ease-in-out infinite",
        }} />
      <span className="text-[10px] font-bold uppercase tracking-widest flex-shrink-0"
        style={{ color: item.color }}>Live</span>
      <span className="text-[11px] truncate" style={{ color: PALETTE.textSecondary }}>{item.text}</span>
      {items.length > 1 && (
        <span className="text-[9px] font-mono ml-auto flex-shrink-0"
          style={{ color: PALETTE.textMuted }}>
          {idx + 1}/{items.length}
        </span>
      )}
    </div>
  )
  return item.href ? <Link href={item.href} className="block">{inner}</Link> : inner
}

function Tile({ color, icon: Icon, label, sub, href }: {
  color: string; icon: React.ComponentType<{ className?: string }>;
  label: string; sub: string; href: string;
}) {
  return (
    <Link href={href} className="block">
      <div className="rounded-[14px] p-3.5 active:scale-[0.98] transition-transform flex flex-col gap-2"
        style={{
          background: PALETTE.bgCard,
          border: `1px solid ${color}4D`,
          minHeight: 92,
        }}>
        <div className="flex items-center justify-center"
          style={{
            width: 34, height: 34, borderRadius: 9,
            background: `${color}2E`, border: `1px solid ${color}66`,
            boxShadow: `0 0 10px ${color}40`,
          }}>
          <Icon className="w-[17px] h-[17px]" />
        </div>
        <div>
          <div className="text-[14px] font-semibold leading-tight" style={{ color: PALETTE.textPrimary }}>{label}</div>
          <div className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: PALETTE.textMuted }}>{sub}</div>
        </div>
      </div>
    </Link>
  )
}
