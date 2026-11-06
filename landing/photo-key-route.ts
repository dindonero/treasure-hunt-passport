// Keys for the encrypted passport photos, for every edition of the game.
//
// A player's passport (on Arkiv) travels between editions, and so does their
// profile photo: its ciphertext sits on Swarm and the passport points at it.
// The key has to be somewhere every edition can reach but that outlives all of
// them, which is this site, for the same reason it owns the WhatsApp relay.
//
// IT STORES NOTHING. The key is derived: HMAC(PHOTO_MASTER_KEY, player:nonce).
//   mint  a fresh random nonce and its key, for a new upload
//   read  the key for a nonce, ONLY if that nonce is the one on the player's
//         current passport on Arkiv (written by our issuer wallet)
// So when a player removes their photo, the edition unsets the nonce on the
// passport, and from then on nobody gets that key again, our own editions
// included. The ciphertext left on Swarm is noise.
//
// Callers are game editions, authenticated like the relay: an HMAC over the raw
// body under PHOTO_KEY_RELAY_SECRET, in `x-th-relay-signature`, plus a
// timestamp inside the body so a captured request goes stale in a minute.
// Editions check who the player is (their JWT) before they ask.
//
// The edition side is lib/photo.ts in the treasure-hunt-passport repo, which
// also carries a copy of this file.

import { createHmac, randomBytes } from "node:crypto"
import { type NextRequest } from "next/server"
import { signatureMatches } from "@/lib/webhook-signature"

const MAX_SKEW_MS = 60_000
const PLAYER = /^0x[0-9a-f]{40}$/
const NONCE = /^[0-9a-f]{32}$/

const derive = (master: string, player: string, nonce: string) =>
  createHmac("sha256", master).update(`${player}:${nonce}`).digest("base64")

/** The photo nonce on the player's passport right now, read straight from Arkiv. */
async function currentNonce(player: string, issuer: string): Promise<string | null> {
  const rpc = `https://rpc.rabdi.db-chain.testnet.arkiv.network/${process.env.ARKIV_ACCESS_KEY ?? ""}`
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "arkiv_query",
      params: [
        `arkiv.schema = str('treasurehunt.passport') AND player = addr(${player}) AND $creator = addr(${issuer})`,
        { select: { attributes: { photoNonce: true } }, limit: "0x1" },
      ],
    }),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Arkiv answered ${res.status}`)
  const body = await res.json()
  if (body.error) throw new Error(`Arkiv: ${body.error.message}`)
  const attrs: { name: string; value: string }[] = body.result?.data?.[0]?.attributes ?? []
  return attrs.find((a) => a.name === "photoNonce")?.value ?? null
}

export async function POST(request: NextRequest) {
  const master = process.env.PHOTO_MASTER_KEY
  const secret = process.env.PHOTO_KEY_RELAY_SECRET
  const issuer = process.env.ARKIV_ISSUER_ADDRESS
  if (!master || !secret || !issuer) return Response.json({ error: "Not configured" }, { status: 503 })

  const raw = await request.text()
  if (!signatureMatches(raw, request.headers.get("x-th-relay-signature"), secret)) {
    return Response.json({ error: "Bad signature" }, { status: 401 })
  }

  let body: { mode?: unknown; player?: unknown; nonce?: unknown; ts?: unknown }
  try {
    body = JSON.parse(raw)
  } catch {
    return Response.json({ error: "Bad JSON" }, { status: 400 })
  }
  const { mode, player, nonce, ts } = body
  if (typeof ts !== "number" || Math.abs(Date.now() - ts) > MAX_SKEW_MS) {
    return Response.json({ error: "Stale request" }, { status: 401 })
  }
  if (typeof player !== "string" || !PLAYER.test(player)) {
    return Response.json({ error: "Bad player" }, { status: 400 })
  }

  if (mode === "mint") {
    const fresh = randomBytes(16).toString("hex")
    return Response.json({ nonce: fresh, key: derive(master, player, fresh) }, { headers: { "Cache-Control": "no-store" } })
  }

  if (mode === "read") {
    if (typeof nonce !== "string" || !NONCE.test(nonce)) return Response.json({ error: "Bad nonce" }, { status: 400 })
    let current: string | null
    try {
      current = await currentNonce(player, issuer)
    } catch (error) {
      console.error("[photo-key] Arkiv read failed:", error)
      return Response.json({ error: "Arkiv unavailable" }, { status: 502 })
    }
    if (current !== nonce) return Response.json({ error: "No such photo" }, { status: 404 })
    return Response.json({ nonce, key: derive(master, player, nonce) }, { headers: { "Cache-Control": "no-store" } })
  }

  return Response.json({ error: "Unknown mode" }, { status: 400 })
}
