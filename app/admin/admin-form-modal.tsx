"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import VenueMap from "@/components/venue-map"
import ImageUpload from "@/components/image-upload"
import { Loader2 } from "lucide-react"
import type { AdminTab, EditableItem, FormData } from "./types"

interface AdminFormModalProps {
  modalType: AdminTab | null
  editingItem: EditableItem | null
  formData: FormData
  setFormData: (data: FormData) => void
  onSave: () => void
  onClose: () => void
  saving: boolean
  symbol: string
}

export default function AdminFormModal({
  modalType,
  editingItem,
  formData,
  setFormData,
  onSave,
  onClose,
  saving,
  symbol,
}: AdminFormModalProps) {
  return (
    <Dialog open={modalType !== null} onOpenChange={() => onClose()}>
      <DialogContent className="bg-[#2a2a2a] border-[#4A4A4A] text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingItem ? "Edit" : "Add"} {modalType?.charAt(0).toUpperCase() + (modalType?.slice(1) || "")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Social Account Form */}
          {modalType === "social" && (
            <>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Platform</label>
                <select
                  value={
                    formData.action_type === "view" ? "view_link" :
                    formData.platform === "twitter" ? `twitter_${formData.action_type || "follow"}` :
                    formData.platform
                  }
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === "twitter_follow") {
                      setFormData({ ...formData, platform: "twitter", action_type: "follow" })
                    } else if (val === "twitter_post") {
                      setFormData({ ...formData, platform: "twitter", action_type: "post" })
                    } else if (val === "view_link") {
                      setFormData({ ...formData, platform: "link", action_type: "view" })
                    } else {
                      setFormData({ ...formData, platform: val, action_type: "follow" })
                    }
                  }}
                  className="w-full bg-[#1a1a1a] border border-[#4A4A4A] rounded-md px-3 py-2 text-white"
                >
                  <option value="linkedin">LinkedIn</option>
                  <option value="instagram">Instagram</option>
                  <option value="twitter_follow">Twitter/X (Follow)</option>
                  <option value="twitter_post">Twitter/X (Post)</option>
                  <option value="view_link">View Link (any platform)</option>
                </select>
              </div>
              {formData.action_type === "view" ? (
                <>
                  <div><label className="block text-sm text-gray-300 mb-1">URL to View</label><Input value={formData.profile_url || ""} onChange={(e) => setFormData({ ...formData, profile_url: e.target.value })} className="bg-[#1a1a1a] border-[#4A4A4A]" placeholder="https://example.com/page" /></div>
                  <div><label className="block text-sm text-gray-300 mb-1">Display Name (optional)</label><Input value={formData.handle || ""} onChange={(e) => setFormData({ ...formData, handle: e.target.value })} className="bg-[#1a1a1a] border-[#4A4A4A]" placeholder="e.g. Our Website" /></div>
                </>
              ) : (
                <>
                  {/* Instagram & Twitter follow → handle only (URL is derived) */}
                  {(formData.platform === "instagram" || (formData.platform === "twitter" && formData.action_type === "follow")) && (
                    <div><label className="block text-sm text-gray-300 mb-1">Handle (without @)</label><Input value={formData.handle || ""} onChange={(e) => setFormData({ ...formData, handle: e.target.value })} className="bg-[#1a1a1a] border-[#4A4A4A]" placeholder="novaims" /></div>
                  )}
                  {/* LinkedIn → URL only (path varies: /in/, /company/, /school/) */}
                  {formData.platform === "linkedin" && (
                    <div><label className="block text-sm text-gray-300 mb-1">Profile URL</label><Input value={formData.profile_url || ""} onChange={(e) => setFormData({ ...formData, profile_url: e.target.value })} className="bg-[#1a1a1a] border-[#4A4A4A]" placeholder="https://linkedin.com/school/nova-ims" /></div>
                  )}
                  {/* Twitter post → tweet template only */}
                  {formData.platform === "twitter" && formData.action_type === "post" && (
                    <div><label className="block text-sm text-gray-300 mb-1">Tweet Template</label><Textarea value={formData.tweet_template || ""} onChange={(e) => setFormData({ ...formData, tweet_template: e.target.value })} className="bg-[#1a1a1a] border-[#4A4A4A] min-h-[80px]" placeholder="e.g. Just joined the Treasure Hunt! https://yoursite.com" /></div>
                  )}
                </>
              )}
              <div><label className="block text-sm text-gray-300 mb-1">Token Reward ({symbol})</label><Input value={formData.token_reward || ""} onChange={(e) => setFormData({ ...formData, token_reward: e.target.value })} className="bg-[#1a1a1a] border-[#4A4A4A]" placeholder="1" /></div>
              <div className="flex items-center gap-2"><input type="checkbox" checked={formData.is_active ?? true} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} className="w-4 h-4" /><label className="text-sm text-gray-300">Active</label></div>
            </>
          )}

          {/* NFC Tag Form */}
          {modalType === "nfc" && (
            <>
              <div><label className="block text-sm text-gray-300 mb-1">Name</label><Input value={formData.name || ""} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="bg-[#1a1a1a] border-[#4A4A4A]" placeholder="Hidden Treasure" /></div>
              <div><label className="block text-sm text-gray-300 mb-1">Hint</label><Input value={formData.hint || ""} onChange={(e) => setFormData({ ...formData, hint: e.target.value })} className="bg-[#1a1a1a] border-[#4A4A4A]" placeholder="Near the coffee bar..." /></div>
              <div><label className="block text-sm text-gray-300 mb-1">Token Reward ({symbol})</label><Input type="number" min="1" max="1000" value={formData.token_reward || "100"} onChange={(e) => setFormData({ ...formData, token_reward: e.target.value })} className="bg-[#1a1a1a] border-[#4A4A4A]" /></div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Map Pin</label>
                <VenueMap
                  interactive
                  pinX={formData.location_x}
                  pinY={formData.location_y}
                  onPinPlace={(x, y) => setFormData({ ...formData, location_x: x, location_y: y })}
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-500">
                    {formData.location_x != null && formData.location_y != null
                      ? `Pin: (${formData.location_x}, ${formData.location_y})`
                      : "Click map to place pin"}
                  </p>
                  {formData.location_x != null && formData.location_y != null && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs border-[#4A4A4A] bg-transparent text-gray-400 hover:text-white"
                      onClick={() => setFormData({ ...formData, location_x: null, location_y: null })}
                    >
                      Clear Pin
                    </Button>
                  )}
                </div>
              </div>
              <div><label className="block text-sm text-gray-300 mb-1">Owner Address</label><Input value={formData.owner_address || ""} onChange={(e) => setFormData({ ...formData, owner_address: e.target.value })} className="bg-[#1a1a1a] border-[#4A4A4A] font-mono text-sm" placeholder="0x..." /></div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Status</label>
                <select value={formData.status || "blank"} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full bg-[#1a1a1a] border border-[#4A4A4A] rounded-md px-3 py-2 text-white">
                  <option value="blank">Blank</option>
                  <option value="registered">Registered</option>
                  <option value="hidden">Hidden</option>
                </select>
              </div>
            </>
          )}

          {/* Merch Form */}
          {modalType === "merch" && (
            <>
              <div><label className="block text-sm text-gray-300 mb-1">Name</label><Input value={formData.name || ""} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="bg-[#1a1a1a] border-[#4A4A4A]" /></div>
              <div><label className="block text-sm text-gray-300 mb-1">Description</label><Input value={formData.description || ""} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="bg-[#1a1a1a] border-[#4A4A4A]" /></div>
              <div><label className="block text-sm text-gray-300 mb-1">Price ({symbol})</label><Input value={formData.price || ""} onChange={(e) => setFormData({ ...formData, price: e.target.value })} className="bg-[#1a1a1a] border-[#4A4A4A]" /></div>
              <div><label className="block text-sm text-gray-300 mb-1">Image</label><ImageUpload value={formData.image || ""} onChange={(url: string) => setFormData({ ...formData, image: url })} /></div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <Button onClick={onSave} disabled={saving} className="flex-1 bg-[#9FD356] hover:bg-[#8fe044] text-black font-bold">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save"}
            </Button>
            <Button onClick={onClose} variant="outline" className="flex-1 border-[#4A4A4A] bg-transparent">Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
