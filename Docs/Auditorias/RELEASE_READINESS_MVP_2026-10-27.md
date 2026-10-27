# Preparación productiva MVP — 27 de octubre de 2026

**Despliegue: PENDIENTE DE VALIDACIONES.** Núcleo: APTO PARA AUDITORÍA FINAL. Service: integración inicial validada en entorno controlado; despliegue externo y extracción real no certificados. Objetivo de presentación: 19:00 America/Tijuana del 27 de octubre. Este corte previo no afirma cuál será el estado servido a esa hora.

Autoridad documental y fuentes: [preauditoría](PRE_AUDITORIA_MVP_PROSPECTOR_2026-10-27.md), [evidencia con SHA/checks](Evidencia_Cierre_MVP_2026-10-27.json), [guion](Segundo_Avance_Prospector_SaaS_2026-10-27.md). Rama Backend `feat/prospector-service-mvp-integration`, código `42b96fe`, [Draft #6](https://github.com/CarlosAM03/saas-platform-backend/pull/6). Flutter `fix/f5-foundation` [#7](https://github.com/CarlosAM03/saas-platform-client/pull/7) y `feat/flutter-prospector-mvp-parity` [#8](https://github.com/CarlosAM03/saas-platform-client/pull/8). Contrato público 1.1.0, capabilities prospector-mvp-v1. Engine/Service sin cambios.

## Gates

| Gate | Estado | Evidencia / condición restante |
|---|---|---|
| P0 aislamiento | Aprobado técnicamente en alcance probado; revisión humana pendiente | Tres hallazgos corregidos; 46 pruebas PG, 77 HTTP y pruebas de sesión Flutter. Cualquier fuga nueva bloquea promoción |
| P1 núcleo sin Service | Validado en entorno aislado | Arranque compilado production sin credenciales externas; Flutter/PG real, CSV600, dashboard, generación503 sin Jobs ficticios ni HTTP externo |
| P2 producción | **Pendiente; no autorizar despliegue todavía** | Dominio efectivo público, CORS, SHA servido, variables, ADMIN, respaldo/restauración, migraciones productivas y smoke autenticado pendientes |
| P3 generación | Deshabilitada para release inicial | Requiere Service, HTTPS, credenciales, callback, cuotas, navegador/capacidad, E2E real y aprobación separada |

## Comprobaciones productivas de sólo lectura

| Elemento | Resultado comprobado | Lo que no demuestra |
|---|---|---|
| Backend público | `https://saas-platform-backend-l55n.onrender.com/api/v1/health/live` HTTP200; `/health/ready` HTTP200, database=up | SHA desplegado, permisos, CSV ni migraciones nuevas |
| Frontend declarado en homepage GitHub | `https://saas-platform-client-docker.vercel.app/` y `/dashboard`: HTTP404 | No hay smoke de la aplicación en ese dominio |
| Otro dominio de documentación | `https://saas-platform-client.vercel.app/` y `/dashboard`: HTTP404 | No se asume que sea el dominio efectivo |
| Deployment marcado Production en GitHub | ID7217774254, SHA a85a99678101b3f5562f66d7dd1c1c454b1d20cb, status success; URL `https://saas-platform-client-bm5dxmqa0-carlos-armentas-projects.vercel.app/` | Redirige al login de Vercel; HTTP200 final es login del proveedor, no la SPA ni el código nuevo |
| Preview histórico 3d0fca4 | Status success en GitHub; URL inmutable también redirige al login Vercel | No prueba sesión/CSV/CORS ni seguridad del código corregido |
| CORS preflight Render | OPTIONS204 sin Access-Control-Allow-Origin para los dos dominios de documentación y la URL Production inmutable | Ese 204 **no autoriza** al navegador a consumir el Backend |
| Origen no confiable | No recibe Access-Control-Allow-Origin | Rechazo CORS esperado; autorización sigue correspondiendo a JWT/roles |
| Base administrada | Readiness reporta PG up | Proveedor/plan/cuotas/región/backup/restore/migraciones no inspeccionados en panel |
| Service en infraestructura | No hay despliegue externo verificado por esta auditoría | No se infiere disponibilidad por URL/env local o por un test controlado |

No se inició sesión en Vercel/Render, no se alteraron protecciones, DNS, secretos, planes ni orígenes productivos. Se consultó metadata de deployments propia y endpoints públicos. HTTPS del health respondió correctamente; HTTPS público efectivo del frontend SaaS requiere resolver el dominio y protección. Precio, costo mensual, retención y límites reales del hosting **pendientes**: no se reutilizan estimaciones TCO como si fueran el plan contratado.

## Configuración exacta

| Variable / ajuste | Release inicial sin Service |
|---|---|
| NODE_ENV | production |
| PORT | Puerto asignado por proveedor; entero 1–65535 |
| DATABASE_URL | Secreto PostgreSQL administrado; validar destino y TLS según proveedor, sin copiar a docs/logs |
| JWT_SECRET | Secreto externo aleatorio de al menos 32 caracteres, sin placeholders/prefijos de prueba; no imprimir |
| JWT_EXPIRES_IN | 8h, requerido por configuración |
| CORS_ORIGINS | Orígenes HTTPS exactos separados por comas, sin wildcard/path/credenciales. Confirmar el dominio efectivo antes de configurarlos |
| PROSPECTOR_ENABLED | **false explícito** |
| PROSPECTOR_BUDGET_APPROVED | No true para la primera promoción |
| Service URL/keys/callback | No requeridos para arrancar el núcleo; no poner URLs ficticias |
| API_BASE_URL (Flutter build) | URL HTTPS efectiva del Backend; define de compilación, no variable que Nginx cambie retroactivamente |

En producción se valida la fortaleza mínima del secreto y HTTPS explícito de CORS. Los espacios entre orígenes se normalizan. Tests ignoran `.env` local. El arranque de aceptación del núcleo usa cwd sin `.env` y sólo el flag disabled de Prospector, no credenciales escondidas. No ejecutar seed de desarrollo ni publicar cuentas demo/passwords en producción.

Para activar posteriormente la integración deben verificarse **todas** las variables efectivas de `.env.example` y la política del Backend: PROSPECTOR_ENABLED, PROSPECTOR_BUDGET_APPROVED, PROSPECTOR_ALLOW_LOCAL_HTTP (false en producción), PROSPECTOR_SERVICE_URL, PROSPECTOR_CALLBACK_ORIGIN, PROSPECTOR_SERVICE_API_KEY, PROSPECTOR_CALLBACK_API_KEY, PROSPECTOR_SERVICE_GENERATION, PROSPECTOR_HTTP_TIMEOUT_MS, PROSPECTOR_JOB_TIMEOUT_SECONDS, PROSPECTOR_MAX_ACTIVE_JOBS, PROSPECTOR_TENANT_JOBS_PER_PERIOD, PROSPECTOR_GLOBAL_JOBS_PER_PERIOD, PROSPECTOR_QUOTA_PERIOD_SECONDS, PROSPECTOR_MAX_RESULT_BYTES y PROSPECTOR_MAX_TOTAL_RESULT_BYTES. No copiar valores de test. Capacidad 1–17 y límite Engine 1–100; confirmar límites, cuotas y periodo aprobados antes de habilitar.

El identificador de generación de Service sólo cambia después de comprobar que el proceso anterior terminó. Un timeout operacional no libera por sí solo una reserva incierta; se conserva hasta acuse terminal o procedimiento de recuperación verificado. El callback terminal tardío libera sin revivir un Job fallido ni conservar resultados fuera de política.

## Migración y rollback

La única migración nueva respecto a dev es `Prisma/migrations/20261027063000_prospector_mvp_integration/migration.sql`: enum/columnas adicionales, índices, eventos y snapshots con FK y límites. No elimina ni renombra columnas/tablas de dominio. Se aplicó en PostgreSQL desechable local y PG16 CI. No se aplicó a producción.

Procedimiento propuesto, **no ejecutado contra producción**:

1. Registrar revisión/imagen actualmente desplegada, destino DATABASE_URL sin revelarlo y estado de migraciones. Confirmar que son la organización y base correctas.
2. Obtener snapshot/backup del proveedor; registrar ID, hora, alcance y responsable. Probar restauración en base separada y comprobar conteos/relaciones. Una captura de health no sustituye este respaldo.
3. Validar migraciones y compatibilidad de rollback sobre una copia autorizada. Usar `npm run prisma:migrate:deploy`; no migrate reset, db push ni seeds demo.
4. Aplicar la migración aditiva sólo tras autorización. Mantener Service disabled. Desplegar revisión aprobada, comprobar readiness y ejecutar smoke autenticado A/B y CSV sintético en tenant de prueba autorizado.
5. Si falla, mantener generación apagada y volver a la imagen anterior sólo si se confirmó que tolera el esquema aditivo. No revertir esquema borrando eventos/snapshots. Restaurar backup sólo con plan explícito de escrituras posteriores y autorización para evitar pérdida de datos.

El build de imagen Backend pasó en CI; no se ejecutó localmente un contenedor Backend contra PG por falta de Docker. Foundation/paridad tienen jobs de imagen frontend y smoke SPA en CI. El arranque limpio compilado del núcleo y las dos integraciones reales HTTP aportan evidencia adicional; no sustituyen smoke del hosting definitivo.

## Orden de promoción preparado

1. Revisar Backend #6, en especial revocación de autorización e identidad global; aprobar por revisor distinto. Confirmar CI del SHA exacto, no sólo del código previo a documentos.
2. Tras autorización posterior, integrar Backend a dev y repetir checks/smoke sin Service.
3. Revisar e integrar Flutter Foundation #7 a dev, después de aprobación ajena y CI.
4. Reorientar Flutter #8 desde Foundation a dev; comprobar diff, ancestros y checks de nuevo. Integrarlo sólo tras revisión. El PR antiguo #6 dev→main permanece fuera de esta ejecución.
5. Revisar dev→main de ambos repos, con evidencia de P0/P1 y P2 resuelto. No promover en paralelo saltando dependencias.
6. Después de aprobación explícita de despliegue: backup validado, migración, Backend, Frontend con API_BASE_URL correcto, HTTPS/CORS y smoke. Verificar SHA/imagen efectiva y registrar evidencia.
7. Service sigue apagado. Su P3 se revisa y autoriza separadamente.

Ninguno de estos merges, aprobaciones o despliegues se ejecuta durante este trabajo. No se usó force-push ni se omitieron checks.

## Lista antes de autorizar

- [x] Ramas correctivas publicadas y Draft PR enlazados.
- [x] P0 reproducibles corregidos, tests A/B y de sesión aprobados.
- [x] Núcleo arrancó sin Service/credenciales y Flutter importó 600 sintéticos.
- [x] Contrato, código fuente y evidencia de capacidades coherentes.
- [x] CI de código Backend/Foundation/paridad aprobado; ver JSON para corte de HEAD/documentos.
- [ ] Auditoría humana y aprobación de PR, luego autorización de promoción.
- [ ] Dominio público efectivo y acceso al frontend de la revisión aprobada.
- [ ] CORS habilitado exclusivamente para ese origen.
- [ ] SHA Backend/Frontend realmente servido y API_BASE_URL efectivo.
- [ ] Variables, credenciales ADMIN y acceso a tenants comprobados sin exponer secretos.
- [ ] Backup restaurable, plan de rollback y responsable.
- [ ] Estado migratorio productivo y ensayo sobre copia autorizada.
- [ ] Smoke autenticado real, CSV aislado, datos de prueba retirados conforme al plan.
- [ ] Hosting/PG: disponibilidad, costo, límites, logs, retención y alertas comprobados.
- [ ] P3 completo antes de cambiar PROSPECTOR_ENABLED a true (no bloquea release sin generación).

## Contingencia de presentación

Usar el entorno aislado reproducible del núcleo, datos sintéticos y generación deshabilitada. Mostrar el flujo CSV, dashboard y aislamiento A/B; identificarlo como demostración controlada. Mostrar la integración HTTP con Service como evidencia separada con EnginePort controlado, sin afirmar extracción pública. Si P2 no se resuelve antes de las 19:00, conservar el entorno estable y presentar estos pendientes, sin despliegue de último momento ni afirmaciones productivas.

Antes de presentar se debe volver a consultar el estado servido y la revisión exacta. El informe representa el corte registrado, no una garantía de disponibilidad futura.
