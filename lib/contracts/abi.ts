/**
 * Centralized contract ABI fragments for the treasure hunt token contract.
 * Import from here instead of defining inline ABIs in each component.
 */

export const balanceOfAbi = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const

export const claimSocialRewardAbi = [
  "function claimSocialReward(string memory socialAccountId, uint256 amount, bytes memory signature) external",
]

export const claimObjectRewardAbi = [
  "function claimObjectReward(string memory objectId, uint256 amount, bytes memory signature) external",
]

export const purchaseMerchAbi = [
  "function purchaseMerch(uint256 merchId, uint256 price, uint256 nonce, bytes memory signature) external",
]

export const usedDigestsAbi = [
  "function usedDigests(bytes32) view returns (bool)",
]

export const claimedRewardsAbi = [
  "function claimedRewards(bytes32) view returns (bool)",
]

export const socialClaimedEventAbi = [
  "event SocialClaimed(address indexed user, string socialAccountId, uint256 amount)",
]

export const objectClaimedEventAbi = [
  "event ObjectClaimed(address indexed user, string objectId, uint256 amount)",
]

export const symbolAbi = [
  {
    name: "symbol",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
] as const

export const nameAbi = [
  {
    name: "name",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
] as const
