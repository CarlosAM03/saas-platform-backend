# Contratos implementados — MVP

platform-api.v1.yaml versión 1.1.0 describe el Backend implementado en esta rama.
/api/docs-json sirve ese contrato con servidor relativo y sortBy real de Jobs.
No es generación inferida de decoradores: es OpenAPI canónico servido por Swagger,
contrastado con controladores/DTO y pruebas HTTP/PostgreSQL. El documento extraído
por esas pruebas se guarda en .tmp/platform-api.served.json para inspección local.

| Operación | Estado |
|---|---|
| POST prospecting-jobs | Condicionado a política completa, tenant/campaña/rol, readiness, cuota y capacidad |
| GET prospecting-jobs/capabilities | Verificación actual para el tenant; POST revalida |
| GET listado/detalle | Estado durable y snapshot PostgreSQL TTL 1h; COMPLETED vacío es válido |
| Callback interno | X-API-Key, DTO, receipts/transición/snapshot transaccionales; 200 success=true sólo tras commit |
| Cancel/persist/export Jobs | Deshabilitados: 503, sin invocaciones Service |
| CRUD/CSV | Disponibles, separados de Jobs; CSV ya existe en main y dev |

prospector-service-api.v1.yaml se conserva como referencia histórica que Service
comprueba mediante hash en sus pruebas. No es la autoridad del protocolo MVP.
service-http.actual.json y service-callback.actual.json reflejan los esquemas del
Service real 566bbbe (src idéntico al checkout 69c54a1). La matriz de auditoría documenta
las diferencias: 202, CUID, límite 100, UTC, progreso null, sin cancel/export/query HTTP.
ADR-005 no autoriza capacidades futuras. Consultar el reporte de integración para
configuración, reconciliación de generaciones, TTL y límites económicos.
