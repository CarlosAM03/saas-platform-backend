# QA independiente — correcciones en worktree

## Atribución y método

- Intervalo ISO observado: `2026-11-22T20:42:55.6161313-08:00` a `2026-11-22T20:45:17.4330879-08:00`.
- HEAD inicial/final verificado: `e2bc9275836b642ac3e2b6086c4c15062b4dcd89`; rama inicial conocida `feat/sprint-campana-prospector`.
- **Resultados del HEAD + worktree correctivo sin commit**, no del commit aislado. Hashes funcionales/de pruebas iguales al inicio y al corte, abajo.
- Host: Node `v22.14.0`, npm `10.9.2`; engines declara `20.x`. PG construyó con imagen `node:20-bookworm-slim`; no se afirma versión patch del contenedor.
- Skills aplicadas: sprint-evidence, sprint-pg-rehearsal, sprint-tenant-isolation. Objetivos: matriz AC y SPEC §9 leídos en la sesión.
- Secuencia ejecutada sin paralelismo: build → unit → E2E → PG → performance dirigido, este último únicamente después del PASS PG. Integrador informó que no había otros PG corriendo; no se atribuye esa declaración a una comprobación independiente.
- Auditor no editó implementación, tests, configuración, Prisma, migraciones, evidencia previa ni gates. Única escritura de este bloque: este archivo.

Se conserva intacto `REGRESION_E2BC927.md`: su primer intento PG quedó BLOCKED por ausencia del motor Docker. El PASS actual, una vez iniciado Docker por integrador, es una ejecución posterior; no convierte retroactivamente el bloqueo histórico en PASS. RED/baseline comunicados por integrador son contexto, no ejecuciones certificadas por este auditor.

## Seguridad y fixture

Compose inspeccionado en la sesión: profile `test`, `test-db` PostgreSQL16 sobre `tmpfs`, `test-postgres` con dependencia exclusiva del test-db y entorno test. No se usó base remota, producción ni `saas_local`. En esta corrida el contenedor test-db ya existía, desechable; Prisma encontró cuatro migraciones y **ninguna pendiente**, no cuatro migraciones recién aplicadas por este comando. La suite de migración hace sus propios ensayos aislados.

Logs HTTP JSON omitidos y líneas potencialmente sensibles filtradas en PowerShell, conservando `$LASTEXITCODE`. Los resúmenes siguientes no incluyen secretos, identidades, CSV ni datos reales. `System.Management.Automation.RemoteException` apareció como representación del stream stderr de PowerShell; Jest y proceso reportaron éxito, código cero. No es una aserción fallida.

## Resultados ejecutados

En la tabla, SHA = `e2bc9275836b642ac3e2b6086c4c15062b4dcd89` **más manifiesto worktree abajo**, fecha = intervalo ISO de este documento, gate G4. Cada fila tiene esperado/observado y limitación; fecha individual de inicio no capturada.

| ID / Txx / AC | Gate | Fecha ISO | HEAD | Comando | Dataset/fixture | Esperado | Observado | Resultado | Evidencia | Limitaciones |
|---|---|---|---|---|---|---|---|---|---|---|
| BUILD | G4 | 2026-11-22T20:42:55-08:00 / 20:45:17-08:00 | e2bc9275836b642ac3e2b6086c4c15062b4dcd89 + WT | `npm run build` | árbol correctivo | compilación exitosa | `nest build`, código 0 | PASS | salida ejecución QA | host Node22 |
| UNIT / RI06 / P4 | G4 | mismo intervalo | mismo SHA + WT | `npm run test:unit:ci` | mocks/fixtures unitarios sintéticos | suite completa verde | 12 suites, 141 tests PASS, 5.152 s | PASS | resumen Jest | no sustituye PG |
| HTTP / regresión | G4 | mismo intervalo | mismo SHA + WT | `npm run test:e2e:ci` | fixtures HTTP/doubles | suite completa verde | 7 suites, 84 tests PASS, 13.869 s; código 0 | PASS | resumen Jest sanitizado | HTTP D02 nuevo está en suite PG, no aquí |
| PG / T01–T31 cubiertos por suites / RI01–RI07 | G4 | mismo intervalo | mismo SHA + WT | `docker compose --profile test run --build --rm test-postgres` | fixtures sintéticos PG16; migraciones en schemas aislados | suite configurada completa verde | 13 suites, 126 tests PASS, 20.936 s; código 0; cuatro migraciones conocidas sin pendientes | PASS | resumen Jest y suites enumeradas abajo | no certifica toda combinación AC ni escenarios ausentes |
| PERF / T17–T20 / C6,C8,tenant | G4 | mismo intervalo | mismo SHA + WT | `docker compose --profile test run --build --rm test-postgres npm run test:postgres -- --testRegex 'campaigns-performance[.]postgres-spec[.]ts$'` | 2 tenants homónimos, 3 campañas, 6000 maestros, 7667 participaciones, 18000 actividades, 5001 procedencias | oráculos de conteo/orden/agregación/tenant conformes y tiempos descriptivos | 1 suite, 4 tests PASS, 15.528 s; código 0 | PASS | JSON G4_PERF y `test/campaigns-performance.postgres-spec.ts:264–420` | sin SLA, sin equivalencia a producción ni caché fría garantizada |
| RI08 / P4,P3,C8 | G4 | mismo intervalo | mismo SHA + WT | ninguno dirigido | UPDATE_EXISTING CSV hacia asociación nueva | clasificar incorporación como reutilización cuando corresponde | reporte estático del revisor recibido; no reproducido por auditor | NOT_RUN | pendiente del integrador descrito abajo | regresión verde no resuelve este escenario |

