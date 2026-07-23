import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "See who's leading the Treasure Hunt. Live rankings of top hunters by tokens earned and treasures found.",
  openGraph: {
    title: "Leaderboard | Treasure Hunt",
    description:
      "Live rankings of top hunters by tokens earned and treasures found.",
    type: "website",
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
