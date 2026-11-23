# QA independiente — regresión final en Node20 y RI08

## Identidad de ejecución

- Inicio ISO: `2026-11-22T20:49:01.0838720-08:00`; corte: `2026-11-22T20:50:18.5068032-08:00`.
- HEAD inicial y final: `e2bc9275836b642ac3e2b6086c4c15062b4dcd89`.
- Atribución obligatoria: **HEAD + worktree correctivo sin commit**, identificado por SHA256 inicial/final abajo. No son resultados del commit aislado.
- Ejecución completa en imagen development `node:20-bookworm-slim`; comprobación adicional de versión en la misma imagen local: **Node v20.20.2 / npm 10.8.2**. Satisface engines `20.x`; no se alteró configuración del host Node22.
- Auditor no editó código, pruebas, configuración, schema, migraciones ni evidencia anterior; única escritura de este bloque: este documento. Sin Git de escritura ni cierre de gates.
- Fuentes: SPEC §9, matriz AC y skills sprint-evidence/sprint-pg-rehearsal/sprint-tenant-isolation ya leídas en esta sesión. RED de RI08 informado por integrador se conserva como contexto ajeno, no como ejecución independiente propia.

## Seguridad verificada antes de ejecutar

Se volvió a leer `compose.yml:68–96`: `test-db` usa PostgreSQL16, profile test y `tmpfs`; `test-postgres` depende exclusivamente de esa base y fija entorno de prueba. El comando sustituye el command del servicio, no sus variables/destino. Solo fixtures sintéticos, sin acceso remoto, producción o `saas_local`. `Dockerfile:1` fija Node20 para development.

El test-db ya estaba iniciado. El paso de migraciones vio **cuatro migraciones conocidas y ninguna pendiente**; no se reportan cuatro aplicaciones nuevas a public. La suite legacy ejecuta sus ensayos aislados. Integrador informó ausencia de otros PG ejecutando; el auditor ejecutó sus comandos secuencialmente.

Salida filtrada para omitir JSON HTTP y líneas potencialmente sensibles; se conservó código real `$LASTEXITCODE`. No se adjuntan secretos ni datos reales. Las líneas `System.Management.Automation.RemoteException` son representación stderr de PowerShell: no hubo test fallido, y el comando completo terminó en código cero.

## Comando completo ejecutado

```text
docker compose --profile test run --build --rm test-postgres sh -c 'npm run build && npm run test:unit:ci && npm run test:e2e:ci && npm run prisma:migrate:deploy && npm run test:postgres'
```

La cadena usa `&&`: todos los pasos se alcanzaron y concluyeron exitosamente. Código final observado: `QA_EXIT_CODE=0`.

## Registro por resultado

SHA completo común: `e2bc9275836b642ac3e2b6086c4c15062b4dcd89` **+ manifiesto WT**. Fecha común: intervalo ISO indicado arriba, no horas individuales de inicio inventadas. Los comandos internos se ejecutaron exclusivamente dentro del contenedor del comando completo.

