# RFC #006: Features Faltantes

**Estado:** Propuesta
**Autor:** Agente de Arquitectura
**Fecha:** 2026-03-22

---

## Feature #7: Busqueda Avanzada

### Estado actual
Solo busqueda por keyword (titulo/descripcion). No hay filtros por fecha, agente ni confianza IA.

### Diseno

#### Endpoint mejorado
```
GET /api/tickets?search=factura
                &status=OPEN
                &priority=HIGH
                &category=BILLING
                &assignedTo=uuid-del-agente
                &unassigned=true
                &aiStatus=CLASSIFIED
                &confidenceMin=0.7
                &confidenceMax=1.0
                &dateFrom=2026-03-01
                &dateTo=2026-03-22
                &sortBy=createdAt|priority|confidence
                &sortOrder=asc|desc
                &page=1
                &limit=20
```

#### Filtros nuevos en el frontend

```
+----------------------------------------------------------------+
| Filtros                                                [Limpiar]|
| [Buscar...        ] [Estado v] [Prioridad v] [Categoria v]     |
| [Fecha desde] [Fecha hasta] [Agente v] [Estado IA v]           |
| [Confianza IA: [====o====] 70% - 100%]                         |
| Ordenar por: [Fecha v] [Asc/Desc]                              |
+----------------------------------------------------------------+
```

**Vista por rol:**
- USER: Solo ve busqueda por keyword + estado (filtra sobre sus tickets)
- AGENT: Todos los filtros excepto "por agente" se limita a agentes activos
- ADMIN: Todos los filtros + filtro por agente creador

#### Filtros guardados (AGENT/ADMIN)
```
Boton [Guardar filtro actual] -> Nombre: "Tickets criticos sin asignar"
Se almacena en localStorage (no en DB, es preferencia de UI)
Aparecen como tabs rapidos:
  [Todos] [Mis tickets] [Sin asignar] [Criticos sin asignar*]
                                        (* = filtro guardado)
```

#### Indices de DB necesarios
```prisma
@@index([createdAt])
@@index([confidence])
@@index([aiStatus, confidence])    // buscar por confianza IA
@@index([assignedToId, status])    // "mis tickets abiertos"
```

---

## Feature #8: Adjuntos / Archivos

### Estado actual
No existe. Los tickets no soportan screenshots ni documentos.

### Diseno

#### Modelo de datos
```prisma
model Attachment {
  id         String   @id @default(uuid())
  filename   String                        // nombre original: "screenshot.png"
  storagePath String                       // ruta en disco/S3: "uploads/2026/03/uuid.png"
  mimeType   String                        // "image/png", "application/pdf"
  size       Int                           // bytes
  ticketId   String
  ticket     Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  uploadedById String
  uploadedBy   User   @relation(fields: [uploadedById], references: [id])
  createdAt  DateTime @default(now())

  @@index([ticketId])
  @@map("attachments")
}
```

#### Restricciones de seguridad

| Regla | Valor | Justificacion |
|-------|-------|--------------|
| Tamano maximo por archivo | 10 MB | Evitar abuso de storage |
| Tamano maximo por ticket | 50 MB | Limite razonable |
| Archivos permitidos | jpg, png, gif, pdf, doc, docx, xlsx, txt, csv | Solo tipos comunes de soporte |
| Archivos prohibidos | exe, bat, sh, js, php, py, zip, rar | Prevenir ejecucion de malware |
| Max archivos por ticket | 10 | Evitar spam |

#### Validacion de archivos
```
1. Verificar extension del nombre
2. Verificar MIME type real (leer magic bytes, no confiar en Content-Type del header)
3. Verificar tamano
4. Renombrar a UUID (evitar path traversal: "../../../etc/passwd.png")
5. Guardar en carpeta fuera del webroot
```

#### Almacenamiento
```
Desarrollo: Disco local -> /uploads/{year}/{month}/{uuid}.{ext}
Produccion: S3/MinIO -> bucket "ticket-attachments"

Strategy Pattern (igual que AI):
  StorageProvider (interfaz)
    -> LocalStorage    (desarrollo)
    -> S3Storage       (produccion)

Variable de entorno:
  STORAGE_PROVIDER=local | s3
  STORAGE_PATH=./uploads
  S3_BUCKET=ticket-attachments
  S3_REGION=us-east-1
```

