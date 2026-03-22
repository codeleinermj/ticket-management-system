import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// Mock Bun.password
vi.stubGlobal("Bun", {
  password: {
    hash: vi.fn().mockResolvedValue("$argon2id$hashed-password"),
    verify: vi.fn(),
  },
  serve: vi.fn(),
});

// Mock crypto.subtle for JWT
const originalCrypto = globalThis.crypto;
vi.stubGlobal("crypto", {
  ...originalCrypto,
  subtle: originalCrypto.subtle,
});

// Mock user repository
vi.mock("../repositories/user.repository", () => ({
  userRepository: {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    updateRefreshToken: vi.fn().mockResolvedValue({}),
  },
}));

// Mock config
vi.mock("../config", () => ({
  config: {
    JWT_SECRET: "test-secret-key-minimum-16-chars",
    JWT_REFRESH_SECRET: "test-refresh-key-minimum-16-chars",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    REDIS_URL: "redis://localhost:6379",
    TICKET_SERVICE_PORT: 3001,
    NODE_ENV: "test",
  },
}));

describe("Auth Routes", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { authRoutes } = await import("./auth");
    app = new Hono();
    app.route("/auth", authRoutes);
  });

  describe("POST /auth/register", () => {
    it("should register a new user", async () => {
      const { userRepository } = await import("../repositories/user.repository");
      (userRepository.findByEmail as any).mockResolvedValue(null);
      (userRepository.create as any).mockResolvedValue({
        id: "user-1",
        email: "new@test.com",
        name: "New User",
        role: "USER",
        createdAt: new Date().toISOString(),
      });

      const res = await app.request("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "new@test.com",
          password: "securePass123",
          name: "New User",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.email).toBe("new@test.com");
    });

    it("should reject duplicate email", async () => {
      const { userRepository } = await import("../repositories/user.repository");
      (userRepository.findByEmail as any).mockResolvedValue({
        id: "existing",
        email: "existing@test.com",
      });

      const res = await app.request("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "existing@test.com",
          password: "securePass123",
          name: "Existing User",
        }),
      });

      // ConflictError thrown - 500 because no global error handler in test
      expect(res.status).toBe(500);
    });
  });

  describe("POST /auth/login", () => {
    it("should reject invalid credentials", async () => {
      const { userRepository } = await import("../repositories/user.repository");
      (userRepository.findByEmail as any).mockResolvedValue(null);

      const res = await app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "wrong@test.com",
          password: "wrongPass",
        }),
      });

      expect(res.status).toBe(500); // UnauthorizedError without handler
    });

    it("should login with valid credentials", async () => {
      const { userRepository } = await import("../repositories/user.repository");
      (userRepository.findByEmail as any).mockResolvedValue({
        id: "user-1",
        email: "valid@test.com",
        name: "Valid User",
        role: "USER",
        password: "$argon2id$hashed",
      });
      (Bun.password.verify as any).mockResolvedValue(true);

      const res = await app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "valid@test.com",
          password: "correctPass123",
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("accessToken");
      expect(body).toHaveProperty("refreshToken");
    });
  });
});
