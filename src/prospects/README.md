# Prospects Module

## Proposito

Gestionar prospectos persistidos y sus asociaciones con campanas dentro del tenant operativo.

## OpenAPI relacionado

- `GET /api/v1/prospects`
- `GET /api/v1/prospects/{id}`
- `PATCH /api/v1/prospects/{id}`
- `GET /api/v1/campaigns/{id}/prospects`

## Dependencias

- `PrismaService` para `Prospect` y `CampaignProspect`.
- `TenantContextService.requireTenantId()` como fuente del aislamiento.
- `@CurrentUser()` y `@Roles()` segun las reglas del endpoint.
- `PaginationDto` para listados.
- `CampaignsModule` para validar campanas y `ProspectorClientModule` solo mediante contratos, no acceso directo al Engine.
- Response wrapper y `GlobalExceptionFilter`.

## Reglas

Filtrar siempre por `tenantId` autenticado. Respetar la identidad `(tenantId, campaignId, source, sourceIdentifier)` y la diferencia entre `BusinessResult` temporal y `Prospect` persistido. No exponer `passwordHash` ni modelos Prisma sin mapping.

La implementacion funcional queda fuera del baseline F4. Consultar `MODULE-DEVELOPMENT.md`.
