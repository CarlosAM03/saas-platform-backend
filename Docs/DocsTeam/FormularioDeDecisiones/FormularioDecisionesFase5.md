# Formulario de decisiones — Fase 5

## Flutter Foundation y baseline del cliente móvil/web

**Proyecto:** Plataforma SaaS — Cliente Flutter
**Fase:** Fase 5 — Flutter Foundation
**Propósito:** Definir las decisiones necesarias para crear un repositorio frontend preparado para desarrollo funcional por André y diseño UI/UX por Ángeles, manteniendo a Carlos como arquitecto, integrador y owner de infraestructura/API client.

---

# 1. Propósito de Fase 5

La Fase 5 tiene como objetivo construir la línea base del cliente Flutter.

Esta fase no busca implementar todas las funcionalidades del producto. Su propósito es dejar preparado el repositorio, arquitectura, navegación, autenticación, cliente HTTP, modelos base, tema visual inicial y documentación para que el equipo pueda desarrollar features de forma ordenada.

## Preguntas

1. ¿La Fase 5 debe cerrar solo el baseline técnico del frontend o también algunas pantallas funcionales?
2. ¿Qué se considera “suficiente” para entregar Fase 5?
3. ¿Qué debe poder hacer André sin intervención de Carlos?
4. ¿Qué decisiones deben quedar protegidas para no romper la arquitectura?
5. ¿Qué decisiones pueden cambiar después sin afectar el baseline?

## Decisión propuesta

Fase 5 cierra el baseline Flutter con autenticación funcional, navegación protegida, DTOs base, tema inicial, estructura por features y documentación de desarrollo.

Las features completas de campañas, prospectos y jobs quedan para fases posteriores o para desarrollo delegado.

---

# 2. Alcance del MVP frontend

## Preguntas

1. ¿Qué pantallas entran en el MVP?
2. ¿Qué pantallas serán funcionales desde Fase 5?
3. ¿Qué pantallas serán solo esqueleto?
4. ¿Qué pantallas quedan fuera del MVP?
5. ¿El MVP se probará primero en Android, Web, Windows o multiplataforma?
6. ¿El diseño debe ser mobile-first o desktop-first?

## Pantallas candidatas

### Autenticación

* Splash / Loading inicial.
* Login.
* Selección de tenant.
* Sesión expirada / error de autenticación.

### Navegación principal

* Dashboard.
* Perfil.
* Cambio de tenant.
* Logout.

### Campañas

* Lista de campañas.
* Crear campaña.
* Detalle de campaña.
* Editar campaña.
* Archivar / pausar campaña.

### Prospectos

* Lista de prospectos.
* Detalle de prospecto.
* Filtros.
* Búsqueda.
* Estado vacío.

### Jobs de prospección

* Formulario para generar prospectos.
* Vista de progreso del job.
* Cancelación del job.
* Resultados temporales.
* Persistir resultados.
* Exportar CSV/XLSX.
* Descartar resultados.

### Administración

* Administración de tenants.
* Administración de usuarios.
* Gestión de roles/membresías.

## Decisión pendiente

Definir cuáles pantallas son obligatorias para MVP y cuáles quedan como placeholder.

---

# 3. Roles y permisos en interfaz

## Contexto

El backend define:

* ADMIN como rol global.
* OWNER y MEMBER como roles dentro de tenant.
* ADMIN puede operar sin tenant, pero para operaciones tenant-aware debe seleccionar tenant.
* El frontend nunca debe usar roles como seguridad real; solo como control de visibilidad de UI.

## Preguntas

1. ¿Qué ve ADMIN al iniciar sesión sin tenant?
2. ¿ADMIN debe entrar primero a un panel global o a selección de tenant?
3. ¿OWNER puede crear usuarios?
4. ¿MEMBER solo puede consultar campañas/prospectos?
5. ¿Qué opciones deben ocultarse según rol?
6. ¿Qué opciones deben mostrarse deshabilitadas en vez de ocultarse?
7. ¿Cómo se comunica al usuario que necesita seleccionar tenant?

## Matriz inicial

| Acción               |          ADMIN |               OWNER |              MEMBER |
| -------------------- | -------------: | ------------------: | ------------------: |
| Login                |             Sí |                  Sí |                  Sí |
| Seleccionar tenant   |             Sí | Sí, si tiene varios | Sí, si tiene varios |
| Ver dashboard        | Sí, con tenant |                  Sí |                  Sí |
| Ver campañas         | Sí, con tenant |                  Sí |                  Sí |
| Crear campaña        | Sí, con tenant |                  Sí |           Pendiente |
| Editar campaña       | Sí, con tenant |                  Sí |           Pendiente |
| Ver prospectos       | Sí, con tenant |                  Sí |                  Sí |
| Generar prospectos   | Sí, con tenant |                  Sí |           Pendiente |
| Cancelar job         | Sí, con tenant |                  Sí |           Pendiente |
| Persistir resultados | Sí, con tenant |                  Sí |           Pendiente |
| Exportar resultados  | Sí, con tenant |                  Sí |           Pendiente |
| Administrar usuarios | Sí, con tenant |                  Sí |                  No |
| Administrar tenants  |             Sí |                  No |                  No |