| ID / Txx | AC / alcance | Gate | Fecha ISO | HEAD | Comando interno | Dataset/fixture | Esperado | Observado | Resultado | Evidencia | Limitaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BUILD | compilación | G4 | 2026-11-22T20:49:01-08:00 / 20:50:18-08:00 | SHA común + WT | `npm run build` | árbol correctivo | compila sin error | `nest build`, continúa cadena | PASS | salida ejecutada | no certifica deploy |
| UNIT | regresión, P4, contratos | G4 | mismo intervalo | mismo SHA + WT | `npm run test:unit:ci` | fixtures unitarios sintéticos | todas conformes | 12 suites; **143/143 tests**; 3.113 s | PASS | resumen Jest | sin equivalencia a persistencia real por sí sola |
| HTTP | regresión HTTP | G4 | mismo intervalo | mismo SHA + WT | `npm run test:e2e:ci` | HTTP con doubles | todas conformes | 7 suites; **84/84 tests**; 10.816 s | PASS | resumen Jest | HTTP real PG se certifica en paso PG |
| MIGRACIONES | prerrequisito PG | G4 | mismo intervalo | mismo SHA + WT | `npm run prisma:migrate:deploy` | PG16 test-db local | estado compatible y sin errores | cuatro migraciones encontradas, ninguna pendiente | PASS | salida Prisma sanitizada | no demuestra por sí solo T28; ese ensayo está en suite PG |
| PG | regresión PG, T28/T31 y review | G4 | mismo intervalo | mismo SHA + WT | `npm run test:postgres` | fixtures PG16 sintéticos y schemas aislados | suite configurada completa verde | 13 suites; **127/127 tests**; 20.933 s | PASS | resumen Jest y lista abajo | no convierte escenarios ausentes en cubiertos |
| RI08 unit nuevo/existente | P4/P3/C8 | G4 | mismo intervalo | mismo SHA + WT | `npm run test:unit:ci` | `it.each([false,true])` | LINKED solo con asociación nueva | ambos casos incluidos en suite PASS | PASS | `src/prospects/imports/prospect-imports.service.spec.ts:154–182` | mocks complementados por PG siguiente |
| RI08 PG nuevo/existente/repetición | P4/P3/C8 | G4 | mismo intervalo | mismo SHA + WT | `npm run test:postgres` | maestro legacy, campaña origen/destino | reused en destino nuevo; origen legacy intacto; sin doble asociación/LINKED | caso incluido en suite PASS | PASS | `test/prospect-imports.postgres-spec.ts:214–324` | alcance concreto descrito abajo |
| PERF | C6/C8 volumen | G4 | mismo intervalo | mismo SHA + WT | no repetido por instrucción | fixture previa | conservar atribución anterior | no hubo nueva medición | NOT_RUN | `VALIDACION_CORRECCIONES_E2BC927.md` contiene PASS anterior y JSON | no trasladar tiempos a nueva corrida ni confundir con nuevo PASS |
| LINT | estilo | G4 | mismo intervalo | mismo SHA + WT | no ejecutado por auditor | no aplica | no aplica | integrador informó lint dirigido código0 | NOT_RUN | declaración del integrador solamente | no se certifica ejecución propia |

Total esta regresión: **354 tests** (143 + 84 + 127), 32 suites entre tres invocaciones; cero FAIL reportados. Diferencia respecto al bloque QA previo: +2 unitarios RI08 y +1 PG RI08; HTTP conserva84. Las cuatro pruebas performance anteriores no se agregan a este total.

PG reportó PASS en `campaigns-tenant-isolation`, `users-authorization`, `campaigns-review-regressions`, `jobs`, `tenant-registration`, `prospect-imports`, `prospect-review-regressions`, `onboarding-http`, `prospect-identity`, `core-isolation`, `campaign-participation-migration`, `proxy-rate-limit` y `tenant-registration-migration` (sufijo común `.postgres-spec.ts`). Configuración continúa seleccionando13 suites.

Comprobación adicional ejecutada después de regresión:

```text
docker compose --profile test run --rm --no-deps test-postgres sh -c 'node --version && npm --version'
v20.20.2
10.8.2
```

## RI08: revisión de fuente y aserciones ejecutadas

### Fuente

`src/prospects/imports/prospect-imports.service.ts:176–192` consulta asociación y hace upsert sin reiniciar contexto. En `:243–274`, UPDATE_EXISTING registra MASTER_UPDATED; **solo si no existía asociación**, agrega procedencia LINKED con tenant/campaña/maestro/source csv/actor y una actividad ASSOCIATION. Las operaciones permanecen en la transacción de confirmación. No se modificó fuente por QA.

### Unitarios

`src/prospects/imports/prospect-imports.service.spec.ts:154–182` parametriza asociación ausente/presente. Confirma UPDATE_EXISTING y SKIP; verifica MASTER_UPDATED, cantidad LINKED 1/0 y actividades1/0. Ambos escenarios se ejecutaron en las143 pruebas verdes.

### PostgreSQL real

`test/prospect-imports.postgres-spec.ts:214–324` ejecutado dentro de las127 pruebas verdes:

1. Maestro y participación legacy en origen; preview MATCH hacia campaña nueva.
2. UPDATE_EXISTING confirma `summary.updated=1`.
3. Dashboard destino: `{new:0,reused:1,unknownLegacy:0}`; origen: `{new:0,reused:0,unknownLegacy:1}`.
4. LINKED destino exactamente1.
5. UPDATE sobre asociación legacy ya presente mantiene unknownLegacy1 en origen y LINKED origen0.
6. Nuevo preview y otra confirmación en destino no duplican LINKED ni ASSOCIATION: ambos permanecen1.
7. Un solo maestro y `campaignId` de origen intacto.

RI08 pasa de **NOT_RUN** en la evidencia anterior a **PASS para estos escenarios en esta nueva ejecución**, sin reescribir el registro histórico. No se afirma haber ejecutado personalmente el RED anterior del integrador. El test PG no compara todos los campos de la participación origen ni valida por sí solo cada payload MASTER_UPDATED; esas limitaciones no invalidan las aserciones efectivamente ejecutadas.

