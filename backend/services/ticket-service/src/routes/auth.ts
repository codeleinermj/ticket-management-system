import { Hono } from "hono";
import { userRepository } from "../repositories/user.repository";
import { ConflictError, UnauthorizedError } from "@repo/shared";
import { config } from "../config";

export const authRoutes = new Hono();

// Register
authRoutes.post("/register", async (c) => {
  const body = await c.req.json();

  const existing = await userRepository.findByEmail(body.email);
  if (existing) {
    throw new ConflictError("Email already registered");
  }

  const hashedPassword = await Bun.password.hash(body.password, {
    algorithm: "argon2id",
    memoryCost: 65536,
    timeCost: 3,
  });

  const user = await userRepository.create({
    ...body,
    password: hashedPassword,
  });

  return c.json({ success: true, data: user }, 201);
});

// Login
authRoutes.post("/login", async (c) => {
  const { email, password } = await c.req.json();

  const user = await userRepository.findByEmail(email);
  if (!user) {
    throw new UnauthorizedError("Invalid credentials");
  }

  const valid = await Bun.password.verify(password, user.password);
  if (!valid) {
    throw new UnauthorizedError("Invalid credentials");
  }

  const accessToken = await signJwt(
    { sub: user.id, email: user.email, role: user.role },
    config.JWT_SECRET,
    900
  );

  const refreshToken = await signJwt(
    { sub: user.id },
    config.JWT_REFRESH_SECRET,
    604800
  );

  await userRepository.updateRefreshToken(user.id, refreshToken);

  // Return user data (without sensitive fields) along with tokens
  const { password: _, refreshToken: _rt, ...userWithoutPassword } = user;
  return c.json({
    accessToken,
    refreshToken,
    user: userWithoutPassword,
  });
});

// Get current user from JWT
authRoutes.get("/me", async (c) => {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    throw new UnauthorizedError("Not authenticated");
  }

  const payload = await verifyJwt(token, config.JWT_SECRET);
  const user = await userRepository.findById(payload.sub);

  if (!user) {
    throw new UnauthorizedError("User not found");
  }

  return c.json({ success: true, data: user });
});

// Refresh token
authRoutes.post("/refresh", async (c) => {
  const { refreshToken } = await c.req.json();

  try {
    const payload = await verifyJwt(refreshToken, config.JWT_REFRESH_SECRET);

    const user = await userRepository.findByIdWithToken(payload.sub);
    if (!user) {
      throw new UnauthorizedError("User not found");
    }

    if (user.refreshToken !== refreshToken) {
      throw new UnauthorizedError("Refresh token revoked");
    }

    const accessToken = await signJwt(
      { sub: user.id, email: user.email, role: user.role },
      config.JWT_SECRET,
      900
    );

    // Rotate refresh token
    const newRefreshToken = await signJwt(
      { sub: user.id },
      config.JWT_REFRESH_SECRET,
      604800
    );

    await userRepository.updateRefreshToken(user.id, newRefreshToken);

    return c.json({ accessToken, refreshToken: newRefreshToken });
  } catch {
    throw new UnauthorizedError("Invalid refresh token");
  }
});

// JWT helpers using Web Crypto API
async function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  expiresIn: number
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresIn };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
  );

  const encodedSignature = base64UrlEncode(
    String.fromCharCode(...new Uint8Array(signature))
  );

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

async function verifyJwt(token: string, secret: string): Promise<any> {
  const [headerB64, payloadB64, signatureB64] = token.split(".");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sig = Uint8Array.from(
    atob(signatureB64.replace(/-/g, "+").replace(/_/g, "/")),
    (ch) => ch.charCodeAt(0)
  );

  const valid = await crypto.subtle.verify("HMAC", key, sig, data);
  if (!valid) throw new Error("Invalid signature");

  const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }

  return payload;
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
