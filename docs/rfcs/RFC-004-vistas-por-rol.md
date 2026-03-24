# RFC #004: Vistas por Rol (Cliente, Agente, Admin)

**Estado:** Propuesta
**Autor:** Agente de Arquitectura
**Fecha:** 2026-03-22

---

## 1. Objetivo

Definir tres experiencias distintas segun el rol del usuario. Cada rol tiene su propia vista, navegacion y permisos. El registro siempre crea un USER. Solo un ADMIN puede cambiar roles.

---

## 2. Flujo de Acceso

```
Registro (/register)
  -> Siempre crea cuenta con rol USER
  -> Redirect automatico a /portal (vista cliente)

Login (/login)
  -> Verifica credenciales
  -> Segun rol en DB:
     USER  -> Redirect a /portal
     AGENT -> Redirect a /dashboard
     ADMIN -> Redirect a /admin
```

### Cambio de rol
```
Solo un ADMIN puede cambiar roles desde /admin/users
  -> PATCH /api/users/:id/role { role: "AGENT" }
  -> La proxima vez que ese usuario haga login, ve la vista de AGENT
  -> Si tiene sesion activa, al refrescar el token se actualiza el rol
```

---

## 3. Estructura de Rutas

```
/login                          -> Publico
/register                       -> Publico

/portal                         -> Solo USER
/portal/tickets                 -> Solo USER
/portal/tickets/[id]            -> Solo USER (solo sus tickets)
/portal/profile                 -> Solo USER

/dashboard                      -> Solo AGENT
/dashboard/tickets              -> Solo AGENT
/dashboard/tickets/[id]         -> Solo AGENT
/dashboard/profile              -> Solo AGENT

/admin                          -> Solo ADMIN
/admin/dashboard                -> Solo ADMIN
/admin/tickets                  -> Solo ADMIN
/admin/users                    -> Solo ADMIN
/admin/settings                 -> Solo ADMIN
/admin/profile                  -> Solo ADMIN
```

### Middleware de proteccion

```
middleware.ts:
  1. Si no autenticado -> /login
  2. Si autenticado:
     - USER accede a /dashboard o /admin -> Redirect a /portal
     - AGENT accede a /portal o /admin   -> Redirect a /dashboard
     - ADMIN accede a /portal             -> Redirect a /admin
  3. ADMIN puede acceder a /dashboard (hereda permisos de AGENT)
```

---

## 4. Vista CLIENT (USER) - /portal

### Principio de diseno
Interfaz **simple y limpia**. El cliente no necesita ver metricas, audit logs ni clasificacion IA. Solo necesita crear tickets, ver su estado y leer respuestas.

### Layout

```
+----------------------------------------------------------+
|  HEADER: Logo | "Mis Tickets" | Perfil (avatar + nombre) |
+----------------------------------------------------------+
|                                                          |
|  [Boton: + Nuevo Ticket]                                 |
|                                                          |
|  +----------------------------------------------------+  |
|  | MIS TICKETS                                        |  |
|  |----------------------------------------------------|  |
|  | #123 | No puedo descargar factura | ABIERTO | Hace 2h |
|  | #122 | Error al pagar             | RESUELTO | Hace 1d |
|  | #121 | Cambiar plan               | CERRADO  | Hace 3d |
|  +----------------------------------------------------+  |
|                                                          |
|  Paginacion: < 1 2 3 >                                  |
+----------------------------------------------------------+
```

### Paginas

#### /portal (Home)
- Lista de tickets del usuario (solo los suyos)
- Filtro simple: Todos | Abiertos | Resueltos | Cerrados
- Busqueda por titulo
- Boton "Nuevo Ticket" prominente

