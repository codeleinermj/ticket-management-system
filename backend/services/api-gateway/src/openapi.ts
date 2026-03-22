export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Ticket Gestion API",
    version: "1.0.0",
    description: "AI-First Support Ticket System",
  },
  servers: [
    { url: "http://localhost:3000", description: "Development" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "Health check",
        responses: {
          200: { description: "Service is healthy" },
        },
      },
    },
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password", "name"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                  name: { type: "string", minLength: 2 },
                  role: { type: "string", enum: ["ADMIN", "AGENT", "USER"] },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "User created" },
          400: { description: "Validation error" },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login and receive tokens via HttpOnly cookies",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Login successful" },
          401: { description: "Invalid credentials" },
        },
      },
    },
    "/api/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Refresh access token",
        responses: {
          200: { description: "Token refreshed" },
          401: { description: "Invalid refresh token" },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout and clear cookies",
        responses: {
          200: { description: "Logged out" },
        },
      },
    },
    "/api/tickets": {
      get: {
        tags: ["Tickets"],
        summary: "List tickets with pagination",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          200: { description: "List of tickets" },
        },
      },
      post: {
        tags: ["Tickets"],
        summary: "Create a new ticket",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "description"],
                properties: {
                  title: { type: "string", minLength: 3, maxLength: 200 },
                  description: { type: "string", minLength: 10, maxLength: 5000 },
                  priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
                  category: { type: "string", enum: ["BUG", "FEATURE_REQUEST", "SUPPORT", "BILLING", "OTHER"] },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Ticket created" },
          400: { description: "Validation error" },
        },
      },
    },
    "/api/tickets/{id}": {
      get: {
        tags: ["Tickets"],
        summary: "Get a ticket by ID",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Ticket details" },
          404: { description: "Ticket not found" },
        },
      },
      patch: {
        tags: ["Tickets"],
        summary: "Update a ticket",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  status: { type: "string", enum: ["OPEN", "IN_PROGRESS", "PENDING_MANUAL_REVIEW", "RESOLVED", "CLOSED"] },
                  priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
                  category: { type: "string", enum: ["BUG", "FEATURE_REQUEST", "SUPPORT", "BILLING", "OTHER"] },
                  assignedToId: { type: "string", format: "uuid" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Ticket updated" },
        },
      },
      delete: {
        tags: ["Tickets"],
        summary: "Delete a ticket (admin only)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Ticket deleted" },
          403: { description: "Insufficient permissions" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
};