### Conteos y suites PG

Configuración `test/jest-postgres.json:6` incluye las dos suites review nuevas y excluye performance por defecto. Jest ejecutó y reportó PASS en:

1. campaigns-tenant-isolation
2. users-authorization
3. campaigns-review-regressions
4. jobs
5. tenant-registration
6. prospect-review-regressions
7. onboarding-http
8. prospect-imports
9. prospect-identity
10. core-isolation
11. campaign-participation-migration
12. proxy-rate-limit
13. tenant-registration-migration

Sufijo común: `.postgres-spec.ts`. Total independiente: 141 unitarias + 84 HTTP + 126 PG = **351**; performance separado = **4**, suma de invocaciones **355 tests**. No se afirma que todos sean escenarios funcionales únicos ni 355 casos del SPEC. El baseline 98 informado por integrador no se cuenta como una ejecución adicional de QA. Frente a la corrida inicial del auditor: U pasa de 115/11 suites a 141/12; H se mantiene 84/7; PG anterior no ejecutado, ahora 126/13.

### Nuevos casos inspeccionados después del PASS

- **D02 HTTP real sobre PG:** `test/campaigns-tenant-isolation.postgres-spec.ts:260–284`, ejecutado en la suite verde. POST manual con coincidencia débil devuelve 409; `success=false`, `error.code=CONFLICT`, mensaje no genérico, `details.reason=PROSPECT_MATCH_REQUIRES_DECISION`, candidatos exclusivamente locales y snapshot persistente inalterado. No es solo una prueba del servicio ni se atribuye al E2E con doubles.
- **CSV RI06:** `test/prospect-imports.postgres-spec.ts:139–209`, ejecutado: preview MATCH sin procedencia; CREATE expreso produce ID distinto; maestro candidato y participación CERRADO preservados; contexto nuevo SIN_GESTIONAR/SIN_EVALUAR/sin responsable; una procedencia CREATED/csv con actor, resolución CREATE y candidateIds; una actividad; repetición exige nuevo preview sin otro maestro.
- Review prospectos `:190,217,269,320,355,374`: candidato fuerte único sin nombre débil, decisión CREATE durable, identidad fuerte ajena oculta, revalidación de carrera legacy, CREATE no evade fuerte previa y concurrencia fuerte con un commit/409.
- Review campañas `:281,303,340,377,439,471,509,530`: mutaciones simultáneas idénticas/distintas, 404 sin mutación, pérdida de membresía, y clasificación de incorporación sin usar PATCH/reaparición/otra campaña como falsa prueba de origen.
- **T28:** suite `campaign-participation-migration` ahora sí ejecutada PASS; dataset legacy sintético y aserciones inspeccionados en reporte anterior. No se extiende su alcance a reporte de colisiones/huérfanos que no se haya certificado.
- **T31:** suite PG de homónimos ahora ejecutada PASS junto con D02 y rutas existentes; no se afirma auditoría exhaustiva de cada endpoint/permiso por todas las combinaciones posibles.
- **T25:** unitarias ejecutadas nuevamente; se conserva valoración previa: reloj simulado es evidencia válida de 15 minutos, sin obligación artificial de esperar tiempo real. Replay/atomicidad incluidos en suite PG verde; fronteras temporales adicionales no se inventan como ejecutadas.

## Performance: JSON observado, sin SLA

```json
{"tenants":2,"campaigns":3,"masters":6000,"primaryParticipations":5000,"totalParticipations":7667,"activities":18000,"provenance":5001,"seedMs":2202.407}
```

```json
[{"label":"filter_page_1","samples":5,"valuesMs":[580.087,578.968,584.186,614.805,597.926],"firstMs":580.087,"minMs":578.968,"medianMs":584.186,"maxMs":614.805},{"label":"unfiltered_page_100","samples":5,"valuesMs":[55.574,52.153,46.32,46.668,46.35],"firstMs":55.574,"minMs":46.32,"medianMs":46.668,"maxMs":55.574},{"label":"dashboard_5000","samples":5,"valuesMs":[285.271,245.528,226.197,245.296,235.693],"firstMs":285.271,"minMs":226.197,"medianMs":245.296,"maxMs":285.271}]
```

