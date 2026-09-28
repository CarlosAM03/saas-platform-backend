# Prospecting Jobs Module

## Estado actual: consulta de registros y operaciones de integracion no disponibles

El modelo ProspectingJob del baseline se conserva. GET /api/v1/prospecting-jobs lista los registros existentes con paginacion y filtro por tenant; GET /api/v1/prospecting-jobs/:id devuelve el detalle del tenant autenticado.

El detalle devuelve resultsAvailable=false, results=null y progress=null. Un estado COMPLETED almacenado no implica que existan resultados temporales disponibles. No se reconstruyen resultados a partir de los prospectos de una campana.

## Operaciones pendientes

POST de creacion, cancel y persist, y GET export, mantienen rutas, JWT, roles y validacion de entrada, pero responden 503 con error.details.reason=PROSPECTOR_INTEGRATION_PENDING. No crean ni modifican datos ni producen archivos. La creacion conserva la exigencia de Idempotency-Key sin guardarla ni implementar deduplicacion.

El callback POST /api/v1/internal/prospecting-jobs/:jobId/events conserva API key y validacion de DTO. Sin clave valida devuelve 401; una solicitud valida y autenticada devuelve 503. No procesa estados, secuencias, resultados ni progreso.

## Dependencias y archivos

| Archivo | Responsabilidad |
| --- | --- |
| prospecting-jobs.module.ts | Conecta Common, Prisma y ProspectorClient; registra controladores y guard interno. |
| prospecting-jobs.controller.ts | Expone las rutas conservadas y sus permisos; export devuelve un error JSON, no un archivo. |
| prospecting-jobs.service.ts | Consulta datos baseline; rechaza operaciones de integracion pendientes. |
| internal-api-key.guard.ts | Rechaza callbacks sin credencial valida, tambien cuando falta configurar la clave. |
| dto/job.request.ts | Valida solicitudes, paginacion y formatos csv/xlsx del contrato. |

Se retiraron JobMemoryService, JobExportService y sus providers, la dependencia directa de ProspectsModule/CampaignsModule, y la tabla adicional de idempotencia. No hay TTL, limite de cache, locks de jobs, eviction, replay, importacion ni exportacion productiva.

## Pruebas

`test/without-prospector.e2e-spec.ts` prueba indisponibilidad sin red ni escrituras con Prisma sustituido. `test/jobs.postgres-spec.ts` usa PostgreSQL real y el adaptador deshabilitado: verifica aislamiento de registros baseline, ausencia de la tabla retirada y que persist/export no alteran prospectos existentes ni entregan archivos.

## Pendientes

Integracion real, cache, importacion/deduplicacion, exportacion, cancelacion fisica e idempotencia persistente requieren definicion posterior. El contrato de Python se restauro al baseline y Swagger refleja la disponibilidad actual. Consultar el handoff para la verificacion final de despliegue pendiente. ADR-005 es registro historico, no autoridad arquitectonica.

Consultar [entrega e historial de hardening](../../Docs/ENTREGA-MODULOS-BACKEND.md).
