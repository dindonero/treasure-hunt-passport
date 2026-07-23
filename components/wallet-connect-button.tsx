"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { ConnectButton } from "thirdweb/react"
import { useWallet } from "@/lib/wallet-context"
import { thirdwebClient, accountAbstraction, thirdwebWallets } from "@/lib/thirdweb-config"

interface WalletConnectButtonProps {
  label?: string
  className?: string
}

export default function WalletConnectButton({ label = "Join the Game!", className }: WalletConnectButtonProps) {
  const { isConnected, isMembershipLoading, isAuthenticating } = useWallet()

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (isConnected) return null

  if (isMembershipLoading || isAuthenticating) {
    return (
      <div className="flex flex-col items-center gap-1">
        <Button disabled className={className || "btn-neon-pink"}>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Checking...
        </Button>
      </div>
    )
  }

  if (!mounted) return null

  return (
    <ConnectButton
      client={thirdwebClient}
      wallets={thirdwebWallets}
      accountAbstraction={accountAbstraction}
      theme="dark"
      connectButton={{ label: label || "Join the Game!", className: className || "btn-neon-pink" }}
    />
  )
}
