// Helpers for round-tripping ISO/UTC timestamps through `<input type="datetime-local">`.
// The input always reads/writes its value in the *browser's* local timezone, so we must
// format from local parts on the way in and let `new Date(value)` parse-as-local on the
// way out. Slicing `toISOString()` (which is UTC) into the input is the classic bug —
// it round-trips with a TZ-offset drift each save.

const pad = (n: number) => String(n).padStart(2, "0")

/** ISO/UTC string → "YYYY-MM-DDTHH:MM" in the browser's local timezone, suitable for `<input type="datetime-local" value=...>`. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "YYYY-MM-DDTHH:MM" from a `<input type="datetime-local">` (interpreted as local time) → UTC ISO string. */
export function localInputToIso(value: string | null | undefined): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}
