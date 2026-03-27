# AI-Powered Ticket Management System
Sistema de gestion de tickets con clasificacion automatica por inteligencia artificial, arquitectura de microservicios y actualizaciones en tiempo real.

## Screenshots

| Login | Dashboard de Agente |
|-------|-------------------|
| ![Login dark](docs/imgs/p.PNG) | ![Dashboard](docs/imgs/dashboard.PNG) |

| Lista de Tickets | Detalle con Clasificacion IA |
|-----------------|------------------------------|
| ![Tickets](docs/imgs/tickets.PNG) | ![Detalle ticket](docs/imgs/1.PNG) |

## Que hace este proyecto

Un sistema completo donde los usuarios crean tickets de soporte y la IA los clasifica automaticamente por categoria, prioridad y genera una respuesta sugerida. Incluye tres vistas segun el rol: portal de usuario, dashboard de agente y panel de administrador.

**Funcionalidades principales:**
- Creacion y seguimiento de tickets con SLA configurable
- Clasificacion automatica por IA (OpenAI / Gemini) con Strategy Pattern
- Notificaciones en tiempo real via WebSocket
- Sistema de comentarios con indicador de mensajes nuevos
- Autenticacion JWT con refresh token rotation
- Vistas diferenciadas por rol (Usuario, Agente, Admin)

## Tech Stack

| Capa | Tecnologias |
|------|-------------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Zustand, TanStack Query, Framer Motion |
| **API Gateway** | Hono, Socket.IO, Bun |
| **Ticket Service** | Hono, Prisma 6, Bun |
| **AI Worker** | Node.js, OpenAI / Gemini SDK, Redis Pub/Sub |
| **Base de datos** | PostgreSQL 16, Redis 7 |
| **Infraestructura** | Docker Compose, Turborepo, pnpm workspaces |

## Arquitectura

```
  Browser (Next.js + React 19)
        │ HTTP + WebSocket
        ▼
  ┌─────────────────────────────────────┐
  │  API Gateway  :3000  (Hono + Bun)   │
  │  Auth · Rate Limit · CORS · Swagger │
  └──────────────┬──────────────────────┘
                 │ HTTP proxy
                 ▼
  ┌─────────────────────────────────────┐       ┌──────────────────┐
  │  Ticket Service  :3001 (Hono + Bun) │──ORM──►  PostgreSQL 16   │
  │  Tickets · Users · SLA · Audit Log  │       │  Usuarios        │
  └──────────────┬──────────────────────┘       │  Tickets         │
                 │ Pub/Sub (ticket-events)       │  Comentarios     │
                 ▼                               │  AiResults       │
  ┌─────────────────────────────────────┐       └──────────────────┘
  │  Redis 7                            │
  │  Pub/Sub · Rate limit · Sessions    │
  └──────────────┬──────────────────────┘
                 │ Subscribe
                 ▼
  ┌─────────────────────────────────────┐
  │  AI Worker  (Node.js)               │
  │  Strategy: OpenAI │ Gemini │ Mock   │
  │  → clasifica y escribe en PostgreSQL│
  └─────────────────────────────────────┘
```

**Flujo:** Usuario crea ticket → Ticket Service guarda en DB y publica en Redis → AI Worker clasifica con IA (categoria, prioridad, respuesta sugerida) → resultado guardado en DB → API Gateway notifica al frontend via WebSocket.

| Servicio | Responsabilidad |
|----------|----------------|
| **API Gateway** | Unico punto de entrada. Auth, rate limiting, WebSocket, proxy |
| **Ticket Service** | CRUD, SLA, comentarios, adjuntos, auditoria, notificaciones |
| **AI Worker** | Clasificacion automatica con Strategy Pattern (OpenAI/Gemini/Mock) |
| **packages/database** | Schema Prisma centralizado compartido |
| **packages/shared** | Tipos Zod y validaciones compartidas |

## Inicio rapido

```bash
# 1. Clonar e instalar dependencias
git clone <repo-url>
cd project-ticket-gestion

# 2. Levantar PostgreSQL, Redis y MailDev
cd backend
cp .env.example .env
pnpm install
pnpm docker:up

# 3. Configurar base de datos
cd services/ticket-service
pnpm db:push

# 4. Iniciar backend (todos los servicios)
cd ../../
pnpm dev

# 5. Iniciar frontend (en otra terminal)
cd ../frontend/app
pnpm install
pnpm dev -p 3002
```

## Estructura del proyecto

```
project-ticket-gestion/
├── backend/
│   ├── services/
│   │   ├── api-gateway/        # Puerto 3000
│   │   ├── ticket-service/     # Puerto 3001
│   │   └── ai-worker/         # Worker en background
│   └── packages/
│       ├── database/           # Schema Prisma compartido
│       └── shared/             # Tipos y validaciones Zod
├── frontend/app/               # Next.js App Router
│   ├── src/app/(auth)/        # Login, registro
│   ├── src/app/(portal)/      # Vista usuario
│   ├── src/app/(dashboard)/   # Vista agente
│   └── src/app/(admin)/       # Vista admin
└── docs/rfcs/                  # Documentacion tecnica
```

## Variables de entorno

Copiar `backend/.env.example` a `backend/.env`. Variables clave:

| Variable | Descripcion |
|----------|-------------|
| `DATABASE_URL` | Conexion a PostgreSQL (puerto 5433) |
| `REDIS_URL` | Conexion a Redis |
| `JWT_SECRET` | Secreto para tokens JWT |
| `AI_PROVIDER` | `mock`, `openai` o `gemini` |
| `OPENAI_API_KEY` | API key de OpenAI (opcional) |
| `GEMINI_API_KEY` | API key de Gemini (opcional) |