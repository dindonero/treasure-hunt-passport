"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { fmtShortAddress } from "@/lib/report"

// ---------- count-up hook ----------
export function useCountUp(target: number, duration = 900, decimals = 0): [string, React.RefObject<HTMLDivElement | null>] {
  const [value, setValue] = useState(0)
  const ref = useRef<HTMLDivElement | null>(null)
  const started = useRef(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced) {
      setValue(target)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !started.current) {
            started.current = true
            const t0 = performance.now()
            const tick = (now: number) => {
              const t = Math.min(1, (now - t0) / duration)
              const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
              setValue(target * eased)
              if (t < 1) requestAnimationFrame(tick)
              else setValue(target)
            }
            requestAnimationFrame(tick)
            io.disconnect()
          }
        })
      },
      { threshold: 0.4 },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [target, duration])

  const display =
    decimals > 0
      ? value.toFixed(decimals)
      : Math.round(value).toLocaleString("en-US")
  return [display, ref]
}

// ---------- Anchor row ----------
export function Anchor({
  num,
  title,
  lede,
  id,
}: {
  num: string
  title: string
  lede?: string
  id?: string
}) {
  return (
    <header className="report-anchor" id={id}>
      <span className="report-anchor__num" aria-hidden>
        {num}
      </span>
      <h2 className="report-anchor__title">{title}</h2>
      {lede && <p className="report-anchor__lede">{lede}</p>}
    </header>
  )
}

// ---------- Username ----------
export function Username({
  name,
  address,
}: {
  name?: string | null
  address?: string | null
}) {
  const placeholder = !name || name === "__placeholder__"
  if (placeholder) {
    const short = address ? fmtShortAddress(address) : "0x1234…abcd"
    return <span className="report-username report-username--placeholder">{short}</span>
  }
  return <span className="report-username">{name}</span>
}

// ---------- KPI ----------
export function KPI({
  value,
  suffix,
  label,
  hint,
  duration,
  decimals,
}: {
  value: number
  suffix?: string
  label: string
  hint?: string
  duration?: number
  decimals?: number
}) {
  const [display, ref] = useCountUp(value, duration ?? 900, decimals ?? 0)
  return (
    <div ref={ref}>
      <div className="report-kpi__value">
        {display}
        {suffix && <span className="report-kpi__suffix">{suffix}</span>}
      </div>
      <div className="report-kpi__label">{label}</div>
      {hint && <p className="report-kpi__hint">{hint}</p>}
    </div>
  )
}

// ---------- in-view rise wrapper ----------
export function Rise({
  children,
  delay = 0,
}: {
  children: ReactNode
  delay?: number
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced) {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true)
            io.disconnect()
          }
        })
      },
      { threshold: 0.1 },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: `opacity 360ms ease-out ${delay}ms, transform 360ms ease-out ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

// ---------- accessible chart wrapper ----------
export function ChartFrame({
  title,
  summary,
  children,
}: {
  title: string
  summary: string
  children: ReactNode
}) {
  return (
    <figure style={{ margin: 0 }}>
      {children}
      <figcaption className="report-sr-only">
        {title}. {summary}
      </figcaption>
    </figure>
  )
}
