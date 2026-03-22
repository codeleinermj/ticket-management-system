# 🎨 Frontend Strategy: Next.js Intelligence Dashboard

## 1. Estructura y Estado
- [ ] **Framework:** Next.js 15 (App Router).
- [ ] **UI System:** Tailwind CSS + Shadcn/ui (para un look profesional y consistente).
- [ ] **State Management:** - **TanStack Query (React Query):** Para caché de servidor y sincronización de tickets.
    - **Zustand:** Para estado global ligero (filtros de búsqueda, tema).

## 2. Características del Dashboard (Agente)
- [ ] **Real-time Updates:** Integración con WebSockets para recibir tickets "Push".
- [ ] **AI-Suggestion UI:** Componente de chat que muestra el borrador generado por la IA con opción de "Aplicar sugerencia".
- [ ] **Filtros Avanzados:** Por prioridad, categoría detectada por IA y tiempo de espera (SLA).

## 3. Seguridad en el Cliente
- [ ] **Protected Routes:** Middleware de Next.js para verificar la sesión antes de renderizar.
- [ ] **XSS Prevention:** Sanitización de las descripciones de tickets (si permiten HTML).
- [ ] **CSRF Protection:** Validación de tokens en peticiones mutativas.

## 4. UX & Performance
- [ ] **Optimistic Updates:** Actualizar el estado del ticket en la UI antes de que la DB responda (sensación de velocidad).
- [ ] **Skeletons & Loading States:** Evitar el CLS (Cumulative Layout Shift) durante la carga de datos.
- [ ] **Error Boundaries:** Capturar fallos en componentes específicos sin tirar toda la aplicación.

## 5. Testing de Interfaz
- [ ] **Component Testing:** Probar componentes críticos (Botón de cierre de ticket) con **React Testing Library**.
- [ ] **E2E Testing:** Un flujo completo con **Playwright**: Login -> Ver nuevo ticket -> Responder -> Cerrar.
- [ ] **Accessibility (A11y):** Cumplimiento de estándares WCAG para herramientas de uso profesional.