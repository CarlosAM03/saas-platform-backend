# G4 — QA por SHA y rastreabilidad

**ESTADO: G4 NO CERRADO — CONCLUSIÓN TÉCNICA LISTA PARA REVISIÓN DEL OWNER**

## Revisión técnica final (2026-11-23)

Instrucción del owner: revisión de cobertura, fixtures de roles, aislamiento, migraciones y paridad contractual sobre el candidato exacto antes de aceptar G4. Resultado: **sin hallazgos bloqueantes**. Se resolvieron un hallazgo alto (fixture ADMIN no representativo en `AC-C4-01`) y cuatro medios (sobreafirmación de `AC-P4-04`, estado intermedio de migraciones, dependencia de orden y garantía estructural de `AC-C2-04`), más drift documental de contrato (`409` de `match`, `x-contract-status`, `SortBy` enum, `400/403`). Dos decisiones quedaron escaladas: `G4-O4` (clasificación de `CORRECTION`) y `G4-O5` (enum `MASTER_UPDATE`). Regresión sobre el árbol revisado: build PASS, 177 unitarias, 84 HTTP y **198 PostgreSQL** — **459 pruebas**. Detalle en `REVISION_FINAL_G4_2026-11-23.md` y `CONTRATO_REVISION_FINAL_0d1dd02.md`.

## Ejecución vigente — cierre de brechas por AC (2026-11-23)

Tras la decisión del owner de no aceptar G4 con parciales, se añadieron doce pruebas dirigidas (`AC-C4-01`, `AC-C3-05`, `AC-P4-03`, `AC-P4-07`, `AC-C1-03`, `AC-C2-03`, `AC-C2-04`, `AC-C3-02`, `AC-C3-03`, `AC-C6-04`, `AC-P2-04`, `AC-P3-04`) y se reforzó `AC-P3-02` con el rollback del lote. Cadena completa ejecutada sobre el árbol limpio del SHA `0d1dd02` (pruebas en `30017d9`): build PASS, 177 unitarias, 84 HTTP y **196 PostgreSQL** — **457 pruebas** en 34 suites, 4 migraciones sin pendientes. Contraste por AC: **50 `CUBIERTO` · 0 `CUBIERTO_PARCIAL` · 0 `NO_CUBIERTO`**. Los bloques anteriores (445 y 442 pruebas) quedan como registro histórico. Detalle en `CIERRE_BRECHAS_AC_7A63DFB.md`.

HEAD de código `7a63dfbe1d72b695457cf99b830f186af9b3d2bb` **+ worktree modificado** en `test/campaigns-read-capabilities.postgres-spec.ts`, `test/campaigns-tenant-isolation.postgres-spec.ts`, `test/prospect-read-capabilities.postgres-spec.ts` y `test/prospect-imports.postgres-spec.ts`. Detalle completo en `COBERTURA_AC_Y_CONCURRENCIA_7A63DFB.md`; conclusión para el owner en `CONCLUSION_G4_7A63DFB.md`.

## Ejecución anterior — cierre de parciales y prueba de instantánea (445 pruebas)

Cierre de parciales y verificación post-commit: además del bloque inicial, se añadieron pruebas para `AC-C2-01`, `AC-C4-02` y `AC-C8-04`. La cadena completa se ejecutó de nuevo sobre el árbol de trabajo consolidado y dio build PASS, 177 unitarias, 84 HTTP y **184 PostgreSQL** — **445 pruebas** en 34 suites, 4 migraciones sin pendientes. Esa misma cadena se repitió después sobre el SHA consolidado `9b6017b33383535d05cc72d86e28363241cb7590`, con resultado idéntico: 177/84/184 y 4 migraciones sin pendientes. Antes, sobre el commit documental `d42be1c27be192f0bca8ab36aabaacedc1c00518`, la cadena dio 181 PostgreSQL (442 pruebas). Contraste por AC: **37 `CUBIERTO` · 13 `CUBIERTO_PARCIAL` · 0 `NO_CUBIERTO`** en `MATRIZ_COBERTURA_AC.md`.

HEAD de código `7a63dfbe1d72b695457cf99b830f186af9b3d2bb` **+ worktree modificado** en `test/campaigns-read-capabilities.postgres-spec.ts` y `test/prospect-read-capabilities.postgres-spec.ts`. Detalle completo en `COBERTURA_AC_Y_CONCURRENCIA_7A63DFB.md`; conclusión para el owner en `CONCLUSION_G4_7A63DFB.md`.

