# Prospector Client Module

## Estado actual: integracion deshabilitada

Desde el segundo paso de hardening (27 de septiembre de 2026), este modulo contiene un adaptador deshabilitado. No ejecuta HTTP, no usa fetch, no inicia scraping y no simula una aceptacion exitosa.

`assertAvailable`, `startJob` y `cancelJob` rechazan la operacion con HTTP 503. El wrapper mantiene el mensaje generico de errores del servidor y expone `error.details.reason = PROSPECTOR_INTEGRATION_PENDING` para identificar el motivo sin exponer datos internos.

Configurar PROSPECTOR_SERVICE_URL o PROSPECTOR_API_KEY no activa el adaptador. Estas variables ya no son necesarias para arrancar la plataforma. No hay reintentos, timeouts ni politicas nuevas de integracion.

## Archivos

| Archivo | Responsabilidad |
| --- | --- |
| `prospector-client.service.ts` | Adaptador deshabilitado; rechaza inicio y cancelacion sin conexiones externas. |
| `prospector-client.module.ts` | Registra y exporta el adaptador sin dependencia directa de ConfigModule. |
| `prospector-client.service.spec.ts` | Comprueba indisponibilidad y ausencia de llamadas HTTP. |
| `dto/start-prospecting-job.request.ts` | Conserva la estructura contractual de solicitud para la integracion pendiente. |
| `dto/accepted-job.response.ts` | Conserva los tipos de respuesta; el adaptador actual no produce aceptaciones. |
| `dto/job-event.request.ts` | Conserva los DTOs de eventos; no implica que los callbacks esten disponibles productivamente. |

## Relacion con Jobs

Jobs comprueba disponibilidad antes de escribir un trabajo nuevo, cancelar o procesar un evento. El guard interno sigue rechazando callbacks sin una API key configurada y valida. Con una clave valida, el procesamiento tambien queda bloqueado por el adaptador deshabilitado.

La suite `test/jobs.postgres-spec.ts` usa PostgreSQL real y el adaptador deshabilitado, sin sustituirlo por aceptaciones simuladas. Verifica que los inicios/cancelaciones/callbacks no escriben trabajos y que los datos baseline siguen consultables. La cache, importacion y exportacion anteriores ya fueron retiradas; las rutas de integracion quedan no disponibles.

## Pendientes

La integracion real, cancelacion fisica y politicas operacionales deben definirse con Prospector Service. ADR-005 y la entrega anterior describen trabajo historico; no hacen que esta integracion este activa.

Consultar el [registro de entrega y hardening](../../Docs/ENTREGA-MODULOS-BACKEND.md).
