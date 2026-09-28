# Plataforma SaaS - Backend

Backend NestJS y PostgreSQL para gestionar usuarios, organizaciones, campanas y prospectos persistidos. Estado al 27 de septiembre de 2026: hardening de implementacion y documentacion realizado por etapas; verificacion final de despliegue pendiente.

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

## Preparacion local

Requisitos: Node.js/npm y PostgreSQL accesible. Ejecutar desde la raiz del repositorio.

1. Crear `.env` a partir de `.env.example` solo si no existe y completar los valores.
2. Instalar y generar el cliente:

```powershell
npm ci
npm run prisma:generate
```

3. En una base nueva, o una base cuyo historial ya se haya comprobado compatible, aplicar las migraciones:

```powershell
npx prisma migrate deploy
```

4. Para una instalacion nueva que necesite un administrador inicial, ejecutar `npm run prisma:seed` con sus variables configuradas.
5. Compilar y arrancar:

```powershell
npm run build
npm run start:dev
```

Para ejecutar el compilado: `node dist/src/main.js`, tambien desde la raiz, porque Swagger lee `Docs/Contracts/platform-api.v1.yaml`. El despliegue debe incluir esa carpeta.

**Base existente:** se retiro del repositorio la migracion adicional de idempotencia. Si un entorno ya aplico `20260925000100_job_idempotency`, necesita revisar sus datos e historial antes del despliegue. Quitar el archivo no elimina una tabla existente. No usar un reset para ocultar la diferencia. La base habitual no se pudo comprobar en esta sesion; no fue modificada.

## Configuracion

Obligatorias: NODE_ENV, PORT, DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN=8h, CORS_ORIGINS, ADMIN_NAME, ADMIN_EMAIL y ADMIN_PASSWORD.

PROSPECTOR_SERVICE_URL, PROSPECTOR_API_KEY y PLATFORM_CALLBACK_BASE_URL no son necesarias para arrancar. Configurarlas no habilita el cliente ni los callbacks. No subir .env ni credenciales a Git.

## API y Swagger

- API: `http://localhost:3000/api/v1`.
- Swagger: `http://localhost:3000/api/docs`.
- Documento servido: `http://localhost:3000/api/docs-json`.
- Salud: `/api/v1/health`, `/api/v1/health/live` y `/api/v1/health/ready`.

Swagger muestra el alcance desplegado: identifica las operaciones no disponibles y documenta su respuesta 503 en lugar de prometer creacion de trabajos o archivos. El [contrato objetivo V1](Docs/Contracts/platform-api.v1.yaml) conserva el baseline. Consultar [contratos y disponibilidad](Docs/Contracts/README.md) para distinguir ambos documentos.

## Pruebas

```powershell
npm run test -- --runInBand
npm run test:e2e -- --runInBand
```

Para la suite PostgreSQL, definir JOBS_TEST_DATABASE_URL con una base exclusiva de pruebas migrada al baseline y ejecutar:

```powershell
npm run test:jobs:db
```

Esa suite usa PostgreSQL real, el adaptador deshabilitado y fixtures propios. Limpia solamente sus registros. No requiere Python ni prueba scraping real. Los resultados de cada etapa se registran en el [handoff de hardening](Docs/HANDOFF-HARDENING.md).

## Documentacion y autoridad

La referencia es ADR-004/F4, Prisma y migraciones baseline, OpenAPI alineado, ADR-003 y ADR-002/ADR-001 cuando sean compatibles. MODULE-DEVELOPMENT y los README explican la implementacion. ADR-005 es historico/propuesta pendiente, no una decision aceptada.

- [Guia de desarrollo](MODULE-DEVELOPMENT.md).
- [Handoff actual y pendientes](Docs/HANDOFF-HARDENING.md).
- [Historia de implementacion y cambios por archivo](Docs/ENTREGA-MODULOS-BACKEND.md).
- [Tenants](src/tenants/README.md), [Campaigns](src/campaigns/README.md), [Prospects](src/prospects/README.md).
- [Jobs](src/prospecting-jobs/README.md) y [ProspectorClient](src/prospector-client/README.md).

Pendientes de diseno/integracion: Prospector Service/Engine, callbacks operacionales, cache real, importacion y deduplicacion, exportacion, idempotencia persistente, cancelacion fisica, retries y timeout operacional. La revision final de instalacion/despliegue y la entrega Git siguen pendientes.
