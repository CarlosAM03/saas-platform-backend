# G4 — QA por SHA y rastreabilidad

**ESTADO: EJECUCIÓN PARCIAL — G4 NO CERRADO**

## Resultado actual — 2026-11-22

HEAD probado: `d262f48e9ab6b344c472df60588c2261d377c884`. Fecha: `2026-11-22T14:19:54-08:00`. Rama: `feat/sprint-campana-prospector`.

| ID | Comando | Fixture/entorno | Esperado | Observado | Estado | Limitación |
|---|---|---|---|---|---|---|
| BUILD-D262 | `npm run build` | TypeScript/NestJS | compilación sin errores | código 0 | PASS | no acredita AC funcionales |
| UNIT-D262 | `npm run test:unit:ci` | 11 suites Jest | regresión verde | 113/113 PASS | PASS | suite baseline, no todos los AC CP |
| HTTP-D262 | `npm run test:e2e:ci` | 7 suites HTTP; fixtures sintéticos | regresión verde | 84/84 PASS | PASS | no sustituye PG ni todos los Txx |
| PG-D262 | `docker compose --profile test run --build --rm test-postgres` | PostgreSQL 16 desechable; 11 suites | regresión y fixtures críticos verdes | 93/93 PASS | PASS | no cierra G4 ni acredita escenarios ausentes |
| SWAGGER-D262 | `docker compose up --build --wait api`; `GET /api/docs-json`; `GET /api/docs` | Compose local sintético, puertos locales, mismo HEAD | documentos servidos con HTTP 200 | JSON 200, 39 rutas/51 operaciones; UI 200 | PASS para disponibilidad HTTP | no resuelve el drift contractual registrado en `DRIFT_CONTRATO_C75AD08.md` |
| CONTRACT-CP-D262 | `npm run test:e2e:ci -- test/without-prospector.e2e-spec.ts`; `npm run build` | Swagger/YAML CP sobre worktree basado en `d262f48` | rutas CP presentes y marcadas `AVAILABLE` | 5/5 PASS; build código 0 | PASS PARCIAL contractual | no acredita todos los flujos T01–T31 |
| T01-T31-D262 | `docker compose --profile test run --build --rm test-postgres` | PostgreSQL 16 desechable; 11 suites | matriz T01–T31 por caso | 94/94 PASS en la suite PostgreSQL completa | COBERTURA PARCIAL | T03, T05, T08, T16, T18, T20 permanecen NOT_RUN; T01/T25 permanecen PARCIAL; T32 fuera de backend |

G4 permanece abierto: faltan reconciliación por AC/T01–T31, rendimiento sintético medido y revisión independiente. T32 sigue reservado a Flutter.

## Resultado más reciente — 2026-11-22

HEAD probado: `cd7227def8eee323cff3df666c25610486ceeb04`. Build PASS, unitarias 113/113, E2E 84/84 y PostgreSQL 93/93 (antes 61). Se implementaron casos específicos de concurrencia fuerte T07, rechazo seguro CSV T04, legacy T28 e IDs cruzados T31, con cobertura y límites por caso en [RESULTADOS_CD7227D.md](RESULTADOS_CD7227D.md). Se corrigió el 500 de creación de actividad con participación ajena para devolver 404, sin cambios protegidos. G4 permanece abierto por cobertura completa de AC/T01–T31, revisión independiente y mediciones pendientes; T32 sigue reservado al frontend.

## Registros históricos (cada resultado conserva su SHA)

