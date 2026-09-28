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

## Estado funcional

Implementado sobre F4. ADMIN, OWNER y MEMBER pueden operar sobre las campanas del tenant autenticado. Todas las operaciones exigen tenant seleccionado, incluso para ADMIN.

- Crear: acepta `name` y `description` opcional/nullable. `tenantId` y `createdBy` se obtienen del contexto autenticado; el estado inicial es ACTIVA.
- Listar: admite `page`, `limit` (maximo 100), `search`, `sortBy` y `sortOrder`. La busqueda contempla nombre y descripcion. Ordena por name, status, createdAt o updatedAt y usa id para desempatar. Se rechaza email porque no es un campo de Campaign.
- Consultar/actualizar: devuelve 404 si la campana no pertenece al tenant o no existe. PATCH exige algun campo; los omitidos se conservan y solo description admite null. Estados: ACTIVA, PAUSADA, COMPLETADA y ARCHIVADA.
- Eliminar: sin `permanent`, o con `permanent=false`, cambia el estado a ARCHIVADA. Las campanas archivadas siguen siendo consultables. `permanent=true` exige ADMIN y elimina fisicamente; si las claves foraneas detectan jobs, prospectos o asociaciones dependientes, responde 409 sin borrarlos en cascada.
- Prospectos de campana: incluye prospectos de origen y asociados mediante CampaignProspect, sin duplicados y filtrados por tenant. Admite paginacion y busqueda por nombre/email. Selecciona exclusivamente campos del contrato publico.

El listado de prospectos se resuelve en CampaignsService mediante Prisma mientras se implementa el modulo Prospects; no introduce dependencias circulares ni modifica contratos o esquema.

## Pruebas

`test/campaigns.e2e-spec.ts` verifica autenticacion, roles, tenant obligatorio, creacion, validacion, actualizaciones parciales, paginacion, busqueda, archivo, borrado fisico, conflictos de dependencias y aislamiento en peticiones concurrentes. Conserva JWT, guards y AsyncLocalStorage reales; solo reemplaza Prisma. Las restricciones de PostgreSQL se simulan y requieren validacion posterior contra una base real.

Consultar `MODULE-DEVELOPMENT.md` para las convenciones transversales.

## Archivos y responsabilidades

Las rutas de esta tabla parten de la raiz del repositorio.

| Archivo | Responsabilidad |
| --- | --- |
| `src/campaigns/dto/campaign.request.ts` | Creado. Contiene validadores para creación, actualización y el parámetro permanent. |
| `src/campaigns/dto/campaign.response.ts` | Creado. Describe la respuesta pública de campaña. |
| `src/campaigns/campaigns.controller.ts` | Creado. Expone las seis operaciones del módulo. |
| `src/campaigns/campaigns.service.ts` | Creado. Aplica tenant, creador, búsqueda, orden, paginación, actualización, archivo, borrado y consulta de prospectos. |
| `src/campaigns/campaigns.module.ts` | Modificado. Registra y exporta el servicio. |

La [entrega completa](../../Docs/ENTREGA-MODULOS-BACKEND.md) explica como se relaciona este modulo con los demas, las verificaciones realizadas y los pasos pendientes.
