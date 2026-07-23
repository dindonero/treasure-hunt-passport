"use client"

import { Coins, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import ResponsiveModal from "@/components/responsive-modal"

interface MerchConfirmItem {
  name: string
  image: string
  price: string
  focal?: string
  fit?: boolean
}

interface MerchConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  item: MerchConfirmItem | null
  symbol: string
  balance: string
  busy?: boolean
}

export default function MerchConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  item,
  symbol,
  balance,
  busy = false,
}: MerchConfirmModalProps) {
  if (!item) return null

  const priceNum = Number.parseFloat(item.price)
  const balanceNum = Number.parseFloat(balance || "0")
  const after = Number.isFinite(balanceNum - priceNum)
    ? (balanceNum - priceNum).toFixed(2)
    : balance

  return (
    <ResponsiveModal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm purchase"
      description="Show the next screen at the Nova IMS booth to collect your item."
      className="sm:max-w-md bg-card border-border"
      dismissable={!busy}
    >
      <div className="flex flex-col gap-4">
        {/* Item preview */}
        <div className="flex gap-3 p-3 rounded-lg bg-muted/40 border border-border">
          <div
            className="w-20 h-24 shrink-0 rounded-md overflow-hidden border border-border"
            style={{ background: item.fit ? "#000" : undefined }}
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
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ShoppingBag className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex flex-col justify-between min-w-0 flex-1">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                Tokens are spent the moment you confirm.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[#56D364] mt-2">
              <Coins className="w-4 h-4" />
              <span className="font-mono font-bold text-sm">
                {item.price} {symbol}
              </span>
            </div>
          </div>
        </div>

        {/* Balance after */}
        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-muted-foreground">Your balance after</span>
          <span className="font-mono font-semibold text-foreground">
            {after} {symbol}
          </span>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button
            onClick={onConfirm}
            disabled={busy}
            size="lg"
            className="w-full bg-[#56D364] hover:bg-[#56D364]/90 text-black font-bold tracking-wide shadow-[0_0_22px_rgba(86,211,100,0.35)] hover:shadow-[0_0_30px_rgba(86,211,100,0.5)] transition-shadow cursor-pointer disabled:opacity-70 disabled:cursor-wait"
            autoFocus
          >
            {busy ? "Processing…" : `Confirm · ${item.price} ${symbol}`}
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            disabled={busy}
            className="w-full bg-transparent cursor-pointer disabled:cursor-not-allowed"
          >
            Cancel
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  )
}