- Backend HEAD exacto: `f09fbee77e26b9b0cdfa3581883b87218e7a8f7d`, validado el 2026-11-21
- PostgreSQL sintético y tipo de dataset: Docker Compose profile test, PostgreSQL 16 desechable
- Comandos/fecha/log (saneado): `npm run build`, `npm run test:unit:ci`, `npm run test:e2e:ci`, `docker compose --profile test run --build --rm test-postgres`
- Unitarias (observado): 113/113 PASS
- HTTP E2E (observado): 84/84 PASS
- PostgreSQL integración (observado): 59/59 PASS
- Migración legacy y rollback/forward-fix ensayado: las 3 migraciones aplicaron sobre PostgreSQL desechable; T28 con backfill específico aún NO_EJECUTADO
- CSV V1 (límites / snapshot / concurrencia / rollback): suite existente PASS; casos faltantes de múltiplos candidatos y concurrencia fuerte aún NO_EJECUTADOS por caso
- Tenant y RBAC (roles/IDs cruzados): suites baseline PASS; T31 específico de nuevos endpoints NO_EJECUTADO
- Swagger/OpenAPI y contrato vs código: NO_EJECUTADO — nuevas rutas aún no reconciliadas en contrato objetivo
- Service ausente y Jobs sin regresión: suite `without-prospector` PASS dentro de E2E
- Rendimiento medido, sin SLA inventado: NO_EJECUTADO
- T01–T31: PARCIAL; matrices generales PASS no sustituyen pruebas por ID
- T32: **NO_EJECUTADO** (E2E Flutter futuro)
- Defectos abiertos y riesgo residual: migración reparada durante G4; contrato y cobertura específica pendientes
- Resultado gate: `BLOCKED_PARA_CIERRE_TOTAL`
- Revisión estática posterior al registro inicial: `c75ad08c2619e8c32eec6661a3f9ad8b5a38eb3b`; los hallazgos `REV-01` (cascadas destructivas) y `REV-02` (procedencia legacy no verificable) quedaron corregidos mediante la migración nueva `20261123000100_campaign_participation_history_forward_fix`, sin editar la migración histórica. Verificados en PostgreSQL desechable; detalle en `HALLAZGOS_REVISION_C75AD08.md`.
- QA/contrato/datos específicos en este turno: `NOT_RUN`; la cuota de subagentes impidió iniciar esas auditorías. No se deriva PASS de esta limitación.

