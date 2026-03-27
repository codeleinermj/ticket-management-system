# RFC #005: Observabilidad y DevOps

**Estado:** Propuesta
**Autor:** Agente de Arquitectura
**Fecha:** 2026-03-24

---

## Objetivo

Cerrar los gaps de infraestructura, despliegue y monitoreo del proyecto. Actualmente el sistema funciona localmente pero no tiene: migraciones de DB, Dockerfiles para servicios, CI/CD, logging centralizado, metricas ni alertas.

---

## 1. Migraciones de Base de Datos

### Problema
Se usa `prisma db push` que aplica cambios directamente al schema sin historial. En produccion esto puede causar perdida de datos (ej: renombrar una columna = borrar + crear).

### Solucion

Migrar a `prisma migrate`:

```
# Crear migracion inicial desde el schema actual
cd packages/database
npx prisma migrate dev --name init

# Para cada cambio futuro
npx prisma migrate dev --name add_ticket_read_model

# En produccion (solo aplica, no crea)
npx prisma migrate deploy
```

### Estructura resultante
```
packages/database/
  prisma/
    schema.prisma
    migrations/
      20260324000000_init/
        migration.sql
      20260324000001_add_ticket_read/
        migration.sql
```

### Reglas
- Nunca editar una migracion ya aplicada
- Cada cambio al schema genera una nueva migracion
- Las migraciones se commitean al repo (son parte del codigo)
- En CI: `prisma migrate deploy` antes de iniciar los servicios
- Seed data para desarrollo:

```
packages/database/
  prisma/
    seed.ts    // Crea: 1 admin, 2 agentes, 3 usuarios, 10 tickets de ejemplo
```

Script en package.json:
```json
"db:seed": "tsx prisma/seed.ts"
```

---

## 2. Dockerfiles para Servicios

### Problema
Docker Compose levanta PostgreSQL, Redis y MailDev, pero los 3 servicios (gateway, ticket-service, ai-worker) corren localmente con `bun run` / `tsx watch`. No se pueden desplegar.

### Solucion

Un Dockerfile por servicio con multi-stage build:

### API Gateway (Bun)
```dockerfile
# Stage 1: Install dependencies
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY services/api-gateway/package.json ./services/api-gateway/
RUN bun install --frozen-lockfile

# Stage 2: Build
FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build --filter=api-gateway

# Stage 3: Production
FROM oven/bun:1-slim AS runner
WORKDIR /app
COPY --from=builder /app/services/api-gateway/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["bun", "run", "dist/index.js"]
```

### Ticket Service (Bun)
```dockerfile
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY services/ticket-service/package.json ./services/ticket-service/
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bunx prisma generate --schema=packages/database/prisma/schema.prisma
RUN bun run build --filter=ticket-service

FROM oven/bun:1-slim AS runner
WORKDIR /app
COPY --from=builder /app/services/ticket-service/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/database/prisma ./prisma
EXPOSE 3001
CMD ["sh", "-c", "bunx prisma migrate deploy --schema=./prisma/schema.prisma && bun run dist/index.js"]
```

### AI Worker (Node.js)
```dockerfile
FROM node:20-slim AS deps
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY services/ai-worker/package.json ./services/ai-worker/
RUN pnpm install --frozen-lockfile

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma
RUN pnpm run build --filter=ai-worker

FROM node:20-slim AS runner
WORKDIR /app
COPY --from=builder /app/services/ai-worker/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]
```

### Frontend (Next.js)
```dockerfile
FROM node:20-slim AS deps
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_PUBLIC_API_URL=http://api-gateway:3000
RUN pnpm build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

### Docker Compose actualizado (produccion)
```yaml
services:
  postgres:
    image: postgres:16-alpine
    # ... (igual que ahora)

  redis:
    image: redis:7-alpine
    # ... (igual que ahora)

  api-gateway:
    build:
      context: .
      dockerfile: docker/Dockerfile.gateway
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    env_file: .env

  ticket-service:
    build:
      context: .
      dockerfile: docker/Dockerfile.ticket-service
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    env_file: .env

  ai-worker:
    build:
      context: .
      dockerfile: docker/Dockerfile.ai-worker
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    env_file: .env

  frontend:
    build:
      context: ../frontend/app
      dockerfile: Dockerfile
    ports:
      - "8080:3000"
    depends_on:
      - api-gateway
```

### Archivos Docker
```
backend/
  docker/
    Dockerfile.gateway
    Dockerfile.ticket-service
    Dockerfile.ai-worker
    docker-compose.yml          # desarrollo (solo infra)
    docker-compose.prod.yml     # produccion (todo containerizado)
  .dockerignore

frontend/app/
  Dockerfile
  .dockerignore
