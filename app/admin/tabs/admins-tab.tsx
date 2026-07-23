"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Plus, Trash2, ShieldCheck, Loader2 } from "lucide-react"
import { useWallet } from "@/lib/wallet-context"
import { toast } from "@/hooks/use-toast"
import type { AdminWallet } from "../types"

export default function AdminsTab() {
  const { address } = useWallet()
  const [admins, setAdmins] = useState<AdminWallet[]>([])
  const [signerAddress, setSignerAddress] = useState("")
  const [saving, setSaving] = useState(false)
  const [showAddAdmin, setShowAddAdmin] = useState(false)
  const [newAdminAddress, setNewAdminAddress] = useState("")
  const [newAdminLabel, setNewAdminLabel] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchAdmins = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/admins", { credentials: "include" })
      if (!response.ok) return
      const data = await response.json()
      setAdmins(data.admins || [])
      setSignerAddress(data.signerAddress || "")
    } catch (error) {
      console.error("Error fetching admins:", error)
    }
  }, [])

  useEffect(() => { fetchAdmins() }, [fetchAdmins])

  const addAdmin = async () => {
    if (!newAdminAddress) return
    setSaving(true)
    try {
      const response = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ wallet_address: newAdminAddress, label: newAdminLabel || undefined }),
      })
      const data = await response.json()
      if (data.success) {
        toast({ description: "Admin added!", className: "border-[#9FD356] bg-[#1a1a1a] text-white" })
        setShowAddAdmin(false)
        setNewAdminAddress("")
        setNewAdminLabel("")
        setRefreshing(true)
        await fetchAdmins()
        setRefreshing(false)
      } else {
        toast({ description: data.error || "Failed to add admin", variant: "destructive" })
      }
    } catch (error) {
      console.error("Error adding admin:", error)
      toast({ description: "Failed to add admin", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const removeAdmin = async (walletAddress: string) => {
    if (!confirm("Remove this admin?")) return
    setDeletingId(walletAddress)
    try {
      const response = await fetch("/api/admin/admins", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ wallet_address: walletAddress }),
      })
      const data = await response.json()
      if (data.success) {
        toast({ description: "Admin removed!", className: "border-[#9FD356] bg-[#1a1a1a] text-white" })
        setRefreshing(true)
        await fetchAdmins()
        setRefreshing(false)
      } else {
        toast({ description: data.error || "Failed to remove admin", variant: "destructive" })
      }
    } catch (error) {
      console.error("Error removing admin:", error)
      toast({ description: "Failed to remove admin", variant: "destructive" })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card className="bg-[#2a2a2a] border-[#4A4A4A] p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Admin Wallets</h2>
        <Button onClick={() => setShowAddAdmin(true)} className="bg-[#9FD356] hover:bg-[#8fe044] text-black">
          <Plus className="w-4 h-4 mr-2" /> Add Admin
        </Button>
      </div>

      {/* Add Admin Form */}
      {showAddAdmin && (
        <div className="bg-[#1a1a1a] p-4 rounded-lg border border-[#4A4A4A] mb-4">
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Wallet Address</label>
              <Input
                value={newAdminAddress}
                onChange={(e) => setNewAdminAddress(e.target.value)}
                className="bg-[#0a0a0a] border-[#4A4A4A] font-mono text-sm"
                placeholder="0x..."
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Label (optional)</label>
              <Input
                value={newAdminLabel}
                onChange={(e) => setNewAdminLabel(e.target.value)}
                className="bg-[#0a0a0a] border-[#4A4A4A]"
                placeholder="e.g. Team Lead"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={addAdmin} disabled={saving} className="bg-[#9FD356] hover:bg-[#8fe044] text-black font-bold">
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding...</> : "Add"}
              </Button>
              <Button onClick={() => { setShowAddAdmin(false); setNewAdminAddress(""); setNewAdminLabel("") }} variant="outline" className="border-[#4A4A4A] bg-transparent">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className={`space-y-3 transition-opacity ${refreshing ? "opacity-50" : ""}`}>
        {refreshing && (
          <div className="flex justify-center py-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#9FD356]" />
          </div>
        )}
        {/* Signer (permanent admin) */}
        {signerAddress && (
          <div className={`bg-[#1a1a1a] p-4 rounded-lg flex justify-between items-center border ${address && signerAddress.toLowerCase() === address.toLowerCase() ? "border-[#9FD356] ring-1 ring-[#9FD356]/50" : "border-[#9FD356]/30"}`}>
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-[#9FD356]" />
              <div>
                <h3 className="font-bold text-white font-mono text-sm">
                  {signerAddress.slice(0, 6)}...{signerAddress.slice(-4)}
                  {address && signerAddress.toLowerCase() === address.toLowerCase() && (
                    <span className="ml-2 text-[10px] bg-[#9FD356]/20 text-[#9FD356] px-1.5 py-0.5 rounded font-sans">You</span>
                  )}
                </h3>
                <p className="text-[#9FD356] text-xs">Signer (permanent admin)</p>
              </div>
            </div>
          </div>
        )}

        {admins.length === 0 && !signerAddress ? (
          <p className="text-gray-400">No admin wallets configured</p>
        ) : (
          admins.map((admin) => {
            const isYou = address && admin.wallet_address.toLowerCase() === address.toLowerCase()
            return (
              <div key={admin.id} className={`bg-[#1a1a1a] p-4 rounded-lg flex justify-between items-center border ${isYou ? "border-[#9FD356] ring-1 ring-[#9FD356]/50" : "border-[#4A4A4A]"}`}>
                <div>
                  <h3 className="font-bold text-white font-mono text-sm">
                    {admin.wallet_address.slice(0, 6)}...{admin.wallet_address.slice(-4)}
                    {isYou && (
                      <span className="ml-2 text-[10px] bg-[#9FD356]/20 text-[#9FD356] px-1.5 py-0.5 rounded font-sans">You</span>
                    )}
                  </h3>
                  {admin.label && <p className="text-gray-400 text-sm">{admin.label}</p>}
                  <p className="text-gray-500 text-xs">
                    Added by {admin.added_by.slice(0, 6)}...{admin.added_by.slice(-4)} on {new Date(admin.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button onClick={() => removeAdmin(admin.wallet_address)} disabled={deletingId === admin.wallet_address} size="sm" className="bg-red-600 hover:bg-red-700">
                  {deletingId === admin.wallet_address ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </Button>
              </div>
            )
          })
        )}
      </div>
    </Card>
  )
}
