import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Treasure Map",
  description:
    "Explore the venue map and find hidden NFC treasure tags. See tag locations and plan your hunt route.",
  openGraph: {
    title: "Treasure Map | Treasure Hunt",
    description:
      "Explore the venue map and find hidden NFC treasure tags.",
    type: "website",
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
