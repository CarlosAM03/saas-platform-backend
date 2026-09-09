# AUDITORÍA FINAL DE FASE 3 Y DELIMITACIÓN DE FASE 4

## 1. Veredicto ejecutivo

```text
FASE 3 — CERRADA DEFINITIVAMENTE
```

No se identifican contradicciones bloqueantes entre ADR-003 y el resto de la arquitectura. Las observaciones encontradas son:

- **A-01 (ADMIN vs Role.tenantId)**: No es una contradicción; es un detalle de implementación que se resuelve en Fase 4 sin modificar Prisma.
- **A-02 (Política de contraseñas ambigua)**: Detalle de implementación que se definirá en F4.
- **O-01 (Creación de ADMIN inicial)**: Omisión no bloqueante; se resuelve con seed o bootstrap en F4.
- **O-02 (Respuesta de select-tenant sin múltiples tenants)**: Omisión que se define en F4.

Todas las decisiones de seguridad transversal están cerradas y son coherentes con F1, F2, Prisma y OpenAPI. La implementación de Common/Auth/Users puede comenzar sin necesidad de nuevas decisiones arquitectónicas.

---

## 2. Auditoría de consistencia F1 → F2 → F3

| Área | F1 | F2 | F3 | Consistencia |
|------|----|----|----|--------------|
| **Multi-tenancy** | Shared DB + tenantId | Shared DB + tenantId | TenantContext + UserTenant validation | ✅ Coherente |
| **User ↔ Tenant** | N:M vía UserTenant | N:M vía UserTenant | Validación de pertenencia vía UserTenant | ✅ Coherente |
| **Roles** | OWNER/MEMBER tenant-scoped, ADMIN global | OWNER/MEMBER tenant-scoped, ADMIN global | OWNER/MEMBER tenant-scoped, ADMIN global | ✅ Coherente |
| **JWT** | JWT Bearer | JWT Bearer, 8h exp | HS256, claims definidos, sin refresh | ✅ Coherente |
| **API Keys** | — | X-API-Key (ambas direcciones) | X-API-Key, variables de entorno | ✅ Coherente |
| **Rate Limiting** | — | — | 5 intentos/min por IP, in-memory | ✅ Coherente |
| **Logging** | Sin auditoría event-driven | Sin auditoría event-driven | Eventos definidos, campos definidos | ✅ Coherente |
| **Logout** | — | — | Stateless, sin blacklist | ✅ Coherente |
| **Prisma** | User.platformRole, UserTenant.roleId, Role tenant-scoped | Schema actualizado | Coherente con User, UserTenant, Role | ✅ Coherente |
| **OpenAPI** | — | Contractos congelados | Coherente con endpoints y protección | ✅ Coherente |

**Conclusión:** No hay contradicciones reales. Todas las decisiones son coherentes entre fases.

---

## 3. Auditoría ADR-003 (F3-01 a F3-10)

| Decisión | Estado | Coherente | ¿Bloquea F4? | Observación |
|----------|--------|-----------|--------------|-------------|
| **F3-01 — Algoritmo JWT** | HS256 | ✅ | No | Coherente con arquitectura centralizada. |
| **F3-02 — Claims y fuente de verdad** | sub, iat, exp, email, platformRole, tenantId, tenantRole | ✅ | No | JWT distingue autoridad global y rol tenant-scoped. |
| **F3-03 — Resolución y contexto de tenant** | JWT contiene tenantId, validación vía UserTenant | ✅ | No | Cambio de tenant emite nuevo JWT. |
| **F3-04 — Arquitectura transversal** | Global AuthGuard + @Public() + RolesGuard | ✅ | No | Estándar NestJS, declarativo. |
| **F3-05 — Aislamiento multi-tenant** | TenantContext + tenantId en consultas | ✅ | No | Coherente con Shared DB + tenantId. |
| **F3-06 — Password hashing** | bcrypt, cost 12, política básica | ✅ | No | Tecnología conocida, adecuada para MVP. |
| **F3-07 — Rate limiting** | 5 intentos/min por IP, in-memory | ✅ | No | Protección básica, limitaciones aceptadas. |
| **F3-08 — Logging** | Eventos y campos definidos | ✅ | No | Suficiente para MVP, sin auditoría completa. |
| **F3-09 — Endpoints transversales** | Públicos, JWT, API Key según corresponda | ✅ | No | Coherente con F2. |
| **F3-10 — Logout JWT** | Stateless, sin blacklist | ✅ | No | Coherente con JWT sin refresh. |

