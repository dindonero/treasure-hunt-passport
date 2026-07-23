"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Home, Scan, Map, Trophy, ShoppingBag } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"
import { useWallet } from "@/lib/wallet-context"

const navItems = [
  { href: "/", icon: Home, label: "Home", alwaysEnabled: true },
  { href: "/dashboard", icon: Map, label: "Map" },
  { href: "/scan", icon: Scan, label: "Scan", isFab: true, alwaysEnabled: true },
  { href: "/leaderboard", icon: Trophy, label: "Board" },
  { href: "/merch", icon: ShoppingBag, label: "Merch" },
]

export default function BottomNav() {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const { isAuthenticated } = useWallet()

  if (!isMobile) return null

  // JWT-first: a valid JWT cookie is enough to enable navigation. Sign-time
  // gates live at each individual action (see WalletContext.isWalletReady).
  const fullyOnboarded = isAuthenticated

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bottom-nav-glass"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Nav items */}
      <div className="flex items-end justify-around px-2 h-16">
        {navItems.map((item) => {
          const isActive = item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href)
          const Icon = item.icon
          const enabled = fullyOnboarded || item.alwaysEnabled

          if (item.isFab) {
            const fabContent = (
              <div className="flex flex-col items-center -mt-6">
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${enabled ? "active:scale-95" : "opacity-40"} ${
                    isActive
                      ? "bg-[var(--neon-pink)] shadow-[var(--glow-pink)]"
                      : "bg-gradient-to-br from-[var(--neon-pink)] to-[var(--neon-purple)]"
                  }`}
                >
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className={`text-[10px] mt-1 font-medium ${enabled ? "text-white" : "text-[var(--text-muted)]"}`}>
                  {item.label}
                </span>
              </div>
            )

            return enabled ? (
              <Link key={item.href} href={item.href}>
                {fabContent}
              </Link>
            ) : (
              <div key={item.href} className="pointer-events-none">
                {fabContent}
              </div>
            )
          }

          const navContent = (
            <>
              <Icon className="w-5 h-5" />
              <span className="text-[10px] mt-0.5 font-medium">
                {item.label}
              </span>
              {isActive && enabled && (
                <div className="absolute bottom-1 w-1 h-1 rounded-full bg-[var(--neon-cyan)]" />
              )}
            </>
          )

          const navClass = `flex flex-col items-center justify-center min-w-[48px] min-h-[48px] py-2 relative transition-colors ${
            !enabled
              ? "text-[var(--text-muted)] opacity-40"
              : isActive
              ? "text-[var(--neon-cyan)] active:scale-95"
              : "text-[var(--text-muted)] active:scale-95"
          }`

          return enabled ? (
            <Link key={item.href} href={item.href} className={navClass}>
              {navContent}
            </Link>
          ) : (
            <div key={item.href} className={`${navClass} pointer-events-none`}>
              {navContent}
            </div>
          )
        })}
      </div>
    </nav>
  )
}
