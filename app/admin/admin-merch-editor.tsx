"use client"

import { useEffect, useState } from "react"
import { Loader2, Trash2, X } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import PhotoUploadBox from "@/components/photo-upload-box"
import type { MerchCategory, MerchItem } from "./types"

interface AdminMerchEditorProps {
  open: boolean
  item: MerchItem | null
  symbol: string
  knownCategories: string[]
  onClose: () => void
  onSaved: () => void
}

interface DraftState {
  name: string
  description: string
  price: string
  image: string
  category: MerchCategory
  stock: string
  focal: string
  fit: boolean
  is_active: boolean
}

const EMPTY: DraftState = {
  name: "",
  description: "",
  price: "200",
  image: "",
  category: "",
  stock: "50",
  focal: "50% 50%",
  fit: false,
  is_active: true,
}

export default function AdminMerchEditor({ open, item, symbol, knownCategories, onClose, onSaved }: AdminMerchEditorProps) {
  const [draft, setDraft] = useState<DraftState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const isNew = !item

  useEffect(() => {
    if (!open) return
    if (item) {
      setDraft({
        name: item.name || "",
        description: item.description || "",
        price: item.price || "0",
        image: item.image || "",
        category: (item.category as MerchCategory) || "",
        stock: item.stock == null ? "" : String(item.stock),
        focal: item.focal || "50% 50%",
        fit: !!item.fit,
        is_active: !!item.is_active,
      })
    } else {
      setDraft({ ...EMPTY })
    }
  }, [open, item])

  const handleSave = async () => {
    if (!draft.name.trim()) {
      toast({ description: "Name is required", variant: "destructive" })
      return
    }
    if (!draft.price.trim() || isNaN(Number(draft.price))) {
      toast({ description: "Price must be a number", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        price: draft.price.trim(),
        image: draft.image,
        category: draft.category,
        stock: draft.stock.trim() === "" ? null : Number(draft.stock),
        focal: draft.focal,
        fit: draft.fit,
        is_active: draft.is_active,
      }
      if (item?.id) payload.id = item.id

      const res = await fetch("/api/admin/merch", {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast({ description: data.error || "Failed to save", variant: "destructive" })
        return
      }
      toast({
        description: `Merch ${isNew ? "created" : "updated"}`,
        className: "border-[#9FD356] bg-[#1a1a1a] text-white",
      })
      onSaved()
      onClose()
    } catch (err) {
      console.error("Save merch failed:", err)
      toast({ description: "Failed to save merch", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!item) return
    if (!confirm(`Delete "${item.name}"? This can't be undone.`)) return
    setDeleting(true)
    try {
      const res = await fetch("/api/admin/merch", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: item.id }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast({ description: data.error || "Failed to delete", variant: "destructive" })
        return
      }
      toast({
        description: "Merch deleted",
        className: "border-[#9FD356] bg-[#1a1a1a] text-white",
      })
      onSaved()
      onClose()
    } catch (err) {
      console.error("Delete merch failed:", err)
      toast({ description: "Failed to delete merch", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="bg-[#06080F] border-[#1C2431] text-white p-0 max-w-2xl w-[calc(100vw-24px)] max-h-[92vh] overflow-y-auto sm:rounded-2xl"
        style={{ borderTopLeftRadius: 18, borderTopRightRadius: 18 }}
      >
        <div className="p-4 flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-center gap-3">
            <h2
              className="flex-1 text-lg font-bold uppercase truncate"
              style={{ fontFamily: "var(--font-display)", color: "#E6EDF3", letterSpacing: "0.04em" }}
            >
              EDIT · {(draft.name || (isNew ? "NEW ITEM" : "ITEM")).toUpperCase()}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-[#8B949E] hover:text-white transition-colors text-xs font-bold flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>

          {/* Photo upload box */}
          <PhotoUploadBox
            value={draft.image}
            focal={draft.focal}
            fit={draft.fit}
            onChange={({ value, focal, fit }) =>
              setDraft((d) => ({ ...d, image: value, focal, fit }))
            }
          />

          {/* Form grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="NAME">
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="bg-[#131921] border-[#1C2431] font-mono text-sm"
                placeholder="Festival Cap"
              />
            </Field>
            <Field label={`PRICE · ${symbol}`}>
              <Input
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                className="bg-[#131921] border-[#1C2431] font-mono text-sm"
                inputMode="numeric"
                placeholder="350"
              />
            </Field>
            <Field label="STOCK">
              <Input
                value={draft.stock}
                onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
                className="bg-[#131921] border-[#1C2431] font-mono text-sm"
                inputMode="numeric"
                placeholder="50 (blank = unlimited)"
              />
            </Field>
            <Field label="CATEGORY">
              <Input
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                className="bg-[#131921] border-[#1C2431] font-mono text-sm"
                placeholder="Optional · blank = Other"
                list="merch-category-suggestions"
                maxLength={60}
              />
              <datalist id="merch-category-suggestions">
                {knownCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="ACTIVE">
              <label className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#131921] border border-[#1C2431] cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.is_active}
                  onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                  className="accent-[#56D364]"
                />
                <span className="text-xs font-mono text-[#8B949E]">
                  {draft.is_active ? "Visible in store" : "Hidden from store"}
                </span>
              </label>
            </Field>
          </div>

          <Field label="DESCRIPTION">
            <Textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              className="bg-[#131921] border-[#1C2431] text-sm min-h-[60px]"
              placeholder="Optional copy shown on the product card."
            />
          </Field>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            {!isNew && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="px-3 py-2.5 rounded-lg flex items-center gap-1.5 text-xs font-bold uppercase border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || deleting}
              className="flex-1 py-3 rounded-lg flex items-center justify-center gap-2 font-extrabold uppercase tracking-wider text-sm disabled:opacity-50"
              style={{
                background: "#56D364",
                color: "#0a0a0a",
                fontFamily: "var(--font-mono, monospace)",
                letterSpacing: "0.5px",
              }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {saving ? "Saving…" : "Save Item"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span
        className="text-[9px] font-bold uppercase"
        style={{ color: "#484F58", letterSpacing: "0.5px" }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}