| Test | SHA | Comando / fixture | Resultado | Evidencia | Limitación |
|---|---|---|---|---|---|
| Build/Prisma | f09fbee77e26b9b0cdfa3581883b87218e7a8f7d | `npm run prisma:generate`; `npm run build` | PASS | salida del shell | generación/compilación |
| Unitarias | f09fbee77e26b9b0cdfa3581883b87218e7a8f7d | `npm run test:unit:ci` | 113/113 PASS | suites Jest | no cubre todos los AC sprint |
| E2E HTTP | f09fbee77e26b9b0cdfa3581883b87218e7a8f7d | `npm run test:e2e:ci` | 84/84 PASS | suites Jest HTTP | no prueba todos los endpoints nuevos |
| PostgreSQL 16 | f09fbee77e26b9b0cdfa3581883b87218e7a8f7d | `docker compose --profile test run --build --rm test-postgres` | 59/59 PASS | suites PostgreSQL desechables | migración aplicada; T28 específico pendiente |
| T25–P4 CSV | f09fbee77e26b9b0cdfa3581883b87218e7a8f7d | suites existentes CSV E2E/PostgreSQL | PARCIAL PASS | pruebas CSV existentes | límites/múltiples candidatos no completos |
| T28 | f09fbee77e26b9b0cdfa3581883b87218e7a8f7d | migración aplicación PostgreSQL | NO_EJECUTADO ESPECÍFICO | — | solo aplicación DDL demostrada |
| T30 | f09fbee77e26b9b0cdfa3581883b87218e7a8f7d | `without-prospector.e2e-spec.ts` | PASS | suite E2E | módulos externos intactos |
| T32 | f09fbee77e26b9b0cdfa3581883b87218e7a8f7d | — | NO_EJECUTADO | — | Flutter fuera de backend |
| Build/Prisma forward-fix | `c75ad08c2619e8c32eec6661a3f9ad8b5a38eb3b` + worktree no confirmado | `npm run prisma:generate`; `npm run build` | PASS | ejecución local, 2026-11-22T12:32:25-08:00 | pendiente commit; no valida todos los AC |
| T28 — forward-fix legacy | `c75ad08c2619e8c32eec6661a3f9ad8b5a38eb3b` + worktree no confirmado | `docker compose --profile test run --build --rm test-postgres`; schema aislado `campaign_fix_<uuid>` | PASS | `test/campaign-participation-migration.postgres-spec.ts`; 61/61 PostgreSQL PASS | cubre solo filas sintéticas de la migración anterior, no datos reales |
| REV-01 — historial append-only | `c75ad08c2619e8c32eec6661a3f9ad8b5a38eb3b` + worktree no confirmado | mismo comando PostgreSQL | PASS | la suite rechaza borrar participación con actividad y prospecto con procedencia; 61/61 PASS | pendiente commit y revisión independiente posterior |
| Regresión unitaria | `c75ad08c2619e8c32eec6661a3f9ad8b5a38eb3b` + worktree no confirmado | `npm run test:unit:ci` | PASS | 113/113 PASS, 2026-11-22T12:33:46-08:00 | no cubre todos los AC sprint |
| Regresión HTTP E2E | `c75ad08c2619e8c32eec6661a3f9ad8b5a38eb3b` + worktree no confirmado | `npm run test:e2e:ci` | PASS | 84/84 PASS, 2026-11-22T12:33:46-08:00 | no sustituye T31 específico ni paridad Swagger |
| T31 — guardas de rutas nuevas | `c75ad08c2619e8c32eec6661a3f9ad8b5a38eb3b` + worktree no confirmado | `npm run test:e2e:ci`; 9 rutas de participación/dashboard añadidas a `campaigns.e2e-spec.ts` | PARCIAL PASS | 84/84 E2E PASS, 2026-11-22T12:36:22-08:00 | valida 401 sin sesión y 403 sin tenant; falta lectura/escritura cruzada con IDs de tenant B |
| Paridad OpenAPI/Swagger — drift inicial | `c75ad08c2619e8c32eec6661a3f9ad8b5a38eb3b` + worktree no confirmado | comparación estática de controladores, YAML y `deploymentDocument()` | FAIL | `DRIFT_CONTRATO_C75AD08.md` | evidencia histórica: rutas nuevas ausentes de YAML y Swagger servido |
| Paridad OpenAPI estática — reconciliación | `c75ad08c2619e8c32eec6661a3f9ad8b5a38eb3b` + worktree no confirmado | `node -e "...js-yaml...platform-api.v1.yaml"`; revisión independiente código→YAML | PARCIAL PASS | `YAML_OK paths=34`; revisión sin hallazgos de severidad; rutas CP/P4 `CONTRACT_ONLY` | cambios sin commit; Swagger servido no verificado; no acredita `AVAILABLE` |
| Swagger servido | `c75ad08c2619e8c32eec6661a3f9ad8b5a38eb3b` + worktree no confirmado | `Invoke-RestMethod http://localhost:3000/api/docs/json` | NOT_RUN | no hubo app escuchando en localhost | requiere levantar aplicación desde SHA confirmado y comparar documento servido |
| Prisma generate / build | `ca2285af1f2dd3881bce4ce4f93ab8c6f3cc29f5` | `npm run prisma:generate`; `npm run build` | PASS | Prisma Client 5.22.0 generado; `nest build` código 0 | compilación no sustituye T01–T31 |
| Regresión unitaria | `ca2285af1f2dd3881bce4ce4f93ab8c6f3cc29f5` | `npm run test:unit:ci` | FAIL | 10 suites PASS, 1 FAIL; 112/113 pruebas PASS; `tenant-registration-document.spec.ts:25` esperaba 33 operaciones y observó 45 | se requiere corregir la expectativa baseline y reejecutar; G4 no cierra |
| Regresión HTTP E2E | `ca2285af1f2dd3881bce4ce4f93ab8c6f3cc29f5` | `npm run test:e2e:ci` | PASS | 7 suites, 84/84 pruebas PASS; fixtures sintéticos | no sustituye Txx específicos |
| PostgreSQL 16 | `ca2285af1f2dd3881bce4ce4f93ab8c6f3cc29f5` | `docker compose --profile test run --build --rm test-postgres` | PASS | profile `test`, PostgreSQL desechable `saas_test`; 4 migraciones sin pendientes; 9 suites, 61/61 pruebas PASS | T07/T28/T31/P4 específicos siguen NOT_RUN |
| Swagger servido / paridad CP | `ca2285af1f2dd3881bce4ce4f93ab8c6f3cc29f5` + worktree de expectativa unitaria no confirmado | `docker compose -p cp-swagger-parity up --build --wait api`; `GET http://127.0.0.1:3100/api/docs-json`; comparación de operaciones | PASS PARA RUTAS CP | HTTP 200; YAML 34 paths/46 operaciones, Swagger 39 paths/51 operaciones; `yamlOnly=[]`, CP `changed=[]` | las 5 operaciones extra son Tenant Registration, añadidas intencionalmente por `deploymentDocument()`; no acredita Txx funcionales; entorno Compose aislado permanece activo |
| Regresión unitaria — expectativa actualizada | `ca2285af1f2dd3881bce4ce4f93ab8c6f3cc29f5` + worktree no confirmado | `npm run test:unit:ci` | PASS | 11 suites, 113/113 pruebas PASS | la actualización 45/50 de `tenant-registration-document.spec.ts` requiere commit; no sustituye Txx específicos |
| Regresión completa | `01f43e264f94590452602c29380f94e1386e4fde` | `npm run prisma:generate`; `npm run build`; `npm run test:unit:ci`; `npm run test:e2e:ci`; `docker compose --profile test run --build --rm test-postgres` | PASS | Prisma Client 5.22.0; build código 0; unitarias 11 suites/113 pruebas; E2E 7 suites/84 pruebas; PostgreSQL sintético 4 migraciones, 9 suites/61 pruebas | las suites generales no acreditan T01–T31 por escenario; T32 es Flutter futuro |
