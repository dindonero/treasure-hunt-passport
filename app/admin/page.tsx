"use client"

import { useState, useEffect } from "react"
import { useWallet } from "@/lib/wallet-context"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import Image from "next/image"
import AppHeader from "@/components/app-header"
import dynamic from "next/dynamic"

const NfcTagsTab = dynamic(() => import("./tabs/nfc-tags-tab"))
const SocialTab = dynamic(() => import("./tabs/social-tab"))
const AdminsTab = dynamic(() => import("./tabs/admins-tab"))
const ContractsTab = dynamic(() => import("./tabs/contracts-tab"))
const MerchTab = dynamic(() => import("./tabs/merch-tab"))
const HealthTab = dynamic(() => import("./tabs/health-tab"))
const ReportsTab = dynamic(() => import("./tabs/reports-tab"))

export default function AdminPage() {
  const { address, isConnected, isAuthenticated, disconnect, isAdmin, authenticate, displayName } = useWallet()
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [authLoading, setAuthLoading] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (isConnected && isAuthenticated && isAdmin) {
      setIsAuthorized(true)
    }
    setLoading(false)
  }, [isConnected, isAuthenticated, isAdmin])

  const handleAdminLogin = async () => {
    if (!address) return
    setAuthLoading(true)
    setMessage("")
    try {
      const authData = await authenticate()
      if (authData.error) {
        setMessage(authData.error)
        setAuthLoading(false)
        return
      }
      if (authData.isAdmin) {
        setIsAuthorized(true)
        setMessage("Admin access granted!")
      } else {
        setMessage("Admin access denied. Not an authorized admin.")
      }
    } catch (error) {
      console.error("Error during admin login:", error)
      setMessage("Failed to authenticate as admin")
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = () => {
    disconnect()
    router.push("/")
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black flex flex-col">
        <AppHeader />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white">Loading...</p>
        </div>
      </main>
    )
  }

  // JWT-first: returning admins skip this gate. They land on the panel
  // immediately; thirdweb hydrates in the background and their write actions
  // (deploy contract, save tag, etc.) are gated individually on isWalletReady.
  if (!isAuthenticated && !isConnected) {
    return (
      <main className="min-h-screen bg-black flex flex-col">
        <AppHeader />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white">Please connect your wallet</p>
        </div>
      </main>
    )
  }

  if (!isAuthorized) {
    return (
      <main className="min-h-screen bg-black flex flex-col">
        <AppHeader />
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="bg-[#2a2a2a] border-[#4A4A4A] p-8 max-w-md w-full">
            <div className="mb-8 flex justify-center">
              <div className="w-32 h-32 relative">
                <Image src="/images/design-mode/image.png" alt="NOVA IMS" fill className="object-contain" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2 text-center">Admin Panel</h1>
            <p className="text-gray-400 text-center mb-6">Signer Only Access</p>
            <p className="text-gray-400 mb-6">
              Wallet: <span className={`text-[#9FD356] text-sm ${displayName ? '' : 'font-mono'}`}>{displayName || `${address?.slice(0, 6)}...${address?.slice(-4)}`}</span>
            </p>
            <Button onClick={handleAdminLogin} disabled={authLoading} className="w-full bg-[#9FD356] hover:bg-[#8fe044] text-black font-bold mb-4">
              {authLoading ? "Verifying..." : "Verify Admin Access"}
            </Button>
            {message && <p className={`text-sm text-center ${message.includes("granted") ? "text-[#9FD356]" : "text-red-400"}`}>{message}</p>}
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black flex flex-col">
      <AppHeader />
      <div className="flex-1 p-4">
        <div className="max-w-6xl mx-auto py-8">
          <div className="mb-8 flex items-center justify-between">
            <h1 className="text-4xl font-bold text-white">Admin Dashboard</h1>
            <Button onClick={handleLogout} className="bg-red-600 hover:bg-red-700">Logout</Button>
          </div>

          <Tabs defaultValue="nfc">
            <TabsList className="bg-[#1a1a1a] border border-[#4A4A4A] h-auto flex-wrap mb-6">
              <TabsTrigger value="nfc" className="cursor-pointer hover:bg-[#3a3a3a] transition-colors duration-200 data-[state=active]:bg-[#9FD356] data-[state=active]:text-black px-4 py-2">NFC Tags</TabsTrigger>
              <TabsTrigger value="social" className="cursor-pointer hover:bg-[#3a3a3a] transition-colors duration-200 data-[state=active]:bg-[#9FD356] data-[state=active]:text-black px-4 py-2">Social Accounts</TabsTrigger>
              <TabsTrigger value="merch" className="cursor-pointer hover:bg-[#3a3a3a] transition-colors duration-200 data-[state=active]:bg-[#9FD356] data-[state=active]:text-black px-4 py-2">Merchandise</TabsTrigger>
              <TabsTrigger value="admins" className="cursor-pointer hover:bg-[#3a3a3a] transition-colors duration-200 data-[state=active]:bg-[#9FD356] data-[state=active]:text-black px-4 py-2">Admins</TabsTrigger>
              <TabsTrigger value="contracts" className="cursor-pointer hover:bg-[#3a3a3a] transition-colors duration-200 data-[state=active]:bg-[#9FD356] data-[state=active]:text-black px-4 py-2">Contracts</TabsTrigger>
              <TabsTrigger value="reports" className="cursor-pointer hover:bg-[#3a3a3a] transition-colors duration-200 data-[state=active]:bg-[#9FD356] data-[state=active]:text-black px-4 py-2">Reports</TabsTrigger>
              <TabsTrigger value="health" className="cursor-pointer hover:bg-[#3a3a3a] transition-colors duration-200 data-[state=active]:bg-[#9FD356] data-[state=active]:text-black px-4 py-2">Health</TabsTrigger>
            </TabsList>

            <TabsContent value="nfc"><NfcTagsTab /></TabsContent>
            <TabsContent value="social"><SocialTab /></TabsContent>
            <TabsContent value="merch"><MerchTab /></TabsContent>
            <TabsContent value="admins"><AdminsTab /></TabsContent>
            <TabsContent value="contracts"><ContractsTab /></TabsContent>
            <TabsContent value="reports"><ReportsTab /></TabsContent>
            <TabsContent value="health"><HealthTab /></TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  )
}
