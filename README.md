# Plataforma SaaS - Backend

Backend principal de la plataforma SaaS para gestion de campanas de marketing y prospeccion automatizada.

Este repositorio contiene la documentacion global y el proyecto NestJS en `saas-platform-backend/`. El backend expone la Platform API, aplica autenticacion y autorizacion, mantiene el contexto tenant, persiste datos con Prisma y coordina servicios internos.

> **Estado:** Baseline Fase 4 implementado y preparado para desarrollo funcional.
> **Alcance actual:** Common, Auth, Users, Prisma, Health y modulos funcionales preparados.
> **Fuente de verdad:** ADR-004, OpenAPI y `saas-platform-backend/Prisma/schema.prisma`.

---

## 1. Objetivo del proyecto

La plataforma busca proporcionar un sistema SaaS para la gestión de campañas de marketing, permitiendo que diferentes organizaciones o clientes utilicen una misma plataforma manteniendo sus datos y operaciones aislados entre sí.

Uno de los principales fundamentos del sistema es la **multitenencia (Multi-Tenancy)**.

El backend es responsable de aplicar las reglas necesarias para que cada tenant opere dentro de su contexto y no acceda a informacion de otros tenants.

---

## 2. Papel del backend dentro de la arquitectura

El backend NestJS funciona como el **punto central de comunicación entre el cliente y los servicios internos de la plataforma**.

La arquitectura inicial se plantea de la siguiente manera:

```text
┌─────────────────────────────┐
│       Cliente Flutter       │
│                             │
│  Aplicación multiplataforma │
└──────────────┬──────────────┘
               │
               │ HTTP / REST API
               ▼
┌─────────────────────────────┐
│       SaaS Backend          │
│       NestJS + TypeScript   │
│                             │
│  ├── Auth                   │
│  ├── Multi-Tenancy          │
│  ├── Usuarios               │
│  ├── Campañas               │
│  ├── Reglas de negocio      │
│  └── Integraciones          │
└───────┬───────────────┬─────┘
        │               │
        ▼               ▼
┌───────────────┐ ┌───────────────────┐
│  PostgreSQL   │ │ Prospector Service│
│               │ │   FastAPI/Python  │
└───────────────┘ └───────────────────┘
```

El cliente Flutter no deberá comunicarse directamente con PostgreSQL ni con los servicios internos.

El backend será responsable de controlar el acceso a dichos recursos.

---

## 3. Multi-Tenancy

La estrategia actualmente definida para la plataforma es:

**Shared Database + Shared Schema + Tenant ID**

Se utilizará una única base de datos y un esquema compartido entre tenants.

Los registros que pertenezcan a entidades tenant-aware deberán asociarse a un identificador de tenant.

Conceptualmente:

```text
                 PostgreSQL
              Shared Database
              Shared Schema
                     │
          ┌──────────┴──────────┐
          │                     │
      tenant_id = A         tenant_id = B
          │                     │
     ┌────┴────┐            ┌───┴────┐
     │ Usuarios │            │Usuarios│
     │ Campañas │            │Campañas│
     │ Datos    │            │ Datos  │
     └─────────┘            └─────────┘
```

### Responsabilidad del backend

El backend deberá garantizar que las operaciones realizadas por un usuario se ejecuten dentro del contexto del tenant autorizado.

Por lo tanto, el `tenant_id` **no debe considerarse un mecanismo de seguridad por sí mismo**.

El cliente puede proporcionar información asociada al contexto de la sesión, pero el backend deberá validar la identidad, autorización y pertenencia al tenant antes de permitir operaciones sobre los datos.

---

## 4. Flujo de una petición

El flujo inicial de una petición tenant-aware puede representarse de la siguiente manera:

```text
Cliente Flutter
      │
      │ Request
      ▼
┌─────────────────┐
│ Authentication  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Tenant Context  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Authorization   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Business Logic  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Prisma / ORM    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   PostgreSQL    │
└─────────────────┘
```

La implementacion vigente usa JWT Bearer, `TenantContextService` basado en `AsyncLocalStorage`, `AuthGuard` global, `RolesGuard` y Services con consultas tenant-aware.

---

## 5. Stack tecnologico

Tecnologías actualmente consideradas:

