export interface SocialAccount {
  id: number
  platform: string
  handle: string
  profile_url: string
  token_reward: string
  is_active: boolean
  action_type: string
  tweet_template: string | null
}

export interface NfcTag {
  id: number
  chain_id: string
  claim_code: string
  owner_address: string | null
  name: string | null
  status: "blank" | "registered" | "hidden"
  hint: string | null
  token_reward: string
  location_x: number | null
  location_y: number | null
  find_count?: number
  created_at: string
}

export interface AdminWallet {
  id: number
  wallet_address: string
  label: string | null
  added_by: string
  created_at: string
}

// Free-text category typed per item. Empty / null renders as "Other" in
// the public store. /merch derives its category tabs from the distinct
// values currently in use, so adding a new category just means typing it
// in the item editor.
export type MerchCategory = string

export interface MerchItem {
  id: string
  name: string
  description: string
  price: string
  image: string
  is_active: boolean
  category: MerchCategory
  stock: number | null
  focal: string
  fit: boolean
  claimed?: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FormData = Record<string, any>

export type EditableItem = SocialAccount | NfcTag | MerchItem

export interface ContractDeployment {
  id: number
  address: string
  deploy_block: number
  deploy_tx_hash: string | null
  label: string | null
  token_name: string
  token_symbol: string
  is_active: boolean
  deployed_at: string
  activated_at: string | null
  deployed_by: string | null
}

export type AdminTab = "nfc" | "social" | "admins" | "merch" | "contracts"
