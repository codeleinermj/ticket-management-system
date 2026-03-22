import type { Context, MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export function authGuard(): MiddlewareHandler {
  return async (c: Context, next) => {
    const authHeader = c.req.header("Authorization");
    const tokenFromCookie = getCookie(c, "accessToken");
    const token = authHeader?.replace("Bearer ", "") || tokenFromCookie;

    if (!token) {
      return c.json({ success: false, error: "Authentication required" }, 401);
    }

    try {
      // Verify JWT using the Web Crypto API (Bun compatible)
      const { config } = await import("../config");
      const payload = await verifyJwt(token, config.JWT_SECRET);
      c.set("user", payload);
      await next();
    } catch {
      return c.json({ success: false, error: "Invalid or expired token" }, 401);
    }
  };
}

export function roleGuard(...roles: string[]): MiddlewareHandler {
  return async (c: Context, next) => {
    const user = c.get("user") as JwtPayload | undefined;
    if (!user || !roles.includes(user.role)) {
      return c.json({ success: false, error: "Insufficient permissions" }, 403);
    }
    await next();
  };
}

// Lightweight JWT verify using HMAC-SHA256 (Bun Web Crypto)
async function verifyJwt(token: string, secret: string): Promise<JwtPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token format");

  const [headerB64, payloadB64, signatureB64] = parts;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlDecode(signatureB64);

  const valid = await crypto.subtle.verify("HMAC", key, signature, data);
  if (!valid) throw new Error("Invalid signature");

  const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"))) as JwtPayload;

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }

  return payload;
}

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
