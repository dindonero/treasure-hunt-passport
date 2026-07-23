import { type NextRequest, NextResponse } from "next/server"
import { getAuthPayload } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

// GET: List all social accounts (admin only)
export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request)
    if (!payload || payload.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: accounts, error } = await supabase
      .from("social_accounts")
      .select("*")
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error fetching social accounts:", error)
      return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 })
    }

    return NextResponse.json({ success: true, accounts })
  } catch (error) {
    console.error("Error in admin social-accounts GET:", error)
    return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 })
  }
}

// POST: Create a new social account
export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request)
    if (!payload || payload.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { platform, handle, profile_url, token_reward, action_type, tweet_template } = await request.json()

    const isTwitter = platform === "twitter"
    const isPost = isTwitter && action_type === "post"
    const isView = action_type === "view"
    const isLinkedIn = platform === "linkedin"

    if (!platform) {
      return NextResponse.json({ error: "Platform required" }, { status: 400 })
    }
    if (isView && !profile_url) {
      return NextResponse.json({ error: "URL required for view links" }, { status: 400 })
    }
    if (isPost && !tweet_template) {
      return NextResponse.json({ error: "Tweet template required" }, { status: 400 })
    }
    if (isLinkedIn && !profile_url) {
      return NextResponse.json({ error: "Profile URL required for LinkedIn" }, { status: 400 })
    }
    if (!isView && !isPost && !isLinkedIn && !handle) {
      return NextResponse.json({ error: "Handle required" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("social_accounts")
      .insert({
        platform,
        handle: handle || "",
        profile_url: profile_url || "",
        token_reward: token_reward || "1",
        is_active: true,
        action_type: isView ? "view" : (isTwitter ? (action_type || "follow") : "follow"),
        tweet_template: isPost ? tweet_template || null : null,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating social account:", error)
      return NextResponse.json({ error: "Failed to create account" }, { status: 500 })
    }

    return NextResponse.json({ success: true, account: data })
  } catch (error) {
    console.error("Error in admin social-accounts POST:", error)
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 })
  }
}

// PUT: Update a social account
export async function PUT(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request)
    if (!payload || payload.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { id, platform, handle, profile_url, token_reward, is_active, action_type, tweet_template } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "Account ID required" }, { status: 400 })
    }

    const isTwitter = platform === "twitter"
    const isPost = isTwitter && action_type === "post"
    const isView = action_type === "view"
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("social_accounts")
      .update({
        platform,
        handle: handle || "",
        profile_url: profile_url || "",
        token_reward,
        is_active,
        action_type: isView ? "view" : (isTwitter ? (action_type || "follow") : "follow"),
        tweet_template: isPost ? tweet_template || null : null,
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating social account:", error)
      return NextResponse.json({ error: "Failed to update account" }, { status: 500 })
    }

    return NextResponse.json({ success: true, account: data })
  } catch (error) {
    console.error("Error in admin social-accounts PUT:", error)
    return NextResponse.json({ error: "Failed to update account" }, { status: 500 })
  }
}

// DELETE: Deactivate a social account
export async function DELETE(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request)
    if (!payload || payload.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Account ID required" }, { status: 400 })
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from("social_accounts")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Error deleting social account:", error)
      return NextResponse.json({ error: "Failed to delete account" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in admin social-accounts DELETE:", error)
    return NextResponse.json({ error: "Failed to deactivate account" }, { status: 500 })
  }
}
