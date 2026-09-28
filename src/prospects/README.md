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

`persistResults` es una operacion interna utilizada por Jobs, no una ruta publica. Guarda Prospect y CampaignProspect atomicamente, deduplica segun ADR-005 y reintenta conflictos de transacciones SERIALIZABLE. No sobrescribe datos ya editados por el usuario.

Las pruebas PostgreSQL en `test/jobs.postgres-spec.ts` cubren rutas, permisos, aislamiento, validacion, metadata, persistencia repetida y concurrencia real. Consultar `MODULE-DEVELOPMENT.md` y ADR-005.

## Archivos y responsabilidades

Las rutas de esta tabla parten de la raiz del repositorio.

| Archivo | Responsabilidad |
| --- | --- |
| `src/prospects/dto/update-prospect.request.ts` | Creado durante el desarrollo guiado. Valida nombre, contacto, idioma, estado y metadata. |
| `src/prospects/dto/prospect.response.ts` | Creado durante el desarrollo guiado. Describe la salida pública sin tenantId. |
| `src/prospects/prospects.controller.ts` | Creado durante el desarrollo guiado. Registra listado, consulta y actualización. |
| `src/prospects/prospects.service.ts` | Creado y ampliado. Consulta por tenant, aplica actualizaciones y persiste resultados de Jobs con deduplicación. |
| `src/prospects/prospects.module.ts` | Modificado. Conecta las piezas y exporta el servicio. |

La [entrega completa](../../Docs/ENTREGA-MODULOS-BACKEND.md) explica como se relaciona este modulo con los demas, las verificaciones realizadas y los pasos pendientes.
