import { type NextRequest, NextResponse } from "next/server"
import { ethers } from "ethers"
import { createToken } from "@/lib/jwt"
import { createClient } from "@/lib/supabase/server"
import { AUTH_COOKIE_NAME, AUTH_COOKIE_MAX_AGE } from "@/lib/auth"
import { predictSmartAccount } from "@/lib/predict-smart-account"

if (!process.env.SIGNER_PRIVATE_KEY) throw new Error("Missing SIGNER_PRIVATE_KEY env var")
if (!process.env.NEXT_PUBLIC_RPC_URL) throw new Error("Missing NEXT_PUBLIC_RPC_URL env var")

const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL

// EIP-1271 magic value returned by isValidSignature
const EIP1271_MAGIC_VALUE = "0x1626ba7e"

// EIP-6492 magic suffix (32 bytes) — appended by Thirdweb for undeployed smart accounts
const EIP6492_MAGIC_SUFFIX = "6492649264926492649264926492649264926492649264926492649264926492"

const EIP1271_ABI = [
  "function isValidSignature(bytes32 hash, bytes signature) view returns (bytes4)"
]

/**
 * Extract the inner ECDSA signature from an EIP-6492 wrapped signature.
 * EIP-6492 format: abi.encode(address factory, bytes factoryCalldata, bytes innerSig) ++ magicSuffix
 * Returns the unwrapped signature, or the original if not EIP-6492.
 */
function unwrapEIP6492(signature: string): string {
  const sigHex = signature.startsWith("0x") ? signature.slice(2) : signature
  if (!sigHex.endsWith(EIP6492_MAGIC_SUFFIX)) {
    return signature
  }

  try {
    // Strip the 32-byte magic suffix, then ABI-decode (address, bytes, bytes)
    const withoutMagic = "0x" + sigHex.slice(0, -64)
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
      ["address", "bytes", "bytes"],
      withoutMagic
    )
    const innerSig = decoded[2] as string
    return innerSig
  } catch {
    return signature
  }
}

/**
 * Decode the full EIP-6492 wrapper to extract factory address, factory calldata, and inner ECDSA signature.
 * Returns null if the signature is not EIP-6492 formatted.
 */
function decodeEIP6492(signature: string): {
  factory: string; factoryCalldata: string; innerSig: string
} | null {
  const sigHex = signature.startsWith("0x") ? signature.slice(2) : signature
  if (!sigHex.endsWith(EIP6492_MAGIC_SUFFIX)) return null
  try {
    const withoutMagic = "0x" + sigHex.slice(0, -64)
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
      ["address", "bytes", "bytes"], withoutMagic
    )
    return { factory: decoded[0], factoryCalldata: decoded[1], innerSig: decoded[2] }
  } catch { return null }
}

/**
 * Verify an EIP-6492 signature by recovering the EOA from the inner sig,
 * checking it matches the admin in the factory calldata, then predicting
 * the smart account address via the factory's CREATE2 derivation.
 */
async function verifyEIP6492ViaFactory(
  claimedAddress: string,
  message: string,
  eip6492: { factory: string; factoryCalldata: string; innerSig: string },
  provider: ethers.JsonRpcProvider
): Promise<boolean> {
  // 1. Recover EOA from inner ECDSA signature
  let recoveredEOA: string
  try { recoveredEOA = ethers.verifyMessage(message, eip6492.innerSig) }
  catch { return false }

  // 2. Decode factory calldata to extract admin + data params
  //    createAccount(address _admin, bytes _data)
  let admin: string, extraData: string
  try {
    const iface = new ethers.Interface(["function createAccount(address,bytes)"])
    const decoded = iface.decodeFunctionData("createAccount", eip6492.factoryCalldata)
    admin = decoded[0]; extraData = decoded[1]
  } catch {
    admin = recoveredEOA; extraData = "0x"  // fallback
  }

  // 3. Verify recovered EOA matches the admin in factory calldata
  if (recoveredEOA.toLowerCase() !== admin.toLowerCase()) return false

  // 4. Predict smart account address via factory's CREATE2 derivation
  try {
    const factory = new ethers.Contract(
      eip6492.factory,
      ["function getAddress(address,bytes) view returns (address)"],
      provider
    )
    // Use bracket notation: ethers v6 BaseContract.getAddress() shadows the on-chain function
    const predicted = await factory["getAddress(address,bytes)"](admin, extraData)
    return predicted.toLowerCase() === claimedAddress.toLowerCase()
  } catch { return false }
}

/**
 * Try to recover an EOA address from a signature.
 * Handles both raw ECDSA signatures and EIP-6492 wrapped signatures.
 */
function tryRecoverEOA(message: string, signature: string): string | null {
  // Try raw signature first
  try {
    return ethers.verifyMessage(message, signature)
  } catch { /* not a raw ECDSA sig */ }

  // Try unwrapping EIP-6492
  const unwrapped = unwrapEIP6492(signature)
  if (unwrapped !== signature) {
    try {
      return ethers.verifyMessage(message, unwrapped)
    } catch { /* unwrapped sig also failed */ }
  }

  return null
}

/**
 * Verify that a recovered EOA is the on-chain owner/admin of a smart account.
 * Calls the `owner()` function on the smart account contract (thirdweb Account pattern).
 */
async function isEOAOwnerOfSmartAccount(
  eoaAddress: string,
  smartAccountAddress: string,
  provider: ethers.JsonRpcProvider
): Promise<boolean> {
  try {
    const code = await provider.getCode(smartAccountAddress)
    if (code === "0x" || code === "0x0") return false
    const contract = new ethers.Contract(
      smartAccountAddress,
      ["function owner() view returns (address)"],
      provider
    )
    const owner = await contract.owner()
    return owner.toLowerCase() === eoaAddress.toLowerCase()
  } catch {
    return false
  }
}

