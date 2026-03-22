# RFC #000: Arquitectura General y Flujo de Datos End-to-End

**Estado:** Propuesta
**Autor:** Agente de Arquitectura
**Fecha:** 2026-03-22

---

## 1. Objetivo

Definir la arquitectura completa del sistema AI-First Ticket Management, el flujo de datos entre todos los componentes y los contratos de comunicacion entre servicios.

---

## 2. Vista General del Sistema

```
                         [CLIENTE / AGENTE]
                               |
                          (HTTPS / WSS)
                               |
                    +----------v-----------+
                    |    NEXT.JS FRONTEND   |
                    |    (App Router)        |
                    |  - Dashboard Agente    |
                    |  - Portal Cliente      |
                    |  - WebSocket Client    |
                    +----------+------------+
                               |
                          (HTTPS REST)
                               |
                    +----------v-----------+
                    |     API GATEWAY        |
                    |     (Hono + Bun)       |
                    |  - Rate Limiting       |
                    |  - Auth Middleware      |
                    |  - Zod Validation      |
                    |  - Request Routing     |
                    +----+------+------+----+
                         |      |      |
              +----------+  +---+---+  +----------+
              |             |       |             |
    +---------v--+   +------v----+  +---v--------+
    |  TICKET     |   | AI WORKER |  | AUTH       |
    |  SERVICE    |   | SERVICE   |  | SERVICE    |
    |  (Prisma)   |   | (Strategy)|  | (JWT)      |
    +------+------+   +-----+----+  +---+--------+
           |               |             |
           |          +----v----+        |
           |          |  GEMINI |        |
           |          |  OPENAI |        |
           |          |  MOCK   |        |
           |          +---------+        |
           |                             |
    +------v-----------------------------v------+
    |              POSTGRESQL                    |
    |  - users, tickets, audit_log, ai_results  |
    +-------------------+------------------------+
                        |
    +-------------------v------------------------+
    |                REDIS                        |
    |  - Eventos (ticket.created, ticket.updated) |
    |  - Cache de sesiones                        |
    |  - Rate limiting counters                   |
    +---------------------------------------------+
```

---

## 3. Flujo de Datos: Creacion de Ticket con IA

Este es el flujo principal del sistema, de principio a fin:

### Paso 1: Creacion del ticket
```
Frontend (form submit)
  -> POST /api/tickets { title, description }
  -> API Gateway valida con Zod
  -> Ticket Service crea registro en DB con estado: OPEN, priority: null, category: null
  -> DB devuelve ticket con ID
  -> API Gateway responde al frontend: { ticket_id: 123, status: "OPEN" }
```

### Paso 2: Evento a Redis
```
Ticket Service (post-insert)
  -> Publica en Redis canal "ticket.created": { ticket_id: 123 }
```

### Paso 3: AI Worker procesa
```
AI Worker (suscriptor de "ticket.created")
  -> Recibe evento { ticket_id: 123 }
  -> Lee ticket completo de DB (title + description)
  -> Construye prompt de clasificacion
  -> Llama al AI Provider activo (Gemini/OpenAI/Mock)
  -> Recibe respuesta estructurada:
     {
       category: "Facturacion",
       priority: "HIGH",
       confidence: 0.92,
       suggested_response: "Estimado cliente, para descargar su factura..."
     }
  -> Guarda resultado en tabla ai_results
  -> Actualiza ticket: category, priority, ai_status: "CLASSIFIED"
  -> Publica en Redis: "ticket.classified": { ticket_id: 123 }
```

### Paso 4: Frontend recibe actualizacion (real-time)
```
Redis "ticket.classified"
  -> API Gateway recibe evento
  -> Envia via WebSocket al frontend
  -> Frontend actualiza el ticket en pantalla:
     - Campos de prioridad y categoria se autocompletan
     - Badge: "Sugerido por IA (92% confianza)"
     - Borrador de respuesta disponible
```

### Paso 5: Agente revisa y actua
```
Agente ve el ticket clasificado:
  Opcion A: Acepta clasificacion + aplica sugerencia -> ticket resuelto
  Opcion B: Corrige clasificacion -> se registra override en audit_log
  Opcion C: Escribe respuesta propia -> se registra como manual
```

### Flujo de Fallback (si la IA falla)
```
AI Worker
  -> Llama al AI Provider -> ERROR (timeout, rate limit, API down)
  -> Retry con backoff exponencial (3 intentos: 1s, 4s, 16s)
  -> Si todos fallan:
     -> Marca ticket: ai_status: "FAILED"
     -> Publica: "ticket.ai_failed": { ticket_id: 123, error: "timeout" }
     -> El ticket queda con priority y category en null
     -> El agente lo clasifica manualmente (formulario lo permite)
```

---

## 4. Contratos de Comunicacion entre Servicios

### 4.1 API Gateway <-> Ticket Service