```text
Backend
├── Node.js
├── NestJS
├── TypeScript
├── Prisma
└── PostgreSQL
```

### NestJS

Framework principal utilizado para construir la API y organizar los módulos de la aplicación.

### TypeScript

Lenguaje principal del backend.

### Prisma

ORM utilizado para la comunicación entre la aplicación y PostgreSQL.

### PostgreSQL

Sistema gestor de base de datos principal de la plataforma.

---

## 6. Requisitos y configuracion local

Se requiere:

- Node.js y npm.
- PostgreSQL local o accesible por red.
- Una base de datos disponible antes de iniciar NestJS.

El servidor conecta Prisma durante el arranque. Si PostgreSQL no esta configurado, `npm run start:dev` no podra iniciar correctamente.

Desde `saas-platform-backend/`:

```powershell
Copy-Item .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run start:dev
```

Variables principales de `.env`:

```text
NODE_ENV
PORT
DATABASE_URL
JWT_SECRET
JWT_EXPIRES_IN
PROSPECTOR_SERVICE_URL
PROSPECTOR_API_KEY
CORS_ORIGINS
ADMIN_NAME
ADMIN_EMAIL
ADMIN_PASSWORD
```

No se deben subir `.env`, passwords, JWT, API keys ni secretos.

## 7. Estructura actual del proyecto

La estructura propuesta para el MVP es:

```text
    saas-platform-backend/
   │
   ├── main.ts
   │
   ├── app.module.ts
   │
   ├── common/
   ├── auth/
   ├── users/
   ├── prisma/
   ├── tenants/
   ├── campaigns/
   ├── prospects/
   ├── prospecting-jobs/
   |── prospector-client/
   │
   ├── Prisma/schema.prisma
   │
   ├── test/
   │
   ├── .env.example
   ├── package.json
   ├── tsconfig.json
   ├── nest-cli.json
   ├── MODULE-DEVELOPMENT.md
   ├── README.md
```

La estructura es una **propuesta inicial**. Los módulos y responsabilidades podrán cambiar conforme se definan los requerimientos funcionales del sistema.
`Common`, `Auth`, `Users` y `Prisma` contienen infraestructura implementada. `Tenants`, `Campaigns`, `Prospects`, `ProspectingJobs` y `ProspectorClient` son esqueletos NestJS preparados para la siguiente fase.
---

## 8. Modulos implementados

### Common

Incluye configuracion, validacion, Health, TenantContext, guards, decoradores, interceptores, filtro global, Pino y rate limiting.

### Auth

Responsable de la autenticación y establecimiento del contexto de sesión.

Inicialmente contempla:

* Inicio de sesión.
* Validación de credenciales.
* Gestión de sesión.
* Identificación del usuario.
* Preparación para autorización.

Usa Passport + JWT HS256, expiracion configurable de 8 horas, password hashing con bcrypt y seleccion multi-tenant.

---

### Users

Gestiona CRUD de usuarios, `UserTenant`, roles `OWNER/MEMBER` y desactivacion logica. Las consultas se restringen al tenant del `TenantContext`.

## 9. Modulos preparados

Cada modulo tiene un README local con su contexto, endpoints y dependencias:

- [Tenants](saas-platform-backend/src/tenants/README.md)
- [Campaigns](saas-platform-backend/src/campaigns/README.md)
- [Prospects](saas-platform-backend/src/prospects/README.md)
- [Prospecting Jobs](saas-platform-backend/src/prospecting-jobs/README.md)
- [Prospector Client](saas-platform-backend/src/prospector-client/README.md)

La guia general para Ángel y agentes IA es [MODULE-DEVELOPMENT.md](saas-platform-backend/MODULE-DEVELOPMENT.md).

---

## 10. Prospector Service

Como parte de la arquitectura general existe un servicio independiente denominado **Prospector Service**.

Este servicio será desarrollado con **Python + FastAPI** y tendrá integrado internamente el motor de prospección.

El servicio será responsable de encapsular la lógica relacionada con la prospección y exponerla mediante una API para que el backend principal pueda utilizar sus capacidades.

Conceptualmente:

