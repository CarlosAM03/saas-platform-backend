# Integración Prospector Service MVP — Backend

Auditoría local 2026-10-26/27. Sin push, merge, despliegue, scraping público ni gasto.

## 1. Versiones, SHA e inventario Git

Engine main 70f6081688db5c5bc5ea612f5fabd5724aab0b20, sin cambios.
Service main remoto 566bbbe67a59a0fda307ea7d8c5f6bf46fd93aab; checkout
feat/fastapi-service-foundation 69c54a15601d238638610d0a5c08af46e3da7f14,
src/Dockerfile/pyproject idénticos a main, sin cambios. Engine instalado en Python
Service desde VCS 70f6081 (direct_url.json); Python 3.13.4.
Backend base origin/dev 967044e2dc7d10ea91d7d78a86e1ea6fe2accd1a,
main 3a3309398458ab333d7b00f16e9c2df6a09ef734 con árbol idéntico y CSV presente.
Rama aislada feat/prospector-service-mvp-integration. SHA de implementación:
consultar el commit que incorpora este reporte y el manifiesto contractual posterior.
Flutter autoridad fix/f5-foundation 97645e4a9abcfb52121d74e2b1d6f5a14a73e3ef;
sin cambios funcionales hasta pasar gate 2.
Cuatro árboles limpios al iniciar, sin operaciones Git pendientes ni worktrees extra.
Remotos oficiales verificados y fetch sin merge. Consulta de PR del usuario autenticado:
ninguno abierto devuelto; no equivale a inventario de PR de otros autores.
Node local 22.16.0; CI mantiene Node 20.x. PostgreSQL local aislado 18; CI PostgreSQL16.

## 2. Contratos auditados

Matriz_Contractual_Prospector_MVP.md referencia código real. Se revisaron docs/API
pública/runtime/testing de Engine; api/schemas/jobs/config/adapters/contracts/decisions
Service; controladores, DTO, Prisma, contexto/roles, prospectos, campañas y contratos
Backend; arquitectura tipada y scopes Flutter. ADR-005 es historia/propuesta.
Platform OpenAPI 1.1.0 representa este incremento. Swagger sirve el YAML contrastado
con rutas/DTO y pruebas, no un spec inferido completo de decoradores. Se extrae por HTTP
en .tmp/platform-api.served.json. service-http.actual.json y service-callback.actual.json
se extraen de FastAPI/Pydantic reales. El YAML interno antiguo se conserva porque Service
comprueba su hash; sus propuestas no prevalecen sobre API/esquemas ejecutables.
Divergencias resueltas: 202 Service vs 201 Platform; strict limit 1–100; CUID; UTC;
progress null; resultados sólo final incluso []; sin replay Python, sin rutas hipotéticas.

## 3. Capacidades implementadas

POST /api/v1/prospecting-jobs condicionado; GET /api/v1/prospecting-jobs/capabilities;
GET listado y detalle con tenant; callback interno autenticado y transaccional.
Registro durable, intención idempotente, aceptación/ incertidumbre, receipts y snapshots.
Backend genera CUID y destino callback; Flutter nunca elige tenant/origen/secret internos.

## 4. Fuera de alcance

Cancel/persist/export Jobs continúan 503. Sin reanudación, colas distribuidas,
Redis, callbacks durables en Python, métricas económicas de hosting ni porcentaje.
Exportación Python y cancelación cooperativa no son endpoints Service.
Persistir resultados a campaña queda propuesto para otro incremento con dedup/atomicidad.

## 5. Diseño

ProspectorPolicy fail-closed, cliente Node HTTP/HTTPS sin dependencias nuevas,
transacciones Prisma cortas coordinadas por advisory lock PostgreSQL global.
HTTP siempre fuera de la transacción. No mocks en src/. ControlledEngine sólo test/.

## 6. Creación y callbacks

JWT/rol/contexto → campaña/membership activos → readiness real → lock → cuota/capacidad
→ intención durable → POST Service. Callback puede adelantarse a 202: lastSequence
prevalece y el ACK nunca regresa el estado. Callback requiere path/body coherentes,
UUID, secuencia creciente, UTC, lifecycle, límites de cardinalidad/bytes y progreso null.
Receipt, snapshot y estado se confirman atómicamente. Duplicado exacto devuelve éxito
sin modificar Job; mismo UUID/seq con otro payload y regresiones devuelven 409.
Se permiten huecos de secuencia por pérdida de entregas previas; no regresiones.

## 7. Seguridad y configuración

