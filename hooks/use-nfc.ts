"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/** NDEF "url" record type: first byte is a URI prefix index, rest is the suffix. */
const URL_PREFIXES: Record<number, string> = {
  0x00: "",
  0x01: "http://www.",
  0x02: "https://www.",
  0x03: "http://",
  0x04: "https://",
  0x05: "tel:",
  0x06: "mailto:",
}

function decodeNdefUrl(record: NDEFRecord): string | null {
  if (!record.data) return null

  if (record.recordType === "url") {
    const bytes = new Uint8Array(record.data.buffer, record.data.byteOffset, record.data.byteLength)
    if (bytes.length < 1) return null
    const prefix = URL_PREFIXES[bytes[0]] ?? ""
    const suffix = new TextDecoder().decode(bytes.slice(1))
    return prefix + suffix
  }

  if (record.recordType === "absolute-url") {
    return new TextDecoder().decode(record.data)
  }

  // Fallback: try to parse "text" records as URLs
  if (record.recordType === "text") {
    const bytes = new Uint8Array(record.data.buffer, record.data.byteOffset, record.data.byteLength)
    // Text records: first byte = status (bit 7 = UTF, bits 5-0 = lang length)
    const langLen = bytes[0] & 0x3f
    const text = new TextDecoder().decode(bytes.slice(1 + langLen))
    try {
      new URL(text) // validate
      return text
    } catch {
      return null
    }
  }

  return null
}

export interface UseNfcReturn {
  isSupported: boolean
  scanning: boolean
  lastReadUrl: string | null
  error: string | null
  startScan: () => Promise<void>
  stopScan: () => void
}

export function useNfc(): UseNfcReturn {
  const [isSupported, setIsSupported] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [lastReadUrl, setLastReadUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const lastReadRef = useRef<{ serial: string; time: number } | null>(null)

  // Detect support on mount
  useEffect(() => {
    setIsSupported(typeof window !== "undefined" && "NDEFReader" in window)
  }, [])

  const stopScan = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setScanning(false)
  }, [])

  const startScan = useCallback(async () => {
    if (!("NDEFReader" in window)) {
      setError("NFC is not supported in this browser.")
      return
    }

    setError(null)
    setLastReadUrl(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const reader = new NDEFReader()

      reader.onreading = (event: NDEFReadingEvent) => {
        // Debounce: ignore duplicate reads of the same tag within 2s
        const now = Date.now()
        const serial = event.serialNumber || ""
        if (
          lastReadRef.current &&
          lastReadRef.current.serial === serial &&
          now - lastReadRef.current.time < 2000
        ) {
          return
        }
        lastReadRef.current = { serial, time: now }

        // Find the first URL in the NDEF message
        let url: string | null = null
        for (const record of event.message.records) {
          url = decodeNdefUrl(record)
          if (url) break
        }

        if (url) {
          setLastReadUrl(url)
        } else {
          setError("This NFC tag doesn't contain a valid URL.")
        }
      }

      reader.onreadingerror = () => {
        setError("Could not read the NFC tag. Try holding your phone closer.")
      }

      await reader.scan({ signal: controller.signal })
      setScanning(true)
    } catch (err: unknown) {
      const e = err as DOMException
      if (e.name === "AbortError") {
        // Silent — user or cleanup stopped the scan
        return
      }
      if (e.name === "NotAllowedError") {
        setError("NFC permission was denied. Allow NFC access in your browser settings.")
      } else if (e.name === "SecurityError") {
        setError("NFC requires a secure (HTTPS) connection.")
      } else {
        setError(e.message || "Failed to start NFC scanner.")
      }
      setScanning(false)
    }
  }, [])

  // Stop scan on visibility change (mirrors QR behavior)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "visible" && scanning) {
        stopScan()
      }
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [scanning, stopScan])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
        abortRef.current = null
      }
    }
  }, [])

  return { isSupported, scanning, lastReadUrl, error, startScan, stopScan }
}