```text
Flutter
   │
   ▼
SaaS Backend
   │
   │ HTTP / API
   ▼
┌─────────────────────────────┐
│     Prospector Service      │
│        Python + FastAPI     │
│                             │
│  ┌───────────────────────┐  │
│  │ Prospector Engine     │  │
│  │                       │  │
│  │ Motor de prospección  │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

El cliente Flutter no deberá comunicarse directamente con Prospector Service.

El backend principal será el responsable de coordinar las solicitudes, aplicar las reglas de negocio correspondientes y comunicarse con el servicio de prospección.

### Responsabilidades

**SaaS Backend:**

* Gestionar la solicitud del usuario.
* Validar autenticación y autorización.
* Mantener el contexto del tenant.
* Aplicar las reglas de negocio.
* Solicitar operaciones de prospección.
* Procesar y almacenar los resultados cuando corresponda.

**Prospector Service:**

* Exponer la API de prospección.
* Ejecutar el motor de prospección integrado.
* Gestionar la lógica específica del proceso de prospección.
* Devolver los resultados al backend principal.

El servicio de prospección se considera un **componente independiente del backend principal**, pero no requiere separar el motor de prospección en otro servicio para el MVP.

---

## 11. Persistencia y seguridad

La persistencia utilizará PostgreSQL mediante Prisma.

La estrategia de multitenencia actualmente definida es:

```text
              PostgreSQL
                  │
          Shared Database
                  │
           Shared Schema
                  │
             tenant_id
                  │
       ┌──────────┴──────────┐
       │                     │
    Tenant A              Tenant B
       │                     │
   Usuarios              Usuarios
   Campañas              Campañas
   Datos                  Datos