| Endpoint | Metodo | Request Body | Response |
|----------|--------|-------------|----------|
| /api/tickets | POST | `{ title, description, ?priority, ?category }` | `{ id, title, description, status, priority, category, created_at }` |
| /api/tickets | GET | Query: `?status, ?priority, ?category, ?page, ?limit` | `{ data: Ticket[], meta: { total, page, limit } }` |
| /api/tickets/:id | GET | - | `Ticket + ai_result` |
| /api/tickets/:id | PATCH | `{ ?status, ?priority, ?category, ?response }` | `Ticket updated` |
| /api/tickets/:id/respond | POST | `{ message, apply_ai_suggestion: boolean }` | `{ ticket_id, response, responded_by }` |

### 4.2 Eventos Redis (Pub/Sub)

| Canal | Payload | Productor | Consumidor |
|-------|---------|-----------|------------|
| ticket.created | `{ ticket_id }` | Ticket Service | AI Worker |
| ticket.classified | `{ ticket_id, category, priority, confidence }` | AI Worker | API Gateway (-> WebSocket) |
| ticket.ai_failed | `{ ticket_id, error, attempts }` | AI Worker | API Gateway (-> WebSocket) |
| ticket.updated | `{ ticket_id, changes, agent_id }` | Ticket Service | API Gateway (-> WebSocket) |
| ticket.closed | `{ ticket_id, resolution, agent_id }` | Ticket Service | API Gateway (-> WebSocket) |

### 4.3 AI Provider Contract (Strategy Pattern)

Todos los providers deben implementar la misma interfaz:

```
Interface AIClassifier {
  classify(input: {
    title: string
    description: string
  }): Promise<{
    category: string
    priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    confidence: number       // 0.0 - 1.0
    suggested_response: string
  }>
}

Implementaciones:
  - GeminiClassifier  -> Gemini 2.0 Flash (gratis, desarrollo)
  - OpenAIClassifier  -> GPT-4o (pago, produccion)
  - MockClassifier    -> Respuestas fijas (testing, sin API)
```

Variable de entorno que controla cual se usa:
```
AI_PROVIDER=gemini | openai | mock
```

---

## 5. Estrategia de Errores Unificada

Todos los servicios responden errores con el mismo formato:

```
{
  "success": false,
  "error": {
    "code": "TICKET_NOT_FOUND",
    "message": "Ticket with ID 123 does not exist",
    "status": 404
  }
}
```

Codigos de error estandar:

| Codigo | Status HTTP | Cuando |
|--------|-------------|--------|
| VALIDATION_ERROR | 400 | Zod rechaza el input |
| UNAUTHORIZED | 401 | Token invalido o ausente |
| FORBIDDEN | 403 | Sin permisos para la accion |
| NOT_FOUND | 404 | Recurso no existe |
| RATE_LIMITED | 429 | Demasiadas requests |
| AI_CLASSIFICATION_FAILED | 502 | AI Provider fallo |
| INTERNAL_ERROR | 500 | Error no manejado |

---

## 6. Decisiones de Arquitectura y Justificacion

| Decision | Justificacion |
|----------|--------------|
| **Monorepo (Turborepo + pnpm)** | Shared package para Zod schemas evita duplicacion de tipos entre servicios. Builds incrementales con cache |
| **Hono como Gateway** | Ligero, tipado nativo con TypeScript, compatible con Bun para performance. Mas adecuado que Express para un gateway |
| **Redis Pub/Sub (no HTTP directo)** | Desacopla servicios. El Ticket Service no necesita saber que el AI Worker existe. Permite agregar mas consumidores sin modificar el productor |
| **Strategy Pattern para IA** | Permite cambiar de provider sin tocar logica de negocio. Facilita testing con MockClassifier. Ahorra costos en desarrollo con Gemini gratis |
| **PostgreSQL unico (no DB por servicio)** | Para la escala de este proyecto, una DB con schemas separados es suficiente. Microservicios con DBs separadas agrega complejidad sin beneficio a esta escala |
| **WebSockets para real-time** | Polling es ineficiente para un dashboard donde los tickets llegan constantemente. WebSocket da UX inmediata |
| **Cursor-based pagination** | Offset pagination se degrada con tablas grandes. Cursor es consistente y performante |

---

## 7. Estructura del Monorepo

```
project-ticket-gestion/
  apps/
    gateway/          # Hono + Bun (API Gateway)
    ticket-service/   # Node.js + Prisma (logica de tickets)
    ai-worker/        # Consumidor Redis + AI classification
    web/              # Next.js 15 (frontend)
  packages/
    shared/           # @repo/shared - Zod schemas, tipos, constantes
    config/           # @repo/config - ESLint, TypeScript, Prettier configs
  docker/
    docker-compose.yml
    Dockerfile.gateway
    Dockerfile.ticket-service
    Dockerfile.ai-worker
  docs/
    rfcs/             # Propuestas tecnicas (este archivo)
  turbo.json
  pnpm-workspace.yaml
  .env.example
```

---

## 8. Proximos RFCs

- **RFC #001:** Modelo de Datos (esquemas Prisma, validaciones Zod, indices)
- **RFC #002:** Seguridad (Auth flow, RBAC, mitigaciones)
- **RFC #003:** AI Worker (prompt engineering, retry logic, feedback loop)
- **RFC #004:** Frontend Dashboard (componentes, estado, WebSocket integration)
- **RFC #005:** Observabilidad y DevOps (logging, metricas, CI/CD)
