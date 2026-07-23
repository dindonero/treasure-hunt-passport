"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import UsernameForm from "@/components/username-form"

interface UsernamePromptModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Dismissable "choose your username" modal. No longer auto-opens on auth —
 * picking a name is decoupled from sign-up so a first-time tap can claim
 * without interruption. This modal is now opened explicitly by the header
 * "Set name" nudge. The mandatory ask lives on the leaderboard page and the
 * optional ask lives inline on the tag page (both render <UsernameForm/>).
 *
 * Centered Dialog positioned high on mobile (not a vaul drawer) so the soft
 * keyboard doesn't push the input off-screen — see CLAUDE.md.
 */
export default function UsernamePromptModal({ open, onOpenChange }: UsernamePromptModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[var(--bg-primary)] border-[var(--bg-elevated)] top-[12%] translate-y-0 sm:top-[50%] sm:translate-y-[-50%]"
      >
        <DialogHeader>
          <DialogTitle>Choose Your Username</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-6 animate-fade-slide-up">
          <div className="text-center">
            <p className="text-[var(--text-secondary)] text-sm">
              Pick a name that will appear on the leaderboard and throughout the app.
            </p>
          </div>

          <UsernameForm onDone={() => onOpenChange(false)} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
