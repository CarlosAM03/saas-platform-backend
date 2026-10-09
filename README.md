# Plataforma SaaS - Backend

Backend NestJS y PostgreSQL para gestionar usuarios, organizaciones, campañas y prospectos persistidos. El backend académico está desplegado con Docker en Render y utiliza PostgreSQL en Supabase; health/readiness y Swagger están publicados. DEV-ENV-001 añade un entorno local reproducible con Docker Compose. La integración Prospector continúa pendiente; el frontend Flutter y su integración no forman parte de este bloque.

## Alcance actual

| Area | Disponible |
| --- | --- |
| Auth y Users | Login JWT HS256 de 8 horas, seleccion de tenant, usuarios y permisos. |
| Tenants | Listar y consultar organizaciones accesibles; creacion exclusiva de ADMIN. |
| Campaigns | Crear, listar, consultar, modificar y archivar. Solo ADMIN puede borrar fisicamente. |
| Prospects | Listar, buscar, consultar y editar contactos ya persistidos. |
| Infraestructura | TenantContext/AsyncLocalStorage, aislamiento, validacion, paginacion, wrappers, logging/requestId y health. |
| Jobs | Listar y consultar registros existentes del tenant. No ejecuta scraping. |
| ProspectorClient | Adaptador deshabilitado: no conecta con Python ni simula aceptaciones. |

Inicio de Jobs, cancelacion, persistencia de resultados, exportacion y callbacks validos responden **503** con `error.details.reason=PROSPECTOR_INTEGRATION_PENDING`. Los errores previos de autenticacion y validacion conservan sus respuestas. El callback exige X-API-Key; sin clave configurada o valida devuelve 401.

El detalle de Jobs devuelve `resultsAvailable=false`, `results=null` y `progress=null`, incluso si su estado persistido es COMPLETED. No hay importacion de scraping, cache de resultados, exportacion CSV/XLSX ni idempotencia persistente. Idempotency-Key sigue siendo obligatorio en la solicitud de creacion, pero no se guarda.

## Arquitectura y permisos

Flutter se comunica con NestJS; NestJS utiliza Prisma para acceder a PostgreSQL. Python no es necesario para arrancar ni usar las funciones de gestion. PostgreSQL si debe estar disponible al iniciar.

AuthGuard y RolesGuard son globales. Los controladores declaran los roles con @Roles; los servicios conservan reglas dinamicas y filtros por tenant. Tenant y creador se obtienen de la sesion, no de valores enviados como autoridad por el cliente. ADMIN sigue necesitando seleccionar tenant para las operaciones de dominio que lo requieren.

## Inicio local

Requisitos: Git y Docker con Docker Compose. Desde un clon limpio:

```powershell
docker compose up --build
```

El stack inicia PostgreSQL 16, aplica `prisma migrate deploy`, carga el dataset de desarrollo y arranca NestJS con hot reload. No se necesita `.env`, Node ni PostgreSQL instalados en el host.

- API: http://localhost:3000/api/v1
- Swagger: http://localhost:3000/api/docs
- Readiness: http://localhost:3000/api/v1/health/ready

La [guía operacional](Docs/DevelopmentEnvironment.md) explica el seed, persistencia, reset local, pruebas PostgreSQL, shared-dev y CI. `Docs/Auditorias-Historico/` conserva el contexto histórico del despliegue; no es la guía vigente.

**Base existente:** si un entorno aplicó previamente `20260925000100_job_idempotency`, hay que revisar su historial antes de desplegar. Quitar el archivo de migración no elimina estructuras ya aplicadas.

## Configuración manual

Para ejecutar fuera de Compose, usar `.env.example` como plantilla y configurar `NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN=8h` y `CORS_ORIGINS`. `ADMIN_*` pertenece exclusivamente al seed bootstrap. Las variables Prospector no habilitan la integración pendiente. No subir archivos `.env` ni credenciales a Git.

## API y Swagger

- API: `http://localhost:3000/api/v1`.
- Swagger: `http://localhost:3000/api/docs`.
- Documento servido: `http://localhost:3000/api/docs-json`.
- Salud: `/api/v1/health`, `/api/v1/health/live` y `/api/v1/health/ready`.

Swagger muestra el alcance desplegado: identifica las operaciones no disponibles y documenta su respuesta 503 en lugar de prometer creacion de trabajos o archivos. El [contrato objetivo V1](Docs/Contracts/platform-api.v1.yaml) conserva el baseline. Consultar [contratos y disponibilidad](Docs/Contracts/README.md) para distinguir ambos documentos.

## Pruebas

```powershell
npm run test:unit:ci
npm run test:e2e:ci
docker compose --profile test run --rm test-postgres
```

La suite PostgreSQL usa `test-db`, separada de la base de desarrollo. Para ejecución manual requiere `INTEGRATION_TEST_DATABASE_URL` apuntando a una base desechable y migrada.

## Documentacion y autoridad

La referencia es ADR-004/F4, Prisma y migraciones baseline, OpenAPI alineado, ADR-003 y ADR-002/ADR-001 cuando sean compatibles. MODULE-DEVELOPMENT y los README explican la implementacion. ADR-005 es historico/propuesta pendiente, no una decision aceptada.

- [Guia de desarrollo](MODULE-DEVELOPMENT.md).
- [Handoff actual y pendientes](Docs/HANDOFF-HARDENING.md).
- [Historia de implementacion y cambios por archivo](Docs/ENTREGA-MODULOS-BACKEND.md).
- [Tenants](src/tenants/README.md), [Campaigns](src/campaigns/README.md), [Prospects](src/prospects/README.md).
- [Jobs](src/prospecting-jobs/README.md) y [ProspectorClient](src/prospector-client/README.md).

Pendientes de diseño/integración: Prospector Service/Engine, callbacks operacionales, caché real, importación y deduplicación, exportación, idempotencia persistente, cancelación física, retries y timeout operacional.