| ID | Gate | Fecha | HEAD | Comando | Dataset | Esperado | Observado | Estado | Evidencia |
|---|---|---|---|---|---|---|---|---|---|
| BUILD-CP-AC | G4 | 2026-11-23 | `7a63dfb` + worktree | `npm run build` | árbol del HEAD | compila | código 0 | PASS | `COBERTURA_AC_Y_CONCURRENCIA_7A63DFB.md` |
| UNIT-CP-AC | G4 | 2026-11-23 | `7a63dfb` + worktree | `npm run test:unit:ci` | fixtures unitarios sintéticos | verde | 12 suites, 177/177 | PASS | mismo documento |
| HTTP-CP-AC | G4 | 2026-11-23 | `7a63dfb` + worktree | `npm run test:e2e:ci` | dobles HTTP en memoria | verde | 7 suites, 84/84 | PASS | mismo documento |
| PG-CP-AC | G4 | 2026-11-23 | `7a63dfb` + worktree | `npm run test:postgres` (PG16 desechable) | fixtures sintéticos; 4 migraciones sin pendientes | verde | 15 suites, 184/184 | PASS | mismo documento |
| SNAP-RED | G4 | 2026-11-23 | `7a63dfb` + worktree con `dashboard` secuencial temporal | `npm run test:postgres -- --testPathPatterns=campaigns-read-capabilities -t 'keeps one snapshot'` | 2 participaciones + 1 escritura intercalada | la prueba falla | `Expected: 2`, `Received: 3` en `activity.events` | PASS de sensibilidad | mismo documento |
| LINT-CP-AC | G4 | 2026-11-23 | `7a63dfb` + worktree | `npx eslint`; `npx prettier --check` | dos archivos de prueba modificados | código 0 | código 0 | PASS | mismo documento |

Total funcional vigente: **445 pruebas** (177 + 84 + 184) en 34 suites; las 4 de rendimiento quedan fuera. Los AC quedaron en 37 `CUBIERTO` · 13 `CUBIERTO_PARCIAL` · 0 `NO_CUBIERTO` según `MATRIZ_COBERTURA_AC.md`.

Aclaración de atribución: estos resultados corresponden al **HEAD más el worktree de pruebas**, no a un commit nuevo. La sensibilidad de la prueba del dashboard quedó demostrada; antes de este bloque la aserción `events >= total` habría aceptado una lectura mixta.

## Última ejecución integrada — worktree correctivo final en Node 20

Evidencia vigente de ejecución: `VALIDACION_FINAL_WORKTREE_E2BC927.md`, intervalo `2026-11-22T20:49:01-08:00` a `2026-11-22T20:50:18-08:00`, HEAD base exacto `e2bc9275836b642ac3e2b6086c4c15062b4dcd89` **+ worktree sin commit identificado por SHA256**. Build PASS, 143/143 unitarias, 84/84 HTTP, 127/127 PostgreSQL; 354 pruebas en total. Ejecución independiente real en Node `20.20.2` / npm `10.8.2`, PostgreSQL 16 desechable; migraciones sin pendientes. No se atribuye el resultado al commit aislado ni se declara cumplimiento exhaustivo de AC.

RI08 tiene ahora PASS unitario y PG para los escenarios ejecutados: incorporación nueva vía UPDATE_EXISTING clasificada como reutilizada; origen legacy desconocido preservado; sin LINKED ficticio en relación existente ni duplicación al repetir con nuevo preview. La reproducción roja y la revisión estática independiente permanecen en sus registros históricos.

Lint y formato dirigidos a diez archivos TS modificados: integrador ejecutó `npx eslint` y `npx prettier --check`, ambos código 0 después de correcciones de estilo/tipos en pruebas, registradas en `BLOQUE_CORRECTIVO_E2BC927.md`. Performance conserva la atribución anterior; no se repitió, pues servicio campañas y fixture mantienen los mismos hashes.

**G4 continúa abierto** por capacidades C6/P2/P3/representación de elegibilidad y aclaración D06/G4-O3. G5 sigue provisional; G6 no aceptado por owner; T32 NOT_RUN, reservado al frontend. No hubo push, merge, deploy ni migración remota.

