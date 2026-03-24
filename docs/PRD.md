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
- Asignación automática de tickets a agentes (round-robin)
- E2E tests con Playwright
- Integración CI/CD

---

## 3. Funcionalidades Principales (Core Features)

### 3.1 Gestión de Tickets

| Funcionalidad | Descripción |
|---|---|
| Crear ticket | El usuario envía título + descripción. El sistema persiste el ticket y emite un evento a Redis. |
| Listar tickets | Paginación server-side con filtros por estado, prioridad, categoría y búsqueda por texto. Los usuarios solo ven sus propios tickets; agentes y admins ven todos. |
| Detalle de ticket | Vista completa con historial de auditoría, sugerencia de IA, conversación de comentarios, y datos del creador/asignado. |
| Actualizar ticket | Cambio de estado, prioridad, categoría, asignación. Cada cambio genera un audit log y emite evento por WebSocket. |
| Asignar ticket | Los agentes y administradores pueden asignar un ticket a cualquier agente/admin desde un dropdown en el detalle del ticket. La asignación genera una notificación automática al agente asignado. |
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
| Asignar ticket a agente | No | Si | Si |
| Comentar en ticket propio | Si | Si | Si |
| Comentar en cualquier ticket | No | Si | Si |
| Aceptar/corregir clasificación IA | No | Si | Si |
| Eliminar ticket | No | No | Si |
| Gestionar usuarios (roles, activar/desactivar) | No | No | Si |

### 3.5 Audit Log

Cada operación sobre un ticket genera un registro inmutable:
- `action` — Tipo de operación (`CREATE`, `UPDATE`, `STATUS_CHANGE`, `AI_CLASSIFICATION`, `AI_CLASSIFICATION_FAILED`, `AI_ACCEPTED`, `AI_CORRECTED`).
- `field` — Campo modificado.
- `oldValue` / `newValue` — Valores anterior y nuevo.
- `userId` — Quién realizó la acción (`null` para operaciones del sistema/IA).

### 3.6 Comentarios y Respuestas

Sistema de conversación dentro de cada ticket que permite la comunicación entre agentes y clientes.

| Funcionalidad | Descripción |
|---|---|
| Agregar comentario | Cualquier usuario involucrado puede escribir un comentario en el ticket. Agentes/admins pueden comentar en cualquier ticket; usuarios solo en los suyos. |
| Ver conversación | Lista cronológica de todos los comentarios con avatar, nombre, rol (Agente/Cliente), y timestamp. |
| Eliminar comentario | El autor del comentario o un ADMIN puede eliminarlo. |
| Notificaciones automáticas | Al comentar, se genera una notificación para el creador del ticket (si no es el autor del comentario) y para el agente asignado (si existe y no es el autor). |

**Endpoints:**
- `GET /api/tickets/:id/comments` — Lista comentarios del ticket.
- `POST /api/tickets/:id/comments` — Agrega un comentario (body: `{ content: string }`).
- `DELETE /api/tickets/:id/comments/:commentId` — Elimina un comentario.

**Componente frontend:** `<TicketComments>` integrado en la vista de detalle del ticket, con textarea que envía con Enter (Shift+Enter para nueva línea).

### 3.7 Notificaciones

Sistema de notificaciones persistentes que alerta a los usuarios sobre eventos relevantes en sus tickets.

| Evento | Notificación generada | Destinatario |
|---|---|---|
| Nuevo comentario | "X comentó en el ticket Y" | Creador del ticket y agente asignado (si no son el autor del comentario) |
| Ticket asignado | "Se te ha asignado el ticket Y" | Agente asignado |
| Cambio de estado | "Tu ticket Y cambió a ESTADO" | Creador del ticket |

**Endpoints:**
- `GET /api/notifications` — Lista notificaciones del usuario autenticado (params: `limit`, `unreadOnly`).
- `PATCH /api/notifications/:id/read` — Marca una notificación como leída.
- `POST /api/notifications/read-all` — Marca todas las notificaciones como leídas.

**Componente frontend:** `<NotificationDropdown>` en el header:
- Icono de campana con badge numérico de no leídas.
- Dropdown con lista de notificaciones, indicador visual de no leída (punto azul).
- Clic en notificación → navega al ticket correspondiente y marca como leída.
- Botón "Marcar todas como leídas".
- Polling automático cada 30 segundos + invalidación en tiempo real por eventos WebSocket.

