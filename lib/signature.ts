import { ethers } from "ethers"

const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY

function getSignerKey(): string {
  if (!SIGNER_PRIVATE_KEY) {
    throw new Error("SIGNER_PRIVATE_KEY environment variable is not set")
  }
  return SIGNER_PRIVATE_KEY
}

export type RewardType = "object" | "social" | "merch"

interface SignatureParams {
  contractAddress: string
  address: string
  rewardType: RewardType
  rewardId: string
  amount: bigint
}

interface MerchSignatureParams {
  contractAddress: string
  address: string
  merchId: string
  price: bigint
  nonce: bigint
}

/**
 * Generates a signature for reward claims that can be verified on-chain.
 * Includes the contract address to prevent cross-contract replay attacks.
 */
export function generateRewardSignature(params: SignatureParams): string {
  const { contractAddress, address, rewardType, rewardId, amount } = params

  const abi = ethers.AbiCoder.defaultAbiCoder()
  const encoded = abi.encode(
    ["address", "address", "string", "string", "uint256"],
    [contractAddress, address, rewardType, rewardId, amount]
  )
  const messageHash = ethers.keccak256(encoded)
  const signer = new ethers.Wallet(getSignerKey())

  return signer.signMessageSync(ethers.getBytes(messageHash))
}

/**
 * Generates a signature for merch purchases. Includes the contract address
 * to prevent cross-contract replay attacks.
 */
export function generateMerchSignature(params: MerchSignatureParams): string {
  const { contractAddress, address, merchId, price, nonce } = params

  const abi = ethers.AbiCoder.defaultAbiCoder()
  const encoded = abi.encode(
    ["address", "address", "string", "uint256", "uint256", "uint256"],
    [contractAddress, address, "merch", merchId, price, nonce]
  )
  const messageHash = ethers.keccak256(encoded)
  const signer = new ethers.Wallet(getSignerKey())

  return signer.signMessageSync(ethers.getBytes(messageHash))
}

/**
 * Checks if the signer private key is configured
 */
export function isSignerConfigured(): boolean {
  return Boolean(SIGNER_PRIVATE_KEY)
}
