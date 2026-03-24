# RFC #002: Hardening de Seguridad

**Estado:** Implementado
**Autor:** Agente de Arquitectura
**Fecha:** 2026-03-23
**Implementado:** 2026-03-24

---

## Alcance

Solo cubre los gaps de seguridad que el proyecto actual NO tenia implementados. Auth, RBAC, JWT, email verification, password reset ya estaban resueltos.

**Resultado: 6/6 items implementados.**

---

## 1. Confidence Threshold para IA [IMPLEMENTADO]

**Problema:** Si la IA clasifica con 20% de confianza, se aplica igual que una con 95%.

**Solucion:**

Variable de entorno:
```
AI_CONFIDENCE_THRESHOLD=0.6
```

Logica en el processor del AI Worker:
```
classification = await classifier.classify(input)

if (classification.confidence < AI_CONFIDENCE_THRESHOLD) {
  -> aiStatus: "PENDING_MANUAL_REVIEW"
  -> Se guarda el AiResult (para que el agente vea la sugerencia)
  -> Pero NO se aplica category/priority al ticket automaticamente
  -> El agente decide si acepta o corrige
} else {
  -> aiStatus: "CLASSIFIED"
  -> Se aplica category/priority al ticket
  -> Flujo normal
}
```

**Donde:** `services/ai-worker/src/processor.ts`

**Implementacion:**
- `processor.ts`: Parametro `confidenceThreshold` con default 0.6
- Clasificaciones con confianza < threshold se marcan como `PENDING_MANUAL_REVIEW`
- Se guarda el AiResult pero no se aplica category/priority automaticamente
- Config validada con Zod en `@repo/shared` (`AI_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.6)`)

---

## 2. Rate Limiting por Usuario Autenticado [IMPLEMENTADO]

**Problema:** El rate limiting actual es solo por IP. Un usuario autenticado puede abusar desde multiples IPs sin restriccion.

**Solucion:**

Agregar rate limiting dual (por IP + por userId):

| Endpoint | Limite por IP | Limite por usuario |
|----------|--------------|-------------------|
| POST /api/tickets | 100/min | 20/min |
| POST /api/tickets/:id/comments | 100/min | 30/min |
| POST /api/tickets/:id/attachments | 50/min | 10/min |
| POST /api/auth/forgot-password | 10/min | 3/hora por email |
| POST /api/auth/resend-verification | 10/min | 3/hora |

**Implementacion:** Usar Redis para almacenar contadores por `userId` con TTL. El middleware del API Gateway ya tiene acceso al userId del JWT.

**Donde:** `services/api-gateway/src/middleware/`

**Implementacion:**
- `user-rate-limiter.ts` creado en api-gateway
- Extrae `userId` del JWT (`c.get("user").sub`)
- Contadores en Redis con clave `rl:{prefix}:{userId}` y TTL
- Aplicado en endpoints: tickets (20/min), comments (30/min), attachments (10/min), auth endpoints

---

## 3. Transacciones Atomicas [IMPLEMENTADO]

**Problema:** Operaciones compuestas (crear ticket + audit log + publicar evento) no son atomicas. Si falla a mitad, la DB queda inconsistente.

**Solucion:**

### Paso 1: Prisma $transaction para operaciones de DB
```
Agrupar en una sola transaccion:
  1. Crear/actualizar ticket
  2. Crear audit log
  3. Crear AiResult (si aplica)

Si cualquiera falla, se hace rollback de todo.
```

### Paso 2: Transactional Outbox para Redis
```
En vez de publicar directamente a Redis despues del insert:
  1. Dentro de la transaccion, insertar un registro en tabla "outbox"
  2. Un proceso aparte (o el mismo servicio) lee la tabla outbox
  3. Publica el evento a Redis
  4. Marca el registro como publicado

Esto garantiza que el evento solo se publica si la DB commit fue exitoso.
```

Modelo outbox:
```prisma
model Outbox {
  id        String   @id @default(uuid())
  event     String                        // "ticket.created"
  payload   Json                          // { ticketId, data }
  published Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([published, createdAt])
  @@map("outbox")
}
```

**Donde:** `services/ticket-service/src/services/` y `packages/database/prisma/schema.prisma`