### 3.8 Panel de Administración de Usuarios

Panel exclusivo para administradores que permite gestionar los usuarios del sistema.

| Funcionalidad | Descripción |
|---|---|
| Listar usuarios | Tabla paginada con nombre, email, rol, estado (activo/inactivo), y fecha de registro. |
| Buscar usuarios | Campo de búsqueda por nombre o email. |
| Filtrar por rol | Selector para filtrar por ADMIN, AGENT, o USER. |
| Cambiar rol | Dropdown para cambiar el rol de un usuario (no se puede cambiar el propio). |
| Activar/desactivar | Botón para activar o desactivar una cuenta de usuario (no se puede desactivar la propia). |

**Endpoints:**
- `GET /api/users` — Lista todos los usuarios (admin only, params: `page`, `limit`, `role`, `search`).
- `GET /api/users/agents` — Lista agentes y admins activos (agent/admin, para el dropdown de asignación).
- `PATCH /api/users/:id/role` — Cambia el rol de un usuario (admin only, body: `{ role: string }`).
- `PATCH /api/users/:id/active` — Activa/desactiva un usuario (admin only, body: `{ isActive: boolean }`).

**Ruta frontend:** `/admin/users` — accesible solo para usuarios con rol ADMIN.

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
- `id` (UUID), `email` (unique), `password` (hash), `name`, `role` (ADMIN/AGENT/USER), `isActive` (boolean, default true)
- Relaciones: tickets creados, tickets asignados, audit logs, comentarios, notificaciones

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

**Comment**
- `id` (UUID), `content`, `createdAt`, `updatedAt`
- FK: `ticketId` (cascade delete), `userId`
- Indices en: `ticketId`, `userId`

**Notification**
- `id` (UUID), `type` (comment/assignment/status_change), `title`, `message`, `ticketId?` (nullable), `read` (boolean, default false), `createdAt`
- FK: `userId`
- Indices en: `userId`, `[userId, read]` (compuesto para consultas de no leídas)

### 4.4 Comunicación entre Servicios

| Origen | Destino | Mecanismo | Propósito |
|---|---|---|---|
| Frontend | API Gateway | HTTP + Cookie auth | Requests de usuario (tickets, comentarios, notificaciones, usuarios) |
| Frontend | API Gateway | Socket.IO | Eventos en tiempo real |
| API Gateway | Ticket Service | HTTP (proxy) | CRUD de tickets, comentarios, notificaciones, gestión de usuarios |
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

**Flujo 1 — Creación de ticket (Cliente / USER)**
1. Usuario hace login → redirigido a `/portal` (vista simplificada).
2. Clic en "Nuevo Ticket" → modal con título y descripción solamente (sin prioridad ni categoría — la IA las asigna).
3. Submit → ticket aparece en la lista con estado `OPEN`.
4. En segundos, la IA clasifica el ticket → el estado se actualiza en tiempo real vía WebSocket.
5. El cliente no ve la clasificación IA, prioridad ni categoría — solo el estado del ticket y la conversación.

**Flujo 2 — Gestión de ticket (Agente / AGENT)**
1. Agente hace login → redirigido a `/dashboard` (vista completa con sidebar).
2. Ve su dashboard con stats: "Mis Asignados", "Sin Asignar", "IA Fallida".
3. Filtra por prioridad `CRITICAL` y estado `OPEN`.
4. Abre un ticket → ve la sugerencia de IA con badge de confianza (verde ≥0.8, amarillo ≥0.5, rojo <0.5).
5. Acepta la clasificación de IA o la corrige (categoría/prioridad) → feedback registrado en `ai_results` y audit log.
6. "Tomar ticket" para auto-asignarse, o asignar a otro agente desde el dropdown.
7. Aplica el borrador de respuesta o lo edita, cambia estado a `IN_PROGRESS`.
8. Resuelve y cierra el ticket.

**Flujo 3 — Conversación en ticket (Agente responde al cliente)**
1. Cliente crea un ticket y queda en estado OPEN.
2. Agente abre el detalle del ticket → ve la sección "Conversación".
3. Escribe un comentario con la respuesta al cliente → el comentario aparece con badge "Agente".
4. El sistema genera una notificación automática para el creador del ticket.
5. El cliente abre su ticket → ve el comentario del agente en la conversación.
6. El cliente responde con otro comentario → notificación generada para el agente asignado.

