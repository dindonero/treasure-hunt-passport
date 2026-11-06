// Encrypted profile photos: ciphertext on Swarm, key from the landing.
//
// Where each piece lives:
//   Swarm    AES-256-GCM ciphertext of the photo (iv | ciphertext | tag)
//   Arkiv    the Swarm reference and a random nonce, on the passport
//   landing  treasurehunt.pt/api/photo-key derives the key as
//            HMAC(master, player:nonce). It stores nothing, and for reads it
//            only answers for the nonce currently on the player's passport.
//
// So the photo follows the player to every edition (each one can ask the
// landing), and removing it from the passport makes the ciphertext unreadable
// for good. Same shape as the WhatsApp relay: the landing outlives every
// edition, and editions prove themselves with an HMAC over the raw body.
//
// Kept free of "@/" imports so scripts/test-passport.mjs can load it directly.
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto"

export function encryptPhoto(key: Buffer, plain: Buffer): Buffer {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const body = Buffer.concat([cipher.update(plain), cipher.final()])
  return Buffer.concat([iv, body, cipher.getAuthTag()])
}

export function decryptPhoto(key: Buffer, blob: Buffer): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", key, blob.subarray(0, 12))
  decipher.setAuthTag(blob.subarray(blob.length - 16))
  return Buffer.concat([decipher.update(blob.subarray(12, blob.length - 16)), decipher.final()])
}

/** Sniff the image type so the decrypted bytes are served with the right header. */
export function imageType(bytes: Buffer): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg"
  if (bytes.subarray(0, 4).toString("hex") === "89504e47") return "image/png"
  if (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP") return "image/webp"
  return null
}

const keyServiceUrl = () => process.env.PHOTO_KEY_URL || "https://www.treasurehunt.pt/api/photo-key"

/** HMAC over the exact bytes sent; the landing checks it before answering. */
export function signKeyRequest(raw: string, secret = process.env.PHOTO_KEY_RELAY_SECRET): string {
  if (!secret) throw new Error("PHOTO_KEY_RELAY_SECRET is not set")
  return `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`
}

type KeyRequest = { mode: "mint"; player: string } | { mode: "read"; player: string; nonce: string }

/** mint: a fresh nonce and its key, for a new upload. read: the key for the passport's current nonce. */
export async function photoKey(req: KeyRequest): Promise<{ key: Buffer; nonce: string }> {
  const raw = JSON.stringify({ ...req, player: req.player.toLowerCase(), ts: Date.now() })
  const res = await fetch(keyServiceUrl(), {
    method: "POST",
    headers: { "content-type": "application/json", "x-th-relay-signature": signKeyRequest(raw) },
    body: raw,
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`photo key service answered ${res.status}`)
  const data = (await res.json()) as { key: string; nonce: string }
  return { key: Buffer.from(data.key, "base64"), nonce: data.nonce }
}

/**
 * Upload raw bytes. Returns the 64-hex Swarm reference.
 * With our own Bee node, set SWARM_POSTAGE_BATCH_ID. The public gateway
 * (https://api.gateway.ethswarm.org) stamps uploads with its own batch.
 */
export async function swarmUpload(bytes: Buffer): Promise<string> {
  const api = process.env.SWARM_API_URL || "https://api.gateway.ethswarm.org"
  const batch = process.env.SWARM_POSTAGE_BATCH_ID
  const res = await fetch(`${api.replace(/\/$/, "")}/bytes`, {
    method: "POST",
    headers: { "content-type": "application/octet-stream", ...(batch ? { "swarm-postage-batch-id": batch } : {}) },
    body: new Uint8Array(bytes),
  })
  if (!res.ok) throw new Error(`Swarm upload failed: ${res.status} ${await res.text().catch(() => "")}`)
  const { reference } = (await res.json()) as { reference: string }
  return reference
}

export async function swarmDownload(reference: string): Promise<Buffer> {
  const gateway = process.env.SWARM_GATEWAY_URL || process.env.SWARM_API_URL || "https://api.gateway.ethswarm.org"
  if (!/^[0-9a-f]{64}$/i.test(reference)) throw new Error("not a Swarm reference")
  const res = await fetch(`${gateway.replace(/\/$/, "")}/bytes/${reference}`)
  if (!res.ok) throw new Error(`Swarm download failed: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}
