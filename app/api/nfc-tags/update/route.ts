import { type NextRequest, NextResponse } from "next/server"
import { getAuthPayload } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

// PUT: Update NFC tag details (owner only)
export async function PUT(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request)
    if (!payload) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const walletAddress = payload.sub.toLowerCase()
    const { tagId, name, hint, status, location_x, location_y } = await request.json()

    if (!tagId) {
      return NextResponse.json({ error: "Tag ID is required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Verify ownership
    const { data: existing } = await supabase
      .from("nfc_tags")
      .select("owner_address, status")
      .eq("id", tagId)
      .single()

    if (!existing || existing.owner_address !== walletAddress) {
      return NextResponse.json({ error: "Not authorized to update this tag" }, { status: 403 })
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name?.trim() || null
    if (hint !== undefined) updateData.hint = hint?.trim() || null
    if (location_x !== undefined) updateData.location_x = location_x
    if (location_y !== undefined) updateData.location_y = location_y

    // Status transitions: registered <-> hidden only
    if (status !== undefined && ["registered", "hidden"].includes(status)) {
      // Require name and location before allowing hidden status
      if (status === "hidden") {
        const { data: fullTag } = await supabase.from("nfc_tags").select("name, location_x, location_y").eq("id", tagId).single()
        const effectiveName = name !== undefined ? name : fullTag?.name
        const effectiveLocX = location_x !== undefined ? location_x : fullTag?.location_x
        const effectiveLocY = location_y !== undefined ? location_y : fullTag?.location_y

        if (!effectiveName || effectiveLocX == null || effectiveLocY == null) {
          return NextResponse.json({ error: "Name and location are required before marking as ready to be found" }, { status: 400 })
        }
      }
      updateData.status = status
    }

    const { data, error } = await supabase
      .from("nfc_tags")
      .update(updateData)
      .eq("id", tagId)
      .select()
      .single()

    if (error) {
      console.error("Error updating NFC tag:", error)
      return NextResponse.json({ error: "Failed to update tag" }, { status: 500 })
    }

    return NextResponse.json({ success: true, tag: data })
  } catch (error) {
    console.error("Error in nfc-tags update:", error)
    return NextResponse.json({ error: "Failed to update tag" }, { status: 500 })
  }
}