/**
 * Verify a message signature, supporting EOA, smart accounts, and EIP-6492.
 * 1. Try EOA recovery (raw or EIP-6492 unwrapped) — if it matches, accept
 * 2. If recovered EOA differs, verify on-chain that the EOA owns the smart account
 * 3. As a last resort, try EIP-1271 on-chain verification
 */
async function verifySignature(
  address: string,
  message: string,
  signature: string
): Promise<boolean> {
  // 1. Try EOA verification (standard ECDSA recovery, with EIP-6492 unwrapping)
  const recoveredAddress = tryRecoverEOA(message, signature)

  if (recoveredAddress) {
    if (recoveredAddress.toLowerCase() === address.toLowerCase()) {
      return true
    }

    // Smart account wallets (e.g. Thirdweb ERC-4337):
    // The recovered EOA differs from the claimed address — verify on-chain
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL)

      // Predict smart account address via factory CREATE2 derivation.
      const FACTORY = process.env.NEXT_PUBLIC_THIRDWEB_FACTORY_ADDRESS
      if (FACTORY) {
        try {
          const factory = new ethers.Contract(
            FACTORY,
            ["function getAddress(address, bytes) view returns (address)"],
            provider
          )
          // Use bracket notation: ethers v6 BaseContract.getAddress() shadows the on-chain function
          const predicted = await factory["getAddress(address,bytes)"](recoveredAddress, "0x")
          if (predicted.toLowerCase() === address.toLowerCase()) {
            return true
          }
        } catch (err) {
          console.error("[auth] factory.getAddress call failed:", err)
        }
      }

      // Fallback: verify on-chain that this EOA is the owner of a deployed smart account
      const isOwner = await isEOAOwnerOfSmartAccount(recoveredAddress, address, provider)
      if (isOwner) return true

      // EIP-6492: Undeployed smart account — verify via factory address prediction
      const eip6492 = decodeEIP6492(signature)
      if (eip6492) {
        const isValid = await verifyEIP6492ViaFactory(address, message, eip6492, provider)
        if (isValid) return true
      }
    } catch (error) {
      console.error("[auth] Smart account verification failed:", error)
    }
  }

  // 2. Try EIP-1271 (smart contract wallet verification)
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL)

    const code = await provider.getCode(address)
    if (code === "0x" || code === "0x0") return false

    const contract = new ethers.Contract(address, EIP1271_ABI, provider)
    const messageHash = ethers.hashMessage(message)
    const result = await contract.isValidSignature(messageHash, signature)
    return result === EIP1271_MAGIC_VALUE
  } catch (err) {
    console.error("[auth] EIP-1271 verification failed:", err)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const { address, signature, messageToSign } = await request.json()

    if (!address || !ethers.isAddress(address)) {
      return NextResponse.json({ error: "Valid address required" }, { status: 400 })
    }

    // Validate full message format
    const expectedPrefix = "I am signing in to Treasure Hunt\n"
    if (!messageToSign || !messageToSign.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: "Invalid message format" }, { status: 400 })
    }

    const walletMatch = messageToSign.match(/Wallet:\s*(0x[0-9a-fA-F]{40})/)
    if (!walletMatch || walletMatch[1].toLowerCase() !== address.toLowerCase()) {
      return NextResponse.json({ error: "Message wallet mismatch" }, { status: 400 })
    }

    const timestampMatch = messageToSign.match(/Timestamp:\s*(\d+)/)
    if (!timestampMatch) {
      return NextResponse.json({ error: "Invalid message format" }, { status: 400 })
    }

    const messageTimestamp = Number(timestampMatch[1])
    const MAX_AGE_MS = 5 * 60 * 1000 // 5 minutes
    if (Number.isNaN(messageTimestamp) || Math.abs(Date.now() - messageTimestamp) > MAX_AGE_MS) {
      return NextResponse.json({ error: "Signature expired" }, { status: 401 })
    }

    // Verify signature (supports both EOA and smart contract wallets)
    const isValid = await verifySignature(address, messageToSign, signature)
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    // Check if user is admin (signer's smart account is permanent admin, others from admin_wallets table)
    const signer = new ethers.Wallet(SIGNER_PRIVATE_KEY)
    let signerIsAdmin = false
    try {
      const signerSmartAccount = await predictSmartAccount(signer.address)
      signerIsAdmin = address.toLowerCase() === signerSmartAccount
    } catch (err) {
      console.error("[auth] Failed to predict signer smart account:", err)
    }

    const supabase = await createClient()

    let isAdmin = signerIsAdmin
    if (!isAdmin) {
      const { data: adminRecord } = await supabase
        .from("admin_wallets")
        .select("wallet_address")
        .eq("wallet_address", address.toLowerCase())
        .maybeSingle()
      isAdmin = !!adminRecord
    }

    // Look up previously saved handle from DB
    let handle: string | null = null
    try {
      const { data: existingUser } = await supabase
        .from("treasure_hunt_users")
        .select("unicorn_handle")
        .eq("wallet_address", address.toLowerCase())
        .maybeSingle()
      if (existingUser?.unicorn_handle) {
        handle = existingUser.unicorn_handle
      }
    } catch { /* non-fatal */ }

    // Create JWT token with 24h expiry (matches AUTH_COOKIE_MAX_AGE)
    const token = await createToken({ sub: address.toLowerCase(), role: isAdmin ? "admin" : "user" }, "24h")
    const res = NextResponse.json({
      success: true,
      isAdmin,
      address,
      handle,
    })

    // 24h cookie for persistent authentication
    res.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: AUTH_COOKIE_MAX_AGE,
    })

    return res
  } catch (error) {
    console.error("Auth /authenticate error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
