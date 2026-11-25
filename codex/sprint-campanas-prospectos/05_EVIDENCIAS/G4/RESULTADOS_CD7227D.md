# G4 — Concurrencia, legacy, CSV y aislamiento tenant

- Fecha de validación: 2026-11-22T14:08:46.5947200-08:00 (inicio de la regresión sobre commit).
- Rama: `feat/sprint-campana-prospector`.
- HEAD probado: `cd7227def8eee323cff3df666c25610486ceeb04`.
- Base previa: `46ff79bd3f4730cf7def671b195c602faa8b0801`.
- Entorno: host para build/unitarias/E2E; PostgreSQL 16 desechable mediante Docker Compose profile `test` para pruebas críticas.
- Fixtures: tenants homónimos A/B, propietarios y MEMBER sintéticos, campañas homónimas, prospectos con datos `demo.test`/`synthetic.test`; schemas legacy aislados por UUID. Sin datos reales, JWT ni referencias firmadas adjuntas.
- Cambios: exclusivamente pruebas, registro Jest y manejo de ausencia en `CampaignsService.createActivity`. No se modificaron Auth, RBAC, TenantContext, Users/Tenants, Jobs/Prospector ni migraciones históricas.

## Ejecuciones sobre HEAD confirmado

| ID | Gate | Fecha ISO | HEAD | Comando | Dataset/fixture | Esperado | Observado | Estado | Evidencia | Limitaciones |
|---|---|---|---|---|---|---|---|---|---|---|
| BUILD | G4 | 2026-11-22T14:08:46.5947200-08:00 | `cd7227def8eee323cff3df666c25610486ceeb04` | `npm run build` | TypeScript/NestJS | compilación sin errores | código 0 | PASS | salida de ejecución local | no acredita AC funcionales |
| UNIT | G4 | 2026-11-22T14:08:46.5947200-08:00 | `cd7227def8eee323cff3df666c25610486ceeb04` | `npm run test:unit:ci` | suites Jest | regresión verde | 11 suites; 113/113 | PASS | salida Jest | suite baseline, no todos los AC CP |
| HTTP | G4 | 2026-11-22T14:08:46.5947200-08:00 | `cd7227def8eee323cff3df666c25610486ceeb04` | `npm run test:e2e:ci` | fixtures HTTP existentes | regresión verde | 7 suites; 84/84 | PASS | salida Jest | parte usa dobles; no reemplaza PG |
| PG | G4 | 2026-11-22T14:08:46.5947200-08:00 | `cd7227def8eee323cff3df666c25610486ceeb04` | `docker compose --profile test run --build --rm test-postgres` | PostgreSQL desechable; 4 migraciones; fixtures CP nuevos | regresión y escenarios nuevos verdes | 11 suites; 93/93; sin migraciones pendientes | PASS | suites listadas abajo | no cierra G4 ni acredita escenarios ausentes |

La fecha común identifica el inicio del bloque de validación, no la hora exacta de finalización de cada comando. Se ejecutaron además ESLint dirigido a los cinco archivos TypeScript modificados y `git diff --check` antes del commit, sin errores. Ese control estático se atribuye al worktree previo al commit, no se presenta como ejecución posterior.

## Cobertura específica ejecutada en PostgreSQL