```

### .dockerignore
```
node_modules
.next
dist
.env
*.log
.git
```

---

## 3. CI/CD Pipeline (GitHub Actions)

### Problema
No hay automatizacion. Cada push puede romper algo sin que nadie lo sepa.

### Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [master, main]
  pull_request:
    branches: [master, main]

jobs:
  lint-and-type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
        working-directory: backend
      - run: pnpm lint
        working-directory: backend
      - run: pnpm type-check
        working-directory: backend

  test-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: ticket_gestion_test
        ports:
          - 5433:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
        working-directory: backend
      - run: npx prisma migrate deploy
        working-directory: backend/packages/database
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5433/ticket_gestion_test
      - run: pnpm test
        working-directory: backend
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5433/ticket_gestion_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-secret-ci
          JWT_REFRESH_SECRET: test-refresh-ci
          AI_PROVIDER: mock

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
        working-directory: frontend/app
      - run: pnpm build
        working-directory: frontend/app
        env:
          NEXT_PUBLIC_API_URL: http://localhost:3000

  build-docker:
    needs: [lint-and-type-check, test-backend, test-frontend]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/master'
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - run: docker compose -f backend/docker/docker-compose.prod.yml build
```

### Que hace cada job
| Job | Que verifica | Cuando falla |
|-----|-------------|-------------|
| lint-and-type-check | Errores de ESLint + TypeScript | Codigo con errores de tipo o estilo |
| test-backend | Unit + integration tests con DB y Redis reales | Logica rota |
| test-frontend | Build de Next.js exitoso | Componentes rotos o imports faltantes |
| build-docker | Las imagenes Docker se construyen | Dockerfile mal configurado |

---

## 4. Logging Estructurado

### Problema
Los logs actuales son `console.log` o el logger basico de `@repo/shared`. En produccion con 3 servicios, los logs se mezclan y no se pueden filtrar.

### Solucion

Logger estructurado JSON con contexto:

```
Cada log entry tiene:
{
  "timestamp": "2026-03-24T14:30:00.000Z",
  "level": "info",
  "service": "ticket-service",
  "requestId": "req-abc-123",        // correlation ID
  "userId": "user-uuid",
  "message": "Ticket created",
  "data": {
    "ticketId": "ticket-uuid",
    "title": "No puedo pagar"
  }
}
```

### Correlation ID (Request Tracing)

Cada request que entra al API Gateway recibe un ID unico:

```
1. Request llega al Gateway
   -> Genera X-Request-ID: "req-abc-123"
   -> Lo agrega a los headers
   -> Lo pasa al Ticket Service

2. Ticket Service lo recibe
   -> Lo incluye en cada log
   -> Lo pasa en el evento Redis

3. AI Worker lo recibe del evento
   -> Lo incluye en sus logs

4. Si algo falla, buscar "req-abc-123" en los logs
   -> Ves TODO el recorrido del request
```

### Implementacion

Middleware en el API Gateway:
```
Generar requestId -> agregar a headers -> pasar a downstream services
```

Cada servicio extrae el requestId del header y lo inyecta en su logger context.

### Niveles de log

| Nivel | Cuando | Ejemplo |
|-------|--------|---------|
| ERROR | Algo fallo y necesita atencion | DB connection lost, AI provider timeout |
| WARN | Algo inesperado pero manejado | Rate limit hit, low confidence classification |
| INFO | Operaciones normales importantes | Ticket created, user logged in, AI classified |
| DEBUG | Detalle para desarrollo | Query executed, Redis event published |

### Reglas
- En produccion: solo INFO y superiores
- En desarrollo: todos los niveles
- Nunca loggear: passwords, tokens, API keys, datos sensibles
- Siempre loggear: requestId, userId, accion, resultado

---

## 5. Health Checks

### Problema
No hay forma de saber si un servicio esta sano sin hacer un request real.

### Solucion

Endpoint `/health` en cada servicio:

```
GET /health

Response 200:
{
  "status": "healthy",
  "service": "ticket-service",
  "uptime": 3600,
  "checks": {
    "database": "connected",
    "redis": "connected"
  }
}

Response 503:
{
  "status": "unhealthy",
  "service": "ticket-service",
  "checks": {
    "database": "disconnected",
    "redis": "connected"
  }
}
```

### Checks por servicio

| Servicio | Checks |
|----------|--------|
| API Gateway | Ticket Service reachable, Redis connected |
| Ticket Service | PostgreSQL connected, Redis connected |
| AI Worker | PostgreSQL connected, Redis connected, AI Provider reachable |

### Uso en Docker Compose
```yaml
ticket-service:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
    interval: 30s
    timeout: 10s
    retries: 3
```

---

## 6. Metricas

### Problema
No hay visibilidad de performance, uso ni tendencias.

### Solucion

Metricas basicas expuestas en endpoint `/metrics` (formato Prometheus):

```
# Requests
http_requests_total{service="gateway", method="POST", path="/api/tickets", status="200"} 1523
http_requests_total{service="gateway", method="POST", path="/api/tickets", status="400"} 12

# Latencia
http_request_duration_seconds{service="gateway", path="/api/tickets", quantile="0.95"} 0.250

# Tickets
tickets_created_total 450
tickets_classified_total 420
tickets_classification_failed_total 30
tickets_classification_confidence_avg 0.82

# AI
ai_classification_duration_seconds{provider="gemini", quantile="0.95"} 1.200
ai_provider_errors_total{provider="gemini"} 5

# System
process_uptime_seconds 86400
db_connection_pool_active 5
redis_connected 1
```

