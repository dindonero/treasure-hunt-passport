import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth"
import { ethers } from "ethers"
import { predictSmartAccount } from "@/lib/predict-smart-account"

const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY || ""

// GET all admin wallets
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.success) return auth.response

  try {
    const supabase = await createClient()
    const { data: admins, error } = await supabase
      .from("admin_wallets")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) throw error

    // Include signer's smart account as permanent admin
    const signer = new ethers.Wallet(SIGNER_PRIVATE_KEY)
    let signerAddress = signer.address.toLowerCase()
    try {
      signerAddress = await predictSmartAccount(signer.address)
    } catch (err) {
      console.error("[admins] Failed to predict signer smart account:", err)
    }

    return NextResponse.json({
      admins: admins || [],
      signerAddress,
    })
  } catch (error) {
    console.error("Error fetching admins:", error)
    return NextResponse.json({ error: "Failed to fetch admins" }, { status: 500 })
  }
}

// POST - add a new admin wallet
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.success) return auth.response

  try {
    const { wallet_address, label } = await request.json()

    if (!wallet_address || !ethers.isAddress(wallet_address)) {
      return NextResponse.json({ error: "Valid Ethereum address required" }, { status: 400 })
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from("admin_wallets")
      .insert({
        wallet_address: wallet_address.toLowerCase(),
        label: label || null,
        added_by: auth.payload.sub,
      })

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "This address is already an admin" }, { status: 400 })
      }
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error adding admin:", error)
    return NextResponse.json({ error: "Failed to add admin" }, { status: 500 })
  }
}

// DELETE - remove an admin wallet
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.success) return auth.response

  try {
    const { wallet_address } = await request.json()

    if (!wallet_address) {
      return NextResponse.json({ error: "Wallet address required" }, { status: 400 })
    }

    // Prevent removing the signer (permanent admin)
    const signer = new ethers.Wallet(SIGNER_PRIVATE_KEY)
    let signerSmartAccount = signer.address.toLowerCase()
    try {
      signerSmartAccount = await predictSmartAccount(signer.address)
    } catch (err) {
      console.error("[admins] Failed to predict signer smart account:", err)
    }
    if (wallet_address.toLowerCase() === signerSmartAccount) {
      return NextResponse.json({ error: "Cannot remove the signer wallet (permanent admin)" }, { status: 400 })
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from("admin_wallets")
      .delete()
      .eq("wallet_address", wallet_address.toLowerCase())

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error removing admin:", error)
    return NextResponse.json({ error: "Failed to remove admin" }, { status: 500 })
  }
}
