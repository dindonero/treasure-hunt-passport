"use client"

/**
 * Returns true when running on a mobile device (phone or tablet).
 */
export function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

/**
 * Returns true when inside a crypto wallet in-app browser
 * that may block deep links (e.g. Trust Wallet, Coinbase Wallet).
 */
export function isInAppWalletBrowser(): boolean {
  if (typeof navigator === "undefined") return false
  return /MetaMask|Trust\/|CoinbaseWallet/i.test(navigator.userAgent)
}
