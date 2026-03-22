# PRD — Sistema de Gestión de Tickets con IA

## 1. Resumen Ejecutivo (Vision)

### Problema

Los equipos de soporte técnico enfrentan un cuello de botella recurrente: cada ticket nuevo debe ser leído, clasificado manualmente por categoría y prioridad, y luego se redacta una respuesta desde cero. Este proceso es lento, inconsistente entre agentes, y genera tiempos de espera elevados para los usuarios finales.

### Objetivo

Construir una plataforma de gestión de tickets que integre clasificación automática por IA. Cuando un usuario crea un ticket, el sistema lo analiza en segundo plano, le asigna categoría y prioridad, y genera un borrador de respuesta que el agente puede aplicar con un clic — reduciendo el tiempo de primera respuesta y eliminando la clasificación manual.

### Público Objetivo

- **Agentes de soporte**: Reciben tickets pre-clasificados con borradores de respuesta listos para enviar o editar.
- **Administradores**: Supervisan métricas, asignan tickets, y gestionan usuarios.
- **Usuarios finales**: Crean tickets y dan seguimiento a su estado en tiempo real.

### Propuesta de Valor

| Sin la plataforma | Con la plataforma |
|---|---|
| Clasificación manual por cada agente | Clasificación automática por IA (categoría + prioridad) |
| Tiempo de primera respuesta alto | Borrador de respuesta generado al instante |
| Sin visibilidad en tiempo real | Dashboard con WebSockets — actualizaciones push |
| Auditoría difícil de rastrear | Log de auditoría automático por cada cambio |

---

## 2. Objetivos y Alcance

### Objetivos del Producto