#### /portal/tickets/[id] (Detalle)
```
+----------------------------------------------------------+
|  <- Volver                                               |
|                                                          |
|  TICKET #123: No puedo descargar mi factura              |
|  Estado: ABIERTO          Creado: 22 Mar 2026            |
|                                                          |
|  DESCRIPCION:                                            |
|  "Cuando hago click en descargar factura me sale..."     |
|                                                          |
|  ------------------------------------------------        |
|  CONVERSACION:                                           |
|  ------------------------------------------------        |
|  [Cliente - 22 Mar 14:00]                                |
|  "Cuando hago click en descargar factura me sale..."     |
|                                                          |
|  [Agente - 22 Mar 14:15]                                 |
|  "Estimado cliente, para descargar su factura vaya..."   |
|                                                          |
|  [Cliente - 22 Mar 14:20]                                |
|  "Gracias, ahora funciona!"                              |
|  ------------------------------------------------        |
|                                                          |
|  [Escribir respuesta...                        ] [Enviar]|
|                                                          |
+----------------------------------------------------------+
```

**Lo que el cliente VE:**
- Titulo, descripcion, estado, fecha
- Conversacion (mensajes del agente y suyos)
- Input para responder

**Lo que el cliente NO ve:**
- Prioridad (no le interesa)
- Categoria (no le interesa)
- Clasificacion IA (es interno)
- Confianza IA (es interno)
- Audit log (es interno)
- Agente asignado (no le interesa saber quien)

#### /portal/profile
- Ver nombre, email
- Cambiar nombre
- Cambiar contrasena

#### Crear ticket (Dialog/Modal)
- Campos: Titulo + Descripcion (solo eso)
- Sin prioridad ni categoria (la IA lo asigna)
- Confirmacion: "Tu ticket fue creado. Te notificaremos cuando haya respuesta."

---

## 5. Vista AGENTE (AGENT) - /dashboard

### Principio de diseno
Interfaz **completa y eficiente**. El agente necesita ver todo: clasificacion IA, prioridad, cola de tickets, asignacion, responder rapidamente.

### Layout

```
+------+-----------------------------------------------------+
| SIDE |  HEADER: Dashboard | Busqueda global | Perfil       |
| BAR  |-----------------------------------------------------|
|      |                                                     |
| Home |  STATS: [Total: 45] [Abiertos: 12] [Mios: 8] [SLA] |
| Tick |                                                     |
| ets  |  TICKETS                          [+ Crear ticket]  |
|      |  Filtros: Estado | Prioridad | Categoria | Busqueda |
|      |  ---------------------------------------------------|
|      |  | Titulo    | Estado | Prior | Cat | Asignado | IA ||
|      |  |-----------|--------|-------|-----|----------|----||
|      |  | Factura.. | OPEN   | HIGH  | BIL | -        | OK ||
|      |  | Error 500 | OPEN   | CRIT  | BUG | Juan     | OK ||
|      |  | Plan..    | IN_PRO | MED   | SUP | Maria    | OK ||
|      |  ---------------------------------------------------|
|      |                                                     |
+------+-----------------------------------------------------+
```

### Paginas

#### /dashboard (Home)
- Stats cards: Total, Abiertos, En progreso, Resueltos, **Mis tickets asignados**
- Tickets recientes (ultimos 5)
- **Tickets sin asignar** (ultimos 5) -> nuevo
- **Tickets pendientes de revision IA** (aiStatus: FAILED) -> nuevo

#### /dashboard/tickets (Lista)
Lo que ya existe + estas mejoras:
- Columna **"Asignado a"** con avatar
- Filtro **"Mis tickets"** (toggle rapido)
- Filtro **"Sin asignar"** (toggle rapido)
- Indicador de **tiempo abierto** (ej: "hace 2h" en rojo si supera SLA)
- Badge de **estado IA** en cada fila (Clasificado/Fallido/Pendiente)