La fixture verifica destino autorizado y limpia únicamente sus IDs aleatorios. Oráculos: AND global y paginación estable completa, offset página100, dashboard de 5000 con sumas exactas y actividad no multiplicada, tenant B homónimo y accesos cruzados 404. Timeout del arnés no es SLA; tiempos locales son observaciones, no garantía de latencia. El comando performance sustituye el comando por defecto, no despliega migraciones otra vez: se ejecutó tras PG exitoso y migraciones verificadas.

## Manifiesto SHA256 worktree (inicio = corte)

No se sustituye el SHA Git por estos hashes; juntos identifican los archivos no committeados ejecutados. Rutas relativas al repositorio:

| Archivo | SHA256 |
|---|---|
| src/campaigns/campaigns.service.ts | CF8E7933D96F1452F2888DC7B8CDC99189919B3777D3BBAC82F076256BD5FED5 |
| src/prospects/prospects.service.ts | D1B4D99A2DE516DDCF05BF985EE43CC2D021A9BF1045777294E322B00F466A8E |
| src/prospects/imports/prospect-imports.service.ts | 3F1D9E0C9610CB426FE453BA92AB55647CD215E3F3F99AC8ABB6B4F67D73B592 |
| src/prospects/imports/prospect-imports.service.spec.ts | A14BEC84D63E847BCFF7B177BD107A6CFB4B6F9AD5BC2FC93F57787A7E3A07EF |
| Docs/Contracts/platform-api.v1.yaml | 6C3DDB6D301428C71B80593495C8E6478ADF90311B3439CCCFBB9AFA5A2DAB35 |
| src/common/openapi/cp-document.spec.ts | D0600B848476BEB6BD759E241A676BAB07EFB37845A41B79D26027F25D08C5FC |
| test/campaigns-tenant-isolation.postgres-spec.ts | BCB950F45502996D7030894072BF032417E7FA85F19F1B2B933C237D2935AB14 |
| test/prospect-imports.postgres-spec.ts | 8C598AB4160438F104148AA98E9B4D8D108AA1D7CA5A38CCC97789DAFBAA1DE1 |
| test/jest-postgres.json | DAF46755062DF2AE432A91FC76DD1F092AFD39F4A4E56FCE4E9CE6ADB7456D6B |
| test/prospect-review-regressions.postgres-spec.ts | 191280E49AAF82EC338045EB673DBA5C0BD7512AD39EA9E0C6EDFE2355214224 |
| test/campaigns-review-regressions.postgres-spec.ts | 69AE85FF3DCBE766F68F45DC94405F94A971C32B2F64528BEDC8823978C500D1 |
| test/campaigns-performance.postgres-spec.ts | 7EB8F618AC9ABDF7CC9AB753CA31EFA54661F3FD6676BC8252F80AC6C2DAD489 |

Snapshot inicial también incluyó schema/migraciones, sin cambios funcionales reportados en esas rutas. Cambios documentales ajenos observados: G3/DIARIO_IMPLEMENTACION, G4/MATRIZ_QA, G5/HANDOFF, G6/REVISION_OWNER, decisiones/SOLICITUDES_OWNER; documentos nuevos G4/BLOQUE_CORRECTIVO, CONTRATO_CORRECCIONES, CONTRATO, INICIO_VALIDACION y REVISION_INDEPENDIENTE con sufijo E2BC927, además de la evidencia previa REGRESION. No se modificaron ni se incorporaron como resultados propios.

## Pendientes y riesgos residuales por severidad

1. **Alta de certificación:** G4 permanece abierto; C6, P2, P3, eligible y D06 siguen como alcance pendiente indicado por integrador. El performance aporta cobertura parcial C6/C8, no borra ni cierra esos pendientes.
2. **Media, RI08 NOT_RUN:** revisor reportó estáticamente que UPDATE_EXISTING CSV hacia participación nueva emite MASTER_UPDATED + ASSOCIATION pero no LINKED; dashboard exige CREATED/LINKED contextual y podría contar unknownLegacy en vez de reused. Fuentes afectadas: `src/prospects/imports/prospect-imports.service.ts` y `src/campaigns/campaigns.service.ts`; no se adjudica línea exacta ni fallo reproducido que el auditor no comprobó. Integrador/implementación deben agregar reproducción PG y corrección, luego QA dirigida; no se necesita repetir toda regresión documental si el alcance se delimita por hashes. La suite verde actual **no resuelve RI08**.
3. **Media:** evidencia pertenece a worktree sin commit. Cualquier cambio posterior requiere nueva atribución/hashes y pruebas dirigidas pertinentes; no presentar estos PASS como código idéntico al commit e2bc927 aislado.
4. **Media/baja de entorno:** build/U/H corrieron en Node22 fuera de engines20; PG corrió sobre imagen Node20. No se certifica build/U/H en Node20 con esta corrida.
5. **Baja de medición:** cinco muestras locales por operación, sin SLA aprobado ni representatividad productiva. Sin declaración de rendimiento suficiente.

No hubo FAIL de comando ni aserción en esta secuencia. PASS ejecutados se conservan con sus límites; NOT_RUN y pendientes permanecen explícitos. Sin cierre de G4, merge, deploy ni migración productiva.
