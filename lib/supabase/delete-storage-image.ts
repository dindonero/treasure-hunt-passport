import type { DbClient } from "@/lib/db"

const BUCKET = "images"

/**
 * Extracts the storage path from an app image URL and deletes the object.
 * Image URLs are served by `/api/images/<bucket>/<path>` (Neon-backed storage).
 * Silently ignores externally-pasted URLs and any errors.
 */
export async function deleteStorageImage(db: DbClient, imageUrl: string | null | undefined) {
  if (!imageUrl) return

  const marker = `/api/images/${BUCKET}/`
  const idx = imageUrl.indexOf(marker)
  if (idx === -1) return // not one of our stored images

  const filePath = imageUrl.slice(idx + marker.length)
  if (!filePath) return

  const { error } = await db.storage.from(BUCKET).remove([filePath])
  if (error) {
    console.error("Failed to delete storage image:", filePath, error)
  }
}
