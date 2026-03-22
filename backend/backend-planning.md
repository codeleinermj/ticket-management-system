# 🛠 Backend Strategy: AI-First Support System

## 1. Arquitectura y Entorno
- [ ] **Monorepo Setup:** Configuración de `pnpm-workspaces` y `Turborepo`.
- [ ] **Infraestructura (Docker):** - Contenedor de PostgreSQL (DB Principal).
    - Contenedor de Redis (Broker para eventos entre microservicios).
    - Contenedor de Maildev (Testing de correos).
- [ ] **Shared Package (@repo/shared):** Definición de esquemas de **Zod** para validación de tickets y contratos de API.

## 2. Microservicios
### A. API Gateway (Hono + Bun)
- [ ] Implementar **Rate Limiting** para prevenir abusos.
- [ ] Gestión de **CORS** dinámico y cabeceras de seguridad con **Helmet**.
- [ ] Documentación automática con **Swagger/OpenAPI**.

### B. Ticket Service (Node.js + Prisma)
- [ ] **Patrón Repository:** Aislar la lógica de Prisma para facilitar el testing.
- [ ] **Audit Log:** Registrar cada cambio de estado (Abierto -> Resuelto) con el ID del agente.
- [ ] **Webhooks:** Sistema para notificar cambios a otros servicios.

### C. AI Worker (OpenAI Integration)
- [ ] **Consumidor de Eventos:** Escuchar en Redis cuando se crea un ticket nuevo.
- [ ] **Prompt Engineering:** Implementar *Structured Outputs* para recibir JSON puro de OpenAI.
- [ ] **Fallback Logic:** Si la IA falla, marcar el ticket como `PENDING_MANUAL_REVIEW`.

## 3. Seguridad Avanzada
- [ ] **Auth:** JWT con rotación de *Refresh Tokens* en Cookies `HttpOnly`.
- [ ] **Validación:** Middleware global de Zod para cada entrada de datos.
- [ ] **Encriptación:** Hasheo de contraseñas con `argon2` o `bcrypt`.

## 4. Testing & Calidad
- [ ] **Unit Tests:** Pruebas de los servicios de clasificación de IA con **Vitest**.
- [ ] **Integration Tests:** Flujo completo desde creación de ticket hasta persistencia en DB (Supertest).
- [ ] **Stress Testing:** Scripts de **k6** para medir latencia bajo carga de 500 req/sec.