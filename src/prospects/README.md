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

## Implementacion funcional

Implementados GET /prospects, GET /prospects/:id y PATCH /prospects/:id. Requieren JWT y tenant seleccionado, incluso para ADMIN. OWNER/MEMBER pueden consultar y actualizar. Los filtros, paginacion y consultas se restringen al tenant autenticado. Campos omitidos se conservan; los nullable aceptan null; metadata null se guarda como SQL NULL. No se permite modificar tenant, campana de origen ni identificadores de fuente.

`persistResults` fue retirado durante el hardening. Este modulo gestiona prospectos ya persistidos; no importa BusinessResult, no crea asociaciones desde scraping ni aplica reglas de deduplicacion para identificadores nulos. La integracion de importacion queda pendiente de definicion.

Las pruebas PostgreSQL en `test/jobs.postgres-spec.ts` cubren consulta/edicion de prospectos persistidos, permisos, aislamiento, validacion y metadata. Tambien verifican que las operaciones de scraping deshabilitadas no modifiquen esos datos. ADR-005 se conserva solo como registro historico.

## Archivos y responsabilidades

Las rutas de esta tabla parten de la raiz del repositorio.

| Archivo | Responsabilidad |
| --- | --- |
| `src/prospects/dto/update-prospect.request.ts` | Creado durante el desarrollo guiado. Valida nombre, contacto, idioma, estado y metadata. |
| `src/prospects/dto/prospect.response.ts` | Creado durante el desarrollo guiado. Describe la salida pública sin tenantId. |
| `src/prospects/prospects.controller.ts` | Creado durante el desarrollo guiado. Registra listado, consulta y actualización. |
| `src/prospects/prospects.service.ts` | Consulta por tenant y aplica actualizaciones de prospectos persistidos; la importacion desde Jobs fue retirada. |
| `src/prospects/prospects.module.ts` | Modificado. Conecta las piezas y exporta el servicio. |

La [entrega completa](../../Docs/ENTREGA-MODULOS-BACKEND.md) explica como se relaciona este modulo con los demas, las verificaciones realizadas y los pasos pendientes.
