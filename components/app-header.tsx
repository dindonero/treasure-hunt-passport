"use client"

import { useWallet } from "@/lib/wallet-context"
import { Button } from "@/components/ui/button"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { useState } from "react"
import WalletConnectButton from "./wallet-connect-button"
import UsernamePromptModal from "./username-prompt-modal"
import Image from "next/image"
import { Coins, LogOut, Copy, Check, Wallet, Pencil } from "lucide-react"
import { useTokenBalanceContext } from "@/hooks/use-token-balance"
import { useTokenMetadata } from "@/lib/token-metadata-context"
import { truncateAddress } from "@/lib/utils"

interface WalletStatusBarProps {
  compact?: boolean
  isAuthenticated: boolean
  authenticating: boolean
  onAuthenticate: () => void
  tokenBalance: string | null
  loadingBalance: boolean
  symbol: string
  isAdmin: boolean
  displayName: string | null
  address: string
  walletPopoverContent: React.ReactNode
  needsUsername: boolean
  onSetName: () => void
}

function WalletStatusBar({
  compact = false,
  isAuthenticated,
  authenticating,
  onAuthenticate,
  tokenBalance,
  loadingBalance,
  symbol,
  isAdmin,
  displayName,
  address,
  walletPopoverContent,
  needsUsername,
  onSetName,
}: WalletStatusBarProps) {
  return (
    <>
      {needsUsername && (
        <button
          onClick={onSetName}
          aria-label="Set your username"
          className={
            compact
              ? "flex items-center gap-1 bg-[var(--neon-yellow)]/15 text-[var(--neon-yellow)] border border-[var(--neon-yellow)]/40 px-2.5 py-1 rounded-full text-[11px] font-semibold animate-pulse cursor-pointer hover:bg-[var(--neon-yellow)]/25 transition-colors"
              : "flex items-center gap-1 bg-[var(--neon-yellow)]/15 text-[var(--neon-yellow)] border border-[var(--neon-yellow)]/40 px-3 py-1 rounded-full text-xs font-semibold animate-pulse cursor-pointer hover:bg-[var(--neon-yellow)]/25 transition-colors"
          }
        >
          <Pencil className="w-3 h-3" />
          Set name
        </button>
      )}
      {!isAuthenticated && (
        <Button
          onClick={onAuthenticate}
          disabled={authenticating}
          {...(compact ? { size: "sm" as const } : {})}
          className={
            compact
              ? "bg-[var(--neon-purple)] hover:bg-[var(--neon-purple)]/80 text-white text-[10px] px-2.5 py-0.5 h-auto transition-all"
              : "bg-[var(--neon-purple)] hover:bg-[var(--neon-purple)]/80 text-white text-xs px-3 py-1.5 transition-all hover:shadow-[var(--glow-purple)]"
          }
        >
          {authenticating ? (compact ? "..." : "Authenticating...") : "Authenticate"}
        </Button>
      )}
      {tokenBalance !== null && (
        <div
          className={
            compact
              ? "flex items-center gap-1.5 bg-[var(--bg-secondary)] px-3 py-1 rounded-full border border-[var(--neon-cyan)]/20"
              : "flex items-center gap-1.5 bg-[var(--bg-secondary)] px-2.5 py-1 rounded-full border border-[var(--neon-cyan)]/30"
          }
        >
          <Coins className={compact ? "w-4 h-4 text-[var(--neon-yellow)]" : "w-3.5 h-3.5 text-[var(--neon-yellow)]"} />
          {loadingBalance ? (
            <span className="text-xs text-[var(--text-muted)]">...</span>
          ) : (
            <span className={compact ? "text-sm font-bold text-[var(--neon-yellow)]" : "text-xs font-bold text-[var(--neon-yellow)]"}>
              {Number.parseFloat(tokenBalance).toFixed(2)} {symbol}
            </span>
          )}
        </div>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={
              compact
                ? "flex items-center gap-1.5 bg-[var(--bg-secondary)] px-3 py-1 rounded-full border border-[var(--neon-pink)]/20 cursor-pointer hover:border-[var(--neon-pink)]/60 transition-colors"
                : "flex items-center gap-1.5 bg-[var(--bg-secondary)] px-2.5 py-1 rounded-full border border-[var(--neon-pink)]/30 cursor-pointer hover:border-[var(--neon-pink)]/60 transition-colors"
            }
          >
            <div className={`w-2 h-2 rounded-full ${isAdmin ? 'bg-[var(--neon-pink)]' : 'bg-[var(--neon-cyan)]'} animate-pulse`} />
            <span className={compact ? "text-sm text-[var(--text-secondary)]" : "text-xs text-[var(--text-secondary)]"}>
              {isAdmin && <span className={`text-[var(--neon-pink)] font-semibold ${compact ? 'mr-0.5' : 'mr-1'}`}>Admin</span>}
              <span className={`${displayName ? '' : 'font-mono'} text-[var(--text-primary)]`}>
                {displayName || `${address.slice(0, 4)}...${address.slice(-4)}`}
              </span>
            </span>
          </button>
        </PopoverTrigger>
        {walletPopoverContent}
      </Popover>
    </>
  )
}

export default function AppHeader() {
  const { address, isConnected, disconnect, isAdmin, isAuthenticated, authenticate, displayName, needsUsername } = useWallet()
  const { balance: tokenBalance, loading: loadingBalance } = useTokenBalanceContext()
  const { symbol } = useTokenMetadata()
  const [authenticating, setAuthenticating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [usernameModalOpen, setUsernameModalOpen] = useState(false)

  const handleCopyAddress = async () => {
    if (!address) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleAuthenticate = async () => {
    setAuthenticating(true)
    try {
      await authenticate()
    } catch {
      // authentication failure is shown via UI state
    } finally {
      setAuthenticating(false)
    }
  }

  const walletPopoverContent = (
    <PopoverContent
      align="end"
      className="w-64 bg-[var(--bg-elevated)] border border-[var(--neon-pink)]/30 backdrop-blur-xl p-0"
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10">
        <Wallet className="w-4 h-4 text-[var(--neon-pink)]" />
        <span className="text-sm font-medium text-[var(--text-primary)]">
          {displayName || "Wallet"}
        </span>
        {isAdmin && (
          <span className="text-[10px] font-semibold text-[var(--neon-pink)] bg-[var(--neon-pink)]/10 px-1.5 py-0.5 rounded-full">
            Admin
          </span>
        )}
      </div>
      <button
        onClick={handleCopyAddress}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors cursor-pointer"
      >
        <span className="text-xs font-mono text-[var(--text-muted)]">
          {address ? truncateAddress(address) : ""}
        </span>
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-400" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        )}
      </button>
      <div className="border-t border-white/10">
        <button
          onClick={disconnect}
          className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="text-xs">Disconnect</span>
        </button>
      </div>
    </PopoverContent>
  )

  return (
    <header className="bg-[var(--bg-primary)]/80 backdrop-blur-lg border-b border-[var(--neon-pink)]/20 sticky top-0 z-50">
      {/* Row 1: Logos + action.
          Branch on JWT (isAuthenticated), not the live thirdweb state, so the
          full status-bar layout shows immediately on every navigation for
          returning users — no flash of the unauthenticated header while the
          thirdweb SDK hydrates. */}
      {!isAuthenticated ? (
        /* Login page: centered on mobile, left on desktop */
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center">
          <div className="flex-1 sm:flex-none" />
          <div className="flex items-center gap-3">
            <a href="/" className="hover:opacity-90 transition-opacity">
              <Image src="/treasure-hunt-only-logo.png" alt="Treasure Hunt" width={65} height={65} className="h-[36px] sm:h-[48px] w-auto flex-shrink-0" />
            </a>
            <a href="/" className="hover:opacity-90 transition-opacity">
              <Image src="/NOVA_Blockchain_Lab-2.png" alt="Nova Blockchain Lab" width={300} height={65} className="h-[44px] sm:h-[56px] w-auto flex-shrink-0" />
            </a>
          </div>
          <div className="flex-1 flex justify-end ml-3">
            <WalletConnectButton />
          </div>
        </div>
      ) : (
        /* Main page: centered on mobile, left on desktop */
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center sm:justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="hover:opacity-90 transition-opacity">
              <Image src="/treasure-hunt-only-logo.png" alt="Treasure Hunt" width={65} height={65} className="h-[36px] sm:h-[48px] w-auto flex-shrink-0" />
            </a>
            <a href="/" className="hover:opacity-90 transition-opacity">
              <Image src="/NOVA_Blockchain_Lab-2.png" alt="Nova Blockchain Lab" width={300} height={65} className="h-[44px] sm:h-[56px] w-auto flex-shrink-0" />
            </a>
          </div>
          {/* Desktop: full controls inline */}
          <div className="hidden sm:flex items-center gap-3">
            <WalletStatusBar
              isAuthenticated={isAuthenticated}
              authenticating={authenticating}
              onAuthenticate={handleAuthenticate}
              tokenBalance={tokenBalance}
              loadingBalance={loadingBalance}
              symbol={symbol}
              isAdmin={isAdmin}
              displayName={displayName}
              address={address!}
              walletPopoverContent={walletPopoverContent}
              needsUsername={needsUsername}
              onSetName={() => setUsernameModalOpen(true)}
            />
          </div>
        </div>
      )}

      {/* Row 2: Mobile status bar */}
      {isAuthenticated && (
        <div className="sm:hidden flex items-center justify-center gap-3 px-4 py-1.5 border-t border-white/5">
          <WalletStatusBar
            compact
            isAuthenticated={isAuthenticated}
            authenticating={authenticating}
            onAuthenticate={handleAuthenticate}
            tokenBalance={tokenBalance}
            loadingBalance={loadingBalance}
            symbol={symbol}
            isAdmin={isAdmin}
            displayName={displayName}
            address={address!}
            walletPopoverContent={walletPopoverContent}
            needsUsername={needsUsername}
            onSetName={() => setUsernameModalOpen(true)}
          />
        </div>
      )}

      <UsernamePromptModal open={usernameModalOpen} onOpenChange={setUsernameModalOpen} />
    </header>
  )
}
