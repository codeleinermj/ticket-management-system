import { Hono } from "hono";
import {
  RegisterUserSchema, LoginSchema,
  UpdateProfileSchema, ChangePasswordSchema,
  ForgotPasswordSchema, ResetPasswordSchema,
} from "@repo/shared";
import { authGuard } from "../middleware/auth";
import { config } from "../config";

export const authRoutes = new Hono();

function cookieOpts(isProduction: boolean) {
  return isProduction ? "; Secure" : "";
}

// Register
authRoutes.post("/register", async (c) => {
  const body = await c.req.json();
  const validated = RegisterUserSchema.parse(body);

  const res = await fetch(`${config.TICKET_SERVICE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validated),
  });

  const data = await res.json() as Record<string, unknown>;
  return c.json(data, res.status as 200);
});

// Login — frontend expects { success, data: { user } } + cookies
authRoutes.post("/login", async (c) => {
  const body = await c.req.json();
  const validated = LoginSchema.parse(body);

  const res = await fetch(`${config.TICKET_SERVICE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validated),
  });

  if (!res.ok) {
    const err = await res.json();
    return c.json(err, res.status as 401);
  }

  const data = (await res.json()) as Record<string, unknown>;
  const secure = cookieOpts(config.NODE_ENV === "production");

  // Set cookies matching frontend middleware names: accessToken, refreshToken
  // Must use { append: true } so both Set-Cookie headers are sent
  c.header(
    "Set-Cookie",
    `accessToken=${data.accessToken}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=900`,
    { append: true }
  );
  c.header(
    "Set-Cookie",
    `refreshToken=${data.refreshToken}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=604800`,
    { append: true }
  );

  return c.json({
    success: true,
    data: { user: data.user },
  });
});

// Refresh token
authRoutes.post("/refresh", async (c) => {
  const refreshToken = c.req.header("Cookie")?.match(/refreshToken=([^;]+)/)?.[1];

  if (!refreshToken) {
    return c.json({ success: false, error: "Refresh token required" }, 401);
  }

  const res = await fetch(`${config.TICKET_SERVICE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    const err = await res.json();
    return c.json(err, res.status as 401);
  }

  const data = (await res.json()) as Record<string, unknown>;
  const secure = cookieOpts(config.NODE_ENV === "production");

  c.header(
    "Set-Cookie",
    `accessToken=${data.accessToken}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=900`,
    { append: true }
  );

  // Rotate refresh token if provided
  if (data.refreshToken) {
    c.header(
      "Set-Cookie",
      `refreshToken=${data.refreshToken}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=604800`,
      { append: true }
    );
  }

  return c.json({ success: true, data: { accessToken: data.accessToken } });
});

// Get current user
authRoutes.get("/me", async (c) => {
  const accessToken = c.req.header("Cookie")?.match(/accessToken=([^;]+)/)?.[1];
  const authHeader = c.req.header("Authorization");

  const token = authHeader?.replace("Bearer ", "") || accessToken;

  if (!token) {
    return c.json({ success: false, error: "Not authenticated" }, 401);
  }

  const res = await fetch(`${config.TICKET_SERVICE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    return c.json({ success: false, error: "Not authenticated" }, 401);
  }

  const data = await res.json();
  return c.json(data);
});

// Logout
authRoutes.post("/logout", (c) => {
  c.header("Set-Cookie", "accessToken=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0", { append: true });
  c.header("Set-Cookie", "refreshToken=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0", { append: true });
  return c.json({ success: true, data: null });
});

// Update profile (authenticated)
authRoutes.patch("/profile", authGuard(), async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const validated = UpdateProfileSchema.parse(body);

  const res = await fetch(`${config.TICKET_SERVICE_URL}/auth/profile`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": user.sub,
    },
    body: JSON.stringify(validated),
  });
  return c.json(await res.json(), res.status as 200);
});

// Change password (authenticated)
authRoutes.patch("/password", authGuard(), async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const validated = ChangePasswordSchema.parse(body);

  const res = await fetch(`${config.TICKET_SERVICE_URL}/auth/password`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": user.sub,
    },
    body: JSON.stringify(validated),
  });

  if (!res.ok) {
    const err = await res.json();
    return c.json(err, res.status as 400);
  }

  // Clear cookies to force re-login
  c.header("Set-Cookie", "accessToken=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0", { append: true });
  c.header("Set-Cookie", "refreshToken=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0", { append: true });
  return c.json(await res.json());
});

// Forgot password (public)
authRoutes.post("/forgot-password", async (c) => {
  const body = await c.req.json();
  const validated = ForgotPasswordSchema.parse(body);

  const res = await fetch(`${config.TICKET_SERVICE_URL}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validated),
  });
  return c.json(await res.json(), res.status as 200);
});

// Reset password (public)
authRoutes.post("/reset-password", async (c) => {
  const body = await c.req.json();
  const validated = ResetPasswordSchema.parse(body);

  const res = await fetch(`${config.TICKET_SERVICE_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validated),
  });
  return c.json(await res.json(), res.status as 200);
});

// Verify email (public)
authRoutes.get("/verify-email", async (c) => {
  const token = c.req.query("token");
  const res = await fetch(`${config.TICKET_SERVICE_URL}/auth/verify-email?token=${token}`);
  return c.json(await res.json(), res.status as 200);
});

// Resend verification (authenticated)
authRoutes.post("/resend-verification", authGuard(), async (c) => {
  const user = c.get("user");
  const res = await fetch(`${config.TICKET_SERVICE_URL}/auth/resend-verification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": user.sub,
    },
  });
  return c.json(await res.json(), res.status as 200);
});
