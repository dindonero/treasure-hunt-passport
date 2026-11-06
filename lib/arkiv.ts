// The player passport and per-edition badges, stored on Arkiv.
//
// Every edition of the game is its own deployment with its own database, so
// nothing a player did at one event used to reach the next one. These two
// records live on Arkiv instead, where every edition can read them:
//
//   passport  one per player: handle, and the Swarm reference + nonce of the
//             ENCRYPTED profile photo (the key never touches Arkiv, see
//             lib/photo.ts)
//   badge     one per (player, edition), issued on the player's first
//             on-chain find in that edition. Created readonly, so nobody can
//             change it after it is issued.
//
// One Treasure Hunt wallet (the "issuer") writes everything, for every
// edition. Arkiv is public and anyone can write entities under our schema
// names, so every read filters on createdBy(issuer).
//
// ponytail: the issuer also owns the passport, so any edition can update it for
// a signed-in player. Handing it to the player's own wallet needs players to
// pay Arkiv gas; do that once writes can be sponsored.
//
// Kept free of "@/" imports so scripts/test-passport.mjs can load it directly.
import { ExpirationTime, createPublicClient, createWalletClient } from "@arkiv-network/sdk"
import { rabdi } from "@arkiv-network/sdk/chains"
import { and, eq } from "@arkiv-network/sdk/query"
import { addr, defineSchema, str, u64 } from "@arkiv-network/sdk/schema"
import { http } from "viem"
import { privateKeyToAccount } from "viem/accounts"

export const Passport = defineSchema("treasurehunt.passport", {
  player: addr().indexed(),
  firstEdition: str(),
  handle: str().optional(),
  photo: str().optional(), // Swarm reference of the encrypted photo
  photoNonce: str().optional(), // input to the landing's key derivation
})

export const Badge = defineSchema("treasurehunt.badge", {
  player: addr().indexed(),
  edition: str().indexed(),
  editionName: str(),
  tagId: str(),
  tagName: str(),
  claimTx: str(),
  foundAt: u64(), // unix seconds
})

export type PassportRecord = {
  key: string
  firstEdition: string
  handle: string | null
  photo: string | null
  photoNonce: string | null
}

export type BadgeRecord = {
  key: string
  edition: string
  editionName: string
  tagId: string
  tagName: string
  claimTx: string
  foundAt: number
}

/** Arkiv `str` values hold at most 128 bytes of UTF-8; our DB columns are longer. */
export function str128(v: string): string {
  let out = ""
  for (const ch of v) {
    if (Buffer.byteLength(out + ch) > 128) break
    out += ch
  }
  return out
}

export const currentEdition = () => ({
  slug: process.env.NEXT_PUBLIC_EDITION_SLUG || "dev",
  name: process.env.NEXT_PUBLIC_EDITION_NAME || "Development",
})

const chain = () => rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? "" })

let reader: ReturnType<typeof makeReader> | undefined
let writer: ReturnType<typeof makeWriter> | undefined
const makeReader = () => createPublicClient({ chain: chain(), transport: http() })
const makeWriter = () =>
  createWalletClient({
    chain: chain(),
    transport: http(),
    account: privateKeyToAccount(process.env.ARKIV_ISSUER_PRIVATE_KEY as `0x${string}`),
  })
const read = () => (reader ??= makeReader())
const write = () => (writer ??= makeWriter())

/** The only account whose Arkiv records we trust. */
export function issuer(): `0x${string}` {
  const key = process.env.ARKIV_ISSUER_PRIVATE_KEY
  if (key) return privateKeyToAccount(key as `0x${string}`).address
  const address = process.env.ARKIV_ISSUER_ADDRESS
  if (!address) throw new Error("ARKIV_ISSUER_PRIVATE_KEY or ARKIV_ISSUER_ADDRESS must be set")
  return address as `0x${string}`
}

export async function getPassport(player: string): Promise<PassportRecord | null> {
  const { entities } = await read()
    .select({ $key: true, firstEdition: true, handle: true, photo: true, photoNonce: true })
    .from(Passport)
    .createdBy(issuer())
    .where(eq("player", addr(player as `0x${string}`)))
    .fetch()
  const e = entities[0]
  if (!e) return null
  return {
    key: e.$key,
    firstEdition: e.firstEdition.value,
    handle: e.handle?.value ?? null,
    photo: e.photo?.value ?? null,
    photoNonce: e.photoNonce?.value ?? null,
  }
}

