# Jobs MVP

Inicio condicionado por ProspectorPolicy; deshabilitado por defecto. Backend registra
la intención antes del HTTP, usa el mismo CUID en Service y persiste receipts/snapshot.
Idempotencia PostgreSQL por tenant/usuario/hash, sin reenvíos automáticos. Callbacks
adelantados prevalecen sobre 202 tardío. GET sólo expone registros del tenant activo.
Resultados COMPLETED (incluye []) se guardan separados de Prospect, TTL 1h, limpieza
periódica cada minuto y en acceso. progress=null. Cancel/persist/export siguen 503.
Ver Docs/Auditorias/Integracion_Prospector_Service_MVP.md y contrato v1.1.0.