D02 HTTP PG y CSV RI06 permanecen incluidos en suites verdes: sus aserciones fueron inspeccionadas en `VALIDACION_CORRECCIONES_E2BC927.md`, con archivo `campaigns-tenant-isolation` de hash idéntico. No se necesita atribuir el caso D02 a la suite HTTP de doubles.

## Manifiesto worktree SHA256

Hashes iguales al inicio y al corte; rutas relativas. Cualquier cambio posterior requiere atribución y selección de pruebas nuevas. Este manifiesto identifica source/tests/configuración de alcance inspeccionados, no declara árbol limpio ni commit nuevo.

| Archivo | SHA256 |
|---|---|
| compose.yml | 28842F2B63511ADA5999F274DBE4B5241A06A61C5BDC93D63E4B57D1951A5CBC |
| Dockerfile | 1B12F3CB965FB186DC778AD166004D7577D3056D1959C5BD0F78307B7CA80902 |
| package.json | 3F0945FA38F63888FCED4BFDBD82C55B7B9071DA70C88BEBF015D936C30D43D5 |
| src/campaigns/campaigns.service.ts | CF8E7933D96F1452F2888DC7B8CDC99189919B3777D3BBAC82F076256BD5FED5 |
| src/prospects/prospects.service.ts | D1B4D99A2DE516DDCF05BF985EE43CC2D021A9BF1045777294E322B00F466A8E |
| src/prospects/imports/prospect-imports.service.ts | 85414348B5890DB9730774C76FA678FF429BBC31643010EEF38A60D19CB66D2F |
| src/prospects/imports/prospect-imports.service.spec.ts | EBF5344E68C561AC27CB9F05C4D0FE5B02DD6B7DC6D98842B7813032AD73645A |
| Docs/Contracts/platform-api.v1.yaml | 6C3DDB6D301428C71B80593495C8E6478ADF90311B3439CCCFBB9AFA5A2DAB35 |
| src/common/openapi/cp-document.spec.ts | BC16EFCD09E8128DA8695C447BB5E3962F87E1ABDBED81F8D2D1E57C80B66D6C |
| test/campaigns-tenant-isolation.postgres-spec.ts | BCB950F45502996D7030894072BF032417E7FA85F19F1B2B933C237D2935AB14 |
| test/prospect-imports.postgres-spec.ts | 56238DC2AFA6373C25A66B26CB0BA4CBCF237DA259AF32C4D530BFC3994FE0FB |
| test/jest-postgres.json | DAF46755062DF2AE432A91FC76DD1F092AFD39F4A4E56FCE4E9CE6ADB7456D6B |
| test/prospect-review-regressions.postgres-spec.ts | 191280E49AAF82EC338045EB673DBA5C0BD7512AD39EA9E0C6EDFE2355214224 |
| test/campaigns-review-regressions.postgres-spec.ts | 69AE85FF3DCBE766F68F45DC94405F94A971C32B2F64528BEDC8823978C500D1 |
| test/campaigns-performance.postgres-spec.ts | 7EB8F618AC9ABDF7CC9AB753CA31EFA54661F3FD6676BC8252F80AC6C2DAD489 |

`campaigns.service.ts` y performance fixture mantienen exactamente los hashes de la medición previa; se conserva esa atribución sin volver a correr performance ni inventar tiempos actuales. El YAML conserva hash. El test contractual cambió respecto al bloque anterior; se ejecutó en suite unitaria PASS, sin certificar lint por referencia ajena.

## Riesgos residuales por severidad

1. **Alta de certificación:** G4 no se cierra. Pendientes C6/P2/P3/eligible/D06 previamente indicados requieren decisión/evidencia del integrador; una regresión verde no es prueba de exhaustividad por AC/endpoint ni autorización de liberación.
2. **Media de trazabilidad:** resultados corresponden a worktree sin commit. No presentarlos como validación del commit e2bc927 aislado; conservar manifiesto y revalidar cambios posteriores.
3. **Baja de alcance:** RI08 cubre las aserciones detalladas, no toda combinación CSV/concurrencia posible; performance no repetido y lint no ejecutado por QA en este bloque.

La diferencia Node22/engines20 del bloque anterior queda atendida para esta regresión mediante ejecución real de build/U/H/PG en Node20, sin borrar los resultados históricos. No se detectaron fallos funcionales en los354 tests ejecutados. Sin cierre de gates, merge, deploy o migración productiva.
