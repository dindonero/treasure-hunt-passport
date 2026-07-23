"use client"

import type { Snapshot } from "@/lib/report"
import { fmtPct } from "@/lib/report"
import { Anchor, KPI, Rise } from "./atoms"

export function SectionKPIs({ snapshot }: { snapshot: Snapshot }) {
  const { kpis, tags } = snapshot
  // Tags hidden across the venue is the count of in-play tags surfaced in
  // the report — each row in `snapshot.tags` is one in-play NFC tag.
  const tagsHidden = tags.length

  const items: Array<{
    value: number
    suffix?: string
    label: string
    hint: string
    decimals?: number
  }> = [
    {
      value: kpis.totalPlayers,
      label: "Total players",
      hint: "Distinct wallets that opted in to the hunt and tapped at least one tag.",
    },
    {
      value: tagsHidden,
      label: "Tags hidden",
      hint: "NFC tags concealed across Cadaval by players and organisers.",
    },
    {
      value: kpis.totalFinds,
      label: "Tag finds",
      hint: "Successful NFC taps. Each player counts once per tag.",
    },
    {
      value: kpis.tokensDistributed,
      label: `Tokens distributed`,
      hint: `${kpis.tokenSymbol} minted to players across all reward types. Settled on Nova Cidade testnet.`,
    },
    {
      value: kpis.merchPurchases,
      label: "Merch purchases",
      hint: "On-chain claims of physical merch from the festival store.",
    },
  ]

  // Paymaster sponsorship pill — 100% target. Only render the explicit
  // percent if it deviates from 100%, otherwise the visual reads cleanly.
  const sponsoredPct = kpis.paymasterSponsoredPct
  const paymasterAllSponsored = sponsoredPct >= 99.95

  return (
    <section className="report-section" id="headline">
      <div className="report-container">
        <Anchor
          num="01"
          title="HEADLINE"
          lede="Five numbers, snapshot at end of festival. Every figure is verifiable on-chain — the contract address is in the footer."
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 32,
            rowGap: 48,
          }}
        >
          {items.map((k, i) => (
            <Rise key={k.label} delay={i * 60}>
              <KPI
                value={k.value}
                suffix={k.suffix}
                label={k.label}
                hint={k.hint}
                decimals={k.decimals}
              />
            </Rise>
          ))}
        </div>

        {/* Paymaster sponsorship pill */}
        <div style={{ marginTop: 48 }}>
          <Rise delay={300}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 22px",
                borderRadius: 999,
                border: "1px solid rgba(86, 211, 100, 0.45)",
                background:
                  "linear-gradient(135deg, rgba(86,211,100,0.12), rgba(86,211,100,0.02))",
                boxShadow: "0 0 32px rgba(86,211,100,0.10)",
                maxWidth: "100%",
                flexWrap: "wrap",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "var(--neon-yellow)",
                  boxShadow: "0 0 14px rgba(86,211,100,0.7)",
                  flexShrink: 0,
                }}
              />
              <span
                className="font-display"
                style={{
                  fontSize: 13,
                  letterSpacing: "0.18em",
                  color: "rgba(86,211,100,0.95)",
                }}
              >
                {paymasterAllSponsored
                  ? "100% PAYMASTER-SPONSORED"
                  : `${fmtPct(sponsoredPct, 1)} PAYMASTER-SPONSORED`}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: "var(--text-primary)",
                  lineHeight: 1.4,
                }}
              >
                Players paid zero gas — every reward, merch, and social tx was
                covered by an ERC-4337 paymaster.
              </span>
            </div>
          </Rise>
        </div>
      </div>
    </section>
  )
}
