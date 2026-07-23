import { createClient } from "@supabase/supabase-js"

/**
 * Cookieless Supabase client for use in cron jobs and other non-request contexts.
 * Uses the anon key directly (no RLS on sync tables).
 */
export function createAdminClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { global: { fetch: (url, init) => fetch(url, { ...init, cache: "no-store" }) } },
  )
}
