"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Plus, Pencil, Trash2, Check, Copy, Tag, Loader2, Search, ArrowUpDown, X, ChevronDown } from "lucide-react"
import { useTokenMetadata } from "@/lib/token-metadata-context"
import { toast } from "@/hooks/use-toast"
import AdminFormModal from "../admin-form-modal"
import type { NfcTag, EditableItem, FormData } from "../types"

type SortKey = "name-asc" | "name-desc" | "newest" | "oldest" | "finds-desc" | "finds-asc" | "status" | "owner-asc" | "owner-desc"
type StatusFilter = "all" | "blank" | "registered" | "hidden"

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name-asc", label: "Name (A → Z)" },
  { value: "name-desc", label: "Name (Z → A)" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "finds-desc", label: "Most found" },
  { value: "finds-asc", label: "Least found" },
  { value: "status", label: "Status" },
  { value: "owner-asc", label: "Owner (A → Z)" },
  { value: "owner-desc", label: "Owner (Z → A)" },
]

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "blank", label: "Blank" },
  { value: "registered", label: "Registered" },
  { value: "hidden", label: "Hidden" },
]

const STATUS_RANK: Record<NfcTag["status"], number> = { blank: 0, registered: 1, hidden: 2 }

export default function NfcTagsTab() {
  const { symbol } = useTokenMetadata()
  const [nfcTags, setNfcTags] = useState<NfcTag[]>([])
  const [generatingTag, setGeneratingTag] = useState(false)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<EditableItem | null>(null)
  const [formData, setFormData] = useState<FormData>({})
  const [copiedTagId, setCopiedTagId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("name-asc")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  const visibleTags = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = nfcTags.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false
      if (!q) return true
      return (t.name || "").toLowerCase().includes(q)
    })
    const sorted = [...filtered]
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "name-asc":   return (a.name || "").localeCompare(b.name || "")
        case "name-desc":  return (b.name || "").localeCompare(a.name || "")
        case "newest":     return (b.created_at || "").localeCompare(a.created_at || "")
        case "oldest":     return (a.created_at || "").localeCompare(b.created_at || "")
        case "finds-desc": return (b.find_count ?? 0) - (a.find_count ?? 0)
        case "finds-asc":  return (a.find_count ?? 0) - (b.find_count ?? 0)
        case "status":     return STATUS_RANK[a.status] - STATUS_RANK[b.status] || (a.name || "").localeCompare(b.name || "")
        case "owner-asc":
        case "owner-desc": {
          const oa = (a.owner_address || "").toLowerCase()
          const ob = (b.owner_address || "").toLowerCase()
          if (!oa && !ob) return (a.name || "").localeCompare(b.name || "")
          if (!oa) return 1
          if (!ob) return -1
          const cmp = oa.localeCompare(ob)
          return sortKey === "owner-asc" ? cmp : -cmp
        }
      }
    })
    return sorted
  }, [nfcTags, search, statusFilter, sortKey])

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = { all: nfcTags.length, blank: 0, registered: 0, hidden: 0 }
    for (const t of nfcTags) counts[t.status] += 1
    return counts
  }, [nfcTags])

  const fetchNfcTags = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/nfc-tags", { credentials: "include" })
      if (!response.ok) return
      const data = await response.json()
      setNfcTags(data.tags || [])
    } catch (error) {
      console.error("Error fetching NFC tags:", error)
    }
  }, [])

  useEffect(() => { fetchNfcTags() }, [fetchNfcTags])

  const openModal = (item?: NfcTag) => {
    setEditingItem(item || null)
    setFormData(item
      ? { name: item.name || "", hint: item.hint || "", token_reward: item.token_reward || "100", status: item.status, location_x: item.location_x ?? null, location_y: item.location_y ?? null, owner_address: item.owner_address || "" }
      : { name: "", hint: "", token_reward: "100", status: "blank", location_x: null, location_y: null, owner_address: "" }
    )
    setModalOpen(true)
  }

  const generateNfcTag = async () => {
    setGeneratingTag(true)
    try {
      const response = await fetch("/api/admin/nfc-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      })
      const data = await response.json()
      if (data.success) {
        toast({ description: "New NFC tag generated!", className: "border-[#9FD356] bg-[#1a1a1a] text-white" })
        setRefreshing(true)
        await fetchNfcTags()
        setRefreshing(false)
      } else {
        toast({ description: data.error || "Failed to generate tag", variant: "destructive" })
      }
    } catch (error) {
      console.error("Error generating NFC tag:", error)
      toast({ description: "Failed to generate tag", variant: "destructive" })
    } finally {
      setGeneratingTag(false)
    }
  }

  const deleteNfcTag = async (id: number) => {
    if (!confirm("Delete this NFC tag? This will also delete all find records.")) return
    setDeletingId(id)
    try {
      const response = await fetch("/api/admin/nfc-tags", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id }),
      })
      const data = await response.json()
      if (data.success) {
        toast({ description: "NFC tag deleted!", className: "border-[#9FD356] bg-[#1a1a1a] text-white" })
        setRefreshing(true)
        await fetchNfcTags()
        setRefreshing(false)
      } else {
        toast({ description: data.error || "Failed to delete tag", variant: "destructive" })
      }
    } catch (error) {
      console.error("Error deleting NFC tag:", error)
      toast({ description: "Failed to delete tag", variant: "destructive" })
    } finally {
      setDeletingId(null)
    }
  }

  const copyTagUrl = async (claimCode: string, tagId: number) => {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/tag/${claimCode}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedTagId(tagId)
      setTimeout(() => setCopiedTagId(null), 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const body: Record<string, unknown> = { ...formData }
      if (editingItem) body.id = editingItem.id

      const response = await fetch("/api/admin/nfc-tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })
      if (!response.ok) { toast({ description: `Server error: ${response.statusText}`, variant: "destructive" }); return }
      const data = await response.json()
      if (data.success) {
        toast({ description: "NFC tag updated!", className: "border-[#9FD356] bg-[#1a1a1a] text-white" })
        setModalOpen(false)
        setEditingItem(null)
        setRefreshing(true)
        await fetchNfcTags()
        setRefreshing(false)
      } else {
        toast({ description: data.error || "Failed to save NFC tag", variant: "destructive" })
      }
    } catch (error) {
      console.error("Error:", error)
      toast({ description: "Failed to save NFC tag", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Card className="bg-[#2a2a2a] border-[#4A4A4A] p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-baseline gap-2">
            <h2 className="text-xl font-bold text-white">NFC Tags</h2>
            <span className="text-gray-600">·</span>
            <span className="text-sm font-medium tabular-nums text-gray-500">
              {visibleTags.length === nfcTags.length
                ? `${nfcTags.length} total`
                : `${visibleTags.length} of ${nfcTags.length}`}
            </span>
          </div>
          <Button onClick={generateNfcTag} disabled={generatingTag} className="bg-[#9FD356] hover:bg-[#8fe044] text-black">
            {generatingTag ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</> : <><Plus className="w-4 h-4 mr-2" />Generate New Tag</>}
          </Button>
        </div>

        <div
          role="toolbar"
          aria-label="Filter and sort NFC tags"
          className="mb-4 rounded-md bg-[#1a1a1a] p-2 flex flex-col gap-2"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1 min-w-0">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name…"
                aria-label="Search NFC tags by name"
                autoComplete="off"
                spellCheck={false}
                className="h-10 bg-[#141414] border-[#3a3a3a] text-white placeholder:text-gray-500 pl-9 pr-9 transition-colors hover:bg-[#181818] hover:border-[#5a5a5a] focus-visible:ring-2 focus-visible:ring-[#9FD356]/40 focus-visible:border-[#9FD356]/60"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-500 cursor-pointer transition-colors hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9FD356]/40"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="relative sm:w-60">
              <ArrowUpDown aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                aria-label="Sort NFC tags"
                className="w-full h-10 appearance-none bg-[#141414] border border-[#3a3a3a] text-white text-sm rounded-md pl-9 pr-9 cursor-pointer transition-colors hover:bg-[#181818] hover:border-[#5a5a5a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9FD356]/40 focus-visible:border-[#9FD356]/60"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} className="bg-[#141414]">{o.label}</option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5" aria-label="Filter by status">
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.value
              return (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStatusFilter(f.value)}
                  className={`group inline-flex items-center gap-2 pl-3 pr-2.5 h-8 rounded-md text-xs font-medium border cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9FD356]/40 ${
                    active
                      ? "bg-[#9FD356] text-black border-[#9FD356] shadow-[0_0_10px_-2px_rgba(159,211,86,0.45)]"
                      : "bg-[#141414] text-gray-300 border-[#3a3a3a] hover:text-white hover:border-[#9FD356]/30 hover:bg-[#1f1f1f]"
                  }`}
                >
                  <span>{f.label}</span>
                  <span
                    className={`inline-flex items-center justify-center min-w-[20px] h-[18px] px-1 rounded-sm text-[11px] font-semibold tabular-nums ${
                      active ? "bg-black/15 text-black/85" : "bg-[#0d0d0d] text-gray-500 group-hover:text-white"
                    }`}
                  >
                    {statusCounts[f.value]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className={`space-y-3 transition-opacity ${refreshing ? "opacity-50" : ""}`}>
          {refreshing && (
            <div className="flex justify-center py-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#9FD356]" />
            </div>
          )}
          {nfcTags.length === 0 && !refreshing ? (
            <p className="text-gray-400">No NFC tags yet. Generate one to get started.</p>
          ) : visibleTags.length === 0 && !refreshing ? (
            <p className="text-gray-400">
              No tags match {search ? <>“<span className="text-white">{search}</span>”</> : "this filter"}.
            </p>
          ) : (
            visibleTags.map((tag) => {
              const tagUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/tag/${tag.claim_code}`
              return (
                <div key={tag.id} className="bg-[#1a1a1a] p-4 rounded-lg border border-[#4A4A4A]">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Tag className="w-4 h-4 text-[#9FD356]" />
                        <h3 className="font-bold text-white">{tag.name || "Unclaimed Tag"}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          tag.status === "blank" ? "bg-gray-600 text-gray-300" :
                          tag.status === "registered" ? "bg-purple-500/20 text-purple-400" :
                          "bg-cyan-500/20 text-cyan-400"
                        }`}>
                          {tag.status}
                        </span>
                      </div>
                      {tag.owner_address && (
                        <p className="text-gray-400 text-sm">
                          Owner: <span className="font-mono text-xs">{tag.owner_address.slice(0, 6)}...{tag.owner_address.slice(-4)}</span>
                        </p>
                      )}
                      <p className="text-[#9FD356] font-mono text-sm">{tag.token_reward} {symbol} reward</p>
                      {tag.hint && <p className="text-gray-500 text-xs mt-1">Hint: {tag.hint}</p>}
                      <p className="text-gray-500 text-xs mt-1">
                        ID: {tag.chain_id.slice(0, 8)}...
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <input readOnly value={tagUrl} className="bg-[#0a0a0a] border border-[#4A4A4A] rounded px-2 py-1 text-xs text-gray-400 font-mono flex-1 min-w-0" />
                        <Button size="sm" onClick={() => copyTagUrl(tag.claim_code, tag.id)} className="bg-blue-600 hover:bg-blue-700">
                          {copiedTagId === tag.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button onClick={() => openModal(tag)} size="sm" className="bg-blue-600 hover:bg-blue-700">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button onClick={() => deleteNfcTag(tag.id)} disabled={deletingId === tag.id} size="sm" className="bg-red-600 hover:bg-red-700">
                        {deletingId === tag.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </Card>

      {modalOpen && (
        <AdminFormModal
          modalType="nfc"
          editingItem={editingItem}
          formData={formData}
          setFormData={setFormData}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditingItem(null) }}
          saving={saving}
          symbol={symbol}
        />
      )}
    </>
  )
}