### Implementacion

Usar una libreria ligera como `prom-client` (Node.js) para exponer metricas:

```
Cada servicio:
  GET /metrics -> texto Prometheus

En produccion:
  Prometheus scrapes /metrics cada 30s
  Grafana visualiza los dashboards
```

### Dashboards sugeridos (Grafana)

| Dashboard | Que muestra |
|-----------|-------------|
| API Overview | Requests/sec, latencia p95, error rate |
| Ticket Pipeline | Tickets creados vs clasificados, tiempo de clasificacion |
| AI Performance | Confianza promedio, fallos por provider, latencia |
| System Health | Uptime, conexiones DB, memoria, CPU |

---

## 7. Environments

### Problema
No hay separacion entre desarrollo, staging y produccion.

### Solucion

Tres environments con configuracion separada:

```
.env.example          # Template (se commitea)
.env                  # Desarrollo local (NO se commitea)
.env.staging          # Staging (NO se commitea)
.env.production       # Produccion (NO se commitea, en secrets manager)
```

### Diferencias por environment

| Config | Development | Staging | Production |
|--------|-------------|---------|------------|
| AI_PROVIDER | mock | gemini | openai |
| AI_CONFIDENCE_THRESHOLD | 0.3 | 0.5 | 0.6 |
| LOG_LEVEL | debug | info | info |
| RATE_LIMIT_MAX | 1000 | 200 | 100 |
| EMAIL_PROVIDER | maildev | resend | resend |
| STORAGE_PROVIDER | local | s3 | s3 |
| DB | localhost:5433 | staging-db-url | prod-db-url |
| CORS_ORIGINS | localhost:* | staging-domain | prod-domain |

### .env.example (se commitea como referencia)
```
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ticket_gestion

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=change-me-in-production
JWT_REFRESH_SECRET=change-me-in-production

# AI
AI_PROVIDER=mock
AI_CONFIDENCE_THRESHOLD=0.6
OPENAI_API_KEY=
GEMINI_API_KEY=

# Email
EMAIL_PROVIDER=maildev
SMTP_HOST=localhost
SMTP_PORT=1025
EMAIL_FROM=soporte@ticketgestion.com

# Storage
STORAGE_PROVIDER=local
STORAGE_PATH=./uploads

# Services
PORT=3000
TICKET_SERVICE_PORT=3001
TICKET_SERVICE_URL=http://localhost:3001
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Logging
LOG_LEVEL=debug
NODE_ENV=development
```

---

## 8. Alertas

### Problema
Si algo falla en produccion, nadie se entera hasta que un usuario reporta.

### Solucion

Alertas basadas en metricas y logs:

| Alerta | Condicion | Severidad | Accion |
|--------|-----------|-----------|--------|
| DB down | health check falla 3 veces | CRITICA | Notificar inmediato |
| Redis down | health check falla 3 veces | CRITICA | Notificar inmediato |
| AI Worker down | No clasifica tickets en 10 min | ALTA | Notificar en 5 min |
| Error rate > 5% | 5xx responses / total > 0.05 | ALTA | Notificar en 5 min |
| Latencia p95 > 2s | http_request_duration > 2s | MEDIA | Notificar en 15 min |
| AI confidence baja | Promedio < 0.5 en 1 hora | BAJA | Revisar prompts |
| Disco > 80% | Espacio usado > 80% | MEDIA | Limpiar uploads/logs |

### Canales de notificacion
- **Desarrollo:** Console logs
- **Staging:** Slack webhook
- **Produccion:** Slack + email al equipo de ops

---

## Prioridad de Implementacion

| Orden | Item | Impacto | Esfuerzo |
|-------|------|---------|----------|
| 1 | Migraciones de DB | Previene perdida de datos en produccion | Bajo |
| 2 | .env.example + environments | Permite colaboracion y deploy | Bajo |
| 3 | Dockerfiles | Habilita despliegue real | Medio |
| 4 | CI/CD (GitHub Actions) | Automatiza validacion en cada push | Medio |
| 5 | Logging estructurado + Correlation ID | Habilita debugging en produccion | Medio |
| 6 | Health checks | Docker y orquestadores dependen de esto | Bajo |
| 7 | Metricas (Prometheus) | Visibilidad de performance | Medio |
| 8 | Alertas | Deteccion proactiva de fallos | Bajo (si metricas existen) |

---

## Resumen

| Area | Estado actual | Despues de este RFC |
|------|--------------|-------------------|
| Migraciones DB | prisma db push (peligroso) | prisma migrate (con historial) |
| Docker | Solo infra (postgres, redis) | Todo containerizado |
| CI/CD | No existe | GitHub Actions (lint, test, build) |
| Logging | console.log basico | JSON estructurado + correlation ID |
| Health checks | Solo en gateway | Todos los servicios |
| Metricas | No existen | Prometheus + Grafana |
| Environments | Solo .env local | dev / staging / prod separados |
| Alertas | No existen | Slack + email por severidad |