#### Endpoints

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| POST /api/tickets/:id/attachments | POST (multipart) | Subir archivo |
| GET /api/tickets/:id/attachments | GET | Listar adjuntos del ticket |
| GET /api/attachments/:id/download | GET | Descargar archivo (stream) |
| DELETE /api/attachments/:id | DELETE | Eliminar (AGENT/ADMIN) |

#### UI del cliente
```
Crear ticket:
  [Titulo: ________________]
  [Descripcion: ___________]
  [Adjuntar archivos] <- drag & drop zone o boton
  Archivos: screenshot.png (1.2MB) [x]
            error-log.txt (0.5MB) [x]
  [Crear ticket]

Ver ticket:
  ADJUNTOS (2):
  +------------------+  +------------------+
  | [thumbnail]      |  | [icono PDF]      |
  | screenshot.png   |  | factura.pdf      |
  | 1.2 MB           |  | 0.8 MB           |
  | [Descargar] [x]  |  | [Descargar] [x]  |
  +------------------+  +------------------+
```

Las imagenes se muestran como thumbnail preview. Los documentos como icono generico.

---

## Feature #9: Acciones en Bulk

### Estado actual
No existe. Cada ticket se gestiona individualmente.

### Diseno

#### UI
```
+----------------------------------------------------------------+
| TICKETS                                    [Acciones bulk v]    |
|                                            - Cambiar estado     |
|                                            - Asignar a agente   |
|                                            - Cambiar prioridad  |
|                                            - Eliminar (admin)   |
|----------------------------------------------------------------|
| [x] | Titulo          | Estado | Prioridad | Asignado          |
|-----|-----------------|--------|-----------|-------------------|
| [x] | No puedo pagar  | OPEN   | HIGH      | -                 |
| [x] | Error login     | OPEN   | MEDIUM    | -                 |
| [ ] | Cambiar plan    | RESOL  | LOW       | Juan              |
|----------------------------------------------------------------|
| 2 tickets seleccionados    [Aplicar accion]                    |
+----------------------------------------------------------------+
```

**Interaccion:**
1. Checkbox en la primera columna de cada fila
2. Checkbox en el header para "seleccionar todos" (de la pagina actual)
3. Al seleccionar 1+, aparece barra de acciones bulk
4. Seleccionar accion -> confirmar -> ejecutar

#### Endpoint

```
POST /api/tickets/bulk
{
  "ticketIds": ["uuid-1", "uuid-2", "uuid-3"],
  "action": "update_status" | "assign" | "update_priority" | "delete",
  "data": {
    "status": "CLOSED",         // si action = update_status
    "assignedToId": "uuid",     // si action = assign
    "priority": "HIGH"          // si action = update_priority
  }
}

Response:
{
  "success": true,
  "processed": 3,
  "failed": 0,
  "results": [
    { "ticketId": "uuid-1", "status": "ok" },
    { "ticketId": "uuid-2", "status": "ok" },
    { "ticketId": "uuid-3", "status": "ok" }
  ]
}
```

#### Reglas
- Maximo 50 tickets por operacion bulk
- Cada ticket genera su propio audit log (no un log "bulk")
- Si 1 de 10 falla, los otros 9 se procesan igual (no es transaccional)
- Solo AGENT y ADMIN pueden usar bulk
- Delete bulk solo ADMIN
- Se publica un evento Redis por cada ticket modificado (no un evento "bulk")

---

## Feature #10: Exportar Datos

### Estado actual
No existe.

### Diseno

#### Formatos soportados
- **CSV** — Universal, abre en Excel/Sheets
- **XLSX** — Excel nativo (opcional, requiere libreria extra)

#### Endpoint

```
GET /api/tickets/export?format=csv
                       &status=OPEN
                       &priority=HIGH
                       &dateFrom=2026-03-01
                       &dateTo=2026-03-22

Response: File download (Content-Disposition: attachment)
```

