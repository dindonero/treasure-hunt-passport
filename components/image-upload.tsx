"use client"

import { useState, useRef } from "react"
import { Upload, X, Loader2, ImageIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { uploadImage, UnsupportedImageError } from "@/lib/image-compress"

interface ImageUploadProps {
  value: string
  onChange: (url: string) => void
  className?: string
}

const MAX_INPUT_BYTES = 25 * 1024 * 1024 // hard cap before compression

export default function ImageUpload({ value, onChange, className }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file")
      return
    }
    if (file.size > MAX_INPUT_BYTES) {
      setError("File too large (max 25MB before compression)")
      return
    }

    setUploading(true)
    setError("")
    try {
      const url = await uploadImage(file)
      onChange(url)
    } catch (err) {
      console.error("Upload error:", err)
      const msg =
        err instanceof UnsupportedImageError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Upload failed. Please try again."
      setError(msg)
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleRemove = () => {
    onChange("")
    setError("")
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className={className}>
      {value ? (
        <div className="relative group">
          <img
            src={value}
            alt="Uploaded"
            className="w-full h-40 object-cover rounded-lg border border-white/10"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-red-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          className={`
            flex flex-col items-center justify-center gap-2 h-32 rounded-lg border-2 border-dashed
            cursor-pointer transition-colors
            ${dragOver
              ? "border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10"
              : "border-white/20 hover:border-white/40 bg-[var(--bg-secondary)]"
            }
            ${uploading ? "pointer-events-none opacity-60" : ""}
          `}
        >
          {uploading ? (
            <>
              <Loader2 className="w-6 h-6 text-[var(--neon-cyan)] animate-spin" />
              <span className="text-xs text-[var(--text-muted)]">Uploading...</span>
            </>
          ) : (
            <>
              <Upload className="w-6 h-6 text-[var(--text-muted)]" />
              <span className="text-xs text-[var(--text-muted)]">Click or drag image here</span>
              <span className="text-xs text-[var(--text-muted)]">Auto-resized to fit under 1MB</span>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />

      {/* Fallback: paste URL directly */}
      {!value && !uploading && (
        <div className="mt-2 flex items-center gap-2">
          <ImageIcon className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
          <Input
            placeholder="or paste image URL"
            className="bg-[var(--bg-secondary)] border-white/10 text-xs h-8"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                const val = (e.target as HTMLInputElement).value.trim()
                if (val) onChange(val)
              }
            }}
            onBlur={(e) => {
              const val = e.target.value.trim()
              if (val) onChange(val)
            }}
          />
        </div>
      )}

      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  )
}
