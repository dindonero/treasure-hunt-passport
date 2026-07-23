"use client"

import { useEffect } from "react"

// Registers the static-asset service worker. Only runs in production builds —
// in dev, Next.js serves unbuilt JS that should never be cached. Failure is
// silent: the app works without the SW, the SW just adds offline resilience
// for static assets when venue WiFi drops.
export default function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* ignore */
      })
    }
    if (document.readyState === "complete") onLoad()
    else window.addEventListener("load", onLoad, { once: true })
  }, [])
  return null
}
