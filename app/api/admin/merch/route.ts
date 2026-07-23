import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth"
import { deleteStorageImage } from "@/lib/supabase/delete-storage-image"
import { getClaimedCounts } from "@/lib/merch-claims"

const CATEGORY_MAX_LENGTH = 60

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.success) return auth.response

  try {
    const supabase = await createClient()
    const { data: merch, error } = await supabase
      .from("merch")
      .select("*")

    if (error) throw error

    const claimed = await getClaimedCounts()

    // Sort client-side: price is stored as VARCHAR, so Supabase .order()
    // sorts lexicographically ("11337" < "2000"). Parse as numbers instead.
    const sorted = (merch || [])
      .map((m) => ({
        ...m,
        category: m.category || "",
        focal: m.focal || "50% 50%",
        fit: !!m.fit,
        claimed: claimed.get(String(m.id)) || 0,
      }))
      .sort((a, b) => {
        const priceDiff = Number(a.price) - Number(b.price)
        if (priceDiff !== 0) return priceDiff
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

    return NextResponse.json({ merch: sorted }, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.error("Error fetching merch:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function normalizeMerchPayload(
  input: Record<string, unknown>,
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const out: Record<string, unknown> = {}
  if (typeof input.name === "string") out.name = input.name
  if ("description" in input) out.description = input.description ?? null
  if (typeof input.price === "string" || typeof input.price === "number") out.price = String(input.price)
  if ("image" in input) out.image = input.image ?? null
  if (typeof input.is_active === "boolean") out.is_active = input.is_active
  if ("category" in input) {
    const raw = input.category
    if (raw === null || raw === undefined) {
      out.category = null
    } else if (typeof raw === "string") {
      const trimmed = raw.trim()
      if (trimmed.length > CATEGORY_MAX_LENGTH) {
        return { ok: false, error: `Category must be ${CATEGORY_MAX_LENGTH} characters or fewer` }
      }
      out.category = trimmed === "" ? null : trimmed
    } else {
      return { ok: false, error: "Category must be a string" }
    }
  }
  if ("stock" in input) {
    const v = input.stock
    out.stock = v === null || v === "" || v === undefined ? null : Number(v)
  }
  if (typeof input.focal === "string" && /^\d{1,3}%\s+\d{1,3}%$/.test(input.focal)) {
    out.focal = input.focal
  }
  if (typeof input.fit === "boolean") out.fit = input.fit
  return { ok: true, value: out }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.success) return auth.response

  try {
    const body = await request.json()
    const supabase = await createClient()
    const result = normalizeMerchPayload(body)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    const normalized = result.value

    if (!normalized.name || !normalized.price) {
      return NextResponse.json({ error: "Name and price required" }, { status: 400 })
    }

    const { data: merch, error } = await supabase
      .from("merch")
      .insert({
        ...normalized,
        is_active: typeof normalized.is_active === "boolean" ? normalized.is_active : true,
        category: "category" in normalized ? normalized.category : null,
        focal: normalized.focal ?? "50% 50%",
        fit: typeof normalized.fit === "boolean" ? normalized.fit : false,
        created_at: new Date(),
      })
      .select()

    if (error) throw error

    return NextResponse.json({ merch: merch?.[0], success: true })
  } catch (error) {
    console.error("Error creating merch:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.success) return auth.response

  try {
    const body = await request.json()
    const id = body.id
    const supabase = await createClient()
    const result = normalizeMerchPayload(body)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    const normalized = result.value

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 })
    }

    if ("image" in normalized) {
      const { data: existing } = await supabase.from("merch").select("image").eq("id", id).single()
      if (existing?.image && existing.image !== normalized.image) {
        await deleteStorageImage(supabase, existing.image)
      }
    }

    const { data: merch, error } = await supabase
      .from("merch")
      .update(normalized)
      .eq("id", id)
      .select()

    if (error) throw error

    return NextResponse.json({ merch: merch?.[0], success: true })
  } catch (error) {
    console.error("Error updating merch:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.success) return auth.response

  try {
    const { id, is_active } = await request.json()

    if (!id || typeof is_active !== "boolean") {
      return NextResponse.json({ error: "ID and is_active (boolean) required" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: merch, error } = await supabase
      .from("merch")
      .update({ is_active })
      .eq("id", id)
      .select()

    if (error) throw error

    return NextResponse.json({ merch: merch?.[0], success: true })
  } catch (error) {
    console.error("Error toggling merch:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.success) return auth.response

  try {
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Delete associated image from storage
    const { data: existing } = await supabase.from("merch").select("image").eq("id", id).single()
    if (existing?.image) {
      await deleteStorageImage(supabase, existing.image)
    }

    const { error } = await supabase.from("merch").delete().eq("id", id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting merch:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