**Flujo 4 — Asignación de ticket (Agente/Admin)**
1. Agente o admin abre el detalle de un ticket.
2. En el sidebar "Detalles", usa el dropdown "Asignado a" para seleccionar un agente.
3. El ticket se actualiza y se genera una notificación para el agente asignado.
4. El cambio queda registrado en el audit log.

**Flujo 5 — Gestión de usuarios (Admin)**
1. Admin hace login → redirigido a `/admin` (panel de administración con sidebar extendido).
2. Navega a "Usuarios" en el sidebar.
3. Ve la tabla con todos los usuarios del sistema.
4. Puede buscar por nombre/email, filtrar por rol.
5. Cambia el rol de un usuario (ej: USER → AGENT) usando el selector de rol.
6. Desactiva una cuenta de usuario presionando el botón "Activo" → cambia a "Inactivo".
7. Cuando se cambia un rol, la sesión actual del usuario sigue activa con el rol viejo. Al refrescar token o re-loguearse, obtiene el nuevo rol y es redirigido a la vista correcta.

**Flujo 6 — Fallback de IA**
1. Ticket creado normalmente.
2. La API de IA falla (timeout, error de red, rate limit, etc.).
3. El AI Worker reintenta con backoff exponencial (3 intentos: 1s, 4s, 16s).
4. Si todos los intentos fallan, el ticket se marca como `PENDING_MANUAL_REVIEW` (`aiStatus: FAILED`).
5. El frontend recibe el evento `ticket.ai_failed` vía WebSocket y muestra notificación de error.
6. Agente lo ve destacado en el dashboard y lo clasifica manualmente.

### 5.2 Estructura de Páginas (Vistas por Rol)

El sistema implementa tres experiencias distintas según el rol del usuario. El registro siempre crea un USER. Solo un ADMIN puede cambiar roles.

**Rutas públicas:**

| Ruta | Componente | Acceso |
|---|---|---|
| `/login` | Formulario de login | Público |
| `/register` | Formulario de registro | Público |

**Portal — Vista Cliente (USER):**

| Ruta | Componente | Descripción |
|---|---|---|
| `/portal` | Lista de tickets del usuario | Interfaz simple: lista de tickets propios, filtro por estado, búsqueda por título, botón "Nuevo Ticket" |
| `/portal/tickets/[id]` | Detalle simplificado | Título, descripción, estado, fecha, conversación. Sin prioridad, categoría, IA, audit log, asignación |
| `/portal/profile` | Perfil del usuario | Nombre, email, rol, fecha de registro |

**Dashboard — Vista Agente (AGENT):**

| Ruta | Componente | Descripción |
|---|---|---|
| `/dashboard` | Dashboard con stats + tickets | Stats: Mis Asignados, Sin Asignar, IA Fallida. Tickets recientes + tickets sin asignar |
| `/dashboard/tickets` | Tabla completa de tickets | Columnas: Título, Estado, Prioridad, Categoría, Asignado a, IA, Creado por, Fecha |
| `/dashboard/tickets/[id]` | Detalle completo | Descripción, sugerencia IA, comentarios, audit log, sidebar con estado/prioridad/categoría/asignación. Botón "Tomar ticket" |
| `/dashboard/profile` | Perfil del agente | Nombre, email, rol |

**Admin — Panel de Administración (ADMIN):**

| Ruta | Componente | Descripción |
|---|---|---|
| `/admin` | Dashboard administrativo | Todo lo del agente + métricas: Usuarios Totales, Sin Asignar, IA Fallida |
| `/admin/tickets` | Gestión de tickets | Tabla completa con acciones de eliminación |
| `/admin/tickets/[id]` | Detalle completo | Igual que agente + botón Eliminar |
| `/admin/users` | Gestión de usuarios | Tabla paginada, búsqueda, filtro por rol, cambiar rol, activar/desactivar |
| `/admin/settings` | Configuración del sistema | Proveedor IA activo, umbral de confianza, reintentos, SLA por prioridad, categorías |
| `/admin/profile` | Perfil del admin | Nombre, email, rol |

**Middleware de protección por rol:**