## Decisión pendiente

Cerrar permisos visibles por pantalla.

---

# 4. Flujo principal del producto

## Flujo conceptual

```text
Login
  ↓
Validar sesión
  ↓
Seleccionar tenant si aplica
  ↓
Dashboard
  ↓
Crear campaña
  ↓
Generar prospectos
  ↓
Monitorear job
  ↓
Ver resultados temporales
  ↓
Persistir / exportar / descartar
  ↓
Gestionar prospectos dentro de campaña
```

## Preguntas

1. ¿El usuario debe crear una campaña antes de generar prospectos?
2. ¿Puede generar prospectos desde una campaña existente?
3. ¿Puede generar prospectos sin campaña?
4. ¿Dónde se muestra el progreso del job?
5. ¿El usuario puede salir de la pantalla mientras el job sigue corriendo?
6. ¿Cómo recupera resultados si cambia de pantalla?
7. ¿Los resultados temporales viven solo en memoria o se guardan localmente?
8. ¿Qué pasa si la app se cierra antes de persistir?
9. ¿Qué pasa si el job falla?
10. ¿Qué pasa si el usuario cancela el job?

## Decisión propuesta

Para MVP, el usuario debe trabajar desde una campaña. Los resultados temporales se asocian a un `jobId`. Si el usuario sale de la pantalla, podrá recuperar el estado consultando el detalle del job desde backend cuando el endpoint esté disponible.

---

# 5. Estrategia de jobs asíncronos

## Preguntas

1. ¿Polling, WebSocket o SSE?
2. ¿Cada cuánto consultar el estado del job?
3. ¿Cuándo detener el polling?
4. ¿Cómo mostrar estados `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`?
5. ¿Qué hacer si el backend responde 503?
6. ¿Qué hacer si el usuario cancela?
7. ¿Debe existir una pantalla de historial de jobs?
8. ¿El job puede seguir aunque el usuario cierre sesión?

## Decisión propuesta MVP

Usar polling por simplicidad.

```text
Intervalo inicial: 3 a 5 segundos
Detener polling: COMPLETED, FAILED, CANCELLED
WebSocket/SSE: post-MVP
```

---

# 6. Caché temporal de prospectos

## Preguntas

1. ¿La caché temporal vive en memoria, secure storage, local database o archivo?
2. ¿Se limpia al cerrar sesión?
3. ¿Se limpia al cambiar de tenant?
4. ¿Se limpia al persistir?
5. ¿Se limpia al descartar?
6. ¿Debe tener TTL?
7. ¿La caché se organiza por `jobId`, `campaignId` o ambos?
8. ¿Qué pasa si hay dos jobs simultáneos?
9. ¿Qué pasa si la app se cierra?

## Decisión propuesta MVP

Usar caché en memoria con Riverpod, organizada por `jobId`.

```text
cache[jobId] = List<ProspectResult>
```

Se limpia al cerrar sesión, cambiar de tenant, persistir o descartar.

TTL postergado.

---

# 7. Persistencia, exportación y descarte

## Preguntas

1. ¿Persistir y exportar son acciones separadas?
2. ¿El usuario puede exportar sin persistir?
3. ¿El usuario puede persistir después de exportar?
4. ¿El usuario puede descartar resultados sin confirmación?
5. ¿La deduplicación aplica antes de persistir, antes de exportar o ambas?
6. ¿Cómo mostrar prospectos duplicados?
7. ¿Qué mensaje se muestra al persistir parcialmente?
8. ¿Qué formatos de exportación son obligatorios en MVP?

## Decisión propuesta

Para MVP:

* Persistir: envía resultados al backend.
* Exportar: descarga CSV/XLSX desde backend.
* Descartar: limpia caché temporal.
* Deduplicación automática al persistir.
* Exportación puede permitir duplicados o advertir al usuario.

---

# 8. Navegación y layout

## Preguntas

1. ¿La app será mobile-first?
2. ¿Bottom navigation en móvil?
3. ¿Sidebar en tablet/desktop?
4. ¿Drawer en móvil?
5. ¿Cuántas secciones principales tendrá la navegación?
6. ¿Dónde vive el selector de tenant?
7. ¿Dónde vive logout?
8. ¿Perfil será pantalla propia o menú?
9. ¿Dashboard será obligatorio o puede iniciar en campañas?

