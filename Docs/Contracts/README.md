# Contratos y disponibilidad de la implementacion

## Contrato objetivo aprobado

`platform-api.v1.yaml` conserva el contrato publico baseline, incluidas las capacidades futuras de Jobs. No debe interpretarse como una declaracion de que todo esta implementado hoy.

`prospector-service-api.v1.yaml` se reconcilio con el baseline del commit 9d17d0f. Se retiro la ruta adicional `/api/v1/prospecting/jobs/{jobId}/cancel`, que no queda fijada como arquitectura definitiva. Las rutas originales de inicio y callback se conservan como contrato de referencia para una integracion pendiente, no como servicio Python disponible.

## Documento que muestra Swagger

`src/common/openapi/deployment-document.ts` lee el contrato publico y prepara una vista de la implementacion para `/api/docs` y `/api/docs-json`. No escribe ni modifica el YAML objetivo.

| Operacion Jobs | Disponibilidad actual |
| --- | --- |
| GET listado y detalle | Consulta datos persistidos con aislamiento por tenant. Sin resultados/progreso temporal. |
| POST inicio, cancel y persist | No disponibles: 503 despues de autenticacion y validacion. |
| GET export | No disponible: error JSON 503, no respuesta binaria. |
| POST callback interno | Requiere API key y DTO valido; no procesa eventos y devuelve 503. Se documenta aqui; no se publica como ruta de Flutter en Swagger. |

El wrapper de indisponibilidad conserva el comportamiento del filtro global: code HTTP_503, message Internal server error y details.reason PROSPECTOR_INTEGRATION_PENDING. El frontend puede distinguir esta situacion por el motivo, sin interpretar un error como scraping aceptado.

La vista Swagger preserva DTOs, rutas y autenticacion del contrato objetivo; para las cuatro operaciones publicas deshabilitadas muestra los errores de entrada y 503, sin respuestas exitosas ficticias. Las consultas de Jobs documentan tenant obligatorio y el ordenamiento realmente admitido.

No usar ADR-005 como fuente de nuevas decisiones. Su contenido se conserva como historial/propuesta pendiente de validacion.
