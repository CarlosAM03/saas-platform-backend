# ADR-006 — Evidencia local y gates

> Registro histórico de Ángel (27–28/10). El texto siguiente se conserva: no acredita las ejecuciones posteriores de Codex. CI en ca1e7c9 sí ejecutó PostgreSQL16: [run 40711778812](https://github.com/CarlosAM03/saas-platform-backend/actions/runs/40711778812), jobs quality/postgres-integration/docker-build SUCCESS, verificados nuevamente el 28/10/2026. El nuevo hardening G1 se documenta por SHA y entorno en [evidencias](../../codex/backend-adr006/evidencias/10_HANDOFF_GATE1.md). El transporte vigente es Brevo HTTPS; los resultados SMTP de abajo corresponden a la implementación anterior.

Validación: 27–28/10/2026. Rama `feat/tenant-register`, HEAD inicial/final de referencia
`b51b265f1a545fa915f1dd1c57ef2f5858ec6492`. No commits/push/merge/despliegues.
Implementación: [README local](../../src/tenant-registration/README.md).

## Inspección inicial

- Status inspeccionado antes de editar; había cambios parciales en Prisma,
  Auth/Users, dependencias y dos archivos de tenant-registration, sin migración.
- Originales aprobados leídos completos; copias internas idénticas por SHA-256.
- Guía, ADR-004/003, Core V1, contrato, init, configuración/Auth/Users/Tenants revisados.
- Build inicial falló: cliente Prisma no contenía mustChangePassword (7 errores).
- Formato inicial falló en siete archivos parciales. No se atribuye al core limpio.
- Host Node22 no cumple engines; validaciones ejecutadas con Node20.20.2 mediante
  `npx --yes --package=node@20 -c "<comando>"`, sin cambiar dependencia del proyecto.
- Docker Engine no accesible (pipe dockerDesktopLinuxEngine inexistente).

## Validaciones ejecutadas durante implementación

- prisma:generate: correcto tras completar modelos.
- Build: correcto después de corregir tipado del flag.
- Unitarias finales: **81 aprobadas** (41 anteriores + 40 nuevas). Incluyen ambos
  secretos desconocidos, consumo, TTL de enlace/desafío, generaciones, estados
  activos, contraseña Unicode y frontera exacta de 72 bytes UTF-8.
- HTTP completas: **84 aprobadas**, incluyendo 78 anteriores y 6 nuevas. La suite
  conserva Auth/JWT/Users/SEC-01, tenants, campañas, CSV, wrappers y Jobs deshabilitados.
- lint:check y format:check completos aprobados; build y tsc --noEmit aprobados.
  Se corrigieron errores propios de lint y tipado de tests/Request durante integración.
- prisma validate: primera ejecución sin DATABASE_URL falló por configuración,
  no por esquema; repetida con URL ficticia no conectable exclusivamente para
  validación estática, aprobada. No se abrió ni migró una base con esa URL.
- Contrato: pruebas de composición 33 operaciones intactas + 5 nuevas, referencias
  y operationId únicos; no se reemplazó el login por oneOf.
- SMTP simulado: aceptación, rechazo y timeout de 15s; HTML escapado y URL configurada.
- No se intentó enviar correo real, crear cuenta, contratar plan ni habilitar pagos.
- npm audit --audit-level=high: código cero, ocho low en herramientas, sin
  moderate/high/critical. npm audit --omit=dev --audit-level=high: cero vulnerabilidades.
- git diff --check: sin errores (solo advertencias de conversión LF/CRLF en Windows).
- El diff de init, contrato core platform-api.v1.yaml, CSV y Jobs permanece vacío.

## Gates no acreditados todavía

Intento real de `docker compose --profile test run --build --rm test-postgres`:
falló antes de crear servicios, al no existir el pipe dockerDesktopLinuxEngine.
No se declaró aprobada ninguna prueba PostgreSQL nueva ni la regresión PostgreSQL
del core en esta sesión.

Docker/PostgreSQL real desechable: pruebas de alta/rollback, unicidad concurrente,
canje/completado/reenvío, límites tras reinicio, estado tardío y migración/colisiones
están añadidas en test/tenant-registration*.postgres-spec.ts. Requieren ejecutar
el perfil test; no se sustituyen por mocks ni por resultados del 13/10.

Tampoco están acreditados SMTP de laboratorio TLS, cuenta/remitente/dominio Free,
frontend de activación, smoke E2E de navegador, CI remoto ni autorización de despliegue.
Revisión/GO explícito del owner sigue obligatorio. Flag false por defecto y
documentado; no se activó producción. No recomendar backend anterior incompatible
como rollback mientras haya cuentas pendientes.