#### /dashboard/tickets/[id] (Detalle)
```
+------+-----------------------------------------------------+
| SIDE |  <- Volver a tickets                                |
| BAR  |                                                     |
|      |  TICKET #123: No puedo descargar factura             |
|      |                                                     |
|      |  +--- MAIN (2/3) -------+  +--- SIDEBAR (1/3) ----+ |
|      |  |                      |  |                       | |
|      |  | DESCRIPCION:         |  | Estado: [OPEN v]      | |
|      |  | "Cuando hago..."     |  | Prioridad: [HIGH v]   | |
|      |  |                      |  | Categoria: [BILLING v]| |
|      |  | --- IA SUGGESTION -- |  | Asignado: [Dropdown v]| |
|      |  | Cat: BILLING (92%)   |  | Creado: 22 Mar 14:00  | |
|      |  | Prior: HIGH          |  | Actualizado: 22 Mar   | |
|      |  | Respuesta sugerida:  |  |                       | |
|      |  | "Estimado cliente.." |  | [Tomar ticket]        | |
|      |  | [Aceptar] [Corregir] |  |                       | |
|      |  |                      |  +-----------------------+ |
|      |  | --- CONVERSACION --- |                            |
|      |  | [Cliente] msg...     |                            |
|      |  | [Agente] msg...      |                            |
|      |  |                      |                            |
|      |  | [Responder...] [App  |                            |
|      |  |  licar sugerencia IA]|                            |
|      |  +----------------------+                            |
|      |                                                     |
|      |  --- AUDIT LOG ---                                  |
|      |  22 Mar - IA clasifico como BILLING/HIGH            |
|      |  22 Mar - Juan tomo el ticket                       |
|      |  22 Mar - Juan respondio al cliente                 |
+------+-----------------------------------------------------+
```

**Acciones del agente:**
- Cambiar estado (dropdown)
- Cambiar prioridad (si corrige a la IA)
- Cambiar categoria (si corrige a la IA)
- **Tomar ticket** (se autoasigna) -> nuevo
- **Asignar a otro agente** (dropdown de agentes) -> nuevo
- **Responder al cliente** (textarea + enviar) -> nuevo
- **Aplicar sugerencia IA** (un click, copia respuesta IA al textarea) -> nuevo
- Aceptar/Corregir clasificacion IA
- Eliminar (solo admin)

#### /dashboard/profile
- Ver nombre, email, rol
- Cambiar nombre, contrasena

---

## 6. Vista ADMIN (ADMIN) - /admin

### Principio de diseno
Todo lo del agente + **gestion de usuarios y configuracion**. El admin supervisa, no necesariamente resuelve tickets.

### Layout

```
+------+-----------------------------------------------------+
| SIDE |  HEADER: Admin Panel | Perfil                       |
| BAR  |-----------------------------------------------------|
|      |                                                     |
| Home |  Contenido segun pagina                             |
| Tick |                                                     |
| ets  |                                                     |
| Usua |                                                     |
| rios |                                                     |
| Sett |                                                     |
| ings |                                                     |
+------+-----------------------------------------------------+
```

### Paginas

#### /admin (Home/Dashboard)
Todo lo del dashboard de agente + metricas globales:
- **Tickets por agente** (quien tiene mas carga)
- **Tiempo promedio de resolucion**
- **Precision de la IA** (% de clasificaciones aceptadas vs corregidas)
- **Tickets sin asignar** (alerta si hay muchos)

#### /admin/tickets
Igual que /dashboard/tickets pero con acciones extra:
- **Eliminar tickets**
- **Reasignar en bulk**
- Exportar a CSV

#### /admin/users (NUEVO - pagina critica)
```
+----------------------------------------------------------+
|  USUARIOS                              [+ Invitar usuario]|
|                                                          |
|  Busqueda: [_______________]                             |
|  Filtro: Todos | Admins | Agentes | Usuarios             |
|                                                          |
|  +----------------------------------------------------+  |
|  | Nombre     | Email            | Rol    | Acciones   |  |
|  |------------|------------------|--------|------------|  |
|  | Juan Perez | juan@mail.com    | AGENT  | [Editar v] |  |
|  | Maria L.   | maria@mail.com   | USER   | [Editar v] |  |
|  | Admin      | admin@mail.com   | ADMIN  | [Editar v] |  |
|  +----------------------------------------------------+  |
|                                                          |
+----------------------------------------------------------+
```

**Acciones del admin sobre usuarios:**
- **Cambiar rol** (USER -> AGENT, AGENT -> ADMIN, etc.)
- **Desactivar cuenta** (soft delete, no borra datos)
- Ver tickets creados/asignados por ese usuario
- Resetear contrasena

