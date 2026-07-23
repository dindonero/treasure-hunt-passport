"use client"

import { ethers } from "ethers"
import { claimedRewardsAbi } from "@/lib/contracts/abi"

// Browser-safe on-chain claim verification.
//
// Mirrors lib/onchain.ts but takes the contract address explicitly so it
// doesn't pull in getActiveContract → @/lib/supabase/admin (server-only).
// Uses the public NEXT_PUBLIC_RPC_URL directly. Nova Cidade RPC sends
// Access-Control-Allow-Origin: * so browsers can read claimedRewards.

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || ""

let _provider: ethers.JsonRpcProvider | null = null
function getProvider() {
  if (!_provider) _provider = new ethers.JsonRpcProvider(RPC_URL)
  return _provider
}

export type RewardType = "object" | "social"

export function computeClaimKey(
  contractAddress: string,
  userAddress: string,
  rewardType: RewardType,
  rewardId: string,
): string {
  const abi = ethers.AbiCoder.defaultAbiCoder()
  const encoded = abi.encode(
    ["address", "address", "string", "string"],
    [contractAddress, userAddress, rewardType, rewardId],
  )
  return ethers.keccak256(encoded)
}

export async function hasClaimedReward(
  contractAddress: string,
  userAddress: string,
  rewardType: RewardType,
  rewardId: string,
): Promise<boolean> {
  const claimKey = computeClaimKey(contractAddress, userAddress, rewardType, rewardId)
  const contract = new ethers.Contract(contractAddress, claimedRewardsAbi, getProvider())
  return contract.claimedRewards(claimKey)
}

export async function hasClaimedObjectReward(
  contractAddress: string,
  userAddress: string,
  chainId: string,
): Promise<boolean> {
  return hasClaimedReward(contractAddress, userAddress, "object", chainId)
}