**Conclusión:** Todas las decisiones F3 están correctamente cerradas y no bloquean F4.

---

## 4. ADMIN global vs Role.tenantId

**Análisis:**

- ADR-003 define ADMIN como **rol global de plataforma**, no tenant-scoped.
- Prisma `Role` tiene `tenantId` obligatorio y `@@unique([tenantId, name])`.

**Resolución F4:** No existe contradicción en el modelo definitivo. `ADMIN` se representa mediante `User.platformRole` y no se persiste en `Role`. `RoleName` contiene únicamente `OWNER` y `MEMBER`; `UserTenant.roleId` asigna esos roles por tenant. Un `ADMIN` puede existir sin registros en `UserTenant`, por lo que no se crea un tenant dummy o system tenant.

---

## 5. Auditoría del flujo multi-tenant

**Escenario base:**

```text
Usuario
 ├── Tenant A → OWNER
 └── Tenant B → MEMBER
```

**Flujo validado:**

1. **Login:** El usuario inicia sesión con email/contraseña. Se valida credenciales.
2. **Identificación:** Se obtiene el `userId` y se consultan sus tenants activos mediante `UserTenant`.
3. **Detección de múltiples tenants:**
   - Si solo tiene uno, se emite JWT con ese `tenantId` y su rol.
   - Si tiene varios, se devuelve lista de tenants y se espera que el usuario seleccione uno.
4. **Selección de tenant:** El cliente llama a `POST /auth/select-tenant` con `tenantId`. Se valida que exista la relación `UserTenant` para ese `userId` y `tenantId`, y se obtiene el rol correspondiente desde `UserTenant.roleId`. Se emite nuevo JWT con `tenantId` y `tenantRole` seleccionados. Un ADMIN global puede autenticarse sin esa relación.
5. **Acceso aislado:** Todos los endpoints protegidos extraen `tenantId` del JWT, y las consultas a datos multi-tenant incluyen filtro `where: { tenantId: context.tenantId }`.

**Casos especiales validados:**

- **Usuario sin tenant:** Un usuario normal sin membresías no obtiene JWT tenant-scoped. Un ADMIN global sí puede autenticarse sin tenant.
- **Tenant suspendido:** Se valida en TenantContext y se rechaza la request con 403.
- **Usuario inactivo:** Se valida en AuthGuard y se rechaza.
- **Pérdida de pertenencia:** El JWT es un snapshot de autorización; un cambio de membresía o rol se refleja al emitir un nuevo JWT conforme a F4-C05.
- **Manipulación de tenantId:** No se acepta desde el cliente; el tenantId se toma del JWT, y la validación de `UserTenant` evita acceso a tenants no autorizados.

**Conclusión:** El flujo multi-tenant es implementable y seguro con el modelo Prisma actual. No hay bloqueos.

---

## 6. Auditoría de Auth/AuthGuard/TenantContext/RolesGuard

**Orden de ejecución:**

```text
Request → Global AuthGuard → @Public()? → (si no) JWT validation → TenantContext → UserTenant validation → RolesGuard → @Roles() → Controller
```

**Validación conceptual:**

| Componente | Responsabilidad | ¿Es necesario? | ¿Coherente? |
|------------|-----------------|----------------|-------------|
| **Global AuthGuard** | Validar JWT y extraer claims. | Sí. | ✅ |
| **@Public()** | Marcar endpoints sin autenticación. | Sí. | ✅ |
| **TenantContext** | Almacenar userId, tenantId, platformRole y tenantRole del contexto autenticado. | Sí. | ✅ |
| **UserTenant validation** | Validar pertenencia del usuario al tenant. | Sí. | ✅ |
| **RolesGuard** | Verificar rol contra @Roles(). | Sí. | ✅ |

**Conclusión:** La arquitectura es conceptualmente sólida y se puede implementar sin contradicciones. Los detalles de implementación (AsyncLocalStorage, inyección de contexto) se resuelven en F4.

