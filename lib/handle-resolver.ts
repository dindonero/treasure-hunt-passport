import { createClient } from "@/lib/supabase/server"

/**
 * DB batch resolution of handles. Checks the treasure_hunt_users table
 * for user handles (custom usernames) by wallet_address.
 * Returns a Map<lowercaseAddress, handle | null>.
 */
export async function resolveHandlesFromDB(
  addresses: string[]
): Promise<Map<string, string | null>> {
  const lower = [...new Set(addresses.map((a) => a.toLowerCase()))]
  const map = new Map<string, string | null>()

  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from("treasure_hunt_users")
      .select("wallet_address, unicorn_handle")
      .in("wallet_address", lower)
      .not("unicorn_handle", "is", null)

    for (const row of data || []) {
      map.set(row.wallet_address, row.unicorn_handle)
    }
  } catch (err) {
    console.error("[handle-resolver] DB batch lookup failed:", err)
  }

  return map
}
