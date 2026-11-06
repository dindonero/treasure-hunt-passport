import { type NextRequest, NextResponse } from "next/server"
import { getAuthPayload } from "@/lib/auth"
import { currentEdition, getBadges, getPassport } from "@/lib/arkiv"

// GET: the signed-in player's passport and badges from every edition, read from Arkiv.
export async function GET(request: NextRequest) {
  const payload = await getAuthPayload(request)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const player = payload.sub.toLowerCase()
  try {
    const [passport, badges] = await Promise.all([getPassport(player), getBadges(player)])
    return NextResponse.json(
      {
        edition: currentEdition(),
        passport: passport && {
          firstEdition: passport.firstEdition,
          handle: passport.handle,
          photoNonce: passport.photo ? passport.photoNonce : null,
        },
        badges,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("passport read failed:", error)
    return NextResponse.json({ error: "Could not read your passport" }, { status: 502 })
  }
}