#### /admin/settings (NUEVO)
- Configurar **categorias disponibles** (agregar/quitar)
- Configurar **SLA por prioridad** (ej: CRITICAL = 1h, HIGH = 4h)
- Configurar **AI provider** activo (Gemini/OpenAI/Mock)
- Configurar **confidence threshold** (minimo para auto-clasificar)
- Ver **API usage/costos** de IA

#### /admin/profile
Igual que los otros roles.

---

## 7. Endpoints Nuevos Necesarios

### Usuarios (para admin)

| Endpoint | Metodo | Quien | Descripcion |
|----------|--------|-------|-------------|
| /api/users | GET | ADMIN | Listar usuarios con filtros y paginacion |
| /api/users/:id | GET | ADMIN | Ver detalle de usuario |
| /api/users/:id/role | PATCH | ADMIN | Cambiar rol `{ role: "AGENT" }` |
| /api/users/:id/status | PATCH | ADMIN | Activar/desactivar cuenta |

### Comentarios/Conversacion (NUEVO modelo)

| Endpoint | Metodo | Quien | Descripcion |
|----------|--------|-------|-------------|
| /api/tickets/:id/comments | GET | Autenticado | Listar comentarios del ticket |
| /api/tickets/:id/comments | POST | Autenticado | Agregar comentario `{ message }` |

### Asignacion

| Endpoint | Metodo | Quien | Descripcion |
|----------|--------|-------|-------------|
| /api/tickets/:id/assign | PATCH | AGENT, ADMIN | Asignar ticket `{ agentId }` |
| /api/tickets/:id/take | POST | AGENT, ADMIN | Auto-asignarse el ticket |
| /api/agents | GET | AGENT, ADMIN | Listar agentes disponibles para asignar |

---

## 8. Modelo de Datos Nuevo

### Comment (nuevo modelo)

```
model Comment {
  id        String   @id @default(uuid())
  message   String
  ticketId  String
  ticket    Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  isAiSuggestion Boolean @default(false)  // true si fue generado por IA
  createdAt DateTime @default(now())

  @@index([ticketId])
  @@map("comments")
}
```

**Nota:** Cuando el agente hace "Aplicar sugerencia IA", se crea un Comment con `isAiSuggestion: true` para trackear cuantas respuestas vienen de la IA.

---

## 9. Eventos WebSocket Nuevos

| Evento | Payload | Quien recibe |
|--------|---------|-------------|
| ticket.commented | `{ ticketId, commentId, userId }` | Todos los suscritos al ticket |
| ticket.assigned | `{ ticketId, agentId, agentName }` | Agente asignado + admin |
| user.role_changed | `{ userId, oldRole, newRole }` | El usuario afectado (forzar re-login o refresh) |

---

## 10. Reglas de Negocio

### Registro
- Siempre crea USER. No hay opcion de elegir rol en el registro.
- Despues del registro, login automatico y redirect a /portal.

### Cambio de rol
- Solo ADMIN puede hacerlo desde /admin/users.
- No se puede degradar al ultimo ADMIN (siempre debe haber al menos 1).
- Cuando se cambia un rol, la sesion actual del usuario sigue activa con el rol viejo. Al refrescar token o re-loguearse, obtiene el nuevo rol.

### Visibilidad de tickets
- USER: solo ve tickets que el creo.
- AGENT: ve todos los tickets. Puede filtrar por "mis asignados".
- ADMIN: ve todo. Puede ver tickets por agente.

### Comentarios
- USER: puede comentar en sus tickets.
- AGENT: puede comentar en cualquier ticket.
- ADMIN: puede comentar en cualquier ticket.
- Los comentarios son inmutables (no se editan ni borran). Esto es por trazabilidad.

### Asignacion
- Un ticket puede tener un solo agente asignado.
- "Tomar ticket" = auto-asignacion del agente logueado.
- Un ADMIN puede reasignar cualquier ticket.
- Un AGENT solo puede reasignar tickets que estan asignados a el.
