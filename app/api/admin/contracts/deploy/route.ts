import { type NextRequest, NextResponse } from "next/server"
import { ethers } from "ethers"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { FULL_ABI, BYTECODE } from "@/lib/contracts/bytecode"
import { verifyOnExplorer } from "@/lib/contracts/verify-on-explorer"

const RPC_URL = (process.env.NEXT_PUBLIC_RPC_URL || "").trim()
const BACKEND_PRIVATE_KEY = (process.env.BACKEND_PRIVATE_KEY || "").trim()

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.success) return auth.response

  try {
    const { label, tokenName, tokenSymbol } = await request.json()
    const name = tokenName || "Bootcamp Coin"
    const symbol = tokenSymbol || "BC"

    if (!BACKEND_PRIVATE_KEY || !RPC_URL) {
      return NextResponse.json({ error: "Server not configured for deployment" }, { status: 500 })
    }

    // Create deployer wallet
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const wallet = new ethers.Wallet(BACKEND_PRIVATE_KEY, provider)

    // Deploy contract
    const factory = new ethers.ContractFactory(FULL_ABI, BYTECODE, wallet)
    const contract = await factory.deploy(name, symbol)
    const deployTx = contract.deploymentTransaction()
    await contract.waitForDeployment()

    const contractAddress = await contract.getAddress()
    const receipt = await provider.getTransactionReceipt(deployTx!.hash)
    const deployBlock = receipt?.blockNumber ?? 0

    // Record in DB
    const supabase = await createClient()
    const { error: dbError } = await supabase
      .from("contract_deployments")
      .insert({
        address: contractAddress.toLowerCase(),
        deploy_block: deployBlock,
        deploy_tx_hash: deployTx!.hash,
        label: label || null,
        token_name: name,
        token_symbol: symbol,
        is_active: false,
        deployed_by: auth.payload.sub.toLowerCase(),
      })

    if (dbError) {
      console.error("[deploy] DB insert error:", dbError)
      return NextResponse.json({
        error: "Contract deployed but failed to save to database",
        address: contractAddress,
        deployBlock,
        txHash: deployTx!.hash,
      }, { status: 500 })
    }

    // Verify contract on Blockscout (non-blocking — deployment succeeds even if verification fails)
    // Retries with delay since the explorer may not have indexed the contract yet
    const verified = await verifyOnExplorer(contractAddress)

    return NextResponse.json({
      success: true,
      address: contractAddress,
      deployBlock,
      txHash: deployTx!.hash,
      tokenName: name,
      tokenSymbol: symbol,
      verified,
    })
  } catch (error) {
    console.error("[deploy] Error:", error)
    return NextResponse.json({ error: `Deployment failed: ${error}` }, { status: 500 })
  }
}
