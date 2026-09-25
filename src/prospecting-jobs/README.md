# Prospecting Jobs Module

## Proposito

Crear y consultar trabajos asincronos de prospeccion, controlar su lifecycle y coordinar resultados temporales con Prospector Service.

## OpenAPI relacionado

- `POST /api/v1/prospecting-jobs`
- `GET /api/v1/prospecting-jobs`
- `GET /api/v1/prospecting-jobs/{id}`
- `POST /api/v1/prospecting-jobs/{id}/cancel`
- `POST /api/v1/prospecting-jobs/{id}/persist`
- `GET /api/v1/prospecting-jobs/{id}/export`

## Dependencias

- `PrismaService` para `ProspectingJob`.
- `TenantContextService.requireTenantId()` y `@CurrentUser()`.
- `ProspectorClientModule` para llamadas internas autenticadas con `X-API-Key`.
- `CampaignsModule` para validar la campana del tenant.
- `ProspectsModule` para persistir resultados bajo demanda.
- `PaginationDto`, idempotencia, response wrapper y error filter.

## Reglas

Platform Backend es dueño del estado persistente del Job. Respetar exactamente `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED` y `CANCELLED`. Toda query debe filtrar por tenant autenticado. No persistir resultados temporales como un modelo Prisma no definido.

## Implementacion funcional

Implementadas las seis rutas publicas y POST /api/v1/internal/prospecting-jobs/:jobId/events. Las rutas publicas requieren JWT, roles ADMIN/OWNER/MEMBER y tenant seleccionado. El callback exige X-API-Key y obtiene el tenant del job, sin confiar en el cuerpo del evento.

- Crear: exige Idempotency-Key, valida campana del tenant y registra job/clave atomicamente. La nueva tabla conserva la idempotencia tras reinicios. Un fallo de envio deja el mismo job disponible para reintentar con la misma clave.
- Listar: page/limit/sortBy/sortOrder; limite 100. Ordenes permitidos: createdAt, updatedAt, startedAt, completedAt, status e id. No acepta search, que no esta declarado para Jobs.
- Detalle: agrega resultados/progreso temporales al modelo persistido sin inventar columnas Prisma.
- Cancelar: QUEUED se cancela localmente; RUNNING solicita cancelacion externa y espera callback CANCELLED. Estados COMPLETED/FAILED devuelven 409.
- Persistir: requiere COMPLETED y resultados disponibles; delega en ProspectsService. Repeticiones conservadas en cache no vuelven a importar.
- Exportar: entrega CSV/XLSX binarios del resultado del job; nunca mezcla toda la campana. Requiere resultados disponibles.

Cache MVP: una sola instancia, TTL 24h desde la ultima actualizacion, maximo 1000 jobs. Reiniciar o expirar pierde resultados/progreso y el cursor de eventos temporal; no pierde jobs, prospectos guardados ni claves de creacion. Fuera de cache, persist/export responde 409. No hay worker local de scraping: Python ejecuta y reporta callbacks.

## Puesta en marcha

1. Configurar DATABASE_URL y aplicar `npx prisma migrate deploy`; luego `npm run prisma:generate`.
2. Configurar PROSPECTOR_SERVICE_URL y PROSPECTOR_API_KEY. PLATFORM_CALLBACK_BASE_URL permite indicar un origen absoluto alcanzable desde Python.
3. El servicio Python debe implementar inicio, cancelacion y callbacks segun el contrato interno actualizado.

`npm run test:jobs:db` necesita JOBS_TEST_DATABASE_URL apuntando a una base de pruebas previamente migrada. Usa PostgreSQL real y limpia solo sus propios fixtures. Ver ADR-005 para las decisiones aprobadas y los limites del MVP.
