/** @type {import('next').NextConfig} */

// Images are served same-origin from /api/images/[...key] (Neon-backed
// storage_objects), so no remote image hosts are needed.
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: false,
  },
}

export default nextConfig
