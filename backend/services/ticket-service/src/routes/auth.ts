import { Hono } from "hono";
import { userRepository } from "../repositories/user.repository";
import { passwordResetRepository } from "../repositories/password-reset.repository";
import { ConflictError, UnauthorizedError } from "@repo/shared";
import { config } from "../config";
import { emailService } from "../services/email.service";

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

  // Send verification email
  try {
    const verifyToken = crypto.randomUUID();
    const tokenHash = await hashToken(verifyToken);
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await userRepository.setVerificationToken(user.id, tokenHash, expires);
    await emailService.sendVerificationEmail(body.email, body.name, verifyToken);
  } catch {
    // Don't fail registration if email fails
  }

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
  const { password: _, refreshToken: _rt, verificationToken: _vt, verificationExpires: _ve, ...userWithoutPassword } = user;
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
  const user = await userRepository.findByIdFull(payload.sub);

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

// Update profile (name)
authRoutes.patch("/profile", async (c) => {
  const userId = c.req.header("x-user-id")!;
  const { name } = await c.req.json();
  const user = await userRepository.updateName(userId, name);
  return c.json({ success: true, data: user });
});

// Change password
authRoutes.patch("/password", async (c) => {
  const userId = c.req.header("x-user-id")!;
  const { currentPassword, newPassword } = await c.req.json();

  const user = await userRepository.findByIdWithPassword(userId);
  if (!user) throw new UnauthorizedError("User not found");

  const valid = await Bun.password.verify(currentPassword, user.password);
  if (!valid) throw new UnauthorizedError("Current password is incorrect");

  const isSame = await Bun.password.verify(newPassword, user.password);
  if (isSame) {
    return c.json({ success: false, error: "New password must be different" }, 400);
  }

  const hashed = await Bun.password.hash(newPassword, { algorithm: "argon2id", memoryCost: 65536, timeCost: 3 });
  await userRepository.updatePassword(userId, hashed);
  return c.json({ success: true, data: { message: "Password updated" } });
});

// Forgot password
authRoutes.post("/forgot-password", async (c) => {
  const { email } = await c.req.json();

  // Always return success to prevent user enumeration
  const user = await userRepository.findByEmail(email);
  if (user) {
    // Rate limit: max 3 per hour
    const recent = await passwordResetRepository.countRecentByUserId(user.id, 60);
    if (recent < 3) {
      const token = crypto.randomUUID();
      const tokenHash = await hashToken(token);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await passwordResetRepository.create({ tokenHash, userId: user.id, expiresAt });

      try {
        await emailService.sendPasswordResetEmail(email, user.name, token);
      } catch {
        // Silently fail
      }
    }
  }

  return c.json({ success: true, data: { message: "Si el email existe, recibiras un enlace de recuperacion" } });
});

// Reset password
authRoutes.post("/reset-password", async (c) => {
  const { token, newPassword } = await c.req.json();

  const tokenHash = await hashToken(token);
  const reset = await passwordResetRepository.findValidByTokenHash(tokenHash);
  if (!reset) {
    return c.json({ success: false, error: "Token invalido o expirado" }, 400);
  }

  const hashed = await Bun.password.hash(newPassword, { algorithm: "argon2id", memoryCost: 65536, timeCost: 3 });
  await userRepository.updatePassword(reset.userId, hashed);
  await passwordResetRepository.markAsUsed(reset.id);

  return c.json({ success: true, data: { message: "Contrasena actualizada exitosamente" } });
});

// Verify email
authRoutes.get("/verify-email", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.json({ success: false, error: "Token required" }, 400);

  const tokenHash = await hashToken(token);
  const user = await userRepository.findByVerificationToken(tokenHash);
  if (!user) {
    return c.json({ success: false, error: "Token invalido o expirado" }, 400);
  }

  await userRepository.verifyEmail(user.id);
  return c.json({ success: true, data: { message: "Email verificado exitosamente" } });
});

// Resend verification email
authRoutes.post("/resend-verification", async (c) => {
  const userId = c.req.header("x-user-id")!;
  const user = await userRepository.findByIdFull(userId);
  if (!user) throw new UnauthorizedError("User not found");

  if (user.emailVerified) {
    return c.json({ success: false, error: "Email ya esta verificado" }, 400);
  }

  const fullUser = await userRepository.findByEmail(user.email);
  if (!fullUser) throw new UnauthorizedError("User not found");

  const verifyToken = crypto.randomUUID();
  const tokenHash = await hashToken(verifyToken);
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await userRepository.setVerificationToken(user.id, tokenHash, expires);

  try {
    await emailService.sendVerificationEmail(user.email, user.name, verifyToken);
  } catch {
    return c.json({ success: false, error: "Error al enviar correo" }, 500);
  }

  return c.json({ success: true, data: { message: "Correo de verificacion enviado" } });
});

// Token hashing helper
async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

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
