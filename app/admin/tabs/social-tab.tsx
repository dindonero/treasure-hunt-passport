"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react"
import { useTokenMetadata } from "@/lib/token-metadata-context"
import { toast } from "@/hooks/use-toast"
import AdminFormModal from "../admin-form-modal"
import type { SocialAccount, EditableItem, FormData } from "../types"
import { getSocialDisplayLabel } from "@/lib/social-links"

export default function SocialTab() {
  const { symbol } = useTokenMetadata()
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<EditableItem | null>(null)
  const [formData, setFormData] = useState<FormData>({})
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchSocialAccounts = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/social-accounts", { credentials: "include" })
      if (!response.ok) return
      const data = await response.json()
      setSocialAccounts(data.accounts || [])
    } catch (error) {
      console.error("Error fetching social accounts:", error)
    }
  }, [])

  useEffect(() => { fetchSocialAccounts() }, [fetchSocialAccounts])

  const openModal = (item?: SocialAccount) => {
    setEditingItem(item || null)
    setFormData(item
      ? { platform: item.platform, handle: item.handle, profile_url: item.profile_url, token_reward: item.token_reward, is_active: item.is_active, action_type: item.action_type || "follow", tweet_template: item.tweet_template || "" }
      : { platform: "linkedin", handle: "", profile_url: "", token_reward: "1", is_active: true, action_type: "follow", tweet_template: "" }
    )
    setModalOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const method = editingItem ? "PUT" : "POST"
      const body: Record<string, unknown> = { ...formData }
      if (editingItem) body.id = editingItem.id

      const response = await fetch("/api/admin/social-accounts", {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })
      if (!response.ok) { toast({ description: `Server error: ${response.statusText}`, variant: "destructive" }); return }
      const data = await response.json()
      if (data.success) {
        toast({ description: `Social account ${editingItem ? "updated" : "created"}!`, className: "border-[#9FD356] bg-[#1a1a1a] text-white" })
        setModalOpen(false)
        setEditingItem(null)
        setRefreshing(true)
        await fetchSocialAccounts()
        setRefreshing(false)
      } else {
        toast({ description: data.error || "Failed to save social account", variant: "destructive" })
      }
    } catch (error) {
      console.error("Error:", error)
      toast({ description: "Failed to save social account", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this social account?")) return
    setDeletingId(id)
    try {
      const response = await fetch(`/api/admin/social-accounts?id=${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!response.ok) { toast({ description: `Server error: ${response.statusText}`, variant: "destructive" }); return }
      const data = await response.json()
      if (data.success) {
        toast({ description: "Social account deleted!", className: "border-[#9FD356] bg-[#1a1a1a] text-white" })
        setRefreshing(true)
        await fetchSocialAccounts()
        setRefreshing(false)
      } else {
        toast({ description: data.error || "Failed to delete social account", variant: "destructive" })
      }
    } catch (error) {
      console.error("Error:", error)
      toast({ description: "Failed to delete social account", variant: "destructive" })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <Card className="bg-[#2a2a2a] border-[#4A4A4A] p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Social Accounts</h2>
          <Button onClick={() => openModal()} className="bg-[#9FD356] hover:bg-[#8fe044] text-black">
            <Plus className="w-4 h-4 mr-2" /> Add Social
          </Button>
        </div>
        <div className={`space-y-3 transition-opacity ${refreshing ? "opacity-50" : ""}`}>
          {refreshing && (
            <div className="flex justify-center py-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#9FD356]" />
            </div>
          )}
          {socialAccounts.length === 0 && !refreshing ? (
            <p className="text-gray-400">No social accounts yet</p>
          ) : (
            socialAccounts.map((account) => (
              <div key={account.id} className="bg-[#1a1a1a] p-4 rounded-lg flex justify-between items-center border border-[#4A4A4A]">
                <div>
                  <h3 className="font-bold text-white">{getSocialDisplayLabel(account)}</h3>
                  <p className="text-gray-400 text-sm capitalize">{account.platform}</p>
                  <p className="text-[#9FD356] font-mono text-sm">{account.token_reward} {symbol} reward</p>
                  <p className={`text-sm ${account.is_active ? "text-green-400" : "text-red-400"}`}>{account.is_active ? "Active" : "Inactive"}</p>
                  {account.action_type === "view" ? (
                    <p className="text-xs mt-1 text-cyan-400">Action: View Link</p>
                  ) : account.platform === "twitter" && (
                    <p className={`text-xs mt-1 ${account.action_type === "post" ? "text-blue-400" : "text-cyan-400"}`}>
                      Action: {account.action_type === "post" ? "Post (verified)" : "Follow"}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => openModal(account)} size="sm" className="bg-blue-600 hover:bg-blue-700"><Pencil className="w-4 h-4" /></Button>
                  <Button onClick={() => handleDelete(account.id)} disabled={deletingId === account.id} size="sm" className="bg-red-600 hover:bg-red-700">
                    {deletingId === account.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {modalOpen && (
        <AdminFormModal
          modalType="social"
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
