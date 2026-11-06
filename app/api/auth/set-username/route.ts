import { type NextRequest, NextResponse, after } from "next/server"
import { setHandle } from "@/lib/arkiv"
import { getAuthPayload } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

// Leaves room for the passport name write that runs after the response.
export const maxDuration = 60

const USERNAME_REGEX = /^[a-zA-Z0-9 ._-]+$/

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request)
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const rawUsername = body?.username
    const username = typeof rawUsername === "string" ? rawUsername.trim().replace(/\s+/g, " ") : rawUsername

    if (
      !username ||
      typeof username !== "string" ||
      username.length < 3 ||
      username.length > 20 ||
      !USERNAME_REGEX.test(username)
    ) {
      return NextResponse.json(
        { error: "Username must be 3-20 characters (letters, numbers, spaces, dots, underscores, hyphens)" },
        { status: 400 },
      )
    }

    const caller = payload.sub
    const supabase = await createClient()

    // Check uniqueness (case-insensitive), excluding the caller's own row
    const { data: existing } = await supabase
      .from("treasure_hunt_users")
      .select("wallet_address")
      .ilike("unicorn_handle", username)
      .neq("wallet_address", caller)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 })
    }

    const { error: upsertError } = await supabase
      .from("treasure_hunt_users")
      .upsert(
        { wallet_address: caller, unicorn_handle: username as string },
        { onConflict: "wallet_address" },
      )

    if (upsertError) {
      if (upsertError.code === "23505") {
        return NextResponse.json({ error: "Username already taken" }, { status: 409 })
      }
      throw upsertError
    }

    // Carry the name on the passport too, so other editions show it. After the
    // response: an Arkiv write takes a block or two and the name is already saved.
    after(() =>
      setHandle(caller.toLowerCase(), username).catch((e) => console.error("passport handle update failed:", e)),
    )

    return NextResponse.json({ success: true, handle: username })
  } catch (error) {
    console.error("[set-username] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
