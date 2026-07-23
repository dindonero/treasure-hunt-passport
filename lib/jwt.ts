// lib/jwt.ts
import { SignJWT, jwtVerify } from "jose"

const secret = process.env.JWT_SECRET
if (!secret) {
  // Fail fast so we don't mint unverifiable tokens in any environment
  throw new Error("Missing JWT_SECRET environment variable")
}
const key = new TextEncoder().encode(secret)

export type TokenPayload = {
  sub: string          // wallet address (lowercased)
  role: "user" | "admin"
}

export async function createToken(payload: TokenPayload, exp: string = "24h") {
  return new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(payload.sub)
      .setExpirationTime(exp)
      .sign(key)
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key)
    const sub = (payload.sub || "").toLowerCase()
    const role = payload.role as TokenPayload["role"]
    if (!sub || (role !== "user" && role !== "admin")) return null
    return { sub, role }
  } catch {
    return null
  }
}
