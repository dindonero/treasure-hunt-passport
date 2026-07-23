import type React from "react"
import type { Metadata } from "next"
import { Bebas_Neue, Roboto, Roboto_Mono } from "next/font/google"
import { LazyThirdwebProvider } from "@/components/lazy-thirdweb-provider"
import { WalletProvider } from "@/lib/wallet-context"
import { ContractAddressProvider } from "@/lib/contract-address-context"
import { TokenMetadataProvider } from "@/lib/token-metadata-context"
import { TokenBalanceProvider } from "@/hooks/use-token-balance"
import Footer from "@/components/footer"
import BottomNav from "@/components/bottom-nav"
import PageTransition from "@/components/page-transition"
import ErrorBoundary from "@/components/error-boundary"
import { Toaster } from "@/components/ui/toaster"
import SwRegister from "@/components/sw-register"
import "./globals.css"

const bebasNeue = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-display" })
const roboto = Roboto({ weight: ["300", "400", "500", "700"], subsets: ["latin"], variable: "--font-sans" })
const robotoMono = Roboto_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-mono" })

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://cadaval.treasurehunt.pt";

export const metadata: Metadata = {
    metadataBase: new URL(baseUrl),
    title: {
        default: "Treasure Hunt | Scan NFC Tags & Earn Crypto Tokens",
        template: "%s | Treasure Hunt",
    },
    description:
      "Scan NFC tags to earn crypto tokens, discover hidden treasures, and climb the leaderboard. A blockchain-powered scavenger hunt by Nova Blockchain Lab.",
    openGraph: {
        title: "Treasure Hunt | Scan NFC Tags & Earn Crypto Tokens",
        description:
          "Scan NFC tags to earn crypto tokens, discover hidden treasures, and climb the leaderboard. A blockchain-powered scavenger hunt by Nova Blockchain Lab.",
        url: baseUrl,
        siteName: "Treasure Hunt",
        locale: "en_US",
        type: "website",
        images: [
            {
                url: "/treasure-hunt-logo.png",
                width: 1200,
                height: 630,
                alt: "Treasure Hunt — blockchain scavenger hunt",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Treasure Hunt | Scan NFC Tags & Earn Crypto Tokens",
        description:
          "Scan NFC tags to earn crypto tokens, discover hidden treasures, and climb the leaderboard.",
        images: ["/treasure-hunt-logo.png"],
    },
    icons: {
        icon: [
            { url: "/favicon.ico", sizes: "any" },
            { url: "/favicon.png", type: "image/png" },
        ],
        shortcut: "/favicon.ico",
        apple: "/treasure-hunt-only-logo.png",
    },
    manifest: "/manifest.webmanifest",
}

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html lang="en" translate="no" suppressHydrationWarning>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
            <meta name="theme-color" content="#0b0b14" />
            {/* Disable browser auto-translation. iOS Safari / Chrome translate
                replace DOM text nodes in place, which crashes React's
                reconciler on the next re-render (e.g. after a successful
                transaction) with NotFoundError on removeChild/insertBefore,
                surfacing as a generic "SOMETHING WENT WRONG" ErrorBoundary
                screen even though the on-chain action already succeeded. */}
            <meta name="google" content="notranslate" />
            {/* Preload header/footer logo (visible on every page) so it's not
                blocked by the JS bundle on slow venue WiFi. */}
            <link
                rel="preload"
                as="image"
                href="/treasure-hunt-only-logo.png"
                fetchPriority="high"
            />
        </head>
        <body className={`${roboto.variable} ${bebasNeue.variable} ${robotoMono.variable} font-sans antialiased flex flex-col min-h-screen`}>
        <LazyThirdwebProvider>
            <WalletProvider>
              <ContractAddressProvider>
              <TokenMetadataProvider>
              <TokenBalanceProvider>
                <ErrorBoundary>
                  <div className="flex flex-col min-h-screen">
                      <div className="flex-1 pb-20 md:pb-0">
                          <PageTransition>{children}</PageTransition>
                      </div>
                      <div className="hidden md:block"><Footer /></div>
                      <BottomNav />
                  </div>
                </ErrorBoundary>
              </TokenBalanceProvider>
              </TokenMetadataProvider>
              </ContractAddressProvider>
            </WalletProvider>
        </LazyThirdwebProvider>
        <Toaster />
        <SwRegister />
        </body>
        </html>
    )
}
