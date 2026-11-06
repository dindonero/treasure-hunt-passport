// Request-scoped data client. This deployment runs on Neon (Postgres), not
// Supabase — `createClient()` returns the Neon-backed, supabase-compatible
// client so existing call sites (`await createClient()` then `.from()...`)
// keep working unchanged. No cookies are needed: auth is our own JWT
// (lib/auth.ts), and the Neon client is stateless.
import { createNeonClient, type NeonClient } from "@/lib/db"

export async function createClient(): Promise<NeonClient> {
  return createNeonClient()
}
