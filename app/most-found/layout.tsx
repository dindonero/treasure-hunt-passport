import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Most Found Tags",
  description:
    "Discover which hidden NFC tags have been found the most in the Treasure Hunt. Live stats on the most popular treasures.",
  openGraph: {
    title: "Most Found Tags | Treasure Hunt",
    description:
      "Discover which hidden NFC tags have been found the most. Live stats on the most popular treasures.",
    type: "website",
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
