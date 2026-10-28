# Contratos y disponibilidad de la implementacion

## Registro de tenants (ADR-006)

La ubicación canónica consumida por la aplicación es Docs/Contracts/platform-api.tenant-registration.approved.yaml. La copia bajo Docs/ADRs permanece intacta como evidencia histórica; no se usa para componer Swagger. La propuesta *.proposed.yaml y ADR-006-TenantRegistration.md describen diseños sustituidos y no autorizan contraseñas temporales ni oneOf en login. Se preserva el CSV previo de Ángel: no forma parte de las correcciones G1 y no se elimina trabajo ajeno.

Los resultados G1 posteriores se encuentran en [handoff Backend](../../codex/backend-adr006/evidencias/10_HANDOFF_GATE1.md). Las instrucciones operativas vigentes usan Brevo HTTPS y [preflight manual](../../codex/backend-adr006/RUNBOOK.md), sin migraciones en el arranque runtime.

Autoridad: [ADR-006 aprobado](../ADRs/ADR-006-TenantRegistration-APROBADO.md) y
[contrato aprobado](platform-api.tenant-registration.approved.yaml), preservados
sin cambios como evidencia. La propuesta anterior queda sustituida: no usar
contraseña temporal, oneOf en login ni PLATFORM_LOGIN_URL.

La implementación local añade cinco operaciones y conserva las 33 existentes y
AuthContext de login. Registro y reenvío desactivados por defecto. La documentación
operativa y los gates pendientes están en [Tenant Registration](../../src/tenant-registration/README.md).

## Contrato objetivo aprobado

`platform-api.v1.yaml` conserva el contrato publico baseline, incluidas las capacidades futuras de Jobs. No debe interpretarse como una declaracion de que todo esta implementado hoy.

`prospector-service-api.v1.yaml` se reconcilio con el baseline del commit 9d17d0f. Se retiro la ruta adicional `/api/v1/prospecting/jobs/{jobId}/cancel`, que no queda fijada como arquitectura definitiva. Las rutas originales de inicio y callback se conservan como contrato de referencia para una integracion pendiente, no como servicio Python disponible.

## Documento que muestra Swagger

`src/common/openapi/deployment-document.ts` lee el contrato publico y prepara una vista de la implementacion para `/api/docs` y `/api/docs-json`. No escribe ni modifica el YAML objetivo. En esta rama compone únicamente las cinco rutas y esquemas nuevos del aprobado ADR-006 mediante `tenant-registration-document.ts`, sin reemplazar las 33 operaciones core. La vista indica versión 1.1.0 y disponibilidad por flag; no acredita habilitación productiva.

| Operacion Jobs | Disponibilidad actual |
| --- | --- |
| GET listado y detalle | Consulta datos persistidos con aislamiento por tenant. Sin resultados/progreso temporal. |
| POST inicio, cancel y persist | No disponibles: 503 despues de autenticacion y validacion. |
| GET export | No disponible: error JSON 503, no respuesta binaria. |
| POST callback interno | Requiere API key y DTO valido; no procesa eventos y devuelve 503. Se documenta aqui; no se publica como ruta de Flutter en Swagger. |

El wrapper de indisponibilidad conserva el comportamiento del filtro global: code HTTP_503, message Internal server error y details.reason PROSPECTOR_INTEGRATION_PENDING. El frontend puede distinguir esta situacion por el motivo, sin interpretar un error como scraping aceptado.

La vista Swagger preserva DTOs, rutas y autenticacion del contrato objetivo; para las cuatro operaciones publicas deshabilitadas muestra los errores de entrada y 503, sin respuestas exitosas ficticias. Las consultas de Jobs documentan tenant obligatorio y el ordenamiento realmente admitido.

No usar ADR-005 como fuente de nuevas decisiones. Su contenido se conserva como historial/propuesta pendiente de validacion.