## Navegación candidata

```text
Dashboard
Campañas
Prospectos
Generar
Perfil
```

Opciones secundarias:

```text
Cambiar tenant
Administración
Logout
```

## Decisión propuesta

Mobile-first con bottom navigation para secciones principales y drawer/menú para acciones secundarias.

---

# 9. Diseño UI/UX

## Preguntas para Ángeles

1. ¿Qué debe transmitir visualmente la app?
2. ¿Qué estilo debe evitarse?
3. ¿Qué paleta se usará para v1.0?
4. ¿Qué tipografía se usará?
5. ¿Qué componentes se diseñarán primero?
6. ¿Qué estados deben existir por pantalla?
7. ¿Qué densidad visual debe tener la app?
8. ¿Debe parecer SaaS empresarial, herramienta comercial o app académica?
9. ¿Habrá logo/nombre comercial?
10. ¿Tema oscuro entra o se posterga?

## Decisión propuesta

La app debe sentirse como un SaaS moderno, comercial, limpio y profesional, evitando apariencia de proyecto escolar.

---

# 10. Arquitectura Flutter

## Preguntas

1. ¿Estructura por features o por capas globales?
2. ¿Dónde viven los DTOs compartidos?
3. ¿Dónde vive el ApiClient?
4. ¿Dónde vive AuthState?
5. ¿Cada feature tendrá service/repository/provider?
6. ¿Se usará repository pattern desde el inicio?
7. ¿Los DTOs serán generados o escritos manualmente?
8. ¿Cómo se nombran carpetas y archivos?
9. ¿Cómo se separa UI, estado y red?
10. ¿Qué puede modificar André sin pedir permiso?

## Decisión propuesta

Estructura por features con `core/` y `shared/`.

```text
lib/
  app/
  core/
    config/
    network/
    storage/
    errors/
    theme/
  shared/
    models/
    widgets/
  features/
    auth/
    campaigns/
    prospects/
    prospecting_jobs/
    profile/
    admin/
  routes/
```

---

# 11. Cliente API

## Preguntas

1. ¿Se usará `http` o `dio`?
2. ¿Cómo se agrega Authorization Bearer?
3. ¿Cómo se maneja 401?
4. ¿Cómo se maneja 403?
5. ¿Cómo se parsea `{ success, data, meta }`?
6. ¿Cómo se parsea error?
7. ¿Dónde se define `baseUrl`?
8. ¿Cómo se manejan timeouts?
9. ¿Cómo se manejan descargas binarias?
10. ¿Cómo se loguean requests sin exponer tokens?

## Decisión propuesta

Usar `http` + capa propia `ApiClient`.

Postergar `dio` hasta que exista necesidad real.

---

# 12. Autenticación y sesión

## Preguntas

1. ¿Dónde se guarda el JWT?
2. ¿Cuándo se borra?
3. ¿Cómo se restaura sesión al abrir la app?
4. ¿Cómo se detecta token expirado?
5. ¿Qué pasa ante 401?
6. ¿Qué pasa ante 403?
7. ¿Cómo se maneja multi-tenant?
8. ¿Dónde vive el tenant seleccionado?
9. ¿Se permite cambiar tenant sin logout?
10. ¿Cómo se representa ADMIN sin tenant?

## Decisión propuesta

Guardar JWT en `flutter_secure_storage`.

Restaurar sesión con `/auth/me`.

Ante 401, limpiar sesión y redirigir a login.

Ante 403, mostrar error contextual sin cerrar sesión.

---

# 13. DTOs y modelos

## Preguntas

1. ¿Qué DTOs son obligatorios desde Fase 5?
2. ¿Se modelan todos los DTOs del OpenAPI o solo Auth/User/Tenant?
3. ¿Los modelos serán inmutables?
4. ¿Se usará `json_serializable`?
5. ¿Cómo se representa `role` nullable?
6. ¿Cómo se representa `currentTenantId` nullable?
7. ¿Cómo se representa `meta` de paginación?
8. ¿Cómo se representan errores?
9. ¿Dónde se ubican enums?
10. ¿Se generarán DTOs desde OpenAPI más adelante?

## DTOs base

```text
ApiResponse<T>
ApiErrorResponse
ApiException
AuthContext
AuthUser
AuthTenant
User
Role
Tenant
PaginationMeta
```

---

# 14. Manejo de errores y estados UI

## Preguntas