1. **Automatizar la clasificación**: Cada ticket creado es procesado por un worker de IA que determina categoría (`BUG`, `FEATURE_REQUEST`, `SUPPORT`, `BILLING`, `OTHER`) y prioridad (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
2. **Reducir tiempo de respuesta**: La IA genera un borrador de respuesta en español que el agente puede aplicar directamente.
3. **Visibilidad en tiempo real**: Los cambios de estado y nuevos tickets se propagan al dashboard vía WebSockets sin necesidad de refrescar la página.
4. **Trazabilidad completa**: Cada modificación de un ticket genera un registro de auditoría inmutable.

### Alcance — Fase 1 (MVP)

**Incluido:**
- Autenticación con JWT (access + refresh tokens)
- CRUD completo de tickets con paginación y filtros
- Clasificación automática por IA (OpenAI / Gemini / Mock)
- Dashboard en tiempo real con WebSockets
- Audit log por ticket
- Roles: USER, AGENT, ADMIN
- Rate limiting y cabeceras de seguridad

**Fuera de alcance (Fase 1):**
- Notificaciones por email (infraestructura de MailDev lista, integración pendiente)
- SLA tracking y métricas de tiempo de resolución
- Asignación automática de tickets a agentes
- Chat en vivo entre agente y usuario
- E2E tests con Playwright
- Integración CI/CD

---

## 3. Funcionalidades Principales (Core Features)

### 3.1 Gestión de Tickets

| Funcionalidad | Descripción |
|---|---|
| Crear ticket | El usuario envía título + descripción. El sistema persiste el ticket y emite un evento a Redis. |
| Listar tickets | Paginación server-side con filtros por estado, prioridad, categoría y búsqueda por texto. Los usuarios solo ven sus propios tickets; agentes y admins ven todos. |
| Detalle de ticket | Vista completa con historial de auditoría, sugerencia de IA, y datos del creador/asignado. |
| Actualizar ticket | Cambio de estado, prioridad, categoría, asignación. Cada cambio genera un audit log y emite evento por WebSocket. |
| Eliminar ticket | Solo ADMIN. Elimina en cascada los audit logs asociados. |

**Ciclo de vida del ticket:**
```
OPEN → IN_PROGRESS → RESOLVED → CLOSED
         ↘ PENDING_MANUAL_REVIEW ↗
```
El estado `PENDING_MANUAL_REVIEW` se asigna automáticamente cuando la IA falla al clasificar.

### 3.2 Clasificación por IA

El **AI Worker** es un proceso independiente que:

1. Escucha el canal `ticket-events` de Redis.
2. Al recibir un evento `ticket.created`, invoca al clasificador configurado.
3. **Retry con backoff exponencial**: 3 intentos con delays de 1s, 4s, 16s.
4. El clasificador analiza título y descripción, y devuelve:
   - `category` — Una de las 5 categorías del sistema.
   - `priority` — Una de las 4 prioridades.
   - `suggestedResponse` — Borrador de respuesta en español.
   - `confidence` — Nivel de confianza (0 a 1).
5. Persiste el resultado en la tabla `ai_results` y actualiza el ticket (`aiStatus: CLASSIFIED`).
6. Publica evento `ticket.classified` en Redis (recibido por el frontend vía WebSocket).
7. Si falla tras 3 intentos, marca el ticket como `PENDING_MANUAL_REVIEW` (`aiStatus: FAILED`) y publica `ticket.ai_failed`.

**Feedback loop (Agentes):**
- `POST /api/tickets/:id/ai/accept` — Acepta la clasificación de IA (marca `AiResult.accepted = true`).
- `POST /api/tickets/:id/ai/correct` — Corrige la clasificación con categoría/prioridad correctas (marca `AiResult.accepted = false`, aplica correcciones al ticket).

**Proveedores soportados:**

| Proveedor | Modelo por defecto | Configuración |
|---|---|---|
| OpenAI | `gpt-4o-mini` | `AI_PROVIDER=openai`, `OPENAI_API_KEY` |
| Google Gemini | `gemini-2.0-flash` | `AI_PROVIDER=gemini`, `GEMINI_API_KEY` |
| Mock | N/A | `AI_PROVIDER=mock` (desarrollo sin API keys) |

### 3.3 Tiempo Real (WebSockets)

El API Gateway mantiene un servidor Socket.IO que:
- Se suscribe al canal `ticket-events` de Redis.
- Re-emite cada evento como `ticket-event` a todos los clientes conectados.
- El frontend escucha estos eventos y actualiza la caché de React Query automáticamente.

**Eventos emitidos:**
- `ticket.created` — Nuevo ticket creado.
- `ticket.updated` — Campos del ticket modificados.
- `ticket.status_changed` — Transición de estado (incluye estado anterior y nuevo).
- `ticket.classified` — IA clasificó el ticket (categoría, prioridad, confianza).
- `ticket.ai_failed` — La clasificación de IA falló tras reintentos.
- `ticket.deleted` — Ticket eliminado.

### 3.4 Autenticación y Autorización

- **Registro**: Email + contraseña + nombre. Rol por defecto: `USER`.
- **Login**: Devuelve access token (en body) + refresh token (en cookie `HttpOnly`).
- **Refresh**: Rota el refresh token y emite nuevo access token. Incluye protección contra replay (token comparado contra el almacenado en DB).
- **JWT**: Firmado con HMAC-SHA256 usando Web Crypto API (compatible con Bun).
- **Roles**:

| Permiso | USER | AGENT | ADMIN |
|---|---|---|---|
| Crear ticket | Si | Si | Si |
| Ver tickets propios | Si | Si | Si |
| Ver todos los tickets | No | Si | Si |
| Actualizar título/descripción (propios) | Si | Si | Si |
| Actualizar todos los campos (cualquier ticket) | No | Si | Si |
| Aceptar/corregir clasificación IA | No | Si | Si |
| Eliminar ticket | No | No | Si |

### 3.5 Audit Log

Cada operación sobre un ticket genera un registro inmutable:
- `action` — Tipo de operación (`CREATE`, `UPDATE`, `STATUS_CHANGE`, `AI_CLASSIFICATION`, `AI_CLASSIFICATION_FAILED`, `AI_ACCEPTED`, `AI_CORRECTED`).
- `field` — Campo modificado.
- `oldValue` / `newValue` — Valores anterior y nuevo.
- `userId` — Quién realizó la acción (`null` para operaciones del sistema/IA).

---

## 4. Requisitos Técnicos y Arquitectura

### 4.1 Diagrama de Arquitectura

```
┌──────────────┐       HTTP        ┌─────────────────┐      HTTP       ┌──────────────────┐
│   Frontend   │ ──────────────── │   API Gateway   │ ─────────────── │  Ticket Service  │
│  (Next.js)   │                  │  (Hono + Bun)   │                 │ (Hono + Bun)     │
│  Port 3000   │ ◄─── Socket.IO ─ │  Port 3000      │                 │ Port 3001        │
└──────────────┘                  └────────┬────────┘                 └────────┬─────────┘
                                           │                                   │
                                           │ Redis Sub                         │ Redis Pub
                                           │                                   │
                                      ┌────▼────────────────────────────────────▼──┐
                                      │              Redis (Port 6379)             │
                                      └────────────────────┬──────────────────────-┘
                                                           │ Redis Sub
                                                     ┌─────▼──────────┐
                                                     │   AI Worker    │
                                                     │ (tsx + Prisma) │
                                                     └─────┬──────────┘
                                                           │ Prisma
                                                     ┌─────▼──────────┐
                                                     │  PostgreSQL    │
                                                     │  (Port 5433)   │
                                                     └────────────────┘
```

### 4.2 Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript |
| **UI** | Tailwind CSS v4, shadcn/ui, Lucide icons |
| **Estado cliente** | Zustand (auth), TanStack React Query (server state) |
| **Tiempo real** | Socket.IO (cliente + servidor) |
| **API Gateway** | Hono framework, Bun runtime |
| **Servicio de tickets** | Hono framework, Bun runtime |
| **AI Worker** | tsx (desarrollo), tsup (build), Node.js |
| **ORM** | Prisma (PostgreSQL) |
| **Validación** | Zod (schemas compartidos entre backend y frontend) |
| **Base de datos** | PostgreSQL 16 |
| **Cache/Mensajería** | Redis 7 (pub/sub) |
| **Monorepo** | pnpm workspaces + Turborepo |
| **Testing** | Vitest (backend), k6 (carga) |
| **Email (dev)** | MailDev |

### 4.3 Modelo de Datos

**User**
- `id` (UUID), `email` (unique), `password` (hash), `name`, `role` (ADMIN/AGENT/USER)
- Relaciones: tickets creados, tickets asignados, audit logs

**Ticket**
- `id` (UUID), `title`, `description`, `status`, `priority?` (nullable — asignado por IA), `category?` (nullable — asignado por IA), `aiResponse?`, `aiStatus` (PENDING/CLASSIFIED/FAILED), `confidence?`
- FK: `createdById`, `assignedToId`
- Relaciones: `aiResults` (AiResult[])
- Indices en: `status`, `priority`, `createdById`, `assignedToId`, `aiStatus`

**AiResult**
- `id` (UUID), `provider`, `category`, `priority`, `suggestedResponse`, `confidence`, `accepted?`
- FK: `ticketId` (cascade delete)
- Indices en: `ticketId`

**AuditLog**
- `id` (UUID), `action`, `field`, `oldValue`, `newValue`
- FK: `ticketId` (cascade delete), `userId?` (nullable — null para acciones del sistema/IA)
- Indices en: `ticketId`, `userId`

### 4.4 Comunicación entre Servicios

| Origen | Destino | Mecanismo | Propósito |
|---|---|---|---|
| Frontend | API Gateway | HTTP + Cookie auth | Requests de usuario |
| Frontend | API Gateway | Socket.IO | Eventos en tiempo real |
| API Gateway | Ticket Service | HTTP (proxy) | CRUD de tickets |
| Ticket Service | Redis | Pub (`ticket-events`) | Notificar nuevo ticket |
| API Gateway | Redis | Sub (`ticket-events`) | Broadcast a clientes WS |
| AI Worker | Redis | Sub (`ticket-events`) | Recibir tickets para clasificar |
| AI Worker | Redis | Pub (`ticket-events`) | Emitir `ticket.classified` / `ticket.ai_failed` |
| AI Worker | PostgreSQL | Prisma (directo) | Persistir clasificación y AiResult |

### 4.5 Variables de Entorno

```env
# Base de datos
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ticket_gestion

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=<min 16 caracteres>
JWT_REFRESH_SECRET=<min 16 caracteres>

# API Gateway
PORT=3000
CORS_ORIGINS=http://localhost:3000
TICKET_SERVICE_URL=http://localhost:3001
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000

# Ticket Service
TICKET_SERVICE_PORT=3001

# AI Worker
AI_PROVIDER=mock|openai|gemini
OPENAI_API_KEY=<opcional>
OPENAI_MODEL=gpt-4o-mini
GEMINI_API_KEY=<opcional>
GEMINI_MODEL=gemini-2.0-flash

# Frontend (frontend/app/.env.local)
NEXT_PUBLIC_API_URL=http://localhost:3000
```

---

## 5. Diseño de Experiencia de Usuario (UX)

### 5.1 Flujos Principales

**Flujo 1 — Creación de ticket (Usuario)**
1. Usuario hace login → redirigido al dashboard.
2. Clic en "Crear Ticket" → modal con título y descripción (prioridad y categoría opcionales — si se dejan en blanco, la IA las asigna automáticamente).
3. Submit → ticket aparece en la tabla con estado `OPEN` y prioridad/categoría como "Pendiente".
4. En segundos, la IA clasifica el ticket → la fila se actualiza en tiempo real vía WebSocket con categoría, prioridad y badge de confianza.

**Flujo 2 — Gestión de ticket (Agente)**
1. Agente ve el dashboard con todos los tickets.
2. Filtra por prioridad `CRITICAL` y estado `OPEN`.
3. Abre un ticket → ve la sugerencia de IA con badge de confianza (verde ≥0.8, amarillo ≥0.5, rojo <0.5).
4. Acepta la clasificación de IA o la corrige (categoría/prioridad) → feedback registrado en `ai_results` y audit log.
5. Aplica el borrador de respuesta o lo edita, cambia estado a `IN_PROGRESS`.
6. Resuelve y cierra el ticket.

**Flujo 3 — Fallback de IA**
1. Ticket creado normalmente.
2. La API de IA falla (timeout, error de red, rate limit, etc.).
3. El AI Worker reintenta con backoff exponencial (3 intentos: 1s, 4s, 16s).
4. Si todos los intentos fallan, el ticket se marca como `PENDING_MANUAL_REVIEW` (`aiStatus: FAILED`).
5. El frontend recibe el evento `ticket.ai_failed` vía WebSocket y muestra notificación de error.
6. Agente lo ve destacado en el dashboard y lo clasifica manualmente.

### 5.2 Estructura de Páginas

| Ruta | Componente | Acceso |
|---|---|---|
| `/login` | Formulario de login | Público |
| `/register` | Formulario de registro | Público |
| `/dashboard` | Vista general con estadísticas y tickets recientes | Autenticado |
| `/dashboard/tickets` | Tabla de tickets con filtros y paginación | Autenticado |
| `/dashboard/tickets/[id]` | Detalle de ticket con audit log y sugerencia IA | Autenticado |

### 5.3 Componentes Clave del Dashboard

- **Stats Cards**: Contadores de tickets por estado (open, in progress, resolved, etc.).
- **Ticket Table**: Tabla paginada con columnas de título, estado (badge color), prioridad (badge), categoría, fecha, asignado.
- **Ticket Filters**: Selectores de estado, prioridad, categoría + campo de búsqueda.
- **AI Suggestion**: Panel con tres estados: spinner "Clasificando con IA..." (PENDING), tarjeta de sugerencia con badge de confianza + botones "Aceptar"/"Corregir" (CLASSIFIED), o tarjeta de error "Revisión manual requerida" (FAILED).
- **Audit Log**: Timeline cronológica de todos los cambios del ticket.
- **Create Ticket Dialog**: Modal con título y descripción obligatorios; prioridad y categoría opcionales con placeholder "Automático (IA)" y hint "Deja en blanco para clasificación automática por IA".
- **Priority/Status Badges**: Badges con colores semánticos según nivel.

---

## 6. Seguridad y Privacidad

### 6.1 Autenticación

- JWT firmado con HMAC-SHA256 (Web Crypto API nativa, sin dependencias).
- Access token de corta vida en respuesta HTTP.
- Refresh token en cookie `HttpOnly` — no accesible desde JavaScript.
- Rotación de refresh token en cada uso.

### 6.2 Autorización

- Middleware `authGuard` en todas las rutas de API (excepto login/register/health).
- Middleware `roleGuard` para operaciones restringidas (delete = solo ADMIN).
- El Ticket Service recibe `x-user-id` y `x-user-role` como headers internos desde el Gateway — nunca expuestos al cliente.

### 6.3 Validación de Entrada

- Zod valida cada payload en el API Gateway antes de hacer proxy al Ticket Service.
- Schemas definidos en `@repo/shared` — fuente única de verdad.
- Errores de validación devuelven respuestas estructuradas con campo, mensaje y código por error (`VALIDATION_ERROR`, `INTERNAL_ERROR`, etc.).

### 6.4 Protección de Red

- **Rate Limiting**: 100 req/min global, 20 req/min en endpoints de auth.
- **CORS**: Whitelist de orígenes configurada por variable de entorno.
- **Secure Headers**: Helmet/secureHeaders de Hono (X-Content-Type-Options, X-Frame-Options, etc.).
- **Cabeceras Rate Limit**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`.

### 6.5 Protección del Frontend

- Next.js middleware redirige rutas protegidas a `/login` si no hay sesión.
- Cookies `accessToken`/`refreshToken` verificadas antes del render.
- Todos los requests incluyen `credentials: "include"` para enviar cookies automáticamente.

### 6.6 Base de Datos

- Conexión vía URL con credenciales (no embebidas en código).
- Prisma previene SQL injection por diseño (queries parametrizadas).
- Audit logs no se pueden modificar — solo insertar.

---

## 7. Plan de Lanzamiento (Roadmap)

### Fase 1 — MVP

- [x] Monorepo con pnpm + Turborepo
- [x] Infraestructura Docker (PostgreSQL, Redis, MailDev)
- [x] API Gateway con Hono + Bun
- [x] Ticket Service con Prisma + PostgreSQL
- [x] AI Worker con clasificación automática (OpenAI, Gemini, Mock)
- [x] Autenticación JWT con refresh tokens
- [x] Rate limiting y cabeceras de seguridad
- [x] Dashboard Next.js con React Query + Zustand
- [x] WebSockets para actualizaciones en tiempo real
- [x] Audit log por ticket
- [x] Filtros y paginación server-side
- [x] Documentación OpenAPI/Swagger

### Fase 1.5 — RFCs Implementados (RFC #001 – #005)

**RFC #001 — Modelo de Datos:**
- [x] Priority y category nullable en tickets (asignados por IA, no por el usuario)
- [x] Enum `AiStatus` (PENDING, CLASSIFIED, FAILED) con campo `aiStatus` en Ticket
- [x] Campo `confidence` (Float?) en Ticket
- [x] Modelo `AiResult` para historial de clasificaciones IA (provider, confianza, aceptado/rechazado)
- [x] `userId` nullable en AuditLog para acciones del sistema/IA
- [x] Schemas Zod actualizados en `@repo/shared`

**RFC #002 — Seguridad:**
- [x] RBAC a nivel de campo: USERs solo actualizan título/descripción de sus propios tickets; AGENTs/ADMINs todos los campos de cualquier ticket
- [x] Protección contra replay de refresh tokens (comparación con token almacenado en DB)
- [x] Código de error (`code`) en todas las respuestas de error para consistencia

**RFC #003 — AI Worker:**
- [x] Retry con backoff exponencial (3 intentos: 1s, 4s, 16s)
- [x] Publicación de eventos Redis: `ticket.classified` y `ticket.ai_failed`
- [x] Creación de `AiResult` en cada clasificación exitosa
- [x] Publisher Redis separado del subscriber (requisito ioredis)
- [x] Endpoints de feedback: `POST /api/tickets/:id/ai/accept` y `POST /api/tickets/:id/ai/correct`
- [x] Manejo graceful de errores en catch (DB failures no crashean el worker)

**RFC #004 — Frontend Dashboard:**
- [x] Tipos actualizados: priority/category nullable, AiStatus, AiResult
- [x] Eventos WebSocket `ticket.classified` y `ticket.ai_failed` con toast notifications
- [x] Componente AiSuggestion con 3 estados: PENDING (spinner), CLASSIFIED (sugerencia + confianza + aceptar/corregir), FAILED (error)
- [x] Badge de confianza con colores semánticos (≥0.8 verde, ≥0.5 amarillo, <0.5 rojo)
- [x] PriorityBadge con estado "Pendiente" (gris) cuando es null
- [x] Create Ticket Dialog con prioridad/categoría opcionales ("Automático IA")
- [x] Hooks `useAcceptAiClassification` y `useCorrectAiClassification`

**RFC #005 — Observabilidad:**
- [x] Logger estructurado JSON en `@repo/shared` (`createLogger`) con niveles info/warn/error/debug
- [x] Reemplazo de `console.log/error` por logger estructurado en todos los servicios
- [x] Health checks mejorados: ticket-service verifica DB + Redis; api-gateway verifica conectividad con ticket-service

### Fase 2 — Mejoras de Producto

- [ ] Notificaciones por email (infraestructura MailDev ya disponible)
- [ ] SLA tracking — tiempo máximo de respuesta por prioridad
- [ ] Asignación automática de tickets a agentes (round-robin o por carga)
- [ ] Métricas del dashboard — gráficas de volumen, tiempo de resolución, distribución por categoría
- [ ] Exportación de datos (CSV/Excel)

### Fase 3 — Escalabilidad y Calidad

- [ ] E2E tests con Playwright (flujo completo: login → crear ticket → responder → cerrar)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Component testing con React Testing Library
- [ ] Dockerización completa de servicios (no solo infraestructura)
- [ ] Health check dashboard para monitoreo de servicios

### Fase 4 — Funcionalidades Avanzadas

- [ ] Chat en vivo entre agente y usuario
- [ ] Base de conocimiento — respuestas frecuentes que la IA puede referenciar
- [ ] Multi-tenancy — soporte para múltiples organizaciones
- [ ] Integración con Slack/Teams para notificaciones
- [ ] API pública con API keys para integraciones de terceros
