// lib/image-compress.ts — single client-side image pipeline.
//
// Used by every authed upload path (admin asset uploads, player report
// photos). Phone-camera shots are routinely 3-8 MB, and the /api/upload
// route + the Supabase `images` bucket both cap at 1 MB, so unprocessed
// uploads silently fail. Run every File through this before posting it.
//
// Also normalises the output mime: the server only accepts
// jpeg/png/webp/gif, but iPhones default to HEIC which would be rejected
// even at 200 KB. Anything outside the allowed list is re-encoded to JPEG.

const DEFAULT_MAX_DIMENSION = 1600
const DEFAULT_MAX_BYTES = 900 * 1024 // leave headroom under the 1 MB cap

const SERVER_ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
])

export interface CompressOptions {
  maxDimension?: number
  maxBytes?: number
}

export class UnsupportedImageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UnsupportedImageError"
  }
}

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  const maxDim = opts.maxDimension ?? DEFAULT_MAX_DIMENSION
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES

  // Animated GIFs would lose animation if re-encoded; pass through if small
  // enough, reject otherwise (we can't shrink them without losing frames).
  if (file.type === "image/gif") {
    if (file.size <= maxBytes) return file
    throw new UnsupportedImageError(
      "Animated GIF is too large to upload (max 1 MB). Please use a smaller GIF.",
    )
  }

  // Fast-path: already a server-allowed type AND already under the cap.
  if (file.size <= maxBytes && SERVER_ALLOWED_TYPES.has(file.type)) {
    return file
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await loadBitmap(file)
  } catch {
    throw new UnsupportedImageError(
      "This image format isn't supported by your browser (HEIC photos from iPhone are common). Please pick a JPEG or PNG.",
    )
  }

  const { width, height } = fit(bitmap.width, bitmap.height, maxDim)

  let quality = 0.85
  let blob = await draw(bitmap, width, height, quality)

  while (blob.size > maxBytes && quality > 0.5) {
    quality -= 0.1
    blob = await draw(bitmap, width, height, quality)
  }

  let scaledW = width
  let scaledH = height
  while (blob.size > maxBytes && Math.max(scaledW, scaledH) > 600) {
    scaledW = Math.round(scaledW * 0.8)
    scaledH = Math.round(scaledH * 0.8)
    blob = await draw(bitmap, scaledW, scaledH, 0.7)
  }

  bitmap.close?.()

  if (blob.size > maxBytes) {
    throw new UnsupportedImageError(
      "Couldn't compress this photo under 1 MB. Please try a different image.",
    )
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "photo"
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" })
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === "function") {
    return await createImageBitmap(file)
  }
  // Older Safari fallback
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = url
    })
    const canvas = document.createElement("canvas")
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    canvas.getContext("2d")!.drawImage(img, 0, 0)
    return (await createImageBitmap(canvas)) as ImageBitmap
  } finally {
    URL.revokeObjectURL(url)
  }
}

function fit(srcW: number, srcH: number, maxDim: number) {
  if (srcW <= maxDim && srcH <= maxDim) return { width: srcW, height: srcH }
  const ratio = srcW > srcH ? maxDim / srcW : maxDim / srcH
  return { width: Math.round(srcW * ratio), height: Math.round(srcH * ratio) }
}

async function draw(bitmap: ImageBitmap, w: number, h: number, quality: number): Promise<Blob> {
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement("canvas"), { width: w, height: h })
  const ctx = (canvas as HTMLCanvasElement | OffscreenCanvas).getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null
  if (!ctx) throw new Error("Canvas 2D context unavailable")
  ctx.drawImage(bitmap, 0, 0, w, h)
  if (canvas instanceof OffscreenCanvas) {
    return await canvas.convertToBlob({ type: "image/jpeg", quality })
  }
  return await new Promise<Blob>((resolve, reject) => {
    ;(canvas as HTMLCanvasElement).toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
      "image/jpeg",
      quality,
    )
  })
}

/**
 * One-shot helper used by every upload UI. Compresses + POSTs to /api/upload
 * and returns the public URL. Throws on failure with a user-readable message.
 */
export async function uploadImage(file: File, opts: CompressOptions = {}): Promise<string> {
  if (!file.type.startsWith("image/") && file.type !== "") {
    throw new UnsupportedImageError("Please pick an image file.")
  }
  const compressed = await compressImage(file, opts)
  const fd = new FormData()
  fd.append("file", compressed)
  const res = await fetch("/api/upload", {
    method: "POST",
    credentials: "include",
    body: fd,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.error || `Upload failed (${res.status})`)
  }
  const data = await res.json()
  if (!data?.url) throw new Error("Upload returned no URL")
  return data.url as string
}
