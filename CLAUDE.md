# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ticket management system with AI-powered classification. Monorepo with separate `backend/` and `frontend/app/` directories (each has its own package manager root — they are NOT in a single workspace).

## Architecture

### Backend (`backend/`)
pnpm monorepo managed by Turborepo. Three services + one shared package:

- **api-gateway** (`services/api-gateway`) — Public-facing Hono HTTP server + Socket.IO WebSocket server. Runs on Bun (`bun run --watch`). Default port **3000**. Proxies requests to ticket-service, handles auth middleware, rate limiting, CORS, and OpenAPI/Swagger docs at `/docs`.
- **ticket-service** (`services/ticket-service`) — Core business logic. Hono server using `Bun.serve`. Default port **3001**. Owns the Prisma schema (`prisma/schema.prisma`), handles CRUD for tickets/users/audit-logs. Publishes events to Redis pub/sub on ticket creation.
- **ai-worker** (`services/ai-worker`) — Background worker (runs via `tsx watch`). Subscribes to Redis `ticket-events` channel. Uses Strategy pattern for AI classifiers (OpenAI, Gemini, or mock). Auto-classifies tickets with category, priority, and suggested response.
- **shared** (`packages/shared`) — Zod schemas, config validation, and error types shared across services. Built with tsup. Services depend on it via `@repo/shared` (`workspace:*`).

Inter-service communication: api-gateway → ticket-service via HTTP; ticket-service → ai-worker via Redis pub/sub; ai-worker writes results back to PostgreSQL via Prisma.

### Frontend (`frontend/app/`)
Next.js 16 App Router with React 19. Standalone pnpm project (not part of backend workspace).

**Important:** Next.js 16 has breaking changes from earlier versions. Before writing frontend code, read the relevant guide in `frontend/app/node_modules/next/dist/docs/` and heed deprecation notices.

Key stack: Zustand (auth state), TanStack React Query (server state), Socket.IO client (real-time updates), shadcn/ui + Tailwind CSS v4, Zod v4 for validation.

Route groups: `(auth)` for login/register, `(dashboard)` for authenticated pages. Middleware handles auth redirects. Frontend connects to the API gateway via `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3000`).

## Commands

### Backend (run from `backend/`)
```bash
pnpm install                    # Install all dependencies
pnpm docker:up                  # Start PostgreSQL, Redis, MailDev containers
pnpm docker:down                # Stop containers
pnpm dev                        # Start all services via turbo (dev mode)
pnpm build                      # Build all packages/services
pnpm test                       # Run all tests via turbo

# Per-service (from service directory)
cd services/ticket-service
pnpm db:generate                # Generate Prisma client (run after schema changes)
pnpm db:push                    # Push schema to database
pnpm db:migrate                 # Run Prisma migrations
pnpm db:studio                  # Open Prisma Studio
pnpm test                       # vitest run
pnpm test:watch                 # vitest watch mode

cd services/ai-worker
pnpm test                       # vitest run

# Run a single test file (from service directory)
pnpm vitest run src/classifier.test.ts
```

### Frontend (run from `frontend/app/`)
```bash
pnpm install
pnpm dev                        # Next.js dev server (default port 3000, conflicts with api-gateway — use -p to change)
pnpm build                      # Production build
pnpm lint                       # ESLint
```

## Infrastructure

Docker Compose (`backend/docker-compose.yml`) provides:
- PostgreSQL 16 on port **5433** (note: non-standard, maps 5433→5432 inside container)
- Redis 7 on port 6379
- MailDev on ports 1080 (web UI) / 1025 (SMTP)

Copy `backend/.env.example` to `backend/.env` and configure. The DATABASE_URL in .env.example uses port 5432 — update to **5433** to match docker-compose.

### Environment setup notes
- All service configs are validated at startup via Zod schemas in `packages/shared/src/config.ts`. Missing or invalid env vars cause immediate failure with descriptive errors.
- `AI_PROVIDER` defaults to `mock` — no OpenAI/Gemini API key needed for local dev.
- `CORS_ORIGINS` on the api-gateway defaults to `http://localhost:5173`. Update this to match the actual frontend URL (e.g., `http://localhost:3001` if running Next.js on a different port).

## Key Patterns

- **Validation**: Zod schemas in `packages/shared` are the source of truth for API contracts. Both backend services and frontend reference these types.
- **AI Classifier Strategy**: `ai-worker/src/classifiers/` uses an `AIClassifier` interface with pluggable implementations (openai, gemini, mock). Configured via `AI_PROVIDER` env var.
- **Auth**: JWT access + refresh token pair. Access token in response body, refresh token in httpOnly cookie.
- **Real-time**: Socket.IO on the api-gateway pushes ticket updates to connected frontend clients.
- **Testing**: Vitest for backend services. Tests are co-located with source files (`*.test.ts`).
- **Load testing**: k6 scripts in `backend/k6/`.

## Language

The application UI and AI suggested responses are in **Spanish**. Code, comments, and variable names are in English.
