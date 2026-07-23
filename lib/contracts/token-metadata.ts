import { ethers } from "ethers"
import { symbolAbi } from "./abi"
import { getActiveContract } from "./active-contract"

export async function getTokenSymbol(): Promise<string> {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL
  if (!rpcUrl) return "ETHD"

  try {
    const { address } = await getActiveContract()
    if (!address) return "ETHD"
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const contract = new ethers.Contract(address, symbolAbi, provider)
    return await contract.symbol()
  } catch (error) {
    console.error("Failed to fetch token symbol:", error)
    return "ETHD"
  }
}
