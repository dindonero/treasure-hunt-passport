"use client"

import { useWallet } from "@/lib/wallet-context"
import { usePathname, useRouter } from "next/navigation"
import ResponsiveModal from "@/components/responsive-modal"
import { Sparkles } from "lucide-react"

export default function TagSetupGateModal() {
  const { needsTagSetup, tagClaimCode } = useWallet()
  const pathname = usePathname()
  const router = useRouter()

  // Suppress on tag pages so the user can actually set up their tag
  const onTagPage = pathname?.startsWith("/tag/")

  if (!needsTagSetup || onTagPage) return null

  return (
    <ResponsiveModal
      isOpen={true}
      onClose={() => {}}
      title="Set Up Your Tag"
      dismissable={false}
      className="bg-[var(--bg-primary)] border-[var(--bg-elevated)]"
    >
      <div className="flex flex-col items-center gap-6 animate-fade-slide-up">
        <div className="w-16 h-16 rounded-full bg-[var(--neon-yellow)]/20 flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-[var(--neon-yellow)]" />
        </div>
        <div className="text-center">
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
            Set up your tag and mark it as <span className="text-[var(--neon-yellow)] font-semibold">Ready to Be Found</span> before exploring the treasure hunt!
          </p>
        </div>
        <button
          onClick={() => router.push(`/tag/${tagClaimCode}`)}
          className="btn-neon-pink w-full py-3 rounded-lg font-bold text-lg cursor-pointer transition-all"
        >
          Set Up My Tag
        </button>
      </div>
    </ResponsiveModal>
  )
}
