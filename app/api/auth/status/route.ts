import { type NextRequest, NextResponse } from "next/server"
import { getAuthPayload, AUTH_COOKIE_NAME } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

// GET auth status from cookie — also returns cached handle from DB
export async function GET(request: NextRequest) {
  const payload = await getAuthPayload(request)

  if (!payload) {
    return NextResponse.json({
      authenticated: false,
      address: null,
      isAdmin: false,
      handle: null,
    })
  }

  let handle: string | null = null
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from("treasure_hunt_users")
      .select("unicorn_handle")
      .eq("wallet_address", payload.sub)
      .single()
    handle = data?.unicorn_handle ?? null
  } catch { /* DB lookup non-fatal */ }

  return NextResponse.json({
    authenticated: true,
    address: payload.sub,
    isAdmin: payload.role === "admin",
    handle,
  })
}

// DELETE to logout (clear cookie)
export async function DELETE() {
  const res = NextResponse.json({ success: true })
  res.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
  return res
}