```
middleware.ts:
  1. Si no autenticado → /login
  2. Si autenticado (JWT decodificado para obtener rol):
     - USER accede a /dashboard o /admin → Redirect a /portal
     - AGENT accede a /portal o /admin   → Redirect a /dashboard
     - ADMIN accede a /portal            → Redirect a /admin
  3. ADMIN puede acceder a /dashboard (hereda permisos de AGENT)
```

### 5.3 Componentes Clave

**Layouts por rol:**
- **PortalShell**: Header simple con logo, enlace "Mis Tickets", y dropdown de perfil con avatar. Sin sidebar. Contenido centrado en `max-w-5xl`.
- **DashboardShell**: Sidebar colapsable + header con notificaciones. Sidebar muestra: Dashboard, Tickets, Mi Perfil.
- **AdminShell**: Sidebar colapsable con label "Admin Panel" + header con notificaciones. Sidebar muestra: Dashboard, Tickets, Usuarios, Configuración, Mi Perfil.

**Componentes compartidos:**
- **Stats Cards**: Contadores de tickets por estado (open, in progress, resolved, etc.).
- **Ticket Table**: Tabla paginada con columnas de título, estado (badge color), prioridad (badge), categoría, asignado a, estado IA (badge), creado por, fecha. Acepta `basePath` para links correctos por rol.
- **Ticket Detail**: Vista completa con descripción, sugerencia IA, comentarios, audit log, sidebar de detalles. Incluye botón "Tomar ticket" para auto-asignación. Acepta `basePath`.
- **Ticket Filters**: Selectores de estado, prioridad, categoría + campo de búsqueda.
- **Recent Tickets**: Últimos 5 tickets con links role-aware. Acepta `basePath`.
- **AI Suggestion**: Panel con tres estados: spinner "Clasificando con IA..." (PENDING), tarjeta de sugerencia con badge de confianza + botones "Aceptar"/"Corregir" (CLASSIFIED), o tarjeta de error "Revisión manual requerida" (FAILED).
- **Ticket Comments**: Sección de conversación con lista de comentarios (avatar, nombre, rol, timestamp), textarea para agregar comentarios (Enter para enviar, Shift+Enter para nueva línea), y opción de eliminar comentarios propios.
- **Assignment Dropdown**: Selector en el sidebar del ticket que muestra todos los agentes/admins activos. Solo visible para agentes y administradores.
- **Notification Dropdown**: Campana en el header con badge de conteo de no leídas, dropdown con lista de notificaciones. Navegación al ticket usa ruta correcta según rol del usuario.
- **Profile Page**: Componente reutilizable con avatar, nombre, email, rol, y fecha de registro. Usado en `/portal/profile`, `/dashboard/profile`, y `/admin/profile`.
- **Admin Users Table**: Tabla paginada con búsqueda, filtro por rol, selectores de rol por usuario, y botones de activar/desactivar.
- **Audit Log**: Timeline cronológica de todos los cambios del ticket.
- **Create Ticket Dialog**: Modal con título y descripción obligatorios; prioridad y categoría opcionales con placeholder "Automático (IA)" y hint "Deja en blanco para clasificación automática por IA". En portal, solo muestra título y descripción.
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

- Next.js middleware decodifica el JWT del `accessToken` cookie para obtener el rol del usuario.
- Rutas protegidas redirigen a `/login` si no hay sesión.
- **Protección por rol**: USER solo accede a `/portal`, AGENT solo a `/dashboard`, ADMIN a `/admin` y `/dashboard`.
- Redireccionamiento automático: si un usuario accede a una vista que no le corresponde, es redirigido a su vista correcta.
- Cookies `accessToken`/`refreshToken` verificadas antes del render.
- Todos los requests incluyen `credentials: "include"` para enviar cookies automáticamente.
- Después de login, el usuario es redirigido a la vista correspondiente a su rol (USER→`/portal`, AGENT→`/dashboard`, ADMIN→`/admin`).
- Después de registro, siempre redirige a `/portal` (rol USER por defecto).

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

### Fase 1.6 — Funcionalidades de Comunicación y Gestión

**Asignación de tickets a agentes:**
- [x] Endpoint `GET /api/users/agents` para listar agentes/admins activos
- [x] Dropdown de asignación en el detalle del ticket (solo visible para agentes/admins)
- [x] Notificación automática al agente asignado