## Sincronización del candidato e2bc927 — 2026-11-22

HEAD: `e2bc9275836b642ac3e2b6086c4c15062b4dcd89`. QA independiente ejecutó build PASS, 115/115 unitarias y 84/84 HTTP; PostgreSQL quedó inicialmente BLOCKED por Docker Desktop no disponible. Ver `REGRESION_E2BC927.md` para comandos, fecha y límites. Después el integrador inició Docker Desktop local y ejecutó el comando PG autorizado: 11 suites, 98/98 PASS, cuatro migraciones aplicadas sobre la base desechable del perfil `test`. Ese resultado complementa, no borra, el bloqueo inicial. La imagen contiene el código funcional del candidato anterior a las correcciones; cambios documentales concurrentes no heredan cobertura funcional.

Revisión independiente y contrato detectaron defectos adicionales pese a la regresión verde: `REVISION_INDEPENDIENTE_E2BC927.md` y `CONTRATO_E2BC927.md`. G4 **no está aprobado**. Se abrió bloque correctivo con pruebas dirigidas antes de cada arreglo; sus resultados se atribuirán a HEAD + worktree, no al candidato inmutable.

T25: el test agregado en `1aa5924` ya se ejecutó en QA; usa reloj simulado y rechaza exactamente en el límite de quince minutos. No se exige una espera real como requisito adicional del SPEC. Esto no sustituye otras aserciones de parser/snapshot/replay ni cierra por sí solo todos los AC.

Los encabezados “final”, “actual” y “más reciente” de los apartados siguientes corresponden al registro histórico de sus SHAs; no deben interpretarse como el estado vigente.

### Validación independiente del bloque correctivo (worktree, no nuevo commit)

`VALIDACION_CORRECCIONES_E2BC927.md` registra la ejecución independiente del `2026-11-22T20:42:55-08:00` al `2026-11-22T20:45:17-08:00`: build PASS, 141/141 unitarias, 84/84 HTTP, 126/126 PostgreSQL (13 suites), 4/4 pruebas de rendimiento dirigidas. El manifiesto SHA256 inicial/final del worktree está en ese documento; **no se atribuyen estos resultados al commit e2bc927 aislado ni a modificaciones posteriores**.

Rendimiento descriptivo sobre 5,000 participaciones de campaña: medianas de cinco muestras de filtro combinado 584.186 ms, página profunda 46.668 ms y dashboard 245.296 ms; sin SLA ni equivalencia productiva. Dataset total: 6,000 maestros, 7,667 participaciones, 18,000 actividades y 5,001 procedencias, dos tenants. No basta para certificar las capacidades C6 aún ausentes.

La segunda revisión encontró RI08 (UPDATE_EXISTING CSV crea participación sin procedencia LINKED). Se abrió reproducción y corrección dirigida posterior a esta corrida; el PASS general no resuelve ese camino. C6/P2/P3/representación de elegibilidad y D06 continúan pendientes, G4 abierto, G5 provisional. T32 permanece NOT_RUN de frontend.

## Resultado final de regresión — 2026-11-22

HEAD probado: `71ef72d95537b12713dc81bb91b6abd03018df1c`. Build PASS, unitarias 114/114, E2E 84/84 y PostgreSQL 98/98.

| ID | Comando | Resultado | Limitación |
|---|---|---|---|
| BUILD-71EF | `npm run build` | PASS código 0 | no acredita AC funcionales |
| UNIT-71EF | `npm run test:unit:ci` | 11 suites, 114/114 PASS | incluye parser CSV de 5 MB/1000 filas |
| HTTP-71EF | `npm run test:e2e:ci` | 7 suites, 84/84 PASS | regresión HTTP sintética |
| PG-71EF | `docker compose --profile test run --build --rm test-postgres` | 11 suites, 98/98 PASS | PG desechable; no acredita TTL 15 min ni revisión independiente |

Casos ejecutados por primera vez sobre este bloque: T01, T03, T05, T08, T16, T18 y T20. T25 permanece PARCIAL porque no se midió el TTL completo de 15 minutos. T32 permanece NOT_RUN fuera del backend. G4 no se declara cerrado hasta revisión independiente y medición de rendimiento.

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