Acepta los mismos filtros que el GET /api/tickets. Exporta lo que el usuario ve con sus filtros actuales.

#### Columnas del CSV
```
ID, Titulo, Descripcion, Estado, Prioridad, Categoria, Estado IA, Confianza IA,
Creado por, Asignado a, Fecha creacion, Fecha actualizacion
```

#### Reglas
- Maximo 10,000 filas por exportacion (evitar OOM)
- Si hay mas, mostrar mensaje: "Aplica filtros para reducir resultados"
- Se genera en streaming (no cargar todo en memoria)
- Solo AGENT y ADMIN pueden exportar
- USER no puede exportar (no tiene sentido con 5 tickets)

#### UI
```
Boton en la barra de filtros:
  [Filtros...] [Limpiar] [Exportar CSV v]
                           - Exportar CSV
                           - Exportar Excel
```

---

## Feature #11: SLA Tracking

### Estado actual
No existe. No hay indicador de tiempo de respuesta.

### Diseno

#### Configuracion de SLA (Admin)

```
SLA por prioridad (tiempo maximo para primera respuesta):

| Prioridad | SLA          |
|-----------|-------------|
| CRITICAL  | 1 hora      |
| HIGH      | 4 horas     |
| MEDIUM    | 8 horas     |
| LOW       | 24 horas    |
```

Se almacena en una tabla de configuracion:

```prisma
model SlaConfig {
  id        String         @id @default(uuid())
  priority  TicketPriority @unique
  maxResponseMinutes Int               // 60, 240, 480, 1440
  updatedAt DateTime       @updatedAt

  @@map("sla_configs")
}
```

#### Calculo del SLA

```
slaDeadline = ticket.createdAt + slaConfig.maxResponseMinutes

Estado del SLA:
  - ON_TIME:  ahora < slaDeadline (verde)
  - WARNING:  ahora > slaDeadline - 25% del tiempo total (amarillo)
  - BREACHED: ahora > slaDeadline (rojo)
  - MET:      se respondio antes del deadline (verde + check)
  - N/A:      ticket sin prioridad (IA no clasifico aun)
```

El SLA se calcula **en tiempo real** en el frontend (no se guarda en DB). El backend solo provee `createdAt`, `priority`, y `firstResponseAt` (timestamp del primer comentario de un AGENT).

#### Modelo de datos adicional
```
Agregar al modelo Ticket:
  firstResponseAt  DateTime?    // se llena cuando un AGENT comenta por primera vez
```

#### UI en la tabla de tickets (AGENT/ADMIN)

```
| Titulo          | Estado | Prioridad | SLA           |
|-----------------|--------|-----------|---------------|
| No puedo pagar  | OPEN   | CRITICAL  | [!] 45 min    |  <- rojo, breach en 45min
| Error login     | OPEN   | HIGH      | [~] 2h 30m    |  <- amarillo, warning
| Cambiar plan    | IN_PRO | LOW       | [ok] Cumplido |  <- verde, respondido a tiempo
```

#### UI en el detalle del ticket

```
+----------------------------------+
| SLA                              |
| Prioridad: CRITICAL (1 hora)     |
| Creado: 22 Mar 14:00             |
| Deadline: 22 Mar 15:00           |
| Estado: BREACH (paso hace 30min) |  <- texto rojo
| Tiempo restante: -00:30:00       |
+----------------------------------+
```

El timer se actualiza cada minuto en el frontend.

---

## Feature #12: Pagina de Perfil / Settings

### Estado actual
No existe.

### Diseno

#### Ruta
- USER: /portal/profile
- AGENT: /dashboard/profile
- ADMIN: /admin/profile

Todas renderizan el mismo componente `<ProfilePage />`, la diferencia es el layout wrapper.

#### UI

