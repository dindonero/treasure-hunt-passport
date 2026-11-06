import { type NextRequest, NextResponse } from "next/server"
import { getAuthPayload } from "@/lib/auth"
import { clearPhoto, getPassport, setPhoto } from "@/lib/arkiv"
import { decryptPhoto, encryptPhoto, imageType, photoKey, swarmDownload, swarmUpload } from "@/lib/photo"
import { playerHandle } from "@/lib/passport-player"

const MAX_BYTES = 2 * 1024 * 1024

async function player(request: NextRequest) {
  const payload = await getAuthPayload(request)
  return payload?.sub.toLowerCase() ?? null
}

// GET: the player's own photo, decrypted. Only the owner can see it.
export async function GET(request: NextRequest) {
  const me = await player(request)
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  try {
    const passport = await getPassport(me)
    if (!passport?.photo || !passport.photoNonce) return NextResponse.json({ error: "No photo" }, { status: 404 })
    const [{ key }, blob] = await Promise.all([
      photoKey({ mode: "read", player: me, nonce: passport.photoNonce }),
      swarmDownload(passport.photo),
    ])
    const plain = decryptPhoto(key, blob)
    return new NextResponse(new Uint8Array(plain), {
      headers: { "Content-Type": imageType(plain) ?? "application/octet-stream", "Cache-Control": "private, no-store" },
    })
  } catch (error) {
    console.error("photo read failed:", error)
    return NextResponse.json({ error: "Could not load your photo" }, { status: 502 })
  }
}

// POST multipart { file }: encrypt, upload to Swarm, point the passport at it.
export async function POST(request: NextRequest) {
  const me = await player(request)
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const file = (await request.formData().catch(() => null))?.get("file")
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Photo is too large" }, { status: 413 })
  const plain = Buffer.from(await file.arrayBuffer())
  if (!imageType(plain)) return NextResponse.json({ error: "Please pick a JPEG, PNG or WebP image" }, { status: 415 })
  try {
    const { key, nonce } = await photoKey({ mode: "mint", player: me })
    const reference = await swarmUpload(encryptPhoto(key, plain))
    await setPhoto(me, reference, nonce, await playerHandle(me))
    return NextResponse.json({ success: true, photoNonce: nonce })
  } catch (error) {
    console.error("photo upload failed:", error)
    return NextResponse.json({ error: "Could not save your photo" }, { status: 502 })
  }
}

// DELETE: unlink the photo. The landing then refuses its key to everyone.
export async function DELETE(request: NextRequest) {
  const me = await player(request)
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  try {
    await clearPhoto(me)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("photo removal failed:", error)
    return NextResponse.json({ error: "Could not remove your photo" }, { status: 502 })
  }
}
