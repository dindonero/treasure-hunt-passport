import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function truncateAddress(address: string): string {
  if (!address || address.length <= 12) return address || ""
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function formatDisplayName(address: string, displayName?: string | null): string {
  if (displayName) return displayName
  return truncateAddress(address)
}

/**
 * Maps common on-chain transaction errors to user-friendly messages.
 */
export function getClaimErrorMessage(error: any): string {
  const message = error?.message || ""
  if (message.includes("user rejected")) return "Transaction rejected"
  if (message.includes("Signature already used")) return "This reward has already been claimed"
  return "Failed to claim reward"
}