---

## 7. Auditoría de Common

**Componentes necesarios para F4:**

| Componente | ¿Debe estar en Common? | Justificación |
|------------|------------------------|---------------|
| **RequestId interceptor** | Sí | Transversal, genera ID para logs. |
| **Logging interceptor** | Sí | Transversal, registra requests/responses. |
| **TenantContext service** | Sí | Transversal, usado por todos los módulos. |
| **AuthGuard** | Sí | Global, usado en toda la API. |
| **RolesGuard** | Sí | Global, usado en toda la API. |
| **@Public() decorator** | Sí | Transversal, marca endpoints públicos. |
| **@Roles() decorator** | Sí | Transversal, marca requisitos de rol. |
| **@CurrentUser() decorator** | Sí | Facilita acceso al usuario en controladores. |
| **GlobalExceptionFilter** | Sí | Maneja errores y formatea respuesta. |
| **ResponseInterceptor** | Sí | Formatea respuestas exitosas con wrapper. |
| **RateLimitGuard** | Sí (o en Auth) | Protege login, puede estar en Common. |
| **ConfigModule** | Sí | Carga variables de entorno. |
| **HealthController** | Sí | Endpoints de health check públicos. |
| **ValidationPipe config** | Sí | Configuración global en main.ts. |

**Conclusión:** Common contiene todos los componentes transversales necesarios. No falta ninguno esencial.

---

## 8. Auditoría de Auth

**Endpoints a implementar en F4:**

| Endpoint | Método | Protección | Dependencias |
|----------|--------|------------|--------------|
| `/auth/login` | POST | Público | Users, Password, JWT, RateLimit |
| `/auth/logout` | POST | JWT | - |
| `/auth/select-tenant` | POST | JWT | UserTenant, JWT |
| `/auth/me` | GET | JWT | Users |

**Dependencias transversales:**

- **Users service:** Para validar credenciales y obtener datos de usuario.
- **UserTenant service:** Para validar pertenencia y obtener tenants.
- **JWT service:** Para generar y validar tokens.
- **Password service:** Para hashear y verificar contraseñas.
- **Config:** Para JWT_SECRET y otras variables.
- **Rate limiting:** Para proteger login.
- **TenantContext:** Para establecer contexto después de login/select-tenant.

**Conclusión:** Auth tiene todas las dependencias necesarias y su implementación es viable en F4 sin nuevas decisiones.

---

## 9. Auditoría de Users

**Componentes a implementar en F4:**

| Componente | Responsabilidad |
|------------|-----------------|
| **Users service** | CRUD de usuarios: creación, listado, obtención, actualización, desactivación lógica. |
| **UserTenant service** | Gestión de relación User-Tenant, validación de pertenencia. |
| **Role service** | Gestión de roles tenant-scoped (OWNER, MEMBER) por tenant. ADMIN se gestiona mediante User.platformRole. |

**Endpoints (definidos en F2):**

```text
GET    /api/v1/users
POST   /api/v1/users
GET    /api/v1/users/{id}
PATCH  /api/v1/users/{id}
DELETE /api/v1/users/{id}
```

**DELETE sigue siendo desactivación lógica:** `status = INACTIVO`. No se elimina físicamente.

**Conclusión:** Users está bien definido y no requiere nuevas decisiones arquitectónicas.

---

## 10. Qué debe quedar congelado antes de escribir código

### DECISIONES YA CONGELADAS

- ✅ JWT (HS256, 8h, sin refresh).
- ✅ Claims: sub, iat, exp, email, platformRole, tenantId, tenantRole.
- ✅ Roles: OWNER/MEMBER tenant-scoped, ADMIN global.
- ✅ Multi-tenancy: Shared DB + tenantId + UserTenant validation.
- ✅ Auth: Global AuthGuard + @Public().
- ✅ Autorización: RolesGuard + @Roles().
- ✅ TenantContext: contexto autenticado transversal.
- ✅ Logging: eventos definidos, sin auditoría completa.
- ✅ Rate limiting: login 5 intentos/min por IP, in-memory.
- ✅ Logout: stateless, sin blacklist.
- ✅ API Keys: X-API-Key, variables de entorno.
- ✅ Endpoints públicos: health checks, login.
- ✅ Passwords: bcrypt cost 12, política mínima.
- ✅ Estructura de carpetas: modular por dominio.