export async function getBadges(player: string, edition?: string): Promise<BadgeRecord[]> {
  const byPlayer = eq("player", addr(player as `0x${string}`))
  const { entities } = await read()
    .select({ $key: true, edition: true, editionName: true, tagId: true, tagName: true, claimTx: true, foundAt: true })
    .from(Badge)
    .createdBy(issuer())
    .where(edition ? and(byPlayer, eq("edition", edition)) : byPlayer)
    .fetch()
  return entities
    .map((e) => ({
      key: e.$key,
      edition: e.edition.value,
      editionName: e.editionName.value,
      tagId: e.tagId.value,
      tagName: e.tagName.value,
      claimTx: e.claimTx.value,
      foundAt: Number(e.foundAt.value),
    }))
    .sort((a, b) => a.foundAt - b.foundAt)
}

export type BadgeInput = {
  player: string
  handle?: string | null
  edition?: { slug: string; name: string }
  tagId: string
  tagName: string
  claimTx?: string
}

/**
 * Issue this edition's badge on the player's first verified find, creating the
 * passport on their first find anywhere. Idempotent per (player, edition).
 * The caller must already have checked the find on-chain.
 *
 * ponytail: check-then-write, so two simultaneous first finds by one player can
 * mint two badges. Reads dedupe by edition; add a lock if it ever matters.
 */
export async function issueBadge(input: BadgeInput): Promise<{ created: boolean; badge: BadgeRecord }> {
  const edition = input.edition ?? currentEdition()
  const [existing] = await getBadges(input.player, edition.slug)
  if (existing) return { created: false, badge: existing }

  const passport = await getPassport(input.player)
  const player = addr(input.player as `0x${string}`)
  const expiration = ExpirationTime.max()
  const record = {
    edition: edition.slug,
    editionName: str128(edition.name),
    tagId: input.tagId,
    tagName: str128(input.tagName),
    claimTx: input.claimTx ?? "",
    foundAt: Math.floor(Date.now() / 1000),
  }
  const values = { ...record, player, foundAt: u64(BigInt(record.foundAt)) }
  const badgeCreate = { schema: Badge, values, expiration, flags: { readonly: true } }
  // One transaction: the badge, plus the new passport or a refreshed lifetime for the old one.
  const result = passport
    ? await write().executeBatch({ creates: [badgeCreate], extensions: [{ entityKey: passport.key as `0x${string}`, expiration }] })
    : await write().executeBatch({
        creates: [
          {
            schema: Passport,
            values: { player, firstEdition: edition.slug, ...(input.handle ? { handle: str128(input.handle) } : {}) },
            expiration,
          },
          badgeCreate,
        ],
      })
  const key = String(result.createdEntities[result.createdEntities.length - 1])
  return { created: true, badge: { key, ...record } }
}

/** Point the passport at a new encrypted photo, creating the passport if needed. */
export async function setPhoto(player: string, photo: string, photoNonce: string, handle?: string | null) {
  const passport = await getPassport(player)
  const expiration = ExpirationTime.max()
  if (!passport) {
    await write().createEntity(
      Passport,
      {
        player: addr(player as `0x${string}`),
        firstEdition: currentEdition().slug,
        photo,
        photoNonce,
        ...(handle ? { handle: str128(handle) } : {}),
      },
      { expiration },
    )
    return
  }
  await write().executeBatch({
    patches: [
      {
        schema: Passport,
        entityKey: passport.key as `0x${string}`,
        set: { photo, photoNonce, ...(handle ? { handle: str128(handle) } : {}) },
      },
    ],
    extensions: [{ entityKey: passport.key as `0x${string}`, expiration }],
  })
}

/**
 * Put the name the player picked on their passport. Players pick it after their
 * first find, which is when the passport is created, so it would otherwise only
 * reach the passport with a photo. No passport yet: the first badge carries it.
 */
export async function setHandle(player: string, handle: string) {
  const passport = await getPassport(player)
  if (!passport || passport.handle === str128(handle)) return
  await write().patchEntity(Passport, passport.key as `0x${string}`, { set: { handle: str128(handle) } })
}

/**
 * Unlink the photo. The landing only hands out a key for the nonce that is on
 * the passport right now, so once this lands the ciphertext on Swarm can no
 * longer be decrypted by anyone, our own servers included.
 */
export async function clearPhoto(player: string) {
  const passport = await getPassport(player)
  if (!passport?.photo) return
  await write().patchEntity(Passport, passport.key as `0x${string}`, { unset: ["photo", "photoNonce"] })
}
