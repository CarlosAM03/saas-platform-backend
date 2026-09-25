# Prospector Client Module

## Proposito

Encapsular la comunicacion Platform Backend -> Prospector Service. No contiene el motor de prospeccion ni logica de dominio de Jobs.

## Contrato relacionado

- `POST /api/v1/prospecting/jobs` en `prospector-service-api.v1.yaml`.
- Callbacks internos de eventos hacia Platform Backend.

## Dependencias

- `@nestjs/config` para `PROSPECTOR_SERVICE_URL` y `PROSPECTOR_API_KEY`.
- `ProspectingJobsModule` como consumidor del cliente.
- DTOs de integracion definidos por el contrato OpenAPI.
- Pino para logging de requests externos sin exponer API keys.

## Reglas

Enviar `X-API-Key` solo al servicio interno. No exponer este cliente directamente a Flutter. No persistir Jobs ni resultados en este modulo. Los timeouts, reintentos y cancelacion fisica deben respetar decisiones posteriores y no inventarse aqui.

## Implementacion funcional

`startJob` envia el DTO al endpoint interno y exige HTTP 202, el mismo jobId, estado QUEUED y fecha ISO valida. `cancelJob` usa POST /api/v1/prospecting/jobs/:jobId/cancel, ampliacion autorizada en ADR-005. Ambos usan X-API-Key y rechazan redirecciones. No agregan reintentos ni una politica propia de timeout operacional.

No expone un controller publico ni accede a Prisma. Usa fetch de Node.js. Los DTOs de eventos incluyen validacion anidada para callbacks. El guard de API key pertenece al modulo Jobs.

`prospector-client.service.spec.ts` verifica aceptacion, errores de red/HTTP, respuestas invalidas y cancelacion. La prueba del backend con PostgreSQL sustituye este servicio; la ejecucion real de scraping y la cancelacion fisica requieren el servicio Python externo.

## Archivos y responsabilidades

Las rutas de esta tabla parten de la raiz del repositorio.

| Archivo | Responsabilidad |
| --- | --- |
| `src/prospector-client/dto/start-prospecting-job.request.ts` | Creado. Describe el trabajo que NestJS envía a Python. |
| `src/prospector-client/dto/accepted-job.response.ts` | Creado. Describe la confirmación de aceptación. |
| `src/prospector-client/dto/job-event.request.ts` | Creado. Valida eventos, progreso, errores y resultados anidados recibidos por callback. |
| `src/prospector-client/prospector-client.service.ts` | Creado y ampliado. Envía inicio y cancelación mediante fetch, usa API key y comprueba las respuestas. |
| `src/prospector-client/prospector-client.module.ts` | Modificado. Proporciona configuración y exporta el servicio; no expone rutas públicas. |
| `src/prospector-client/prospector-client.service.spec.ts` | Creado y ampliado. Prueba solicitudes, códigos HTTP, respuestas inválidas, fechas y cancelación. |

La [entrega completa](../../Docs/ENTREGA-MODULOS-BACKEND.md) explica como se relaciona este modulo con los demas, las verificaciones realizadas y los pasos pendientes.