```

Las entidades que requieran aislamiento deberán incorporar la relación correspondiente con el tenant.

El modelo vigente esta en [Prisma/schema.prisma](saas-platform-backend/Prisma/schema.prisma). `User.platformRole` representa ADMIN global; `UserTenant.roleId` representa OWNER/MEMBER por tenant. No existe system tenant.

---

## 12. Responsabilidades del backend

El backend será responsable de:

* Exponer la API principal.
* Autenticar usuarios.
* Autorizar operaciones.
* Mantener el contexto del tenant.
* Aplicar el aislamiento entre tenants.
* Ejecutar las reglas de negocio.
* Validar datos de entrada.
* Gestionar la persistencia.
* Coordinar servicios internos.
* Exponer información al cliente Flutter de forma controlada.

El backend **no deberá delegar la seguridad de la multitenencia al cliente**.

---

## 13. Scripts y pruebas

Desde `saas-platform-backend/`:

```powershell
npm run build
npm run lint
npm run test
npm run test:e2e
```

Las pruebas E2E usan Jest y Supertest. El servidor normal requiere PostgreSQL configurado.

## 14. Documentacion y fuentes de verdad

- [ADR-001: dominio MVP](Docs/ADRs/ADR-001-DecisionesDeDominioMVP.md)
- [ADR-002: contrato API](Docs/ADRs/ADR-002-ContratoAPI.md)
- [ADR-003: seguridad y autenticacion](Docs/ADRs/ADR-003-SeguridadAutenticacionComponentesTransversales.md)
- [ADR-004: baseline F4](Docs/ADRs/ADR-004-ImplementacionModulosCommonYBaseline.md)
- [Contrato Platform API V1](Docs/Contracts/platform-api.v1.yaml)
- [Auditoria API V1](Docs/Contracts/API_V1_AUDIT.md)
- [Schema Prisma](saas-platform-backend/Prisma/schema.prisma)

Si el codigo, contrato, schema o documentacion se contradicen, se debe detener la implementacion y reportar la diferencia conforme a `MODULE-DEVELOPMENT.md`.

## 15. Alcance F4

F4 implementa el baseline transversal y deja preparados los modulos funcionales. La funcionalidad completa de Tenants, Campaigns, Prospects, ProspectingJobs y ProspectorClient se desarrollara posteriormente sobre las decisiones congeladas.

## 16. Principios de implementacion

El backend deberá desarrollarse considerando los siguientes principios:

1. **Multi-Tenancy como fundamento arquitectónico.**
2. **Aislamiento de datos entre tenants.**
3. **Autorización y validación en el servidor.**
4. **El cliente no debe ser una autoridad de seguridad.**
5. **Separación entre lógica de negocio, infraestructura y presentación de API.**
6. **Los servicios internos no deben exponerse directamente al cliente.**
7. **La arquitectura debe permitir la incorporación progresiva de nuevas funcionalidades.**
8. **Las decisiones arquitectonicas deberan documentarse conforme se conviertan en restricciones del sistema.**

## 17. Handoff a Angel

El baseline queda preparado para que Angel continue con la implementacion funcional sin redisenar la infraestructura transversal.

### Entregables

- Codigo fuente completo de `saas-platform-backend/`.
- Common, Auth, Users, Prisma y Health implementados.
- Modulos vacios preparados: Tenants, Campaigns, Prospects, ProspectingJobs y ProspectorClient.
- [README principal](README.md) y [MODULE-DEVELOPMENT.md](saas-platform-backend/MODULE-DEVELOPMENT.md).
- Cinco READMEs locales con contexto y dependencias de cada modulo.
- Contratos [Platform API V1](Docs/Contracts/platform-api.v1.yaml) y [Prospector Service API V1](Docs/Contracts/prospector-service-api.v1.yaml).
- Prisma schema, PrismaService y seed idempotente para ADMIN global.
- Pruebas unitarias y E2E en `saas-platform-backend/test/`.

### Siguientes pasos de Angel

1. Configurar PostgreSQL local y `DATABASE_URL`.
2. Ejecutar migraciones, seed, build y pruebas.
3. Leer ADR-004, OpenAPI, Prisma, `MODULE-DEVELOPMENT.md` y el README del modulo objetivo.
4. Implementar la logica de Tenants, Campaigns, Prospects y ProspectingJobs.
5. Integrar Prospector Service mediante `ProspectorClient`, inicialmente con un cliente basico o simulado.
6. Mantener el aislamiento tenant-aware y agregar pruebas por cada modulo.

Flutter se desarrolla fuera de este repositorio y consume la Platform API definida en OpenAPI.

## 18. Checklist de aceptacion F4

### Proyecto e infraestructura

- [x] Proyecto compila con `npm run build`.
- [x] `npm run lint` pasa sin errores.
- [x] `npm run format` debe ejecutarse como verificacion final de formato.
- [x] Prisma Client genera correctamente.
- [x] El schema Prisma valida correctamente.
- [ ] Migraciones y seed deben ejecutarse contra PostgreSQL local configurado.
- [x] HealthController esta registrado y `/health`, `/health/live`, `/health/ready` son publicos.

### Autenticacion y autorizacion

- [x] Login genera JWT con contexto platform/tenant.
- [x] Logout es stateless y registra el evento.
- [x] Select tenant valida membership o autoridad ADMIN.
- [x] `/auth/me` devuelve el contexto autenticado.
- [x] AuthGuard y RolesGuard estan registrados globalmente.
- [x] `@Public()`, `@Roles()` y `@CurrentUser()` estan disponibles.
- [x] RateLimitGuard implementa 5 intentos por 60 segundos por IP.

### Users y multi-tenancy

- [x] Users contiene CRUD, UserTenant, roles y desactivacion logica.
- [x] Las consultas Users usan el tenant del TenantContext.
- [ ] Pruebas E2E de CRUD, roles y aislamiento deben quedar verdes.

### Pruebas y documentacion

- [x] Existe estructura de pruebas Jest/Supertest.
- [ ] `npm run test:e2e` requiere finalizar el harness Prisma fake y ejecutarse completo.
- [x] README, MODULE-DEVELOPMENT y READMEs locales estan documentados.
- [x] Las contradicciones deben reportarse antes de cambiar decisiones congeladas.

### Mensaje de handoff

> El baseline F4 de Platform Backend esta implementado con NestJS, Common, Auth, Users, Prisma, Health, JWT, RBAC, TenantContext y modulos funcionales preparados. Angel puede comenzar la implementacion de dominio leyendo ADR-004, OpenAPI, Prisma, `MODULE-DEVELOPMENT.md` y el README local del modulo. Antes de ejecutar el servidor debe configurar PostgreSQL y `DATABASE_URL`; despues debe completar y verificar las pruebas E2E, implementar los modulos funcionales y conectar Prospector Service sin modificar las decisiones transversales congeladas.
