# Cliente Service MVP

Sólo POST /api/v1/prospecting/jobs y GET /health/ready. X-API-Key de salida separado
respecto del callback. Timeouts totales, sin redirects ni retries, payload/response
acotados. 400/401/503 son rechazo de admisión; 409/red/timeout/ack inválido conservan
incertidumbre. No convertir 401 interno en logout del usuario. Nunca HTTP en transacción.
TLS obligatorio salvo loopback autorizado explícitamente en test/development.
Ver .env.example, ProspectorPolicy y reporte de integración. No publicar secretos.
