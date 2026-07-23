"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Loader2, Pencil, Plus, Image as ImageIcon } from "lucide-react"
import { useTokenMetadata } from "@/lib/token-metadata-context"
import { toast } from "@/hooks/use-toast"
import AdminMerchEditor from "../admin-merch-editor"
import type { MerchItem } from "../types"

export default function MerchTab() {
  const { symbol } = useTokenMetadata()
  const [merch, setMerch] = useState<MerchItem[]>([])
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MerchItem | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(true)

  const fetchMerch = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/merch", {
        credentials: "include",
        cache: "no-store",
      })
      if (!response.ok) return
      const data = await response.json()
      setMerch(data.merch || [])
    } catch (error) {
      console.error("Error fetching merch:", error)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchMerch() }, [fetchMerch])

  // Suggestions for the editor's category datalist come straight from
  // whichever categories admins have already typed on other items.
  const knownCategories = useMemo(() => {
    const seen = new Set<string>()
    for (const m of merch) {
      const c = (m.category || "").trim()
      if (c) seen.add(c)
    }
    return [...seen].sort((a, b) => a.localeCompare(b))
  }, [merch])

  const openEditor = (item?: MerchItem) => {
    setEditingItem(item || null)
    setEditorOpen(true)
  }

  const handleToggle = async (item: MerchItem) => {
    const newState = !item.is_active
    setMerch((prev) => prev.map((m) => (m.id === item.id ? { ...m, is_active: newState } : m)))
    setTogglingId(item.id)
    try {
      const response = await fetch("/api/admin/merch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: item.id, is_active: newState }),
      })
      if (!response.ok) throw new Error(response.statusText)
      const data = await response.json()
      if (!data.success) throw new Error(data.error || "Failed to toggle")
      toast({
        description: `${item.name} ${newState ? "enabled" : "disabled"}`,
        className: "border-[#9FD356] bg-[#1a1a1a] text-white",
      })
    } catch (error) {
      setMerch((prev) => prev.map((m) => (m.id === item.id ? { ...m, is_active: !newState } : m)))
      console.error("Error:", error)
      toast({ description: "Failed to toggle merch status", variant: "destructive" })
    } finally {
      setTogglingId(null)
    }
  }

  const totalClaimed = merch.reduce((a, m) => a + (m.claimed || 0), 0)

  return (
    <div className="space-y-4">
      <Card className="bg-[#2a2a2a] border-[#4A4A4A] p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Merchandise</h2>
            <p className="text-xs text-gray-500 mt-1 font-mono">
              {merch.length} item{merch.length === 1 ? "" : "s"} · {totalClaimed} claimed
            </p>
          </div>
          <Button
            onClick={() => openEditor()}
            className="bg-[#9FD356] hover:bg-[#8fe044] text-black cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-2" /> New Item
          </Button>
        </div>

        <div className={`space-y-2.5 transition-opacity ${refreshing ? "opacity-50" : ""}`}>
          {refreshing && merch.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-[#9FD356]" />
            </div>
          ) : merch.length === 0 ? (
            <p className="text-gray-400">No merch items yet</p>
          ) : (
            merch.map((item) => {
              const stock = item.stock
              const claimed = item.claimed || 0
              const out = stock != null && stock > 0 && claimed >= stock
              const pct = stock != null && stock > 0 ? Math.min(100, Math.round((claimed / stock) * 100)) : 0
              return (
                <div
                  key={item.id}
                  className="rounded-xl flex items-center gap-3 p-3 transition-opacity"
                  style={{
                    background: "#1c1c1f",
                    border: `1px solid ${out ? "rgba(239,68,68,0.45)" : "rgba(255,255,255,0.08)"}`,
                    opacity: !item.is_active ? 0.55 : out ? 0.78 : 1,
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center"
                    style={{ background: "#0a0a0c", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image}
                        alt={item.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: item.fit ? "contain" : "cover",
                          objectPosition: item.focal || "50% 50%",
                          background: item.fit ? "#000" : undefined,
                        }}
                      />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-[#5a5e66]" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white truncate">{item.name}</span>
                      {out && (
                        <span
                          className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded"
                          style={{ color: "#ef4444", background: "rgba(239,68,68,0.15)" }}
                        >
                          Sold out
                        </span>
                      )}
                      <span
                        className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{ color: "#9aa0a6", background: "rgba(255,255,255,0.06)" }}
                      >
                        {item.category?.trim() || "Other"}
                      </span>
                    </div>
                    <div className="text-xs font-bold font-mono mt-0.5" style={{ color: "#a3e635" }}>
                      {item.price} {symbol}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div
                        className="flex-1 h-1 rounded overflow-hidden"
                        style={{ background: "#0a0a0c" }}
                      >
                        {stock != null && stock > 0 ? (
                          <div
                            style={{
                              width: `${pct}%`,
                              height: "100%",
                              background: out ? "#ef4444" : "#a3e635",
                              transition: "width 240ms ease",
                            }}
                          />
                        ) : null}
                      </div>
                      <div className="text-[10px] font-mono whitespace-nowrap" style={{ color: "#9aa0a6" }}>
                        {stock != null ? `${claimed}/${stock}` : `${claimed} claimed`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={item.is_active}
                      onCheckedChange={() => handleToggle(item)}
                      disabled={togglingId === item.id}
                      className="cursor-pointer data-[state=checked]:bg-[#9FD356]"
                    />
                    <Button
                      onClick={() => openEditor(item)}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 cursor-pointer"
                      aria-label="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </Card>

      <AdminMerchEditor
        open={editorOpen}
        item={editingItem}
        symbol={symbol}
        knownCategories={knownCategories}
        onClose={() => {
          setEditorOpen(false)
          setEditingItem(null)
        }}
        onSaved={() => {
          setRefreshing(true)
          fetchMerch()
        }}
      />
    </div>
  )
}
