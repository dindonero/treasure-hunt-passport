"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Smartphone } from "lucide-react"
import AppHeader from "@/components/app-header"
import { NfcTapAnimation } from "@/components/nfc-tap-animation"
import { useHaptic } from "@/hooks/use-haptic"
import { useNfc } from "@/hooks/use-nfc"

const ACCENT = {
  pink: "#F0605D",
  orange: "#F2A467",
  cyan: "#58A6FF",
  green: "#56D364",
}

type Phase = "idle" | "scanning" | "success"

function parseNfcUrl(raw: string): string | null {
  const text = (raw || "").trim()
  try {
    const url = new URL(text)
    const tagMatch = url.pathname.match(/\/tag\/([\w-]+)/i)
    if (tagMatch) return `/tag/${encodeURIComponent(tagMatch[1])}`
    const findMatch = url.pathname.match(/\/find\/([\w-]+)/i)
    if (findMatch) return `/tag/${encodeURIComponent(findMatch[1])}`
  } catch {
    /* not a URL — fall through */
  }
  if (text) return `/tag/${encodeURIComponent(text)}`
  return null
}

export default function ScanPage() {
  const router = useRouter()
  const haptic = useHaptic()
  const nfc = useNfc()

  const [nfcSupported, setNfcSupported] = useState(false)
  useEffect(() => {
    setNfcSupported(typeof window !== "undefined" && "NDEFReader" in window)
  }, [])

  const [phase, setPhase] = useState<Phase>("idle")
  const [error, setError] = useState<string | null>(null)

  const accent = ACCENT.pink
  const accentB = ACCENT.orange

  // ── NFC scan ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!nfc.lastReadUrl) return
    const dest = parseNfcUrl(nfc.lastReadUrl)
    nfc.stopScan()
    if (!dest) {
      setError("NFC tag URL doesn't match a valid treasure hunt link.")
      setPhase("idle")
      return
    }
    setPhase("success")
    haptic.success()
    setTimeout(() => router.push(dest), 500)
  }, [nfc.lastReadUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ───────────────────────────────────────────────────────
  const startScan = async () => {
    setError(null)
    setPhase("scanning")
    await nfc.startScan()
  }

  const cancelScan = () => {
    nfc.stopScan()
    setPhase("idle")
    setError(null)
  }

  const scanning = phase === "scanning"
  const success = phase === "success"

  return (
    <main className="min-h-screen hero-gradient flex flex-col relative overflow-hidden">
      <div className="blob-pink top-10 -left-40 opacity-30" />
      <div className="blob-cyan bottom-20 -right-40 opacity-30" />

      <AppHeader />

      <div className="flex-1 max-w-lg mx-auto w-full px-3.5 py-3 pb-28 relative z-10">
        {/* Header row */}
        <div className="flex items-center gap-2.5 mb-3">
          <Link
            href="/"
            onClick={() => {
              if (nfc.scanning) nfc.stopScan()
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              border: `1px solid ${ACCENT.cyan}66`,
              background: "var(--bg-card, #131921)",
            }}
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" style={{ color: ACCENT.cyan }} />
          </Link>
          <h1
            className="text-[20px] tracking-wider"
            style={{
              fontFamily: "var(--font-display, 'Bebas Neue')",
              color: "var(--text-primary, #E6EDF3)",
              textShadow: `0 0 10px ${accent}AA, 0 0 20px ${accent}55`,
            }}
          >
            SCAN NFC TAG
          </h1>
        </div>

        {/* Canvas */}
        <div
          className="relative w-full rounded-2xl overflow-hidden"
          style={{
            aspectRatio: "1 / 1",
            border: "1px solid rgba(255,255,255,0.04)",
            background: `radial-gradient(circle at center, var(--bg-elevated, #161B22), var(--bg-primary, #06080F) 70%)`,
            boxShadow: `0 0 24px ${accent}30, 0 4px 20px rgba(0,0,0,0.3)`,
            backdropFilter: "blur(12px)",
          }}
        >
          {scanning || success ? (
            <NFCPulse scanning={scanning} success={success} />
          ) : (
            <NfcTapAnimation />
          )}

          {/* Success flash */}
          {success && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(circle at center, ${ACCENT.green}33, transparent 70%)`,
                animation: "thFadeUp 0.4s ease-out",
              }}
            />
          )}

          {/* Status text */}
          <div
            className="absolute left-0 right-0 text-center px-4"
            style={{ bottom: 18, zIndex: 3 }}
          >
            {phase === "idle" && (
              <div
                className="text-[12px]"
                style={{
                  color: "var(--text-secondary, #8B949E)",
                  letterSpacing: 0.4,
                }}
              >
                {nfcSupported
                  ? "Tap Scan to begin NFC scan"
                  : "Tap your phone's NFC area to the tag"}
              </div>
            )}
            {scanning && (
              <div aria-live="polite">
                <div
                  className="text-[13px] font-medium"
                  style={{ color: "var(--text-primary, #E6EDF3)" }}
                >
                  Waiting for NFC tag…
                </div>
                <div
                  className="text-[10px] mt-[3px]"
                  style={{ color: "var(--text-muted, #6E7681)" }}
                >
                  Hold the back of your phone against a tag
                </div>
              </div>
            )}
            {success && (
              <div
                className="text-[13px] font-semibold"
                style={{ color: ACCENT.green }}
              >
                Tag detected · verifying…
              </div>
            )}
          </div>
        </div>

        {/* Action button */}
        <div className="mt-3">
          {phase === "idle" && nfcSupported && (
            <button
              type="button"
              onClick={startScan}
              className="w-full inline-flex items-center justify-center gap-2.5 active:scale-[0.985] transition-transform"
              style={{
                padding: "15px 18px",
                borderRadius: 12,
                color: "#fff",
                background: `linear-gradient(135deg, ${accent}, ${accentB})`,
                fontFamily: "var(--font-display, 'Bebas Neue')",
                fontSize: 18,
                letterSpacing: 1.8,
                boxShadow: `0 0 22px ${accent}66, 0 6px 14px rgba(0,0,0,0.35)`,
                border: "none",
              }}
            >
              <Smartphone className="w-5 h-5" />
              SCAN NFC TAG
            </button>
          )}

          {scanning && (
            <button
              type="button"
              onClick={cancelScan}
              aria-live="polite"
              className="w-full relative overflow-hidden inline-flex items-center justify-center gap-2.5"
              style={{
                padding: "15px 18px",
                borderRadius: 12,
                color: "#fff",
                background: `linear-gradient(135deg, ${accent}, ${accentB})`,
                fontFamily: "var(--font-display, 'Bebas Neue')",
                fontSize: 18,
                letterSpacing: 1.8,
                boxShadow: `0 0 22px ${accent}66, 0 6px 14px rgba(0,0,0,0.35)`,
                border: "none",
                animation: "thPulse 1.6s ease-in-out infinite",
              }}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)",
                  animation: "thLaser 1.6s ease-in-out infinite",
                  transform: "rotate(90deg)",
                }}
              />
              <Smartphone className="w-5 h-5" />
              LISTENING…
            </button>
          )}
        </div>

        {/* Errors */}
        {(error || nfc.error) && (
          <div
            className="mt-3 rounded-lg p-3 text-sm"
            style={{
              background: "rgba(239,68,68,0.10)",
              border: "1px solid rgba(239,68,68,0.30)",
              color: "#fca5a5",
            }}
          >
            {nfc.error || error}
          </div>
        )}

        {/* Hint card */}
        {!success && (
          <div
            className="mt-3 rounded-[10px] flex items-start gap-2.5"
            style={{
              padding: "10px 12px",
              background: "var(--bg-card, #131921)",
              border: "1px solid rgba(255,255,255,0.04)",
            }}
          >
            <div
              className="flex-shrink-0 flex items-center justify-center"
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: `${accent}26`,
                border: `1px solid ${accent}66`,
              }}
            >
              <Smartphone className="w-3.5 h-3.5" style={{ color: ACCENT.pink }} />
            </div>
            <div>
              <div
                className="text-[12px] font-medium"
                style={{ color: "var(--text-primary, #E6EDF3)" }}
              >
                How to scan NFC
              </div>
              <div
                className="text-[10px] mt-0.5"
                style={{
                  color: "var(--text-muted, #6E7681)",
                  lineHeight: 1.5,
                }}
              >
                Hold the back of your phone against the NFC tag. The antenna is usually near the top-center.
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes thLaser {
          0% {
            top: 0%;
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          85% {
            opacity: 1;
          }
          100% {
            top: 100%;
            opacity: 0;
          }
        }
        @keyframes thScanPing {
          0% {
            transform: scale(0.4);
            opacity: 0.7;
          }
          100% {
            transform: scale(1.2);
            opacity: 0;
          }
        }
        @keyframes thFadeUp {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.th-scan-ping),
          :global(.th-laser) {
            animation: none !important;
          }
        }
      `}</style>
    </main>
  )
}

