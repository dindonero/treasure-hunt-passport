"use client"

import type { ReactNode } from "react"
import dynamic from "next/dynamic"

// Code-split ThirdwebProvider out of the main app bundle (~250 KB SDK chunk).
// While the chunk is in flight on first paint, ThirdwebProvider renders as a
// pass-through (children mount normally). thirdweb/react hooks like
// useActiveAccount() return undefined without a provider in the tree, which
// is exactly what WalletProvider expects during the JWT-first window — it
// falls back to authAddress from the JWT cookie until thirdweb hydrates and
// useActiveAccount() resolves to the live wallet.
const ThirdwebProviderDynamic = dynamic(
  () => import("thirdweb/react").then((m) => ({ default: m.ThirdwebProvider })),
  { ssr: false, loading: () => null }
)

export function LazyThirdwebProvider({ children }: { children: ReactNode }) {
  return <ThirdwebProviderDynamic>{children}</ThirdwebProviderDynamic>
}
