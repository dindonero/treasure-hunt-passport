"use client"

import { useWallet } from "@/lib/wallet-context"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { PopoverClose } from "@radix-ui/react-popover"
import { useEffect, useState } from "react"
import { getLastAuthProvider } from "thirdweb/react"
import WalletConnectButton from "./wallet-connect-button"
import Image from "next/image"
import Link from "next/link"
import {
  BookUser,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Gem,
  LogOut,
  ShoppingBag,
  Tag,
  Trophy,
  Wallet,
} from "lucide-react"
import { useTokenBalanceContext } from "@/hooks/use-token-balance"
import { useTokenMetadata } from "@/lib/token-metadata-context"
import { truncateAddress } from "@/lib/utils"

const EXPLORER = (process.env.NEXT_PUBLIC_EXPLORER_URL || "").replace(/\/+$/, "")
const RULE = "1px solid rgba(240,246,252,0.08)"

/** Thirdweb's last login strategy, as a word. Brand names stay as they are. */
const METHODS: Record<string, string> = {
  google: "Google",
  apple: "Apple",
  facebook: "Facebook",
  discord: "Discord",
  x: "X",
  telegram: "Telegram",
  github: "GitHub",
  twitch: "Twitch",
  coinbase: "Coinbase",
  line: "LINE",
  farcaster: "Farcaster",
  steam: "Steam",
  email: "email",
  phone: "phone",
  passkey: "passkey",
  wallet: "wallet",
}

/** One row of either menu: icon, label, an optional fact on the right, chevron. */
function MenuRow({
  href,
  external,
  icon,
  label,
  meta,
  chevron = true,
}: {
  href: string
  external?: boolean
  icon: React.ReactNode
  label: string
  meta?: React.ReactNode
  chevron?: boolean
}) {
  const inner = (
    <>
      {icon}
      <span className="flex-1 text-sm">{label}</span>
      {meta}
      {chevron && <ChevronRight className="w-4 h-4 shrink-0 text-[var(--text-secondary)]" />}
    </>
  )
  const cls = "flex items-center gap-3 h-[52px] pl-4 pr-3.5 text-[var(--text-primary)] hover:bg-white/5 transition-colors"
  return external ? (
    <a role="menuitem" href={href} target="_blank" rel="noopener noreferrer" className={cls} style={{ borderTop: RULE }}>
      {inner}
    </a>
  ) : (
    <PopoverClose asChild>
      <Link role="menuitem" href={href} className={cls} style={{ borderTop: RULE }}>
        {inner}
      </Link>
    </PopoverClose>
  )
}

/** What the balance opens: the number, and what you can do with it. */
function BalanceMenu({ balance, symbol }: { balance: number; symbol: string }) {
  return (
    <PopoverContent
      align="end"
      sideOffset={6}
      role="menu"
      aria-label="Balance"
      className="w-[300px] p-0 overflow-hidden rounded-[14px] bg-[var(--bg-elevated)] border border-[var(--neon-cyan)]/35 shadow-[0_18px_50px_rgba(0,0,0,0.6)]"
    >
      <div className="flex flex-col gap-0.5 px-4 py-3.5">
        <span className="font-mono text-[10px] tracking-[0.16em] text-[var(--text-secondary)]">YOUR BALANCE</span>
        <div className="flex items-baseline gap-1.5">
          <span style={{ fontFamily: "var(--font-display)", fontSize: 46, lineHeight: 1, letterSpacing: "0.02em" }}>
            {Math.floor(balance).toLocaleString()}
          </span>
          <span className="text-sm text-[var(--text-secondary)]">{symbol}</span>
        </div>
      </div>
      <MenuRow href="/merch" icon={<ShoppingBag className="w-[18px] h-[18px] shrink-0 text-[var(--neon-pink)]" />} label="Store" />
      <MenuRow href="/dashboard" icon={<Tag className="w-[18px] h-[18px] shrink-0 text-[var(--neon-cyan)]" />} label="Tags found" />
      <MenuRow href="/leaderboard" icon={<Trophy className="w-[18px] h-[18px] shrink-0 text-[var(--medal-gold,#f5c542)]" />} label="Ranking" />
    </PopoverContent>
  )
}

