"use client"

import AppHeader from "@/components/app-header"
import Leaderboard from "@/components/leaderboard"
import UsernameForm from "@/components/username-form"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useWallet } from "@/lib/wallet-context"

export default function LeaderboardPage() {
  // A name is mandatory to view the rankings: this is the one place where the
  // otherwise-optional handle is required, since the board is where it shows.
  // Unauthenticated visitors (needsUsername === false) still see it read-only.
  const { needsUsername } = useWallet()

  return (
    <main className="min-h-screen hero-gradient flex flex-col relative overflow-hidden">
      <div className="blob-pink top-10 -left-40 opacity-30" />
      <div className="blob-cyan bottom-20 -right-40 opacity-30" />

      <AppHeader />
      <div className="flex-1 p-4 relative z-10">
        <div className="max-w-2xl mx-auto py-6">
          <Link href="/" className="hidden md:inline-flex">
            <Button
              variant="outline"
              size="sm"
              className="mb-6 border-[var(--neon-cyan)]/30 text-[var(--neon-cyan)]"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>

          {needsUsername ? (
            <Card className="glass-card p-6 max-w-md mx-auto text-center">
              <h2
                className="text-2xl font-bold gradient-text mb-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                CHOOSE YOUR NAME
              </h2>
              <p className="text-[var(--text-secondary)] text-sm mb-5">
                Pick a username to join the rankings. It's required to view the leaderboard.
              </p>
              <UsernameForm submitLabel="View leaderboard" />
            </Card>
          ) : (
            <>
              <Leaderboard />
              <div className="mt-4 text-center">
                <Link href="/most-found">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[var(--neon-cyan)]/30 text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/10"
                  >
                    View Most Found Tags
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
