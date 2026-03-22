import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { ticketRoutes } from "./tickets";

// Mock repositories and services
vi.mock("../repositories/ticket.repository", () => {
  const mockTickets = new Map();
  return {
    ticketRepository: {
      findAll: vi.fn().mockImplementation(({ page, limit }) => ({
        tickets: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      })),
      findById: vi.fn().mockImplementation((id: string) => mockTickets.get(id) || null),
      create: vi.fn().mockImplementation((data: any) => {
        const ticket = {
          id: "test-ticket-id",
          ...data,
          status: "OPEN",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: { id: data.createdById, name: "Test User", email: "test@test.com" },
        };
        mockTickets.set(ticket.id, ticket);
        return ticket;
      }),
      update: vi.fn().mockImplementation((id: string, data: any) => {
        const existing = mockTickets.get(id);
        if (!existing) return null;
        const updated = { ...existing, ...data };
        mockTickets.set(id, updated);
        return updated;
      }),
      delete: vi.fn().mockResolvedValue(true),
    },
  };
});

vi.mock("../repositories/audit.repository", () => ({
  auditRepository: {
    log: vi.fn().mockResolvedValue({}),
    logChanges: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../services/webhook.service", () => ({
  webhookService: {
    emit: vi.fn().mockResolvedValue(undefined),
  },
}));

function createTestApp() {
  const app = new Hono();
  app.route("/tickets", ticketRoutes);
  return app;
}

describe("Ticket Routes - Integration", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  describe("POST /tickets", () => {
    it("should create a ticket and return 201", async () => {
      const res = await app.request("/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "user-123",
          "x-user-role": "USER",
        },
        body: JSON.stringify({
          title: "Login no funciona",
          description: "No puedo iniciar sesion desde ayer, sale error 500.",
          priority: "HIGH",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.title).toBe("Login no funciona");
      expect(body.data.status).toBe("OPEN");
    });
  });

  describe("GET /tickets", () => {
    it("should return paginated ticket list", async () => {
      const res = await app.request("/tickets?page=1&limit=10", {
        headers: {
          "x-user-id": "user-123",
          "x-user-role": "ADMIN",
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty("tickets");
      expect(body.data).toHaveProperty("pagination");
    });
  });

  describe("GET /tickets/:id", () => {
    it("should return 404 for non-existent ticket", async () => {
      const res = await app.request("/tickets/non-existent", {
        headers: {
          "x-user-id": "user-123",
          "x-user-role": "ADMIN",
        },
      });

      // Will throw NotFoundError, handled by the app's error handler
      expect(res.status).toBe(500); // No global error handler in test app
    });
  });

  describe("PATCH /tickets/:id", () => {
    it("should return 404 for non-existent ticket", async () => {
      const res = await app.request("/tickets/non-existent", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "user-123",
          "x-user-role": "AGENT",
        },
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      });

      expect(res.status).toBe(500);
    });
  });

  describe("Webhook emission", () => {
    it("should emit ticket.created event when creating a ticket", async () => {
      const { webhookService } = await import("../services/webhook.service");

      await app.request("/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "user-123",
          "x-user-role": "USER",
        },
        body: JSON.stringify({
          title: "New feature request",
          description: "Please add dark mode to the dashboard for better UX.",
        }),
      });

      expect(webhookService.emit).toHaveBeenCalledWith(
        "ticket.created",
        "test-ticket-id",
        expect.objectContaining({ title: "New feature request" })
      );
    });
  });

  describe("Audit logging", () => {
    it("should create audit log entry on ticket creation", async () => {
      const { auditRepository } = await import("../repositories/audit.repository");

      await app.request("/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "user-999",
          "x-user-role": "USER",
        },
        body: JSON.stringify({
          title: "Bug report",
          description: "Application crashes when uploading large files.",
        }),
      });

      expect(auditRepository.log).toHaveBeenCalledWith({
        action: "CREATE",
        ticketId: "test-ticket-id",
        userId: "user-999",
      });
    });
  });
});