/** What the wallet opens: who you are signed in as, the address, passport, explorer, sign out. */
function WalletMenu({
  address,
  displayName,
  isAdmin,
  onSignOut,
}: {
  address: string | null
  displayName: string | null
  isAdmin: boolean
  onSignOut: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [method, setMethod] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    getLastAuthProvider()
      .then((m) => {
        if (live && m) setMethod(METHODS[String(m)] ?? null)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  const copy = async () => {
    if (!address) return
    try {
      await navigator.clipboard?.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  const name = displayName || "Wallet"
  return (
    <PopoverContent
      align="end"
      sideOffset={6}
      role="menu"
      aria-label="Account"
      className="w-[300px] p-0 overflow-hidden rounded-[14px] bg-[var(--bg-elevated)] border border-[var(--neon-pink)]/35 shadow-[0_18px_50px_rgba(0,0,0,0.6)]"
    >
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span
          className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center bg-[var(--neon-pink)]/15 border border-[var(--neon-pink)]/50 text-[var(--neon-pink)]"
          style={{ fontFamily: "var(--font-display)", fontSize: 24 }}
          aria-hidden
        >
          {Array.from(name)[0]?.toUpperCase()}
        </span>
        <div className="min-w-0 flex flex-col gap-0.5">
          <span className="flex items-center gap-2 text-[15px] font-bold truncate">
            {name}
            {isAdmin && (
              <span className="text-[10px] font-semibold text-[var(--neon-pink)] bg-[var(--neon-pink)]/10 px-1.5 py-0.5 rounded-full">
                Admin
              </span>
            )}
          </span>
          {method && <span className="text-xs text-[var(--text-secondary)]">Signed in with {method}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 h-12 pl-4 pr-1" style={{ borderTop: RULE }}>
        <span className="flex-1 font-mono text-[12.5px] text-[var(--text-secondary)]">{address ? truncateAddress(address) : ""}</span>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy address"
          className="w-11 h-11 flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
        >
          {copied ? <Check className="w-4 h-4 text-[var(--neon-yellow)]" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <MenuRow href="/passport" icon={<BookUser className="w-[18px] h-[18px] shrink-0" />} label="Passport" />
      {EXPLORER && address && (
        <MenuRow
          href={`${EXPLORER}/address/${address}`}
          external
          chevron={false}
          icon={<ExternalLink className="w-[18px] h-[18px] shrink-0" />}
          label="View on explorer"
        />
      )}
      <button
        type="button"
        role="menuitem"
        onClick={onSignOut}
        className="w-full flex items-center gap-3 h-[52px] px-4 text-left text-sm text-[#FF7B72] hover:bg-red-500/10 transition-colors cursor-pointer"
        style={{ borderTop: "1px solid rgba(240,246,252,0.14)" }}
      >
        <LogOut className="w-[18px] h-[18px]" />
        Sign out
      </button>
    </PopoverContent>
  )
}

/**
 * The two pills. The balance is a button: it opens the balance menu. The wallet
 * is a symbol, not the address, which is noise on every screen and a wallet
 * address on display in a hall full of strangers.
 */
function WalletStatusBar({
  tokenBalance,
  loadingBalance,
  symbol,
  isAdmin,
  address,
  displayName,
  onSignOut,
}: {
  tokenBalance: string | null
  loadingBalance: boolean
  symbol: string
  isAdmin: boolean
  address: string | null
  displayName: string | null
  onSignOut: () => void
}) {
  const [open, setOpen] = useState<"balance" | "wallet" | null>(null)
  const balance = tokenBalance === null ? 0 : Number.parseFloat(tokenBalance)
  return (
    <>
      {tokenBalance !== null && (
        <Popover open={open === "balance"} onOpenChange={(o) => setOpen(o ? "balance" : null)}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Open balance menu"
              className={`flex min-h-8 items-center gap-1.5 pl-2.5 pr-2 rounded-full border cursor-pointer transition-colors ${
                open === "balance"
                  ? "bg-[var(--neon-cyan)]/15 border-[var(--neon-cyan)]/70"
                  : "bg-[var(--bg-secondary)] border-white/10 hover:border-white/25"
              }`}
            >
              <Gem className="w-3.5 h-3.5 shrink-0 text-[var(--neon-cyan)]" />
              {loadingBalance ? (
                <span className="text-xs text-[var(--text-muted)]">...</span>
              ) : (
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  {Math.floor(balance).toLocaleString()} <span className="font-normal text-[var(--text-secondary)]">{symbol}</span>
                </span>
              )}
              <ChevronDown className="w-3 h-3 shrink-0 text-[var(--text-secondary)]" strokeWidth={2.4} />
            </button>
          </PopoverTrigger>
          {open === "balance" && <BalanceMenu balance={balance} symbol={symbol} />}
        </Popover>
      )}
      <Popover open={open === "wallet"} onOpenChange={(o) => setOpen(o ? "wallet" : null)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Open account menu"
            className={`flex min-h-8 items-center gap-1.5 px-2.5 rounded-full border cursor-pointer transition-colors ${
              open === "wallet"
                ? "bg-[var(--neon-pink)]/15 border-[var(--neon-pink)]/80"
                : "bg-[var(--bg-secondary)] border-[var(--neon-pink)]/30 hover:border-[var(--neon-pink)]/60"
            }`}
          >
            <div className={`w-2 h-2 shrink-0 rounded-full ${isAdmin ? "bg-[var(--neon-pink)]" : "bg-[var(--neon-cyan)]"} animate-pulse`} />
            {isAdmin && <span className="shrink-0 text-xs text-[var(--neon-pink)] font-semibold">Admin</span>}
            <Wallet className="w-4 h-4 shrink-0 text-[var(--text-primary)]" />
          </button>
        </PopoverTrigger>
        {open === "wallet" && <WalletMenu address={address} displayName={displayName} isAdmin={isAdmin} onSignOut={onSignOut} />}
      </Popover>
    </>
  )
}

export default function AppHeader({ showConnect = true }: { showConnect?: boolean }) {
  const { address, disconnect, isAdmin, isAuthenticated, displayName } = useWallet()
  const { balance: tokenBalance, loading: loadingBalance } = useTokenBalanceContext()
  const { symbol } = useTokenMetadata()

  return (
    <header className="bg-[var(--bg-primary)]/80 backdrop-blur-lg border-b border-[var(--neon-pink)]/20 sticky top-0 z-50">
      {/* Branch on the JWT, not the live thirdweb state, so returning users get the
          full header at once instead of a flash of the signed-out one. */}
      {!isAuthenticated ? (
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center">
          <div className="flex-1 sm:flex-none" />
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="/" className="hover:opacity-90 transition-opacity">
              <Image src="/treasure-hunt-only-logo.png" alt="Treasure Hunt" width={65} height={65} className="h-[34px] sm:h-[48px] w-auto flex-shrink-0" />
            </a>
            <a href="/" className="hover:opacity-90 transition-opacity">
              <Image src="/NOVA_Blockchain_Lab-2.png" alt="Nova Blockchain Lab" width={300} height={65} className="h-[38px] sm:h-[56px] w-auto flex-shrink-0" />
            </a>
          </div>
          <div className="flex-1 flex justify-end ml-3">{showConnect && <WalletConnectButton />}</div>
        </div>
      ) : (
        /* One row at every width. Under pressure the logos give way (min-w-0),
           never the balance or the account pill (shrink-0). */
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-1.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <a href="/" className="hover:opacity-90 transition-opacity">
              <Image src="/treasure-hunt-only-logo.png" alt="Treasure Hunt" width={65} height={65} className="h-8 sm:h-[48px] w-auto flex-shrink-0" />
            </a>
            <a href="/" className="min-w-0 hover:opacity-90 transition-opacity">
              <Image src="/NOVA_Blockchain_Lab-2.png" alt="Nova Blockchain Lab" width={300} height={65} className="h-6 sm:h-[56px] w-auto" />
            </a>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <WalletStatusBar
              tokenBalance={tokenBalance}
              loadingBalance={loadingBalance}
              symbol={symbol}
              isAdmin={isAdmin}
              address={address}
              displayName={displayName}
              onSignOut={disconnect}
            />
          </div>
        </div>
      )}
    </header>
  )
}
