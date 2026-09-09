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

La implementacion funcional queda fuera del baseline F4. Consultar `MODULE-DEVELOPMENT.md`.