function NFCPulse({ scanning, success }: { scanning: boolean; success: boolean }) {
  const size = 90
  const wrap = size + 60
  return (
    <div
      className="absolute"
      style={{
        width: wrap,
        height: wrap,
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      }}
    >
      {scanning &&
        [0, 0.4, 0.8].map((delay, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: wrap - i * 22,
              height: wrap - i * 22,
              marginLeft: -(wrap - i * 22) / 2,
              marginTop: -(wrap - i * 22) / 2,
              borderRadius: 999,
              border: `2px solid ${ACCENT.pink}${i === 0 ? "B3" : i === 1 ? "80" : "66"}`,
              animation: `thScanPing 2s ease-out ${delay}s infinite`,
            }}
          />
        ))}
      <div
        className="absolute flex items-center justify-center"
        style={{
          width: size,
          height: size,
          left: "50%",
          top: "50%",
          marginLeft: -size / 2,
          marginTop: -size / 2,
          borderRadius: 999,
          background: scanning ? `${ACCENT.pink}40` : `${ACCENT.pink}1F`,
          border: `1.5px solid ${ACCENT.pink}${scanning ? "E6" : "66"}`,
          boxShadow: scanning
            ? `0 0 30px ${ACCENT.pink}CC`
            : `0 0 12px ${ACCENT.pink}66`,
          transition: "all 0.4s",
          transform: success ? "scale(1.18)" : "scale(1)",
        }}
      >
        <Smartphone
          style={{ color: ACCENT.pink, width: 42, height: 42 }}
        />
      </div>
    </div>
  )
}
