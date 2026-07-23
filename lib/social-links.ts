"use client"

import { isMobileBrowser } from "@/lib/platform"

export type SocialPlatform = "twitter" | "x" | "instagram" | "linkedin" | "link" | string
export type SocialActionType = "follow" | "post" | "view" | string

export interface SocialLinkInput {
  platform: SocialPlatform
  action_type: SocialActionType
  handle: string
  profile_url: string
  tweet_template: string | null
}

export interface SocialLinkUrls {
  /** Always-safe https URL (also works as iOS/Android Universal Link / App Link when the app is installed). */
  web: string
  /** Native app deep link, or null when no reliable scheme exists for this platform. */
  app: string | null
}

function isTwitter(platform: string): boolean {
  const p = platform.toLowerCase()
  return p === "twitter" || p === "x"
}

function buildTwitterUrls(input: SocialLinkInput): SocialLinkUrls {
  if (input.action_type === "post") {
    const text = input.tweet_template ?? ""
    const encoded = encodeURIComponent(text)
    return {
      web: `https://twitter.com/intent/tweet?text=${encoded}`,
      app: `twitter://post?message=${encoded}`,
    }
  }
  const handle = encodeURIComponent(input.handle)
  return {
    web: `https://twitter.com/intent/follow?screen_name=${handle}`,
    app: `twitter://user?screen_name=${handle}`,
  }
}

function buildInstagramUrls(input: SocialLinkInput): SocialLinkUrls {
  const handle = input.handle.replace(/^@/, "").trim()
  const web = input.profile_url || (handle ? `https://www.instagram.com/${handle}/` : "")
  const app = handle ? `instagram://user?username=${encodeURIComponent(handle)}` : null
  return { web, app }
}

function buildLinkedInUrls(input: SocialLinkInput): SocialLinkUrls {
  // LinkedIn's https:// URLs are Universal Links (iOS) and App Links (Android),
  // so they already open the native app when installed. The legacy
  // `linkedin://profile/{numericId}` scheme requires numeric IDs we don't have.
  return { web: input.profile_url, app: null }
}

export function buildSocialUrls(input: SocialLinkInput): SocialLinkUrls {
  if (input.action_type === "view") {
    return { web: input.profile_url, app: null }
  }
  if (isTwitter(input.platform)) return buildTwitterUrls(input)
  if (input.platform.toLowerCase() === "instagram") return buildInstagramUrls(input)
  if (input.platform.toLowerCase() === "linkedin") return buildLinkedInUrls(input)
  return { web: input.profile_url, app: null }
}

/**
 * Returns the URL that should be set on an <a href> for this account.
 *
 * On mobile we prefer the native app scheme so the platform app opens
 * directly. On desktop (and when no scheme exists for this platform) we
 * return the https URL — the browser tab is the right surface there.
 */
/**
 * Best-effort display label for a social account card title.
 * Prefers `@handle`; for LinkedIn falls back to the URL's last path
 * segment (e.g. `nova-ims` from `linkedin.com/school/nova-ims`) so the
 * card never reads "No handle" when LinkedIn-only URL is configured.
 */
export function getSocialDisplayLabel(input: Pick<SocialLinkInput, "platform" | "handle" | "profile_url" | "action_type">): string {
  if (input.handle) return `@${input.handle}`
  if (input.action_type === "view") return "View Link"
  const platform = input.platform.toLowerCase()
  if (platform === "linkedin" && input.profile_url) {
    try {
      const u = new URL(input.profile_url)
      const slug = u.pathname.split("/").filter(Boolean).pop()
      if (slug) return slug
    } catch {
      /* malformed URL — fall through */
    }
    return "LinkedIn"
  }
  if (platform === "twitter" || platform === "x") return "Tweet to Earn"
  return platform.charAt(0).toUpperCase() + platform.slice(1)
}

export function getPreferredSocialUrl(input: SocialLinkInput): string {
  const { web, app } = buildSocialUrls(input)
  if (app && isMobileBrowser()) return app
  return web
}

/**
 * Click handler that tries the native app scheme on mobile, then falls
 * back to the https URL if the app didn't open within ~1.5s (signalled
 * by the page remaining visible). On desktop or when there is no app
 * scheme it just opens the web URL in a new tab.
 */
export function openSocialLink(input: SocialLinkInput): void {
  const { web, app } = buildSocialUrls(input)

  if (!app || !isMobileBrowser()) {
    if (web) window.open(web, "_blank", "noopener,noreferrer")
    return
  }

  let fellBack = false
  const fallback = window.setTimeout(() => {
    if (document.visibilityState === "visible" && !fellBack) {
      fellBack = true
      if (web) window.open(web, "_blank", "noopener,noreferrer")
    }
  }, 1500)

  const cancelFallback = () => {
    if (document.visibilityState === "hidden") {
      fellBack = true
      window.clearTimeout(fallback)
      document.removeEventListener("visibilitychange", cancelFallback)
    }
  }
  document.addEventListener("visibilitychange", cancelFallback)

  // Setting location.href (rather than window.open) is what actually
  // triggers the iOS/Android app handler for custom URL schemes.
  window.location.href = app
}
