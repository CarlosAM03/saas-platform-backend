# F4 Implementation Plan — Platform Backend Sprint

> Artefacto externo de ejecución F4, ejecutado y conservado como evidencia histórica; no es requisito versionarlo. ADR-004 y registro F4 prevalecen. Las rutas y credenciales de ejemplo se reconciliaron; los prompts originales no sustituyen las decisiones consolidadas.

## Documento de ejecución para Copilot/Codex

**Versión:** 1.0  
**Fecha:** 9 de septiembre de 2026  
**Basado en:** ADR-004 (cerrado), Auditoría de consistencia (actualizada), y el flujo definido en `readiness.md`.  
**Propósito:** Guiar la implementación del baseline del Platform Backend (Fase 4) de forma autónoma por parte de Copilot/Codex, asegurando que el código resultante sea consistente con las decisiones arquitectónicas cerradas.

---

## Tabla de contenido

1. [Introducción y contexto](#1-introducción-y-contexto)
2. [Jerarquía de fuentes de verdad para Copilot](#2-jerarquía-de-fuentes-de-verdad-para-copilot)
3. [Estructura final del proyecto](#3-estructura-final-del-proyecto)
4. [Preparación inicial (manual)](#4-preparación-inicial-manual)
5. [Sprint de implementación: bloques](#5-sprint-de-implementación-bloques)
   - Bloque 1: Bootstrap y configuración
   - Bloque 2: Prisma Service y modelo
   - Bloque 3: Common (infraestructura transversal)
   - Bloque 4: Auth (autenticación y JWT)
   - Bloque 5: Users (gestión de usuarios y roles)
   - Bloque 6: Módulos funcionales vacíos
   - Bloque 7: Health checks
   - Bloque 8: Pruebas de infraestructura
   - Bloque 9: Documentación y guías
6. [Handoff a Ángel](#6-handoff-a-ángel)
7. [Checklist de aceptación](#7-checklist-de-aceptación)
8. [Prompt maestro para Copilot/Codex](#8-prompt-maestro-para-copilotcodex)

---

## 1. Introducción y contexto

Este plan materializa la **Fase 4** del proyecto: la construcción del *baseline técnico* del Platform Backend. El objetivo es dejar una base sólida, segura y documentada sobre la cual Ángel (y otros desarrolladores) podrán construir los módulos funcionales (Tenants, Campaigns, Prospects, ProspectingJobs, etc.) sin tener que reinterpretar las decisiones arquitectónicas.

**Decisiones clave ya cerradas** (fuente: ADR-004 y formulario de decisiones):

- **Multi-tenancy**: Shared DB + Shared Schema + tenantId.
- **Roles**: `OWNER` y `MEMBER` son roles *tenant-scoped*; `ADMIN` es un rol global de plataforma (representado por `platformRole` en `User`).
- **User ↔ Role**: Relación a través de `UserTenant.roleId`; `User.roleId` **eliminado**.
- **JWT**: Claims `platformRole`, `tenantId`, `tenantRole`. Expiración 8h, HS256, sin refresh token.
- **TenantContext**: Implementado con `AsyncLocalStorage`.
- **Aislamiento**: Se hará mediante consultas explícitas con `tenantId` desde los Services; no se usará Prisma Middleware/Extension obligatorio.
- **Autenticación**: Passport + JWT Strategy.
- **Rate limiting**: 5 intentos/60s/IP para login, en memoria.

Todos los documentos (ADR-001, ADR-002, ADR-003, Fase1, Fase2, Fase3, OpenAPI) han sido actualizados y son coherentes con estas decisiones.

---

## 2. Jerarquía de fuentes de verdad para Copilot

Durante la implementación, Copilot debe priorizar la siguiente jerarquía:

1. **ADR-004** (`Docs/ADRs/ADR-004-CommonBaseline.md`) y el **formulario de decisiones de Fase 4** (`Docs/DocsTeam/FormularioDeDecisiones/FormularioDecisionesFase4.md`).
2. **Prisma/schema.prisma** (ya corregido según las decisiones).
3. **OpenAPI** (`Docs/Contracts/platform-api.v1.yaml` y `prospector-service-api.v1.yaml`).
4. **ADRs anteriores** (ADR-001, ADR-002, ADR-003) y sus respectivos análisis (Fase1, Fase2, Fase3).
5. **Documentación general** (ActaConceptual, ModeloArquitectonico, etc.) como contexto histórico, no como fuente de implementación.

Si algún documento secundario contradice a ADR-004 o al schema, **Copilot debe priorizar ADR-004 y reportar la contradicción**.

---

## 3. Estructura final del proyecto

La siguiente estructura de carpetas y archivos debe ser creada durante el sprint:

```
saas-backend/
├── .env.example
├── .gitignore
├── nest-cli.json
├── package.json
├── tsconfig.json
├── prisma/
│   ├── schema.prisma          (ya corregido)
│   └── seed.ts
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── common.module.ts
│   │   ├── interceptors/
│   │   │   ├── request-id.interceptor.ts
│   │   │   ├── logging.interceptor.ts
│   │   │   └── response.interceptor.ts
│   │   ├── guards/
│   │   │   ├── auth.guard.ts
│   │   │   ├── roles.guard.ts
│   │   │   └── rate-limit.guard.ts
│   │   ├── decorators/
│   │   │   ├── public.decorator.ts
│   │   │   ├── roles.decorator.ts
│   │   │   └── current-user.decorator.ts
│   │   ├── filters/
│   │   │   └── global-exception.filter.ts
│   │   ├── context/
│   │   │   └── tenant-context.service.ts
│   │   ├── config/
│   │   │   └── config.module.ts
│   │   ├── health/
│   │   │   └── health.controller.ts
│   │   └── dto/
│   │       ├── pagination.dto.ts
│   │       └── response.dto.ts
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── dto/
│   │   │   ├── login.request.ts
│   │   │   ├── login.response.ts
│   │   │   └── select-tenant.request.ts
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts
│   │   └── guards/
│   │       └── local-auth.guard.ts (opcional)
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── dto/
│   │   │   ├── create-user.request.ts
│   │   │   ├── update-user.request.ts
│   │   │   └── user.response.ts
│   │   └── services/
│   │       ├── user-tenant.service.ts
│   │       └── role.service.ts
│   ├── tenants/                  (estructura vacía, solo .module.ts)
│   │   └── tenants.module.ts
│   ├── campaigns/                (estructura vacía)
│   │   └── campaigns.module.ts
│   ├── prospects/                (estructura vacía)
│   │   └── prospects.module.ts
│   ├── prospecting-jobs/         (estructura vacía)
│   │   └── prospecting-jobs.module.ts
│   ├── prospector-client/        (estructura vacía)
│   │   └── prospector-client.module.ts
│   └── prisma/
│       └── prisma.service.ts
├── test/
│   ├── common/
│   ├── auth/
│   └── users/
├── README.md
└── MODULE-DEVELOPMENT.md
```

Los archivos marcados como `(estructura vacía)` deben contener al menos un módulo NestJS básico y ser importados en `AppModule`.

---

## 4. Preparación inicial (manual)

Antes de comenzar con Copilot, asegúrate de:

- [ ] Tener Node.js (v18+), npm/yarn, PostgreSQL (local o remoto) instalados.
- [ ] Crear un nuevo proyecto NestJS con `nest new saas-backend` o clonar un repositorio base.
- [ ] Instalar dependencias necesarias (ver más adelante).
- [ ] Configurar las variables de entorno en `.env` (usar `.env.example` como plantilla).
- [ ] Asegurar que el schema Prisma esté actualizado (ya corregido).

**Dependencias a instalar** (el plan incluirá los comandos en los bloques correspondientes):

- `@nestjs/config`
- `@nestjs/passport`, `passport`, `@nestjs/jwt`, `passport-jwt`
- `@prisma/client`, `prisma`
- `class-validator`, `class-transformer`
- `bcrypt`, `@types/bcrypt`
- `pino`, `pino-pretty`, `nestjs-pino`
- `helmet`
- `@nestjs/throttler` (opcional, pero podemos implementar rate limiting manualmente)

El plan asume que Copilot puede ejecutar comandos `npm install` y crear archivos.

---

## 5. Sprint de implementación: bloques

A continuación se presentan los bloques de trabajo. Cada bloque contiene:

- **Objetivo**
- **Tareas concretas** (archivos a crear/modificar)
- **Prompt detallado para Copilot** (copia y pega en la conversación)

> **Importante:** Copilot debe leer los documentos de referencia antes de implementar cada bloque. Se le proporcionará un prompt maestro al inicio.

---

### Bloque 1: Bootstrap y configuración

**Objetivo:** Configurar el proyecto NestJS, el módulo de configuración, las variables de entorno, y el arranque principal (`main.ts`).

**Archivos a crear/modificar:**

- `package.json` (agregar scripts y dependencias)
- `.env.example`
- `src/main.ts`
- `src/app.module.ts`
- `src/common/config/config.module.ts` (módulo de configuración)

**Prompt para Copilot:**

```
Lee ADR-004 secciones 8, 9, 10, 11 y 58. Luego:

1. Asegura que el package.json tenga las dependencias necesarias:
   - @nestjs/config
   - @nestjs/passport, passport, @nestjs/jwt, passport-jwt
   - @prisma/client, prisma
   - class-validator, class-transformer
   - bcrypt, @types/bcrypt
   - nestjs-pino, pino, pino-http
   - helmet
   - @nestjs/throttler (opcional)
   Además, agrega scripts: start:dev, build, start, test, test:e2e, lint, format, prisma:generate, prisma:migrate, prisma:seed.

2. Crea el archivo .env.example con las variables:
   NODE_ENV=development
   PORT=3000
   DATABASE_URL=postgresql://user:password@localhost:5432/saas
   JWT_SECRET=changeme
   JWT_EXPIRES_IN=8h
   PROSPECTOR_SERVICE_URL=http://localhost:8000
   PROSPECTOR_API_KEY=changeme
   CORS_ORIGINS=http://localhost:4200
   ADMIN_NAME=Admin
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=<ADMIN_PASSWORD>

3. Implementa src/main.ts según ADR-004:
   - Bootstrap con NestFactory.
   - Prefijo global '/api/v1' (app.setGlobalPrefix('api/v1')).
   - ValidationPipe global con whitelist: true, forbidNonWhitelisted: true, transform: true.
   - Registro de GlobalExceptionFilter (crearemos en Bloque 3).
   - Registro de interceptores globales (ResponseInterceptor, RequestIdInterceptor, LoggingInterceptor).
   - Helmet y CORS (CORS configurable desde variables de entorno).
   - Shutdown hooks.

4. Crea src/common/config/config.module.ts usando @nestjs/config. Debe cargar y validar las variables obligatorias (DATABASE_URL, JWT_SECRET, PROSPECTOR_API_KEY). Si falta alguna, la aplicación no debe arrancar.

5. Crea src/app.module.ts e importa ConfigModule, CommonModule (crearemos después), AuthModule, UsersModule, y los módulos vacíos (aunque aún no existan, los dejaremos comentados o los crearemos más tarde). Al menos importa ConfigModule y CommonModule por ahora.
```

---

### Bloque 2: Prisma Service y modelo

**Objetivo:** Configurar Prisma, el `PrismaService` y el seed inicial.

**Archivos a crear/modificar:**

- `prisma/schema.prisma` (ya debe estar corregido, verificar)
- `src/prisma/prisma.service.ts`
- `prisma/seed.ts`
- `src/prisma/prisma.module.ts` (opcional, puede integrarse en Common)

**Prompt para Copilot:**

```
Revisa ADR-004 secciones 12, 13, 46, 47 y el esquema Prisma corregido. Luego:

1. Verifica que prisma/schema.prisma coincida con las decisiones:
   - User tiene platformRole String? (sin roleId)
   - UserTenant tiene roleId String (FK a Role)
   - RoleName enum = { OWNER, MEMBER }
   - Role tiene tenantId obligatorio
   - Relaciones correctas.

2. Crea src/prisma/prisma.service.ts como un servicio que extienda PrismaClient y que implemente onModuleInit para conectar la base de datos.

3. Crea un módulo PrismaModule que provea PrismaService (puede estar en src/prisma/prisma.module.ts). Luego impórtalo en AppModule.

4. Crea prisma/seed.ts (punto de entrada para npm run prisma:seed). El seed debe ser idempotente:
   - Verificar si ya existe un rol 'OWNER' y 'MEMBER' para el tenant correspondiente (si no hay tenant, crearlos con un tenant por defecto? Según ADR-004, no hay tenant ficticio, pero para el seed inicial necesitamos al menos un tenant si queremos crear roles. Sin embargo, el ADMIN global no necesita tenant. Debe crearse el usuario ADMIN global con platformRole = 'ADMIN', usando las variables ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD. Si el usuario ya existe, no duplicar.
   - Si se necesita un tenant para pruebas, se puede crear uno, pero no es obligatorio para el seed de ADMIN.

   El seed debe informar en consola las acciones realizadas.
```

---

### Bloque 3: Common (infraestructura transversal)

**Objetivo:** Implementar todos los componentes transversales: interceptores, guards, decoradores, filtros, TenantContext, logging, etc.

**Archivos a crear:**

- `src/common/common.module.ts`
- `src/common/interceptors/request-id.interceptor.ts`
- `src/common/interceptors/logging.interceptor.ts`
- `src/common/interceptors/response.interceptor.ts`
- `src/common/guards/auth.guard.ts`
- `src/common/guards/roles.guard.ts`
- `src/common/guards/rate-limit.guard.ts` (si se implementa con guard)
- `src/common/decorators/public.decorator.ts`
- `src/common/decorators/roles.decorator.ts`
- `src/common/decorators/current-user.decorator.ts`
- `src/common/filters/global-exception.filter.ts`
- `src/common/context/tenant-context.service.ts`
- `src/common/health/health.controller.ts`
- `src/common/dto/pagination.dto.ts`
- `src/common/dto/response.dto.ts`

**Prompt para Copilot:**

```
Lee ADR-004 secciones 15-24, 40-41 y 57. También revisa ADR-003 sobre autenticación y autorización. Implementa los siguientes archivos:

1. tenant-context.service.ts:
   - Usa AsyncLocalStorage para mantener el contexto de la request (userId, tenantId, tenantRole, platformRole).
   - Provee métodos para setear el contexto (desde JWT Strategy) y para obtenerlo (getContext, getTenantId, etc.).
   - Asegura que el contexto no sea accesible fuera de la request.

2. Decoradores:
   - @Public(): marca endpoints como públicos (no requieren autenticación).
   - @Roles(...): acepta ADMIN, OWNER, MEMBER (se interpretan según platformRole o tenantRole).
   - @CurrentUser(): inyecta el objeto usuario autenticado (o el contexto) en el controlador.

3. Guards:
   - AuthGuard: valida JWT (usando Passport) y extrae claims. Si la ruta no es pública, verifica la validez del token y que el usuario esté activo (podemos consultar UserService para verificar estado). Luego establece el TenantContext.
   - RolesGuard: verifica que el usuario tenga el rol requerido según @Roles(). Distingue entre platformRole (ADMIN) y tenantRole (OWNER/MEMBER).
   - RateLimitGuard: implementa rate limiting para login (5 intentos/60s por IP). Usa almacenamiento en memoria (Map). Si se excede, lanza 429.

4. Interceptores:
   - RequestIdInterceptor: genera y asigna un requestId (UUID) a cada request, lo añade a los headers y lo inyecta en el contexto de logging.
   - LoggingInterceptor: registra cada request con method, path, statusCode, duration, userId, tenantId, etc. Usa Pino (nestjs-pino).
   - ResponseInterceptor: envuelve las respuestas exitosas en { success: true, data, meta }.

5. GlobalExceptionFilter: captura todas las excepciones no manejadas y las convierte al formato de error normalizado { success: false, error: { code, message, details, timestamp } }. Debe diferenciar entre errores de validación (400), autenticación (401), autorización (403), no encontrado (404), conflictos (409), internos (500), etc.

6. HealthController: endpoints /health, /health/live, /health/ready. Públicos. /ready debe verificar conexión a PostgreSQL.

7. DTOs de paginación: PaginationDto con page, limit (max 100) y meta de respuesta.

8. Crea CommonModule y registra todos estos componentes (interceptores, guards, decoradores, filtros, etc.) como globales (usando @Global() o registrándolos en AppModule). Asegúrate de que los interceptores y filtros se apliquen globalmente (app.useGlobalInterceptors, app.useGlobalFilters) en main.ts, o mediante módulo.

Asegúrate de que CommonModule sea importado en AppModule.
```

---

### Bloque 4: Auth (autenticación y JWT)

**Objetivo:** Implementar el módulo de autenticación: login, logout, select-tenant, me, JWT generación y validación, password hashing, rate limiting.

**Archivos a crear:**

- `src/auth/auth.module.ts`
- `src/auth/auth.controller.ts`
- `src/auth/auth.service.ts`
- `src/auth/dto/login.request.ts`
- `src/auth/dto/login.response.ts`
- `src/auth/dto/select-tenant.request.ts`
- `src/auth/strategies/jwt.strategy.ts`
- `src/auth/guards/local-auth.guard.ts` (opcional, para login)
- `src/auth/password.service.ts` (opcional, puede estar en common)

**Prompt para Copilot:**

```
Lee ADR-004 secciones 28-39, 42-44 y ADR-003. También revisa platform-api.v1.yaml para los endpoints de auth. Implementa:

1. Crea el módulo AuthModule con imports: ConfigModule, PassportModule, JwtModule (registrado con JWT_SECRET y JWT_EXPIRES_IN).

2. AuthService:
   - Método validateUser(email, password): busca usuario por email, verifica estado ACTIVO, compara contraseña con bcrypt.
   - Método login(user): genera JWT con claims: sub, email, platformRole, tenantId, tenantRole (según el contexto). Si el usuario tiene un solo tenant, lo asigna automáticamente; si tiene múltiples, debe devolver la lista de tenants.
   - Método selectTenant(userId, tenantId): valida que exista UserTenant para ese usuario/tenant, obtiene el rol, y genera un nuevo JWT con el tenant seleccionado.
   - Método getMe(userId): obtiene el perfil del usuario con sus tenants y rol actual.
   - Método logout: solo registra el evento (stateless, no hace nada especial).

3. AuthController:
   - POST /auth/login: recibe email/password, llama a AuthService.login, devuelve JWT y lista de tenants (si hay múltiples). Si solo un tenant, devuelve el JWT final.
   - POST /auth/logout: requiere autenticación, solo retorna 200.
   - POST /auth/select-tenant: requiere autenticación, recibe tenantId, valida y emite nuevo JWT.
   - GET /auth/me: devuelve el perfil del usuario y contexto actual.

4. JWT Strategy (passport-jwt): valida el token, extrae claims, consulta UserService para verificar que el usuario aún existe y está activo (si no, rechaza). Luego establece el TenantContext con los claims.

5. PasswordService (puede estar en common o auth): encapsula bcrypt con hash(password) y compare(password, hash).

6. Rate limiting: aplica el RateLimitGuard (creado en Bloque 3) al endpoint /auth/login (puedes usar @UseGuards(RateLimitGuard) en el controlador).

7. Asegura que los endpoints de login y health sean públicos (@Public()). Los demás requieren autenticación (por defecto con AuthGuard global, pero marcamos @Public() para los públicos).

8. Usa DTOs para request y response, según OpenAPI.
```

---

### Bloque 5: Users (gestión de usuarios y roles)

**Objetivo:** Implementar el CRUD de usuarios, gestión de UserTenant, roles, y desactivación lógica.

**Archivos a crear:**

- `src/users/users.module.ts`
- `src/users/users.controller.ts`
- `src/users/users.service.ts`
- `src/users/dto/create-user.request.ts`
- `src/users/dto/update-user.request.ts`
- `src/users/dto/user.response.ts`
- `src/users/services/user-tenant.service.ts`
- `src/users/services/role.service.ts`

**Prompt para Copilot:**

```
Lee ADR-004 secciones 45, 34-36, y platform-api.v1.yaml para endpoints /users. Implementa:

1. UsersModule: importa PrismaModule, CommonModule.

2. RoleService:
   - Método findRolesByTenant(tenantId): obtiene los roles (OWNER, MEMBER) para ese tenant.
   - Método getRoleByName(tenantId, name): obtiene un rol específico.
   - Al seed, asegura que existan los roles OWNER y MEMBER para cada tenant (o al menos para el tenant por defecto). Pero en el MVP, podríamos crear roles al crear el tenant (pero eso será en Fase 5). Por ahora, solo proporciona métodos de consulta.

3. UserTenantService:
   - Método findTenantsByUser(userId): lista tenants a los que pertenece el usuario, con su rol.
   - Método validateMembership(userId, tenantId): verifica que la relación exista.
   - Método addUserToTenant(userId, tenantId, roleId): crea la relación.

4. UsersService:
   - create(createUserDto): crea un usuario (con password hasheado), y lo asocia al tenant actual (si se proporciona tenantId) con el rol correspondiente. También puede aceptar roleId. Debe validar que el usuario que crea tenga permisos (OWNER o ADMIN).
   - findAll(filters, pagination): lista usuarios del tenant actual (solo los que pertenecen al tenant, con proyección).
   - findOne(id): obtiene un usuario con su rol y tenants.
   - update(id, updateUserDto): actualiza datos (name, email, password, roleId si se permite, status). Solo OWNER/ADMIN pueden modificar. Desactivación lógica: status = INACTIVO.
   - remove(id): desactiva lógicamente (status = INACTIVO). Solo ADMIN.

5. UsersController:
   - GET /users: paginado, filtros.
   - POST /users: crea usuario en el tenant actual.
   - GET /users/:id
   - PATCH /users/:id
   - DELETE /users/:id (desactiva)

   Todos los endpoints deben usar RolesGuard y TenantContext. El tenant se obtiene automáticamente del contexto.

6. DTOs: CreateUserRequest con name, email, password, roleId (opcional, si no se proporciona se asigna MEMBER). UpdateUserRequest con campos opcionales. UserResponse sin passwordHash.

7. Asegura que el módulo Users sea importado en AppModule.
```

---

### Bloque 6: Módulos funcionales vacíos

**Objetivo:** Crear la estructura de carpetas y módulos para los dominios que Ángel implementará después, pero vacíos (solo con el módulo NestJS).

**Archivos a crear:**

- `src/tenants/tenants.module.ts`
- `src/campaigns/campaigns.module.ts`
- `src/prospects/prospects.module.ts`
- `src/prospecting-jobs/prospecting-jobs.module.ts`
- `src/prospector-client/prospector-client.module.ts`

**Prompt para Copilot:**

```
Lee ADR-004 sección 7 y 25. Crea los siguientes módulos vacíos, cada uno en su carpeta:

1. tenants/tenants.module.ts: exporta una clase TenantsModule vacía.
2. campaigns/campaigns.module.ts: exporta una clase CampaignsModule vacía.
3. prospects/prospects.module.ts: exporta una clase ProspectsModule vacía.
4. prospecting-jobs/prospecting-jobs.module.ts: exporta una clase ProspectingJobsModule vacía.
5. prospector-client/prospector-client.module.ts: exporta una clase ProspectorClientModule vacía.

Luego, regístralos todos en AppModule (imports). No necesitan controllers ni services por ahora.
```

---

### Bloque 7: Health checks

**Objetivo:** Asegurar que los endpoints de health estén funcionando (ya se creó HealthController en Common, pero verificar que esté registrado y accesible).

**Prompt para Copilot:**

```
Verifica que HealthController esté registrado en CommonModule y que los endpoints /health, /health/live, /health/ready sean públicos. /ready debe verificar la conexión a la base de datos (usando PrismaService). Actualiza el controlador si es necesario.
```

---

### Bloque 8: Pruebas de infraestructura

**Objetivo:** Crear pruebas unitarias y de integración para los componentes críticos.

**Archivos a crear (en `test/`):**

- `test/common/tenant-context.spec.ts`
- `test/auth/auth.e2e-spec.ts`
- `test/users/users.e2e-spec.ts`
- `test/tenant-isolation.e2e-spec.ts`
- `test/rate-limiting.e2e-spec.ts`

**Prompt para Copilot:**

```
Lee ADR-004 sección 56 y los criterios de aceptación. Crea pruebas:

1. TenantContext: prueba que el contexto se establece correctamente y que no es accesible fuera de la request.

2. Auth E2E:
   - Login exitoso devuelve token.
   - Login fallido devuelve 401.
   - Token inválido devuelve 401.
   - Usuario inactivo no puede autenticarse.
   - Select tenant funciona con un usuario con múltiples tenants.

3. Users E2E:
   - CRUD de usuarios con roles adecuados.
   - Desactivación lógica (DELETE).
   - Aislamiento: usuario de Tenant A no puede ver usuarios de Tenant B.

4. Tenant isolation: prueba que un usuario autenticado con tenant A no puede acceder a recursos de tenant B (usando un endpoint de ejemplo, quizás /users).

5. Rate limiting: envía 6 requests de login en 60 segundos y verifica que la sexta recibe 429.

Utiliza Jest y supertest. Las pruebas deben ser ejecutables con npm run test y npm run test:e2e.
```

---

### Bloque 9: Documentación y guías

**Objetivo:** Crear la documentación final para Ángel y los agentes de IA.

**Archivos a crear:**

- `README.md` (actualizar con instrucciones de instalación, variables, y arquitectura general)
- `MODULE-DEVELOPMENT.md` (guía completa para crear nuevos módulos)

**Prompt para Copilot:**

```
Lee ADR-004 secciones 52, 53 y los criterios de aceptación. Crea/actualiza:

1. README.md:
   - Visión general del backend.
   - Requisitos (Node, PostgreSQL).
   - Configuración (.env.example, variables).
   - Instalación y ejecución (npm install, prisma migrate, seed, start:dev).
   - Estructura de carpetas.
   - Enlaces a la documentación (ADRs, OpenAPI).

2. MODULE-DEVELOPMENT.md:
   - Explicación de la arquitectura modular.
   - Cómo crear un nuevo módulo (comando nest g module, estructura).
   - Cómo usar TenantContext, @Roles, @Public, @CurrentUser.
   - Cómo hacer consultas tenant-aware (ejemplos).
   - Cómo utilizar el wrapper de respuestas y manejo de errores.
   - Cómo escribir pruebas.
   - Decisiones congeladas (no modificar ADRs, Prisma, etc.).
   - Cómo reportar contradicciones.

Asegura que la documentación sea clara y esté orientada a que Ángel (y agentes IA) puedan implementar módulos funcionales sin rediseñar.
```

---

## 6. Handoff a Ángel

Al finalizar el sprint, el repositorio debe estar listo para que Ángel continúe con:

- Implementación de la lógica de negocio para Tenants, Campaigns, Prospects, ProspectingJobs.
- Integración con Prospector Service (aunque se usará un cliente simulado o básico inicialmente).
- Desarrollo de Flutter (pero eso es aparte).

**Entregables a Ángel:**

- Código fuente completo del baseline.
- Documentación (README, MODULE-DEVELOPMENT.md).
- Contratos OpenAPI actualizados.
- Pruebas básicas.
- Seed inicial para usuarios y roles.

Copilot debe generar un mensaje de handoff que resuma el estado y los siguientes pasos.

---

## 7. Checklist de aceptación

Al final del sprint, verificar los siguientes puntos:

- [ ] Proyecto compila sin errores (`npm run build`).
- [ ] `npm run lint` y `npm run format` pasan sin errores.
- [ ] Prisma genera cliente y migraciones funcionan.
- [ ] Seed idempotente crea ADMIN.
- [ ] Health endpoints responden.
- [ ] Login devuelve JWT, y JWT es válido.
- [ ] Logout responde 200.
- [ ] Select tenant funciona con múltiples tenants.
- [ ] `/auth/me` devuelve contexto.
- [ ] RolesGuard permite acceso según roles.
- [ ] Rate limit limita login.
- [ ] CRUD de usuarios funciona con aislamiento.
- [ ] Tests pasan (unitarios y e2e).
- [ ] Documentación completa.

---

## 8. Prompt maestro para Copilot/Codex

Copia y pega el siguiente prompt al inicio de la conversación con Copilot. Este prompt establece el contexto y le indica que siga el plan paso a paso.

---

**Prompt maestro:**

```
Eres Copilot/Codex, un asistente de programación experto en NestJS, TypeScript, Prisma y arquitectura SaaS. Vas a ejecutar el plan de implementación de la Fase 4 del Platform Backend, siguiendo estrictamente el documento "F4_Implementation_Plan.md" y las decisiones de ADR-004.

Contexto:
- El proyecto es un backend SaaS multi-tenant para gestión de campañas de marketing.
- La arquitectura es un Modular Monolith con NestJS, Prisma, PostgreSQL.
- Las decisiones clave están en ADR-004 y el formulario de decisiones de Fase 4.
- Todos los documentos (ADRs, OpenAPI, análisis de fases) han sido actualizados y son consistentes.
- El objetivo es construir el baseline: Common, Auth, Users, Health, estructura de módulos vacíos, pruebas y documentación.

Instrucciones:
1. Lee los documentos necesarios (ADR-004, OpenAPI, schemas) antes de implementar cada bloque.
2. Sigue el orden de los bloques del plan (Bootstrap, Prisma, Common, Auth, Users, módulos vacíos, Health, pruebas, documentación).
3. Por cada archivo que crees, incluye comentarios que expliquen el propósito y referencias a ADR-004.
4. No modifiques ADR-004 ni el formulario de decisiones. Son fuentes de verdad.
5. Si encuentras una contradicción entre la documentación y el plan, reportala y espera instrucciones.
6. Ejecuta pruebas después de cada bloque y corrige errores técnicos.
7. Al final de cada bloque, proporciona un resumen de lo implementado y una lista de pendientes.
8. Cuando hayas completado todos los bloques, genera un informe de handoff para Ángel.

Comienza con el Bloque 1: Bootstrap y configuración.
```

---

## Nota final

Este plan está diseñado para ser ejecutado por Copilot de forma autónoma, con checkpoints para revisión humana. Asegúrate de que el entorno de desarrollo esté listo (Node, PostgreSQL, variables de entorno) antes de iniciar.

**El éxito del sprint dependerá de la precisión con que Copilot siga las instrucciones y de que la documentación de referencia sea la correcta.** Si en algún momento se detecta una desviación, se debe detener y ajustar.

---

**Fin del documento**