.env.example mantiene PROSPECTOR_ENABLED=false y BUDGET_APPROVED=false.
Para habilitar: configurar TODOS los valores de ProspectorPolicy; secretos aleatorios
separados de al menos 32 caracteres. PROSPECTOR_SERVICE_API_KEY coincide con INTERNAL_API_KEY
Service; PROSPECTOR_CALLBACK_API_KEY con CALLBACK_API_KEY. Fallback a PROSPECTOR_API_KEY
sólo si variable nueva ausente (vacía no activa fallback). No claves reales en repo/Flutter.
PROSPECTOR_SERVICE_URL y CALLBACK_ORIGIN son orígenes, sin userinfo/path/query/fragment.
HTTPS obligatorio; HTTP sólo loopback, NODE_ENV test/development y ALLOW_LOCAL_HTTP=true.
Service PLATFORM_CALLBACK_ORIGIN coincide exactamente; callback es la ruta validada por
su política. Desarrollo local Service requiere ALLOW_LOCAL_CALLBACKS=true. Producción no.
Timeout HTTP explícito 100..60000 ms; sin redirects/retries, límites de 64KiB en request/ACK.
JSON callback hasta 1MiB +16KiB envelope; parser general permanece explícito (100KiB).
No logs de claves, payloads de negocios, trazas o error crudo Python. 401 interno se
traduce en 503 público seguro, nunca en logout JWT. El código de error seguro queda en Job.

## 8. Multi-tenancy

Tenant y usuario salen del contexto JWT. Roles ADMIN/OWNER/MEMBER y tenant seleccionado.
Creación revalida usuario/tenant/membership y campaña ACTIVA antes de reservar y bajo lock.
Campaña ajena y detalle ajeno 404. ADMIN global sin tenant 403. El callback no recibe tenant.
Seeds históricos con tenant ID no CUID no son compatibles con Service: capabilities=false,
PROSPECTOR_TENANT_ID_UNSUPPORTED; crear tenants reales CUID, no remapear identidades.
CRUD/CSV y hardening de sesión no se sustituyen.

## 9. Idempotencia

SHA-256 de clave (1–200 bytes) y payload JSON canónico; unique tenant/requestedBy/hash.
Concurrencia crea una intención y una llamada. Replay sólo consulta evidencia durable.
Payload diferente 409. Clave original no almacenada. 409 Service NO prueba aceptación.
Timeout/red/ACK inválido/redirect dejan UNCERTAIN; PENDING después de crash también incierto.
Respuesta 503 details.reason PROSPECTOR_DISPATCH_UNCERTAIN + jobId permite GET sin reenvío.
400/401/503 Service confirman rechazo de admisión, marcan FAILED/REJECTED y liberan reserva.

## 10. Modelo y migración

20261027063000_prospector_mvp_integration es aditiva: campos nullable de intención,
generación, deadline, dispatchState; lastSequence; receipts UUID/seq/hash con constraints;
snapshot por Job con JSONB array, bytes 0..1MiB y expiresAt indexado. Cascades sólo de tablas
nuevas al eliminar Job. JobStatus externo no cambia. No altera prospectos/importador.
Migraciones baseline + nueva aplicadas sólo al cluster temporal de prueba 127.0.0.1:55439.
Nunca se tocó la instancia existente 5432 ni una base productiva.

## 11. Resultados temporales

Snapshot PostgreSQL del callback COMPLETED, límite configurable por Job hasta1MiB y total
hasta100MiB, bajo mismo lock; TTL adoptado por Backend de3600s desde recepción final.
COMPLETED [] está disponible. Vencido: resultsAvailable=false, results=null, fecha persiste.
Lecturas/mantenimiento retiran snapshots vencidos; intervalo60s independiente de admisión
limpia incluso con política retirada. Historia de Job/receipts permanece. Reiniciar Backend
conserva snapshots vigentes. No reconstruir desde Prospect/CampaignProspect ni guardarlos allí.

## 12. Fallos y reinicios

Deadline conservador configurable300..86400s (ejemplo1800). Reconciliación al arrancar,
cada minuto y en lecturas/admisión. Vencido pasa FAILED/FINAL_EVENT_TIMEOUT sin resultados,
sin afirmar cese de scraping, sin reenvío y reserva bloqueada. Callback terminal tardío
se registra LATE_TERMINAL_DISCARDED, libera reserva pero no revive Job ni conserva resultados.
PROSPECTOR_SERVICE_GENERATION identifica instancia operativa. Mantener estable al reiniciar
Backend. Cambiar SÓLO tras verificar que el proceso Service anterior terminó/reinició;
marca búsquedas antiguas activas FAILED/SERVICE_RESTARTED y libera reservas de esa generación.
No hay detección automática fiable: Service no tiene endpoint de inventario/consulta.
retryAllowed sólo con terminal y reserva liberada; nueva intención manual usa clave nueva.