### DECISIONES QUE F4 DEBE RESOLVER ANTES O DURANTE IMPLEMENTACIÓN

1. **Manejo de ADMIN vs Role.tenantId:** User.platformRole representa ADMIN global; no existe tenant dummy.
2. **Política de contraseñas exacta:** Definir caracteres específicos (ej. mínimo 10, al menos una mayúscula, un número, un carácter especial).
3. **Creación de ADMIN inicial:** Crear usuario ADMIN con `platformRole = ADMIN`, sin UserTenant obligatorio, mediante seed o script.
4. **Respuesta de select-tenant cuando solo hay un tenant:** Devolver 400 o simplemente el JWT actual (se decide en F4).
5. **Detalles de implementación:** AsyncLocalStorage para TenantContext, configuración de ValidationPipe, etc.
6. **Documentación de handoff:** Guías de uso para Ángel.

---

## 11. Definición correcta de Fase 4

```text
FASE 4 — Implementación de infraestructura transversal y módulos base
```

**Objetivo:** Implementar Common, Auth y Users, y preparar la estructura de módulos funcionales para que Ángel pueda desarrollar sin tomar decisiones arquitectónicas.

**Alcance:**
- Common (interceptores, guards, decoradores, filtros, contexto, health, config).
- Auth (login, logout, select-tenant, me, JWT, bcrypt, rate limiting).
- Users (CRUD, UserTenant, Role, desactivación lógica).
- Estructura de módulos (carpetas vacías para Tenants, Campaigns, Prospects, ProspectingJobs, ProspectorClient).
- Documentación de handoff.

**No alcance:**
- Módulos funcionales (implementación de Campaigns, Prospects, etc.).
- Integración real con Prospector Service (se usarán mocks).
- Frontend.

**Secuencia:**
```text
1. Configuración base (env, Prisma)
2. Common (transversal)
3. Auth
4. Users
5. Estructura de módulos funcionales
6. Pruebas básicas
7. Documentación de handoff
8. Handoff a Ángel
```

---

## 12. Qué debe contener ADR-004

1. **Objetivo** de Fase 4.
2. **Alcance y no alcance**.
3. **Estructura de carpetas** del Platform Backend.
4. **Responsabilidades de Common** (componentes transversales).
5. **Responsabilidades de Auth** (autenticación).
6. **Responsabilidades de Users** (gestión de usuarios y roles).
7. **Convenciones para Ángel**:
   - Cómo usar TenantContext.
   - Cómo usar @Roles, @Public, @CurrentUser.
   - Cómo hacer consultas tenant-aware.
   - Cómo usar el wrapper de respuestas.
   - Cómo manejar errores.
   - Cómo usar logging y requestId.
   - Cómo agregar nuevos módulos.
8. **Criterios de aceptación** de Fase 4.
9. **Pruebas mínimas** requeridas.
10. **Documentación de handoff** a entregar.

**ADR-004 no debe rediseñar, solo explicar cómo implementar lo ya decidido.**

---

## 13. Estructura de carpetas para todo el Platform Backend

```
src/
├── main.ts
├── app.module.ts
├── common/
│   ├── common.module.ts
│   ├── interceptors/
│   │   ├── request-id.interceptor.ts
│   │   ├── logging.interceptor.ts
│   │   └── response.interceptor.ts
│   ├── guards/
│   │   ├── auth.guard.ts
│   │   ├── roles.guard.ts
│   │   └── rate-limit.guard.ts
│   ├── decorators/
│   │   ├── public.decorator.ts
│   │   ├── roles.decorator.ts
│   │   └── current-user.decorator.ts
│   ├── filters/
│   │   └── global-exception.filter.ts
│   ├── context/
│   │   └── tenant-context.service.ts
│   ├── config/
│   │   └── config.module.ts
│   ├── health/
│   │   └── health.controller.ts
│   └── dto/
│       ├── pagination.dto.ts
│       └── response.dto.ts
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── dto/
│   │   ├── login.request.ts
│   │   ├── login.response.ts
│   │   └── select-tenant.request.ts
│   ├── strategies/
│   │   └── jwt.strategy.ts
│   └── guards/
│       └── local-auth.guard.ts (opcional)
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── dto/
│   │   ├── create-user.request.ts
│   │   ├── update-user.request.ts
│   │   └── user.response.ts
│   └── services/
│       ├── user-tenant.service.ts
│       └── role.service.ts
├── tenants/                  → VACÍO PARA ÁNGEL
├── campaigns/                → VACÍO PARA ÁNGEL
├── prospects/                → VACÍO PARA ÁNGEL
├── prospecting-jobs/         → VACÍO PARA ÁNGEL
├── prospector-client/        → VACÍO PARA ÁNGEL
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── .env.example
├── package.json
├── tsconfig.json
└── nest-cli.json
```