**Implementacion:**
- `prisma.$transaction()` usado en creacion de tickets (ticket + audit log + outbox en una sola transaccion)
- Modelo `Outbox` agregado al schema de Prisma con campos: event, payload (Json), published, createdAt
- Indice en `[published, createdAt]` para procesamiento eficiente

---

## 4. Content Security Policy (CSP) [IMPLEMENTADO]

**Problema:** No hay header CSP. Un atacante podria inyectar scripts externos.

**Solucion:**

Agregar en el API Gateway:
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  connect-src 'self' ws://localhost:* wss://*;
  font-src 'self';
  object-src 'none';
  frame-ancestors 'none';
```

Tambien agregar en Next.js via `next.config.js` headers.

**Donde:** `services/api-gateway/src/index.ts` (hono secure-headers) y `frontend/app/next.config.js`

**Implementacion:**
- CSP configurado en api-gateway via `secureHeaders` de Hono con todas las directivas especificadas
- `default-src 'self'`, `script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`
- WebSocket permitido via `connect-src 'self' ws://localhost:* wss://*`

---

## 5. Sanitizacion de HTML (XSS) [IMPLEMENTADO]

**Problema:** Si un usuario escribe `<script>alert('xss')</script>` en la descripcion del ticket o comentario, podria ejecutarse en el navegador del agente.

**Solucion:**

### Backend (defensa primaria):
Sanitizar en el punto de entrada. Antes de guardar en DB, limpiar HTML de:
- Titulo del ticket
- Descripcion del ticket
- Contenido de comentarios

Usar una libreria como `sanitize-html` o `isomorphic-dompurify` en el ticket-service.

### Frontend (defensa secundaria):
React ya escapa HTML por defecto con JSX. Pero si en algun lugar se usa `dangerouslySetInnerHTML`, aplicar DOMPurify antes.

Verificar que ningun componente renderice contenido de usuario con `dangerouslySetInnerHTML`.

**Donde:** `services/ticket-service/src/routes/tickets.ts`, `services/ticket-service/src/routes/comments.ts`

**Implementacion:**
- `sanitize-html@2.17.2` instalado en ticket-service
- `lib/sanitize.ts` creado con config estricta: `allowedTags: []`, `disallowedTagsMode: "recursiveEscape"`
- Aplicado en: creacion de tickets (title + description), actualizacion de tickets, creacion de comentarios
- Frontend: cero usos de `dangerouslySetInnerHTML` (React escapa por defecto)

---

## 6. Proteccion del Ultimo Admin [IMPLEMENTADO]

**Problema:** Si un admin se degrada a si mismo o desactiva su cuenta, el sistema puede quedar sin administradores.

**Solucion:**

En el endpoint PATCH /api/users/:id/role y PATCH /api/users/:id/active:
```
1. Contar admins activos en DB
2. Si el usuario objetivo es ADMIN y la accion lo removeria del rol:
   - Si es el unico admin activo -> rechazar con error:
     "No se puede modificar al unico administrador del sistema"
   - Si hay otros admins -> permitir
```

**Donde:** `services/ticket-service/src/routes/users.ts`

**Implementacion:**
- En PATCH role: verifica `countActiveAdmins()` antes de degradar un ADMIN
- En PATCH active: verifica `countActiveAdmins()` antes de desactivar un ADMIN
- Si es el unico admin, lanza `ForbiddenError("No se puede modificar al unico administrador del sistema")`

---

## Resumen de Implementacion

| # | Item | Estado | Ubicacion |
|---|------|--------|-----------|
| 1 | Confidence Threshold | IMPLEMENTADO | `ai-worker/src/processor.ts`, `@repo/shared/config.ts` |
| 2 | Rate Limiting por Usuario | IMPLEMENTADO | `api-gateway/src/middleware/user-rate-limiter.ts` |
| 3 | Transacciones Atomicas | IMPLEMENTADO | `ticket-service/src/routes/tickets.ts`, `database/prisma/schema.prisma` (Outbox) |
| 4 | CSP Headers | IMPLEMENTADO | `api-gateway/src/index.ts` (secureHeaders) |
| 5 | Sanitizacion XSS | IMPLEMENTADO | `ticket-service/src/lib/sanitize.ts`, rutas de tickets y comments |
| 6 | Proteccion Ultimo Admin | IMPLEMENTADO | `ticket-service/src/routes/users.ts` |
