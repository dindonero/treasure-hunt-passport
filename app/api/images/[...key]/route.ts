import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

// Serves images stored in Neon (the `storage_objects` table), replacing
// Supabase Storage public URLs. Public + immutable-cached: filenames are
// unique (timestamp + random), so a given URL never changes content.
export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params
  const fullKey = (key ?? []).join("/")
  if (!fullKey) return new NextResponse("Not found", { status: 404 })

  try {
    const rows = await query<{ content_type: string; hex: string }>(
      `SELECT content_type, encode(bytes, 'hex') AS hex FROM storage_objects WHERE key = $1`,
      [fullKey],
    )
    if (!rows.length) return new NextResponse("Not found", { status: 404 })

    const buf = Buffer.from(rows[0].hex, "hex")
    return new NextResponse(buf, {
      headers: {
        "Content-Type": rows[0].content_type || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (err) {
    console.error("[/api/images] serve error:", err)
    return new NextResponse("Error", { status: 500 })
  }
}
