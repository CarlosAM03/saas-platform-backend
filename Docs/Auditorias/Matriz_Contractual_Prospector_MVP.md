# Auditoría contractual inicial — integración MVP

Inicio 2026-10-26, America/Tijuana. Rama Backend feat/prospector-service-mvp-integration,
base origin/dev 967044e2. Engine 70f6081; Service origin/main 566bbbe, checkout limpio
69c54a1 con src idéntico; Flutter fix/f5-foundation 97645e4 (sin modificaciones funcionales).
Backend origin/main 3a330939 tiene el mismo árbol que dev e incluye CSV: corrige la
referencia documental previa de Flutter, que se conserva como historia.

| Componente/capacidad | Código y contrato efectivo | Restricción / resolución del incremento |
|---|---|---|
| Engine | API pública Python, google_maps, limit 1–100, síncrono, campos normalizados e identidad VERIFIED | Sin HTTP/tenant/JWT/durabilidad/porcentaje; usar el adaptador de Service sin cambios |
| Service inicio | POST /api/v1/prospecting/jobs, X-API-Key, 202 success/data(jobId,status=QUEUED,acceptedAt)/meta | CUID de Job/tenant, texto no blanco, limit estricto 1–100; no redirecciones ni endpoints supuestos |
| Service health | GET /health/live y /health/ready | Ready incluye configuración, browser probe, worker, cola y registry; no informa consumo económico |
| Service ejecución | Un thread/worker y cola/registry acotados, registry default 100 | En memoria, sin eviction general ni recuperación; 409 por Job duplicado no acredita aceptación |
| Service callback | POST al origen/ruta exacta de Platform; X-API-Key de retorno; 200 success=true obligatorio | UUID, secuencia monotónica, UTC, progress=null; resultados sólo COMPLETED, error sólo FAILED; retry acotado no durable |
| Backend actual | CRUD/Auth/CSV y lecturas Jobs; inicio/callbacks/cancel/persist/export 503 | Implementar únicamente inicio, callbacks y lectura temporal; mantener las otras operaciones deshabilitadas |
| Backend autorización | JWT HS256 + TenantContext + Roles; ADMIN/OWNER/MEMBER para Jobs | tenantId y usuario desde contexto; campaña del tenant y ACTIVA; ningún origen/secret/callback desde Flutter |
| Backend almacenamiento | PostgreSQL y Prisma con Job durable, sin capa de resultados actual | Añadir hashes de intención, receipts de eventos y snapshot PostgreSQL TTL 1h, limpieza real y límites |
| Flutter actual | DTOs, PlatformApi, Auth/scopes y UI endurecidos; 252 tests | No modificar funcionalmente hasta pasar Backend; luego capabilities verificadas, sin flag optimista |
| Cancel/persist/export/resume | No operativos en esta integración | No añadir rutas Service ni persistencia automática de prospectos; CSV sigue separado |

## Diseño mínimo que se comprobará

- POST único con timeouts, tamaño acotado, TLS salvo loopback local explícito, sin redirects.
- Clave y payload canónico SHA-256; unique tenant/usuario/hash en PostgreSQL; un Job por intención.
- Transacciones cortas con advisory lock global para admisión/capacidad y estados. Ningún HTTP en la transacción.
- Job antes de HTTP; callback adelantado y aceptación tardía no degradan el estado.
- Errores internos 401 no se propagan como expiración JWT del usuario. 409/timeout sin callback acreditado conservan incertidumbre y no provocan reenvío.
- Eventos confirmados se reconocen por UUID/secuencia/hash persistidos; un replay exacto confirma sin escribir otra vez. Huecos de entrega permiten un estado avanzado válido, pero una secuencia vieja/no confirmada nunca retrocede el Job.
- Snapshot separado, hasta 100 resultados y límite de bytes; TTL una hora desde recepción final, lectura exacta incluso [] y borrado al vencer mediante mantenimiento periódico y en acceso.
- Deadline operacional persistido: marca FAILED sin inventar que el scraping cesó. Una reserva incierta no se libera por ese timeout; requiere callback terminal legítimo o una nueva generación de Service confirmada por operador. Un callback terminal tardío puede registrar su descarte y liberar capacidad sin revivir el Job ni almacenar resultados.
- Generación de Service configurada explícitamente: cambiarla sólo tras comprobar que el proceso previo terminó/reinició; reiniciar Backend no la cambia ni reenvía Jobs.
- Admisión deshabilitada por defecto; topes explícitos activos/tenant/global/periodo y presupuesto conservador reconocido. No equivalen a lectura de facturación del hosting. Readiness real del Service es obligatorio; no se afirma capacidad ilimitada.

Las decisiones son de Backend en este incremento autorizado, no nuevas capacidades de
Service. ADR-005-FunctionalJobs se leyó como propuesta histórica: no se adopta su cancel
HTTP, replay hacia Python, caché en memoria, persist/export ni TTL histórico de 24h.

## Herramientas y evidencias iniciales

Python 3.13.4; Engine instalado desde VCS 70f6081 en el entorno de pruebas Service.
PostgreSQL 18 aislado en 127.0.0.1:55439; la instancia existente 5432 no se toca.
Node local 22.16.0 frente al Node 20 de CI; se reportará esa diferencia.
Primer Engine: 245 PASS + 2 fallos browser ENOENT por MAX_PATH; Service: 93 PASS +
1 fallo del mismo probe. Repetición con browser P:\.cache\browsers: Engine 247 PASS, 1 E2E público deseleccionado; Service 94 PASS.
No se ejecuta Google Maps live. Las pruebas HTTP posteriores usarán Service real y un
EnginePort controlado sólo en test/, con callbacks reales a NestJS y PostgreSQL real.
