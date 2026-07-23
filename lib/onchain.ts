import { ethers } from "ethers"
import { claimedRewardsAbi, usedDigestsAbi } from "@/lib/contracts/abi"
import { getActiveContract } from "@/lib/contracts/active-contract"

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || ""

let _provider: ethers.JsonRpcProvider | null = null
function getProvider() {
  if (!_provider) _provider = new ethers.JsonRpcProvider(RPC_URL)
  return _provider
}

function getContract(contractAddress: string, abi: readonly string[], provider?: ethers.JsonRpcProvider) {
  return new ethers.Contract(contractAddress, abi as string[], provider || getProvider())
}

/**
 * Check if a merch-style signature digest has been used onchain. Only merch
 * still uses `usedDigests`; reward claims migrated to amount-independent
 * `claimedRewards` keys.
 */
export async function checkDigestUsed(digest: string, contractAddress?: string): Promise<boolean> {
  const address = contractAddress || (await getActiveContract()).address
  return getContract(address, usedDigestsAbi).usedDigests(digest)
}

/**
 * Identity-keyed claim check for object/social rewards. The on-chain key
 * is `keccak256(abi.encode(contract, user, type, id))`.
 */
export async function hasClaimedReward(
  userAddress: string,
  rewardType: "object" | "social",
  rewardId: string,
  contractAddress?: string,
): Promise<boolean> {
  const addr = contractAddress || (await getActiveContract()).address
  const claimKey = computeClaimKey(addr, userAddress, rewardType, rewardId)
  return getContract(addr, claimedRewardsAbi).claimedRewards(claimKey)
}

export async function hasClaimedObjectReward(
  userAddress: string,
  chainId: string,
  contractAddress?: string,
): Promise<boolean> {
  return hasClaimedReward(userAddress, "object", chainId, contractAddress)
}

/**
 * Compute the amount-independent claim key the contract uses to gate
 * one-claim-per-(user, type, id). Matches:
 *   keccak256(abi.encode(contract, user, type, id))
 */
export function computeClaimKey(
  contractAddress: string,
  address: string,
  rewardType: string,
  rewardId: string,
): string {
  const abi = ethers.AbiCoder.defaultAbiCoder()
  const encoded = abi.encode(
    ["address", "address", "string", "string"],
    [contractAddress, address, rewardType, rewardId],
  )
  return ethers.keccak256(encoded)
}

/**
 * Compute the EIP-191 digest for merch purchases.
 * Matches: keccak256(abi.encode(contractAddress, userAddress, "merch", merchId, price, nonce)) -> toEthSignedMessageHash
 */
export function computeMerchDigest(
  contractAddress: string,
  address: string,
  merchId: string,
  price: bigint,
  nonce: bigint
): string {
  const abi = ethers.AbiCoder.defaultAbiCoder()
  const encoded = abi.encode(
    ["address", "address", "string", "uint256", "uint256", "uint256"],
    [contractAddress, address, "merch", merchId, price, nonce]
  )
  const messageHash = ethers.keccak256(encoded)
  return ethers.hashMessage(ethers.getBytes(messageHash))
}
