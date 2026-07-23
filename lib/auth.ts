// lib/auth.ts
// Centralized authentication utilities for API routes

import { type NextRequest, NextResponse } from "next/server"
import { verifyToken, type TokenPayload } from "./jwt"

export const AUTH_COOKIE_NAME = "jwt_token"
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 // 24 hours

export type AuthResult =
  | { success: true; payload: TokenPayload }
  | { success: false; response: NextResponse }

/**
 * Extracts and verifies JWT from the request.
 * Checks both cookie and Authorization header for backwards compatibility.
 */
export async function getAuthPayload(request: NextRequest): Promise<TokenPayload | null> {
  // First try cookie (preferred)
  const cookieToken = request.cookies.get(AUTH_COOKIE_NAME)?.value
  if (cookieToken) {
    const payload = await verifyToken(cookieToken)
    if (payload) return payload
  }

  // Fallback to Authorization header for backwards compatibility
  const authHeader = request.headers.get("Authorization")
  if (authHeader?.startsWith("Bearer ")) {
    const headerToken = authHeader.slice(7)
    const payload = await verifyToken(headerToken)
    if (payload) return payload
  }

  return null
}

/**
 * Requires admin authentication. Returns the payload if authenticated,
 * or an error response if not.
 */
export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
  const payload = await getAuthPayload(request)

  if (!payload) {
    return {
      success: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  if (payload.role !== "admin") {
    return {
      success: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  return { success: true, payload }
}

/**
 * Requires any authenticated user. Returns the payload if authenticated,
 * or an error response if not.
 */
export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  const payload = await getAuthPayload(request)

  if (!payload) {
    return {
      success: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  return { success: true, payload }
}