**Sistema de comentarios/respuestas:**
- [x] Modelo `Comment` en Prisma con relaciones a Ticket y User
- [x] Endpoints CRUD: `GET/POST /api/tickets/:id/comments`, `DELETE /api/tickets/:id/comments/:commentId`
- [x] Componente `<TicketComments>` con lista cronológica, avatares, roles (Agente/Cliente), y textarea
- [x] Notificaciones automáticas al creador del ticket y agente asignado al comentar
- [x] Permisos: usuarios solo comentan en sus propios tickets; agentes/admins en cualquiera

**Sistema de notificaciones:**
- [x] Modelo `Notification` en Prisma con tipos: `comment`, `assignment`, `status_change`
- [x] Endpoints: `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `POST /api/notifications/read-all`
- [x] Componente `<NotificationDropdown>` en el header con badge de no leídas
- [x] Polling automático cada 30s + invalidación por eventos WebSocket
- [x] Clic en notificación navega al ticket correspondiente

**Panel de administración de usuarios:**
- [x] Endpoints: `GET /api/users`, `PATCH /api/users/:id/role`, `PATCH /api/users/:id/active`
- [x] Campo `isActive` en modelo User para activar/desactivar cuentas
- [x] Página de gestión de usuarios con tabla paginada, búsqueda, filtro por rol
- [x] Selectores de rol y botones de activar/desactivar por usuario

### Fase 1.7 — Vistas por Rol (RFC #004)

**Estructura de rutas por rol:**
- [x] Tres route groups separados: `(portal)` para USER, `(dashboard)` para AGENT, `(admin)` para ADMIN
- [x] Middleware con protección por rol: decodifica JWT para obtener rol y redirige automáticamente
- [x] Login redirige según rol: USER→`/portal`, AGENT→`/dashboard`, ADMIN→`/admin`
- [x] Registro siempre crea USER y redirige a `/portal`

**Portal — Vista Cliente (USER):**
- [x] Layout simple `PortalShell`: header con logo, "Mis Tickets", dropdown de perfil (sin sidebar)
- [x] `/portal` — Lista de tickets propios con filtros por estado, búsqueda, y botón "Nuevo Ticket" (solo título + descripción)
- [x] `/portal/tickets/[id]` — Detalle simplificado: título, descripción, estado, fecha, conversación (sin prioridad, categoría, IA, audit log)
- [x] `/portal/profile` — Perfil básico del usuario

**Dashboard — Vista Agente (AGENT):**
- [x] Sidebar actualizado: Dashboard, Tickets, Mi Perfil (sin sección admin)
- [x] Dashboard mejorado con stats: "Mis Asignados", "Sin Asignar", "IA Fallida" + sección "Tickets Sin Asignar"
- [x] Tabla de tickets mejorada: columnas "Asignado a" y "IA" (badge con estado de clasificación)
- [x] Botón "Tomar ticket" en detalle para auto-asignación
- [x] `/dashboard/profile` — Perfil del agente

**Admin — Panel de Administración (ADMIN):**
- [x] Layout `AdminShell` con sidebar extendido: Dashboard, Tickets, Usuarios, Configuración, Mi Perfil
- [x] `/admin` — Dashboard administrativo con métricas globales: Usuarios Totales, Sin Asignar, IA Fallida
- [x] `/admin/tickets` — Gestión completa de tickets con eliminación
- [x] `/admin/tickets/[id]` — Detalle completo con todas las acciones
- [x] `/admin/users` — Gestión de usuarios (movido desde `/dashboard/admin/users`)
- [x] `/admin/settings` — Configuración del sistema: proveedor IA, umbral de confianza, SLA, categorías
- [x] `/admin/profile` — Perfil del administrador

**Componentes actualizados:**
- [x] `TicketTable`, `TicketDetail`, `RecentTickets` aceptan prop `basePath` para generar links correctos por rol
- [x] `NotificationDropdown` redirige al ticket con la ruta correcta según el rol del usuario
- [x] Componente `ProfilePage` reutilizable para las tres vistas de perfil
- [x] Utilidad `getRoleBasePath(role)` centralizada en `lib/role-utils.ts`

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

- [ ] Chat en vivo con WebSockets (conversación bidireccional instantánea, complementario al sistema de comentarios)
- [ ] Base de conocimiento — respuestas frecuentes que la IA puede referenciar
- [ ] Multi-tenancy — soporte para múltiples organizaciones
- [ ] Integración con Slack/Teams para notificaciones
- [ ] API pública con API keys para integraciones de terceros