```
+----------------------------------------------------------+
| MI PERFIL                                                |
|                                                          |
| +--- Informacion ---+  +--- Seguridad ---------------+  |
| |                    |  |                              |  |
| | Avatar: [O]        |  | Cambiar contrasena          |  |
| | Nombre: [Juan P.] |  | Actual: [________]          |  |
| | Email:  juan@m.com |  | Nueva:  [________]          |  |
| | Rol:    Agente     |  | Repetir:[________]          |  |
| |                    |  | [Guardar contrasena]         |  |
| | [Guardar cambios]  |  |                              |  |
| +--------------------+  +------------------------------+  |
|                                                          |
| +--- Sesiones activas (futuro) ----------------------+   |
| | Chrome - Windows - Hace 2 min (actual)             |   |
| | Firefox - Mac - Hace 3 dias             [Cerrar]   |   |
| +----------------------------------------------------+   |
+----------------------------------------------------------+
```

#### Endpoints

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| GET /api/auth/me | GET | Ya existe - retorna perfil |
| PATCH /api/auth/profile | PATCH | Actualizar nombre `{ name }` |
| PATCH /api/auth/password | PATCH | Cambiar contrasena `{ currentPassword, newPassword }` |

#### Validaciones cambio de contrasena
- Verificar contrasena actual (argon2 verify)
- Nueva contrasena minimo 8 chars, 1 mayuscula, 1 numero
- No puede ser igual a la actual
- Al cambiar, invalidar todos los refresh tokens (fuerza re-login en otros dispositivos)

#### Lo que el usuario puede cambiar
- Nombre: si
- Email: no (requeriria verificacion, queda para futuro)
- Rol: no (solo admin desde /admin/users)
- Contrasena: si (verificando la actual)

---

## Feature #13: Recuperacion de Contrasena

### Estado actual
No existe. Si un usuario olvida su password, no puede recuperarlo.

### Diseno

#### Flujo completo

```
1. Usuario en /login hace click en "Olvide mi contrasena"
     |
2. Redirect a /forgot-password
   [Email: ________________] [Enviar enlace]
     |
3. Backend:
   -> Busca usuario por email
   -> Genera token aleatorio (crypto.randomUUID)
   -> Guarda hash del token en DB con expiracion (1 hora)
   -> Envia email con link: /reset-password?token=xxx
   -> SIEMPRE responde "Si el email existe, recibiras un enlace"
      (no revelar si el email esta registrado)
     |
4. Usuario abre email, click en link
     |
5. /reset-password?token=xxx
   [Nueva contrasena: ________]
   [Repetir:          ________]
   [Cambiar contrasena]
     |
6. Backend:
   -> Verifica token (hash match + no expirado)
   -> Actualiza contrasena (argon2 hash)
   -> Invalida token (single use)
   -> Invalida todos los refresh tokens del usuario
   -> Redirect a /login con mensaje "Contrasena actualizada"
```

#### Modelo de datos

```prisma
model PasswordReset {
  id        String   @id @default(uuid())
  tokenHash String                        // hash del token (no guardar en plano)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime                      // createdAt + 1 hora
  usedAt    DateTime?                     // null si no se uso, fecha si se uso
  createdAt DateTime @default(now())

  @@index([tokenHash])
  @@index([userId])
  @@map("password_resets")
}
```

#### Endpoints

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| POST /api/auth/forgot-password | POST | `{ email }` -> envia email |
| POST /api/auth/reset-password | POST | `{ token, newPassword }` -> cambia password |

#### Seguridad
- Token expira en 1 hora
- Solo 1 uso (se marca como usado)
- Se guarda el HASH del token en DB (si la DB se filtra, no pueden resetear passwords)
- Rate limit: maximo 3 solicitudes por email por hora
- Email se envia via SMTP (MailDev en desarrollo, servicio real en produccion)
- No revelar si el email existe o no (prevencion de user enumeration)

#### Email template
```
Asunto: Restablece tu contrasena - Ticket Gestion

Hola {nombre},

Recibimos una solicitud para restablecer tu contrasena.
Haz click en el siguiente enlace (valido por 1 hora):

[Restablecer contrasena]  -> {FRONTEND_URL}/reset-password?token=xxx

Si no solicitaste esto, ignora este correo.

---
Ticket Gestion - Soporte
```