---

## 14. Módulos que Ángel recibirá preparados

| Módulo | Responsabilidad | Endpoints | Dependencias transversales |
|--------|-----------------|-----------|----------------------------|
| **Tenants** | Gestión de tenants | GET /tenants, POST /tenants (ADMIN), GET /tenants/{id} | AuthGuard, RolesGuard, TenantContext |
| **Campaigns** | CRUD de campañas | GET, POST, GET/:id, PATCH/:id, DELETE/:id, GET/:id/prospects | AuthGuard, RolesGuard, TenantContext |
| **Prospects** | CRUD de prospectos | GET, GET/:id, PATCH/:id | AuthGuard, RolesGuard, TenantContext |
| **ProspectingJobs** | Gestión de jobs | POST, GET, GET/:id, POST/:id/cancel, POST/:id/persist, GET/:id/export | AuthGuard, RolesGuard, TenantContext, ProspectorClient |
| **ProspectorClient** | Comunicación con Prospector Service | — | API Key, logging, HTTP client |

**Ángel no tendrá que decidir:**
- Cómo autenticar.
- Cómo autorizar.
- Cómo obtener tenant.
- Cómo aislar datos.
- Cómo estructurar respuestas.
- Cómo manejar errores.
- Cómo hacer logging.
- Cómo validar DTOs.
- Cómo comunicarse con Prospector.

---

## 15. Documentación mínima para handoff

- `README.md` del backend: visión general, cómo ejecutar, variables de entorno.
- `common/README.md`: cómo usar interceptores, guards, decoradores, contexto.
- `auth/README.md`: cómo funciona el login, JWT, select-tenant.
- `users/README.md`: cómo gestionar usuarios y roles.
- **Guía de desarrollo de módulos:**
  - Cómo crear un nuevo módulo.
  - Cómo usar `TenantContext`.
  - Cómo usar `@Roles` y `@Public`.
  - Cómo usar `@CurrentUser`.
  - Cómo hacer consultas tenant-aware.
  - Cómo usar el wrapper de respuestas.
  - Cómo manejar errores.
  - Cómo usar logging y `requestId`.
  - Ejemplo completo de un módulo funcional (ej. Campaigns).

---

## 16. Criterios para cerrar F3 y comenzar F4

```text
[✅] Todas las decisiones F3 están cerradas.
[✅] No existen contradicciones bloqueantes.
[✅] Prisma es compatible con la arquitectura.
[✅] OpenAPI es compatible con la arquitectura.
[✅] Auth está definido.
[✅] RBAC está definido.
[✅] TenantContext está definido.
[✅] Tenant isolation está definido.
[✅] Logging está definido.
[✅] Rate limiting está definido.
[✅] Endpoints públicos/protegidos están definidos.
[✅] Logout está definido.
[✅] Limitaciones conocidas están aceptadas.
[✅] No existen decisiones pendientes que bloqueen Common/Auth/Users.
```

```text
FASE 3 — CERRADA DEFINITIVAMENTE
```

---

## 17. Conclusión final

```text
SIGUIENTE PASO:

FASE 4 — Implementación de infraestructura transversal y módulos base

Primer entregable:
ADR-004 + estructura definitiva de Common/Auth/Users + estructura vacía de módulos para Ángel.
```

**Acción concreta:** Redactar ADR-004 siguiendo la estructura definida en la sección 12, y comenzar la implementación de Common, Auth y Users.

**No se requiere ninguna decisión adicional de Fase 3.** La arquitectura de seguridad está completamente definida y cerrada.