## 13. Cuotas y costo cero

Feature flag, presupuesto conservador aprobado, maxActive1..17 (default operativo1),
cuota tenant/global1..100 por ventana60..2678400s, tenant<=global, readiness real.
Registro durable y lock evitan carreras. Intentos reservados consumen cuota aun rechazados,
conservador. Capacidad incierta no se libera sólo por tiempo. Agotamiento:429 cuota/503 capacidad.
Registry Service default100 sin eviction: readiness detiene nuevas admisiones al agotarse;
reinicio controlado necesario, nunca asumir capacidad ilimitada. Job quota no mide dinero:
operador debe configurar topes conservadores del plan gratuito y prohibir sobrecostos en
proveedor. BUDGET_APPROVED es reconocimiento explícito, no verificación de facturación.
No se ejecutó hosting ni scraping público. Sin configuración completa la creación permanece off.

## 14. Pruebas ejecutadas

Engine247 PASS +1 E2E público deseleccionado; Service94 PASS, browser probe compatible.
Primer intento browser falló por MAX_PATH; alias P: y PLAYWRIGHT_BROWSERS_PATH corto
permitieron probe real sin cambios. Backend61 unit,77 HTTP/fake-Prisma regresión,
28 PostgreSQL (incluye18 HTTP real MVP +10 CRUD/CSV) PASS en ejecución local.
Se probaron aceptación/callbacks COMPLETED/FAILED, vacíos, secuencia/duplicados/conflictos,
callbacks antes de202, timeout, callback fallido, 401 real/409 real Service, rechazo503
cliente HTTP, red/redirect, cuotas/concurrencia, aislamiento, rollback, constraints, TTL,
reinicio Backend, snapshot durable, late terminal y ausencia de claves en logs.
Lint, formato, build y tsc completo se registran en manifiesto final.
Docker daemon no disponible: builds no ejecutados/aprobados. CI conserva jobs independientes;
PostgreSQL CI instala Service main pin566 y sus dependencias Engine fijadas, sin Google Maps.

## 15. Riesgos Service

Memoria volátil, worker único, registry no evicta, shutdown cooperativo limitado,
callbacks retries acotados sin outbox. Snapshot delivery puede fallar si storage lleno;
no ACK falso; operación termina por deadline si Python agota retries. No exactly-once.
Cambiar generación sin verificar proceso previo podría permitir scraping simultáneo: prohibido.
Cuotas globales suponen misma BD/Service y todos los productores pasan por este Backend.

## 16. Estado E2E

Backend↔FastAPI↔EnginePort controlado↔callback↔PostgreSQL↔GET verificado.
Engine real se validó por suites separadas con browser probe, no Google Maps live.
Recorrido Flutter pendiente al cerrar etapa I; gate4 se documentará en reporte Flutter.
No llamar E2E Google Maps a fixtures controlados.

## 17. Reproducción y commits

INTEGRATION_TEST_DATABASE_URL debe apuntar a PostgreSQL desechable migrado.
Python3.13 con pip install git+https://github.com/CarlosAM03/prospector-service.git@566bbbe67a59a0fda307ea7d8c5f6bf46fd93aab.
PROSPECTOR_TEST_PYTHON selecciona ese intérprete. npm ci; npm run prisma:generate;
npm run prisma:migrate:deploy; npm run test:unit:ci; npm run test:e2e:ci; npm run test:postgres.
Script test/scripts/mvp-stack.ts levanta sólo loopback y fixtures propietarios. Ejecutar
con ts-node y la DB de prueba, usar .tmp/mvp-stack.json desde la prueba Flutter real;
enviar stop por stdin limpia sus fixtures y cierra Nest/FastAPI. No imprimir manifiesto
con credencial temporal de fixture en logs públicos. No es un comando de producción.
Commits separados de Flutter y sin push. Manifiesto posterior fija SHA exacto del contrato.

## 18. Dictamen etapa I

Gate1 y gate2 funcionales con Service real/EnginePort controlado y PostgreSQL real.
INTEGRACIÓN FUNCIONAL CON LIMITACIONES al terminar esta etapa: falta validar Flutter
antes del dictamen global. Cancel/persist/export quedan deshabilitados y admisión off por defecto.
