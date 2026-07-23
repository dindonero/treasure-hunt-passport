"use client"

import { useState } from "react"
import { useWallet } from "@/lib/wallet-context"

const USERNAME_REGEX = /^[a-zA-Z0-9 ._-]+$/

interface UsernameFormProps {
  /** Called after the handle is saved successfully. */
  onDone?: (handle: string) => void
  /** Submit button label. */
  submitLabel?: string
  /** Autofocus the input on mount. Off for inline placements that aren't the
   *  primary focus of the screen (e.g. the post-claim card on the tag page). */
  autoFocus?: boolean
}

/**
 * Bare username input + validation + submit. The single source of truth for
 * picking a handle, reused by:
 *   - the dismissable header modal (UsernamePromptModal)
 *   - the optional inline card on the tag page (after a first claim)
 *   - the mandatory gate on the leaderboard page
 * On success it pushes the handle into WalletContext via applyHandle(), so
 * every consumer of displayName / needsUsername updates immediately.
 */
export default function UsernameForm({
  onDone,
  submitLabel = "LET'S GO",
  autoFocus = true,
}: UsernameFormProps) {
  const { applyHandle } = useWallet()
  const [username, setUsername] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function validate(value: string): string | null {
    if (value.length < 3) return "Must be at least 3 characters"
    if (value.length > 20) return "Must be 20 characters or less"
    if (!USERNAME_REGEX.test(value)) return "Only letters, numbers, spaces, dots, underscores, and hyphens"
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = username.trim().replace(/\s+/g, " ")
    const validationError = validate(trimmed)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/auth/set-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: trimmed }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 409) {
          setError("Username already taken")
        } else {
          setError(data.error || "Something went wrong")
        }
        return
      }

      applyHandle(data.handle)
      onDone?.(data.handle)
    } catch {
      setError("Network error — please try again")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
      <div>
        <label htmlFor="username-input" className="sr-only">Username</label>
        <input
          id="username-input"
          type="text"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value)
            if (error) setError(null)
          }}
          placeholder="Enter username"
          maxLength={20}
          autoFocus={autoFocus}
          autoComplete="off"
          className="w-full px-4 py-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--bg-elevated)] text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--neon-cyan)] focus:border-transparent transition-all"
        />
        {error && (
          <p className="mt-2 text-sm text-[var(--neon-pink)]" role="alert">{error}</p>
        )}
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          3-20 characters. Letters, numbers, spaces, dots, underscores, hyphens.
        </p>
      </div>

      <button
        type="submit"
        disabled={isSubmitting || username.trim().length < 3}
        className="btn-neon-pink w-full py-3 rounded-lg font-bold text-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {isSubmitting ? "Saving..." : submitLabel}
      </button>
    </form>
  )
}