| Test / AC | Archivo | Fixture y aserción observada | Estado del caso | Límite |
|---|---|---|---|---|
| T07 / AC-P1-05 | `test/prospect-identity.postgres-spec.ts` | Barrera de consultas de prueba obliga a dos transacciones reales a alcanzar INSERT con la misma clave normalizada; un éxito, un ConflictException 409; un maestro, una participación, una procedencia CREATED y una actividad ASSOCIATION | PASS | no prueba identidad fuerte desde CSV; fuente limitada al comportamiento google_maps actual, sin resolver G2-O1 |
| T02/T06 / AC-P1-01 | mismo archivo | misma identidad en campañas A1/A2 conserva ID/origen; tenant B obtiene maestro independiente con la misma clave | PASS para identidad/asociaciones | no demuestra aún independencia completa de etapas/evaluación/responsable/historial entre A1/A2 |
| T04 / AC-P1-03, P4 rechazo seguro | `test/prospect-imports.postgres-spec.ts` | dos nombres normalizados coincidentes producen CONFLICT; confirm con decisiones vacías produce REJECTED con explicación; snapshot íntegro sin cambios antes/después; candidateId no admitido | PASS | no equivale a T25 completo (límites/TTL/replay) |
| T28 / conservación legacy | `test/campaign-participation-migration.postgres-spec.ts` | seis prospectos en A/B, asociación preexistente, orígenes sin asociación, duplicados google_maps por campaña, identificadores nulos y origen lógico cross-tenant; cinco participaciones válidas tras migrar; IDs/origen/source/status/timestamps preservados | PASS para fixture | no incluye usuario responsable que pierde membresía ni ensayo de recuperación con nuevas escrituras posteriores |
| T28 / historial e integridad | mismo archivo | cero actividad/procedencia retrospectiva; identidades legacy nulas; duplicados no fusionados; unique histórico y PK de participación siguen rechazando duplicados; Restrict impide borrar historial | PASS | no se fabricó huérfano físico: la FK histórica lo impide; sí se ensayó inconsistencia lógica de tenant |
| T31 / INV-01, INV-02 | `test/campaigns-tenant-isolation.postgres-spec.ts` | 13 operaciones nuevas: sin sesión 401, sin tenant 403, IDs B con sesión A 404; combinaciones campaña A/prospecto B rechazadas; snapshots sin mutaciones | PASS para matriz ejecutada | no es prueba exhaustiva de todas las combinaciones ADMIN/OWNER/MEMBER ni de todas las ramas de resolve |
| T15/T31 / responsable ajeno | mismo archivo | usuario B no elegible en A devuelve 400; sin cambios en los datos | PASS para usuario ajeno | inactivo y retiro de membresía pendientes de prueba específica |
| T31 / P4 | mismo archivo | MEMBER recibe 403 en preview/confirm y match/resolve; campaña ajena 404 en preview; referencia de A usada en B devuelve 400; sin escrituras | PASS para casos ejecutados | validación con JWT sintético conforme al contrato, sin omitir guards ni modificar Auth |
| C3 / T31 | mismo archivo | corrección con actividad de otro tenant devuelve 404; creación local válida devuelve 201, actor/contexto correctos y no afecta actividad B | PASS para creación/ocultación | no acredita todavía todo T13 ni paginación de bitácora |
| C6/C8 / aislamiento | mismo archivo | dashboard de A total=1; filtro AND devuelve solo prospecto A pese a homónimo B | PASS para fixture mínimo | paginación, orden, volumen y distribuciones completas aún pendientes |

## Defecto detectado y corregido

`POST /campaigns/:campaignId/prospects/:prospectId/activities` devolvía 500 ante una participación ausente/ajena porque `findFirstOrThrow` propagaba el error Prisma sin convertirlo al error HTTP de ocultación. Se cambió por `findFirst` y `NotFoundException` explícito dentro de la misma transacción y con los mismos filtros tenant/campaign/prospect. Las aserciones conservaron 404 y verifican ausencia de mutaciones. No fue necesario tocar capas protegidas.

## Historial de iteración (no confundir con el resultado final)

- Primera suite extendida sin HTTP nuevo: 65/65 PASS sobre worktree de `46ff79b`.
- Primera ejecución HTTP: 25 fallos de fixture JWT por ausencia de email; corregido el fixture, sin modificar Auth ni debilitar aserciones.
- Segunda ejecución: 87/90; dos fallos reales 500 en actividades ajenas y una expectativa de fixture incorrecta (preview es 200, no 201).
- Tras corregir el defecto de dominio y el fixture: 93/93 PASS; vuelto a ejecutar sobre `cd7227def8eee323cff3df666c25610486ceeb04` con el mismo resultado.

## Pendientes: G4 NO CERRADO

La afirmación previa de que solo faltaban cuatro bloques era incompleta. Antes de G5 se requiere reconciliar la cobertura de **todas** las AC y T01–T31: flujos positivos y negativos de seguimiento, no-op/reapertura, evaluación con motivo, correcciones append-only, elegibilidad histórica, filtros/paginación, agregados, procedencia y CSV completo. Los casos no identificados en una ejecución trazable permanecen NOT_RUN; los escenarios parciales no se convierten en PASS integral.

- Revisión independiente de esta implementación: NOT_RUN en este bloque.
- Rendimiento con volumen sintético: NOT_RUN.
- Swagger sobre este nuevo SHA: NOT_RUN; la evidencia servida anterior se conserva con su SHA original.
- Compatibilidad UI/cliente y T32: NOT_RUN; Flutter sigue fuera del backend.
- G2-O1 (fuentes/formatos fuertes) permanece abierto según registro del owner.
- Diferencia del manifiesto original en matriz provisional André: sin restaurar ni actualizar huella automáticamente.
- G5 permanece provisional; no hay permiso de push, merge, deploy ni migración remota.