1. ¿Cada pantalla tendrá loading/error/empty/success?
2. ¿Los errores se muestran con snackbar, dialog o inline?
3. ¿Qué errores ameritan logout?
4. ¿Qué errores ameritan retry?
5. ¿Qué errores se consideran silenciosos?
6. ¿Qué mensaje se muestra cuando no hay campañas?
7. ¿Qué mensaje se muestra cuando no hay prospectos?
8. ¿Qué mensaje se muestra si backend está apagado?
9. ¿Qué mensaje se muestra si Prospector Service no está disponible?
10. ¿Cómo se reportan errores técnicos durante demo?

## Decisión propuesta

Cada feature debe modelar explícitamente:

```text
loading
empty
error
success
```

---

# 15. Testing frontend

## Preguntas

1. ¿Qué se probará en Fase 5?
2. ¿Se probará ApiClient?
3. ¿Se probará AuthState?
4. ¿Se probarán guards?
5. ¿Se usarán mocks del backend?
6. ¿Se probarán widgets base?
7. ¿Se probará navegación protegida?
8. ¿Qué no se probará todavía?

## Decisión propuesta

Fase 5 debe incluir pruebas mínimas de:

```text
ApiResponse parser
ApiException parser
AuthState
SecureStorage mock
Router guard
```

---

# 16. Documentación del repo frontend

## Archivos requeridos

```text
README.md
FEATURE-DEVELOPMENT.md
CONTRIBUTING.md
.env.example
analysis_options.yaml
```

## Preguntas

1. ¿README será para instalación o también arquitectura?
2. ¿FEATURE-DEVELOPMENT será la guía principal de André?
3. ¿CONTRIBUTING explicará ramas, commits y PRs?
4. ¿Dónde se documenta cómo agregar una feature?
5. ¿Dónde se documenta cómo consumir un endpoint nuevo?
6. ¿Dónde se documenta cómo agregar DTOs?
7. ¿Dónde se documenta cómo manejar permisos?
8. ¿Dónde se documenta cómo trabajar con mocks?

---

# 17. Flujo Git y ownership

## Preguntas

1. ¿Cuál será la rama estable?
2. ¿Cuál será la rama de integración?
3. ¿André trabajará en ramas feature?
4. ¿Ángeles subirá documentación o solo diseños externos?
5. ¿Quién aprueba PRs?
6. ¿Qué archivos no debe modificar André sin consultar?
7. ¿Qué archivos no debe modificar Ángeles sin consultar?
8. ¿Qué cambios requieren coordinación con Carlos?

## Decisión propuesta

```text
main = estable
dev = integración
feature/<nombre> = trabajo individual
```

Carlos protege:

```text
core/network/
core/config/
core/storage/
routes/
shared/models/base
```

André trabaja principalmente en:

```text
features/
shared/widgets/
```

Ángeles trabaja principalmente en:

```text
docs/
design/
wireframes/
```

---

# 18. Mocks y trabajo sin backend completo

## Preguntas

1. ¿André puede avanzar si Campaigns/Prospects/Jobs no existen en backend?
2. ¿Dónde vivirán los mocks?
3. ¿Los mocks seguirán OpenAPI?
4. ¿Cómo se cambia entre mock y API real?
5. ¿Qué datos fake se usarán?
6. ¿Cómo evitar que mocks contradigan backend?

## Decisión propuesta

Crear mocks por feature solo como adaptadores temporales.

```text
features/campaigns/data/mock_campaigns_repository.dart
features/campaigns/data/api_campaigns_repository.dart
```

La UI consume interfaces, no llamadas HTTP directas.

---

# 19. Alcance fuera del MVP

## Postergar explícitamente

```text
refresh token
analytics
push notifications
deep linking
tema oscuro
offline avanzado
cola de requests
WebSocket/SSE
publicación en stores
métricas avanzadas
dashboards analíticos
```

---

# 20. Criterio de cierre Fase 5

Fase 5 se considera cerrada cuando exista:

```text
1. Repositorio saas-platform-client creado.
2. Flutter app arranca.
3. Estructura base definida.
4. Tema base configurado.
5. ApiClient funcional.
6. Manejo de errores estándar.
7. SecureStorageService funcional.
8. AuthService funcional.
9. AuthState con Riverpod.
10. Routing protegido con go_router.
11. Login funcional contra backend.
12. /auth/me funcional.
13. select-tenant funcional.
14. logout funcional.
15. DTOs base implementados.
16. README.md completo.
17. FEATURE-DEVELOPMENT.md completo.
18. CONTRIBUTING.md completo.
19. .env.example sin secretos reales.
20. Handoff explícito para André y Ángeles.
```

## Veredicto esperado

```text
F5 CLOSED AS FLUTTER FOUNDATION / READY FOR FEATURE DEVELOPMENT
```

No significa frontend completo.

Significa que André y Ángeles pueden desarrollar sobre una base estable sin rediseñar arquitectura.
