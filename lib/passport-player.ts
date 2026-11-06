import { createClient } from "@/lib/supabase/server"

/** The player's handle in this edition's database, if they set one. */
export async function playerHandle(player: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("treasure_hunt_users")
    .select("unicorn_handle")
    .eq("wallet_address", player)
    .maybeSingle()
  return data?.unicorn_handle ?? null
}
