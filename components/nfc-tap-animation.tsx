"use client"

import type { CSSProperties } from "react"

const PINK = "#F0605D"
const ETH_DARK = "#3C3C3B"
const ETH_LIGHT = "#8C8C8C"
const ETH_ACCENT = "#627EEA"

export function NfcTapAnimation({
  size = 220,
  active = true,
}: {
  size?: number
  active?: boolean
}) {
  const wrapStyle: CSSProperties = {
    width: size,
    height: size,
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
  }

  return (
    <div className="nfc-tap absolute" style={wrapStyle} aria-hidden>
      <div className="nfc-tap__tag">
        <span className="nfc-tap__ripple nfc-tap__ripple--1" />
        <span className="nfc-tap__ripple nfc-tap__ripple--2" />
        <span className="nfc-tap__ripple nfc-tap__ripple--3" />
        <span className="nfc-tap__disc">
          <EthDiamond size={Math.round(size * 0.18)} />
        </span>
      </div>

      <div className="nfc-tap__phone">
        <PhoneSilhouette width={Math.round(size * 0.34)} height={Math.round(size * 0.58)} />
      </div>

      <style jsx>{`
        .nfc-tap {
          position: absolute;
          pointer-events: none;
        }
        .nfc-tap__tag {
          position: absolute;
          width: 46%;
          height: 46%;
          left: 50%;
          top: 58%;
          transform: translate(-50%, -50%);
        }
        .nfc-tap__disc {
          position: absolute;
          inset: 0;
          margin: auto;
          width: 70%;
          height: 70%;
          border-radius: 999px;
          background: radial-gradient(
            circle at 35% 30%,
            rgba(255, 255, 255, 0.08),
            rgba(255, 255, 255, 0.02) 60%,
            rgba(0, 0, 0, 0.4) 100%
          );
          border: 1.5px solid ${PINK}66;
          box-shadow:
            inset 0 0 18px rgba(0, 0, 0, 0.45),
            0 0 18px ${PINK}33;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .nfc-tap__ripple {
          position: absolute;
          inset: 0;
          margin: auto;
          width: 70%;
          height: 70%;
          border-radius: 999px;
          border: 2px solid ${PINK};
          opacity: 0;
          animation: ${active ? "nfcTapRipple 2.4s ease-out infinite" : "none"};
        }
        .nfc-tap__ripple--2 {
          animation-delay: 0.8s;
        }
        .nfc-tap__ripple--3 {
          animation-delay: 1.6s;
        }
        .nfc-tap__phone {
          position: absolute;
          left: 50%;
          top: 6%;
          transform-origin: 50% 100%;
          animation: ${active ? "nfcTapPhone 2.4s ease-in-out infinite" : "none"};
        }
        @keyframes nfcTapPhone {
          0% {
            transform: translate(-50%, -22%) rotate(-6deg);
          }
          35% {
            transform: translate(-50%, 8%) rotate(-2deg);
          }
          45% {
            transform: translate(-50%, 10%) rotate(-1deg);
          }
          65% {
            transform: translate(-50%, 8%) rotate(-2deg);
          }
          100% {
            transform: translate(-50%, -22%) rotate(-6deg);
          }
        }
        @keyframes nfcTapRipple {
          0% {
            transform: scale(0.55);
            opacity: 0;
          }
          15% {
            opacity: 0.85;
          }
          100% {
            transform: scale(1.85);
            opacity: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .nfc-tap__phone,
          .nfc-tap__ripple {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  )
}

function PhoneSilhouette({ width, height }: { width: number; height: number }) {
  const radius = Math.round(Math.min(width, height) * 0.16)
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 170"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="nfcTapPhoneBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1c2330" />
          <stop offset="100%" stopColor="#0b0f17" />
        </linearGradient>
        <linearGradient id="nfcTapPhoneScreen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={`${PINK}33`} />
          <stop offset="100%" stopColor="#0a0d18" />
        </linearGradient>
      </defs>
      <rect
        x="2"
        y="2"
        width="96"
        height="166"
        rx={radius}
        ry={radius}
        fill="url(#nfcTapPhoneBody)"
        stroke={`${PINK}80`}
        strokeWidth="1.5"
      />
      <rect
        x="8"
        y="14"
        width="84"
        height="142"
        rx={Math.max(2, radius - 6)}
        ry={Math.max(2, radius - 6)}
        fill="url(#nfcTapPhoneScreen)"
      />
      <rect
        x="38"
        y="6"
        width="24"
        height="4"
        rx="2"
        ry="2"
        fill="#0a0d18"
      />
      <g transform="translate(50 60)">
        <path
          d="M-14 -14 Q -14 -22 -6 -22 L 6 -22 Q 14 -22 14 -14 L 14 14 Q 14 22 6 22 L -6 22 Q -14 22 -14 14 Z"
          stroke={PINK}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity="0.55"
        />
        <path
          d="M-8 -8 Q -8 -14 -2 -14 L 2 -14 Q 8 -14 8 -8 L 8 8 Q 8 14 2 14 L -2 14 Q -8 14 -8 8 Z"
          stroke={PINK}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity="0.8"
        />
        <circle cx="0" cy="0" r="2.5" fill={PINK} />
      </g>
    </svg>
  )
}

function EthDiamond({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={Math.round(size * 1.6)}
      viewBox="0 0 256 417"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: `drop-shadow(0 0 6px ${ETH_ACCENT}88)` }}
    >
      <path fill={ETH_DARK} d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z" />
      <path fill={ETH_LIGHT} d="M127.962 0L0 212.32l127.962 75.639V154.158z" />
      <path
        fill={ETH_DARK}
        d="M127.961 312.187l-1.575 1.92v98.199l1.575 4.6L256 236.587z"
      />
      <path fill={ETH_LIGHT} d="M127.962 416.905v-104.72L0 236.585z" />
      <path fill="#141414" d="M127.961 287.958l127.96-75.637-127.96-58.162z" />
      <path fill="#393939" d="M0 212.32l127.96 75.638v-133.8z" />
    </svg>
  )
}
