# Campaigns Module

## Proposito

Gestionar campanas pertenecientes al tenant autenticado: creacion, consulta, actualizacion, archivado y relacion con prospectos y jobs.

## OpenAPI relacionado

- `GET /api/v1/campaigns`
- `POST /api/v1/campaigns`
- `GET /api/v1/campaigns/{id}`
- `PATCH /api/v1/campaigns/{id}`
- `DELETE /api/v1/campaigns/{id}`
- `GET /api/v1/campaigns/{id}/prospects`

## Dependencias

- `PrismaService` para `Campaign`, `Prospect` y `ProspectingJob`.
- `TenantContextService.requireTenantId()` en cada operacion tenant-scoped.
- `@CurrentUser()` para `createdBy`.
- `@Roles('ADMIN', 'OWNER', 'MEMBER')` segun la operacion.
- `PaginationDto`, response wrapper y `GlobalExceptionFilter`.
- `ProspectsModule` y `ProspectingJobsModule` mediante servicios, evitando dependencias circulares.

## Reglas

Nunca aceptar `tenantId` del request como autoridad. Toda query debe filtrar por el tenant autenticado. `DELETE` debe respetar la eliminacion logica y las reglas de OWNER/MEMBER/ADMIN definidas por OpenAPI y ADRs.

La implementacion funcional queda fuera del baseline F4. Consultar `MODULE-DEVELOPMENT.md`.
