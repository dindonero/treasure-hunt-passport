import type { ReactNode } from "react"
import "./_report.css"

export const metadata = {
  title: "Festival da Juventude 2026 · Treasure Hunt Report",
  description:
    "Post-event report for the Festival da Juventude 2026 Treasure Hunt in Cadaval. Aggregated from on-chain events on Nova Cidade testnet.",
}

// Hide the global site footer + bottom-nav on the report route: the report
// has its own header / footer and we don't want the in-app chrome leaking
// into a public share. The host-level chrome is rendered as siblings of
// {children} in the root layout, so route CSS reaches it via the body.
const HIDE_GLOBAL_CHROME_CSS = `
  body:has(.report-root) > div > div:first-child { padding-bottom: 0 !important; }
  body:has(.report-root) > div > .hidden.md\\:block { display: none !important; }
  body:has(.report-root) nav[aria-label="Bottom navigation"],
  body:has(.report-root) nav[role="navigation"][class*="bottom"],
  body:has(.report-root) [data-bottom-nav],
  body:has(.report-root) .bottom-nav-glass { display: none !important; }
`

export default function ReportLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{HIDE_GLOBAL_CHROME_CSS}</style>
      <div className="report-root">{children}</div>
    </>
  )
}
