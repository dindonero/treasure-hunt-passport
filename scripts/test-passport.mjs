// Check for the passport: photo crypto offline, then a real round trip on
// Arkiv's testnet with a throwaway player address.
//   node --env-file=.env.arkiv-issuer scripts/test-passport.mjs
// Without ARKIV_ISSUER_PRIVATE_KEY only the offline part runs.
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { createWalletClient } from "@arkiv-network/sdk"
import { rabdi } from "@arkiv-network/sdk/chains"
import { http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { decryptPhoto, encryptPhoto, imageType, signKeyRequest } from "../lib/photo.ts"
import { Badge, clearPhoto, getBadges, getPassport, issueBadge, setPhoto } from "../lib/arkiv.ts"

// --- offline: photo encryption ---
const key = randomBytes(32)
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), randomBytes(500)])
const blob = encryptPhoto(key, jpeg)
assert.deepEqual(decryptPhoto(key, blob), jpeg, "round trip")
assert.throws(() => decryptPhoto(randomBytes(32), blob), "wrong key must fail")
const tampered = Buffer.from(blob)
tampered[20] ^= 1
assert.throws(() => decryptPhoto(key, tampered), "tampered ciphertext must fail")
assert.equal(imageType(jpeg), "image/jpeg")
assert.equal(imageType(randomBytes(16).fill(0)), null)
assert.equal(signKeyRequest("x", "s"), signKeyRequest("x", "s"))
assert.notEqual(signKeyRequest("x", "s"), signKeyRequest("y", "s"))
console.log("offline checks passed")

if (!process.env.ARKIV_ISSUER_PRIVATE_KEY) process.exit(0)

// --- Arkiv testnet round trip ---
const player = privateKeyToAccount(`0x${randomBytes(32).toString("hex")}`).address.toLowerCase()
const ed1 = { slug: "test-a", name: "Test A" }
const ed2 = { slug: "test-b", name: "Test B" }
const writer = createWalletClient({
  chain: rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? "" }),
  transport: http(),
  account: privateKeyToAccount(process.env.ARKIV_ISSUER_PRIVATE_KEY),
})
const keys = []
try {
  const first = await issueBadge({ player, handle: "tester", edition: ed1, tagId: "1", tagName: "Fountain" })
  assert.equal(first.created, true)
  keys.push(first.badge.key)
  const again = await issueBadge({ player, edition: ed1, tagId: "2", tagName: "Stairs" })
  assert.equal(again.created, false, "one badge per edition")
  const second = await issueBadge({ player, edition: ed2, tagId: "7", tagName: "Stage" })
  assert.equal(second.created, true)
  keys.push(second.badge.key)

  const badges = await getBadges(player)
  assert.deepEqual(badges.map((b) => b.edition).sort(), ["test-a", "test-b"])
  const passport = await getPassport(player)
  assert.equal(passport.firstEdition, "test-a", "passport is created on the first badge")
  assert.equal(passport.handle, "tester")
  keys.push(passport.key)

  await setPhoto(player, "ab".repeat(32), "n1")
  assert.equal((await getPassport(player)).photoNonce, "n1")
  await clearPhoto(player)
  const cleared = await getPassport(player)
  assert.equal(cleared.photo, null)
  assert.equal(cleared.photoNonce, null)

  await assert.rejects(
    writer.patchEntity(Badge, first.badge.key, { set: { tagName: "forged" } }),
    "badges are readonly",
  )
  console.log("Arkiv checks passed for", player)
} finally {
  // Leave nothing behind under our schema names.
  for (const entityKey of keys) await writer.deleteEntity({ entityKey }).catch(() => {})
}