#### Infraestructura de email
```
Desarrollo: MailDev (ya configurado en Docker, puerto 1080)
Produccion: Resend / SendGrid / AWS SES

Strategy Pattern:
  EmailProvider (interfaz)
    -> MailDevProvider   (desarrollo, SMTP localhost:1025)
    -> ResendProvider    (produccion)

Variable de entorno:
  EMAIL_PROVIDER=maildev | resend
  EMAIL_FROM=soporte@ticketgestion.com
  RESEND_API_KEY=re_xxxxxxx (solo produccion)
```

---

## Feature #14: Verificacion de Email

### Estado actual
Cualquiera puede registrarse con un email falso.

### Diseno

#### Flujo

```
1. Usuario se registra con email + password
     |
2. Backend:
   -> Crea cuenta con emailVerified: false
   -> Genera token de verificacion (crypto.randomUUID)
   -> Guarda hash del token en DB
   -> Envia email: "Verifica tu cuenta"
   -> Responde: "Revisa tu correo para activar tu cuenta"
     |
3. Usuario:
   -> Puede hacer login PERO ve un banner:
      "Tu email no esta verificado. [Reenviar correo de verificacion]"
   -> Puede ver tickets pero NO puede crear tickets hasta verificar
     |
4. Usuario abre email, click en link
   -> GET /verify-email?token=xxx
     |
5. Backend:
   -> Verifica token
   -> Marca emailVerified: true
   -> Redirect a /portal con mensaje "Email verificado"
     |
6. Usuario tiene acceso completo
```

#### Modelo de datos

Agregar al modelo User:
```prisma
model User {
  // ... campos existentes
  emailVerified    Boolean  @default(false)
  verificationToken String?                  // hash del token pendiente
  verificationExpires DateTime?              // expira en 24 horas
}
```

#### Endpoints

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| GET /api/auth/verify-email?token=xxx | GET | Verificar email |
| POST /api/auth/resend-verification | POST | Reenviar correo (autenticado) |

#### Restricciones para usuarios no verificados
- Puede hacer login (para ver el banner y reenviar)
- Puede ver dashboard/portal
- **NO puede crear tickets**
- **NO puede comentar**
- Ve banner permanente: "Verifica tu email para usar todas las funciones"

#### Seguridad
- Token expira en 24 horas
- Rate limit reenvio: maximo 3 por hora
- El token se hashea antes de guardar en DB
- Cuentas no verificadas despues de 7 dias: se pueden limpiar con cron job (opcional)

#### Email template
```
Asunto: Verifica tu cuenta - Ticket Gestion

Hola {nombre},

Gracias por registrarte. Verifica tu email haciendo click aqui:

[Verificar mi cuenta]  -> {FRONTEND_URL}/verify-email?token=xxx

Este enlace expira en 24 horas.

---
Ticket Gestion - Soporte
```

---

## Resumen de Modelos Nuevos

```prisma
// NUEVOS
model Attachment { ... }      // Feature #8
model SlaConfig { ... }       // Feature #11
model PasswordReset { ... }   // Feature #13

// MODIFICADOS
model User {
  + emailVerified Boolean @default(false)        // Feature #14
  + verificationToken String?                    // Feature #14
  + verificationExpires DateTime?                // Feature #14
}

model Ticket {
  + firstResponseAt DateTime?                    // Feature #11
  + attachments Attachment[]                     // Feature #8
}
```

## Resumen de Endpoints Nuevos

| Feature | Endpoint | Metodo |
|---------|----------|--------|
| Busqueda | GET /api/tickets (params extendidos) | GET |
| Adjuntos | POST /api/tickets/:id/attachments | POST |
| Adjuntos | GET /api/tickets/:id/attachments | GET |
| Adjuntos | GET /api/attachments/:id/download | GET |
| Adjuntos | DELETE /api/attachments/:id | DELETE |
| Bulk | POST /api/tickets/bulk | POST |
| Exportar | GET /api/tickets/export?format=csv | GET |
| Perfil | PATCH /api/auth/profile | PATCH |
| Perfil | PATCH /api/auth/password | PATCH |
| Password reset | POST /api/auth/forgot-password | POST |
| Password reset | POST /api/auth/reset-password | POST |
| Email verify | GET /api/auth/verify-email | GET |
| Email verify | POST /api/auth/resend-verification | POST |

