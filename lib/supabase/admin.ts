import { createNeonClient, type NeonClient } from "@/lib/db"

/**
 * Cookieless data client for cron jobs and other non-request contexts.
 * Backed by Neon (Postgres) via the supabase-compatible client.
 */
export function createAdminClient(): NeonClient {
  return createNeonClient()
}
