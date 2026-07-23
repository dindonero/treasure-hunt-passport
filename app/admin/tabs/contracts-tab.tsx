"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Plus, Loader2, CheckCircle2, ExternalLink, Zap, AlertTriangle, ShieldCheck } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog"
import type { ContractDeployment } from "../types"

const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL || ""

export default function ContractsTab() {
  const [contracts, setContracts] = useState<ContractDeployment[]>([])
  const [loading, setLoading] = useState(true)

  // Deploy form state
  const [showDeploy, setShowDeploy] = useState(false)
  const [tokenName, setTokenName] = useState("Bootcamp Coin")
  const [tokenSymbol, setTokenSymbol] = useState("BC")
  const [label, setLabel] = useState("")
  const [deploying, setDeploying] = useState(false)
  const [deployStatus, setDeployStatus] = useState("")

  // Activate state
  const [activatingId, setActivatingId] = useState<number | null>(null)

  // Verify state
  const [verifyingAddress, setVerifyingAddress] = useState<string | null>(null)

  const fetchContracts = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/contracts", { credentials: "include" })
      if (!response.ok) return
      const data = await response.json()
      setContracts(data.contracts || [])
    } catch (error) {
      console.error("Error fetching contracts:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchContracts() }, [fetchContracts])

  // Default the deploy form to the active contract's token name/symbol
  useEffect(() => {
    const active = contracts.find((c) => c.is_active)
    if (active) {
      setTokenName(active.token_name)
      setTokenSymbol(active.token_symbol)
    }
  }, [contracts])

  const handleDeploy = async () => {
    if (!tokenName.trim() || !tokenSymbol.trim()) {
      toast({ description: "Token name and symbol are required", variant: "destructive" })
      return
    }

    setDeploying(true)
    setDeployStatus("Deploying contract to chain...")
    try {
      const response = await fetch("/api/admin/contracts/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ label: label || undefined, tokenName, tokenSymbol }),
      })
      const data = await response.json()

      if (data.success) {
        const verifiedNote = data.verified ? " and verified on explorer" : ""
        toast({
          description: `Contract deployed at ${data.address.slice(0, 10)}...${verifiedNote}`,
          className: "border-[#9FD356] bg-[#1a1a1a] text-white",
        })
        if (!data.verified) {
          toast({
            description: "Contract verification on explorer failed — you may need to verify manually",
            variant: "destructive",
          })
        }
        setShowDeploy(false)
        setLabel("")
        setDeployStatus("")
        await fetchContracts()
      } else {
        toast({ description: data.error || "Deployment failed", variant: "destructive" })
        setDeployStatus("")
      }
    } catch (error) {
      console.error("Deploy error:", error)
      toast({ description: "Deployment failed", variant: "destructive" })
      setDeployStatus("")
    } finally {
      setDeploying(false)
    }
  }

  const handleActivate = async (contract: ContractDeployment) => {
    setActivatingId(contract.id)
    try {
      const response = await fetch("/api/admin/contracts/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: contract.id }),
      })
      const data = await response.json()

      if (data.success) {
        toast({
          description: "Contract activated! Game state has been reset.",
          className: "border-[#9FD356] bg-[#1a1a1a] text-white",
        })
        // Full reload ensures the entire site picks up the new active contract
        // (ContractAddressProvider only fetches on mount)
        window.location.reload()
        return
      } else {
        toast({ description: data.error || "Activation failed", variant: "destructive" })
      }
    } catch (error) {
      console.error("Activate error:", error)
      toast({ description: "Activation failed", variant: "destructive" })
    } finally {
      setActivatingId(null)
    }
  }

  const handleVerify = async (address: string) => {
    setVerifyingAddress(address)
    try {
      const response = await fetch("/api/admin/contracts/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address }),
      })
      const data = await response.json()

      if (data.success) {
        toast({
          description: "Contract verified on explorer!",
          className: "border-[#9FD356] bg-[#1a1a1a] text-white",
        })
      } else {
        const detail = data.error || data.message || data.details
        toast({
          description: detail
            ? `Verification failed: ${detail}`
            : "Verification failed — the explorer may not support this contract",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Verify error:", error)
      const msg = (error as { message?: string })?.message
      toast({
        description: msg ? `Verification failed: ${msg}` : "Verification failed",
        variant: "destructive",
      })
    } finally {
      setVerifyingAddress(null)
    }
  }

  if (loading) {
    return (
      <Card className="bg-[#2a2a2a] border-[#4A4A4A] p-6">
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-[#9FD356]" />
        </div>
      </Card>
    )
  }

  return (
    <Card className="bg-[#2a2a2a] border-[#4A4A4A] p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Contract Deployments</h2>
        <Button onClick={() => setShowDeploy(true)} className="bg-[#9FD356] hover:bg-[#8fe044] text-black cursor-pointer">
          <Plus className="w-4 h-4 mr-2" /> Deploy New
        </Button>
      </div>

      {/* Deploy Form */}
      {showDeploy && (
        <div className="bg-[#1a1a1a] p-4 rounded-lg border border-[#4A4A4A] mb-4">
          <h3 className="text-white font-bold mb-3">Deploy New Contract</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Token Name</label>
                <Input
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  className="bg-[#0a0a0a] border-[#4A4A4A]"
                  placeholder="Bootcamp Coin"
                  disabled={deploying}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Token Symbol</label>
                <Input
                  value={tokenSymbol}
                  onChange={(e) => setTokenSymbol(e.target.value)}
                  className="bg-[#0a0a0a] border-[#4A4A4A]"
                  placeholder="BC"
                  disabled={deploying}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Label (optional)</label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="bg-[#0a0a0a] border-[#4A4A4A]"
                placeholder="e.g. Round 2 - Summer Event"
                disabled={deploying}
              />
            </div>
            {deployStatus && (
              <div className="flex items-center gap-2 text-yellow-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                {deployStatus}
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={handleDeploy} disabled={deploying} className="bg-[#9FD356] hover:bg-[#8fe044] text-black font-bold">
                {deploying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deploying...</> : "Deploy"}
              </Button>
              <Button
                onClick={() => { setShowDeploy(false); setLabel(""); setDeployStatus("") }}
                variant="outline"
                className="border-[#4A4A4A] bg-transparent"
                disabled={deploying}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Contract List */}
      <div className="space-y-3">
        {contracts.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No contracts deployed yet</p>
        ) : (
          contracts.map((contract) => (
            <div
              key={contract.id}
              className={`bg-[#1a1a1a] p-4 rounded-lg border ${
                contract.is_active
                  ? "border-[#9FD356] ring-1 ring-[#9FD356]/50"
                  : "border-[#4A4A4A]"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-white">
                      {contract.token_name} ({contract.token_symbol})
                    </h3>
                    {contract.is_active && (
                      <span className="flex items-center gap-1 text-xs bg-[#9FD356]/20 text-[#9FD356] px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Active
                      </span>
                    )}
                  </div>

                  {contract.label && (
                    <p className="text-gray-400 text-sm mb-1">{contract.label}</p>
                  )}

                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-gray-300 text-xs font-mono">
                      {contract.address.slice(0, 10)}...{contract.address.slice(-8)}
                    </code>
                    {EXPLORER_URL && (
                      <a
                        href={`${EXPLORER_URL}/address/${contract.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#9FD356] hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <button
                      onClick={() => handleVerify(contract.address)}
                      disabled={verifyingAddress === contract.address}
                      className="text-gray-400 hover:text-[#9FD356] transition-colors disabled:opacity-50 cursor-pointer"
                      title="Verify on explorer"
                    >
                      {verifyingAddress === contract.address ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-3 h-3" />
                      )}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>Block: {contract.deploy_block}</span>
                    <span>Deployed: {new Date(contract.deployed_at).toLocaleDateString()}</span>
                    {contract.activated_at && (
                      <span>Last activated: {new Date(contract.activated_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>

                {!contract.is_active && (
                  activatingId === contract.id ? (
                    <Button disabled size="sm" className="bg-amber-600 text-white shrink-0">
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />Switching...
                    </Button>
                  ) : (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 cursor-pointer">
                          <Zap className="w-4 h-4 mr-1" />Activate
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-[#1a1a1a] border-[#4A4A4A]">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-white">
                            Activate {contract.token_name} ({contract.token_symbol})?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-gray-400 space-y-2">
                            <p>Switching to contract <code className="text-gray-300 text-xs">{contract.address.slice(0, 10)}...{contract.address.slice(-6)}</code></p>
                            <p className="text-amber-400 font-medium">This will:</p>
                            <ul className="list-disc pl-5 text-amber-400/80 space-y-1">
                              <li>Reset ALL leaderboard data</li>
                              <li>Clear all NFC tag find records</li>
                              <li>Start a fresh game round</li>
                            </ul>
                            <p className="text-red-400 font-medium">This cannot be undone.</p>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="border-[#4A4A4A] bg-transparent text-gray-300 hover:bg-[#2a2a2a] cursor-pointer">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleActivate(contract)}
                            className="bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                          >
                            <Zap className="w-4 h-4 mr-1" />
                            Activate & Reset
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )
                )}
              </div>

              {!contract.is_active && activatingId === contract.id && (
                <div className="mt-3 flex items-center gap-2 text-amber-400 text-xs">
                  <AlertTriangle className="w-3 h-3" />
                  Resetting game state...
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  )
}
