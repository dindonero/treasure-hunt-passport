"use client"

import { useEffect, useState } from "react"
import { X, Pencil, Plus, Loader2, Check } from "lucide-react"

interface OwnTagInput {
  id: number
  name: string | null
  hint: string | null
  status: string | null
  token_reward: string
  find_count: number
}

interface Props {
  tag: OwnTagInput
  open: boolean
  onClose: () => void
  onSaved: () => void
}

const C = {
  bgCard: "var(--bg-card, #131921)",
  bgSecondary: "var(--bg-secondary, #0A0E14)",
  cyan: "#58A6FF",
  green: "#56D364",
  textPrimary: "var(--text-primary, #E6EDF3)",
  textSecondary: "var(--text-secondary, #8B949E)",
  textMuted: "var(--text-muted, #484F58)",
}

// Bottom-sheet edit surface for owners. The reward amount is shown read-only —
// only admins can change a tag's reward (handled in the admin NFC Tags tab).
export default function EditOwnTagSheet({ tag, open, onClose, onSaved }: Props) {
  const [name, setName] = useState(tag.name || "")
  const [hint, setHint] = useState(tag.hint || "")
  const [hintExpanded, setHintExpanded] = useState(Boolean(tag.hint))
  const [active, setActive] = useState<boolean>(tag.status !== "registered")
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setName(tag.name || "")
    setHint(tag.hint || "")
    setHintExpanded(Boolean(tag.hint))
    setActive(tag.status !== "registered")
    setError("")
  }, [open, tag.id, tag.name, tag.hint, tag.status])

  if (!open) return null

  const submit = async () => {
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/nfc-tags/update", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tagId: tag.id,
          name: name.trim() || null,
          hint: hintExpanded ? (hint.trim() || null) : null,
          status: active ? "hidden" : "registered",
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "Failed to save")
        return
      }
      setSavedFlash(true)
      onSaved()
      setTimeout(() => {
        setSavedFlash(false)
        onClose()
      }, 700)
    } catch {
      setError("Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="sheet-overlay fixed inset-x-0 top-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="sheet-content w-full max-w-lg"
        style={{
          background: C.bgCard,
          borderTop: `1px solid ${C.cyan}66`,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          overflowY: "auto",
          animation: "fadeSlideUp 0.22s ease-out",
        }}
      >
        {/* grab handle */}
        <div className="flex justify-center pt-2">
          <div style={{ width: 38, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.18)" }} />
        </div>

        {/* header */}
        <div className="flex items-center gap-2 px-4 pt-2 pb-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{
            width: 8, height: 8, borderRadius: 999, background: C.cyan,
            boxShadow: `0 0 8px ${C.cyan}AA`,
          }} />
          <h2 className="font-bebas tracking-wider" style={{ fontSize: 16, color: C.textPrimary }}>
            EDIT YOUR TAG
          </h2>
          <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
            style={{ background: `${C.cyan}25`, color: C.cyan, border: `1px solid ${C.cyan}50` }}>
            Yours
          </span>
          <button onClick={onClose} aria-label="Close"
            style={{ background: "transparent", border: "none", color: C.textMuted, cursor: "pointer", padding: 4 }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3 px-4 py-4">
          <div className="rounded-[10px] px-3 py-2"
            style={{ background: `${C.cyan}1F`, border: `1px solid ${C.cyan}4D` }}>
            <p className="text-[11px]" style={{ color: C.textSecondary }}>
              Reward <span style={{ color: C.green, fontWeight: 700 }}>+{tag.token_reward} TH</span> ·{" "}
              found by <span style={{ color: C.textPrimary, fontWeight: 700 }}>{tag.find_count}</span> hunter
              {tag.find_count === 1 ? "" : "s"}. Reward is admin-set.
            </p>
          </div>

          <Field label="Tag name">
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Give your tag a name"
              style={inputStyle} />
          </Field>

          {!hintExpanded ? (
            <button
              onClick={() => setHintExpanded(true)}
              style={{
                padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                background: "transparent", border: `1px dashed rgba(255,255,255,0.18)`,
                color: C.textSecondary, fontSize: 12, fontWeight: 600,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
              <Plus className="w-3.5 h-3.5" /> Add a hint (optional)
            </button>
          ) : (
            <Field label="Hint shown to hunters (optional)">
              <textarea value={hint} onChange={(e) => setHint(e.target.value)}
                rows={2} placeholder="e.g. Behind the green couch near booth 3C11"
                style={{ ...inputStyle, resize: "none", lineHeight: 1.4 }} />
              {hint.trim() === "" && (
                <button
                  onClick={() => { setHint(""); setHintExpanded(false) }}
                  className="mt-1 text-[10px] uppercase tracking-wider"
                  style={{ background: "transparent", border: "none", color: C.textMuted, cursor: "pointer", padding: 0 }}>
                  Remove hint
                </button>
              )}
            </Field>
          )}

          <Field label="Status">
            <div className="flex gap-1.5">
              {[
                { v: true, label: "Active · findable" },
                { v: false, label: "Paused · hidden" },
              ].map((opt) => {
                const sel = active === opt.v
                return (
                  <button key={String(opt.v)} onClick={() => setActive(opt.v)}
                    style={{
                      flex: 1, padding: "10px 8px", borderRadius: 10, cursor: "pointer",
                      border: `1px solid ${sel ? C.cyan : "rgba(255,255,255,0.08)"}`,
                      background: sel ? `${C.cyan}33` : C.bgSecondary,
                      color: sel ? C.cyan : C.textPrimary, fontSize: 11, fontWeight: sel ? 800 : 600,
                    }}>{opt.label}</button>
                )
              })}
            </div>
          </Field>

          {error && (
            <div className="text-[12px]" style={{ color: "#F0605D" }}>{error}</div>
          )}

          <div className="flex gap-2 mt-1">
            <button onClick={onClose} style={{
              flex: 1, padding: 12, borderRadius: 10, cursor: "pointer",
              background: "transparent", border: `1px solid rgba(255,255,255,0.1)`,
              color: C.textMuted, fontSize: 12, fontWeight: 700,
            }}>Cancel</button>
            <button onClick={submit} disabled={saving}
              style={{
                flex: 1.4, padding: 12, borderRadius: 10, border: "none",
                cursor: saving ? "wait" : "pointer",
                background: savedFlash ? C.green
                  : `linear-gradient(135deg, ${C.cyan} 0%, ${C.green} 100%)`,
                color: "#0b1220", fontSize: 12, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
              {savedFlash ? <><Check className="w-3.5 h-3.5" /> Saved</>
                : saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: C.textMuted }}>
        {label}
      </div>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 10,
  background: C.bgSecondary, border: "1px solid rgba(255,255,255,0.08)",
  color: C.textPrimary, fontSize: 13, fontFamily: "inherit",
}

// re-export the Pencil icon as a named helper for callers that want the
// matching cyan edit-button glyph next to "Edit"
export { Pencil as EditOwnTagPencil }
