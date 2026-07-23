import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

// GET: List all NFC tags (admin only)
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.success) return auth.response

  try {
    const supabase = await createClient()

    const { data: tags, error } = await supabase
      .from("nfc_tags")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching NFC tags:", error)
      return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 })
    }

    return NextResponse.json({ success: true, tags })
  } catch (error) {
    console.error("Error in admin nfc-tags GET:", error)
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 })
  }
}

// POST: Generate a new blank NFC tag (admin only)
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.success) return auth.response

  try {
    const adminAddress = auth.payload.sub.toLowerCase()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("nfc_tags")
      .insert({
        status: "blank",
        created_by: adminAddress,
        token_reward: "100",
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating NFC tag:", error)
      return NextResponse.json({ error: "Failed to create tag" }, { status: 500 })
    }

    return NextResponse.json({ success: true, tag: data })
  } catch (error) {
    console.error("Error in admin nfc-tags POST:", error)
    return NextResponse.json({ error: "Failed to create tag" }, { status: 500 })
  }
}

// PUT: Update any NFC tag fields (admin only)
export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.success) return auth.response

  try {
    const { id, name, hint, token_reward, status, location_x, location_y, owner_address } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "Tag ID is required" }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name?.trim() || null
    if (hint !== undefined) updateData.hint = hint?.trim() || null
    if (token_reward !== undefined) updateData.token_reward = token_reward
    if (status !== undefined) updateData.status = status
    if (location_x !== undefined) updateData.location_x = location_x
    if (location_y !== undefined) updateData.location_y = location_y
    if (owner_address !== undefined) updateData.owner_address = owner_address?.trim().toLowerCase() || null

    const supabase = await createClient()

    const { data, error } = await supabase
      .from("nfc_tags")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating NFC tag:", error)
      return NextResponse.json({ error: "Failed to update tag" }, { status: 500 })
    }

    return NextResponse.json({ success: true, tag: data })
  } catch (error) {
    console.error("Error in admin nfc-tags PUT:", error)
    return NextResponse.json({ error: "Failed to update tag" }, { status: 500 })
  }
}

// DELETE: Delete an NFC tag (admin only)
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.success) return auth.response

  try {
    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: "Tag ID is required" }, { status: 400 })
    }

    const supabase = await createClient()

    const { error } = await supabase
      .from("nfc_tags")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Error deleting NFC tag:", error)
      return NextResponse.json({ error: "Failed to delete tag" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in admin nfc-tags DELETE:", error)
    return NextResponse.json({ error: "Failed to delete tag" }, { status: 500 })
  }
}