## Feature #15: Notificaciones en Tiempo Real en el Chat (tipo WhatsApp)

### Estado actual
Los comentarios se crean y se notifican via DB (tabla Notification), pero no hay push en tiempo real al chat. El usuario necesita recargar o navegar para ver nuevos mensajes. El evento `ticket.updated` con `type: "comment"` se publica a Redis pero el frontend no lo distingue de otras actualizaciones.

### Diseno

#### Evento dedicado de Redis/WebSocket
```
Evento: "comment.created"
Payload: {
  event: "comment.created",
  ticketId: "uuid",
  data: {
    commentId: "uuid",
    userId: "uuid",
    userName: "Juan Perez",
    userRole: "AGENT" | "USER" | "ADMIN",
    content: "Hola, ya revisamos tu caso...",  // primeros 100 chars
    createdAt: "2026-03-27T14:30:00Z"
  },
  timestamp: "2026-03-27T14:30:00Z"
}
```

#### Flujo
```
1. Agente escribe comentario en ticket
     |
2. Backend:
   -> Crea comentario en DB
   -> Crea notificacion en DB (ya existe)
   -> Publica evento "comment.created" a Redis (NUEVO)
     |
3. WebSocket server (api-gateway):
   -> Recibe evento de Redis
   -> Broadcast a todos los clientes conectados (ya existe)
     |
4. Frontend del cliente (si tiene el ticket abierto):
   -> Recibe "comment.created" via socket
   -> Invalida query de comentarios -> chat se actualiza automaticamente
   -> Auto-scroll al nuevo mensaje
   -> NO muestra toast (ya ve el mensaje en el chat)
     |
5. Frontend del cliente (si NO tiene el ticket abierto):
   -> Recibe "comment.created" via socket
   -> Invalida query de notificaciones
   -> Muestra toast: "Juan Perez comento en 'No puedo pagar'"
   -> Click en toast navega al ticket
```

#### UI en el chat (TicketComments)
```
Cuando llega un mensaje nuevo y el usuario esta en el ticket:
  - El mensaje aparece automaticamente (query invalidation)
  - Auto-scroll al fondo del chat
  - Efecto sutil de entrada (animate-in)

Cuando el usuario NO esta en el fondo del scroll:
  - Aparece boton flotante: "Nuevo mensaje v" (flecha abajo)
  - Click en el boton hace scroll al fondo
```

#### Cambios necesarios

**Backend:**
- Agregar `"comment.created"` a `WebhookEvent` type
- En `POST /:ticketId/comments`: publicar `comment.created` en vez de `ticket.updated`

**Frontend:**
- Agregar `"comment.created"` a `TicketEvent.event` union type
- En `use-socket.ts`: manejar `comment.created` -> invalidar comments + notifications, toast condicional
- En `TicketComments`: auto-scroll al fondo cuando llega nuevo comentario, boton "nuevo mensaje"

---

## Prioridad de Implementacion

| Orden | Feature | Justificacion |
|-------|---------|--------------|
| 1 | #15 Chat en tiempo real | Mejora inmediata en UX, bajo esfuerzo |
| 2 | #12 Perfil + cambio de contrasena | Base para las demas features de auth |
| 3 | #13 Recuperacion de contrasena | Critico para cualquier app con login |
| 4 | #14 Verificacion de email | Previene cuentas basura |
| 5 | #11 SLA tracking | Da valor inmediato al dashboard del agente |
| 6 | #7 Busqueda avanzada | Mejora la eficiencia del agente |
| 7 | #8 Adjuntos | Los clientes necesitan enviar screenshots |
| 8 | #10 Exportar | Util para reportes y auditorias |
| 9 | #9 Bulk actions | Optimizacion para cuando hay volumen |
