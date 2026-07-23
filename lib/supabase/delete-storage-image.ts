import type { SupabaseClient } from "@supabase/supabase-js"

const BUCKET = "images"

/**
 * Extracts the storage path from a Supabase public URL and deletes the file.
 * Silently ignores non-Supabase URLs (e.g. pasted external links) and any errors.
 */
export async function deleteStorageImage(supabase: SupabaseClient, imageUrl: string | null | undefined) {
  if (!imageUrl) return

  const marker = `/storage/v1/object/public/${BUCKET}/`
  const idx = imageUrl.indexOf(marker)
  if (idx === -1) return // not a Supabase storage URL

  const filePath = imageUrl.slice(idx + marker.length)
  if (!filePath) return

  const { error } = await supabase.storage.from(BUCKET).remove([filePath])
  if (error) {
    console.error("Failed to delete storage image:", filePath, error)
  }
}
