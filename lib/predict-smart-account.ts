import { ethers } from "ethers"

/**
 * Predict the smart account address for a given EOA via the Thirdweb factory's
 * CREATE2 derivation: factory.getAddress(eoa, "0x").
 */
export async function predictSmartAccount(eoaAddress: string): Promise<string> {
  const FACTORY = process.env.NEXT_PUBLIC_THIRDWEB_FACTORY_ADDRESS
  const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL
  if (!FACTORY) throw new Error("Missing NEXT_PUBLIC_THIRDWEB_FACTORY_ADDRESS env var")
  if (!RPC_URL) throw new Error("Missing NEXT_PUBLIC_RPC_URL env var")

  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const factory = new ethers.Contract(
    FACTORY,
    ["function getAddress(address, bytes) view returns (address)"],
    provider
  )
  const predicted: string = await factory["getAddress(address,bytes)"](eoaAddress, "0x")
  return predicted.toLowerCase()
}
