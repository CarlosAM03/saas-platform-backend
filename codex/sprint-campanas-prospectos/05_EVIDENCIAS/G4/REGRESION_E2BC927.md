# Regresión independiente — e2bc927

- Fecha ISO de inicio: `2026-11-22T20:28:24.4665594-08:00`; corte: `2026-11-22T20:29:20.6303196-08:00`.
- HEAD verificado al inicio y al corte mediante `git rev-parse HEAD`: `e2bc9275836b642ac3e2b6086c4c15062b4dcd89`.
- Rama: `feat/sprint-campana-prospector`. Referencia de implementación proporcionada por integrador: `1aa592490e3c5f40e75b8314155f01f104640740`; no se reemplaza la atribución al HEAD ejecutado.
- Fuentes leídas: matriz operacional AC y SPEC §9 (T01–T31); skills sprint-evidence, sprint-pg-rehearsal y sprint-tenant-isolation.
- Entorno ejecutado: Windows, Node `v22.14.0`, npm `10.9.2`. `package.json:8-9` exige Node `20.x`: diferencia de entorno registrada, sin cambiar configuración. No se certifica Node 20.
- Auditor no modificó código, pruebas, configuración, Prisma, migraciones, matriz QA ni gates. Este archivo es su única escritura.

## Seguridad y worktree

Se inspeccionó `compose.yml` antes de Docker: `test-db` usa `postgres:16`, profile `test`, almacenamiento `tmpfs` (líneas 68–81). `test-postgres` depende solamente de `test-db`, fija entorno de prueba y ejecuta migraciones y suite PG dentro del contenedor (83–96). No se ejecutó contra `db`/`saas_local`, remotos o producción. No se imprimen URLs, credenciales ni logs de autenticación en esta evidencia.

Worktree inicial limpio. En el corte se observaron cambios documentales concurrentes del integrador, sin atribuirlos al auditor:

- M `05_EVIDENCIAS/G3/DIARIO_IMPLEMENTACION.md`
- M `05_EVIDENCIAS/G5/HANDOFF.md`
- M `05_EVIDENCIAS/G6/REVISION_OWNER.md`
- ?? `05_EVIDENCIAS/G4/INICIO_VALIDACION_E2BC927.md`

Los prefijos son `codex/sprint-campanas-prospectos/`. Este registro se agrega después del corte. El ensayo de rendimiento temporal de datos no forma parte de las suites aquí ejecutadas.

Verificación final posterior a escribir este archivo: HEAD permanece idéntico. Además apareció `?? 05_EVIDENCIAS/G4/REVISION_INDEPENDIENTE_E2BC927.md`, documento concurrente ajeno a este auditor; no se modificó ni se incorporaron sus resultados.

## Ejecución en orden

En todas las filas: gate G4, fecha de esta sesión y HEAD completo indicado arriba; resultados independientes de evidencias anteriores, que no se invalidan ni sustituyen.

| ID | Gate | Fecha ISO | HEAD | Comando | Dataset/fixture | Esperado | Observado | Resultado | Evidencia | Limitaciones |
|---|---|---|---|---|---|---|---|---|---|---|
| BUILD | G4 | 2026-11-22T20:28:24-08:00 / 20:29:20-08:00 | e2bc9275836b642ac3e2b6086c4c15062b4dcd89 | `npm run build` | árbol del HEAD | compilación sin error | `nest build`, salida exitosa | PASS | salida del comando en sesión QA | Node 22, no Node 20 |
| UNIT | G4 | 2026-11-22T20:28:24-08:00 / 20:29:20-08:00 | e2bc9275836b642ac3e2b6086c4c15062b4dcd89 | `npm run test:unit:ci` | fixtures unitarios sintéticos | todas las pruebas conformes | 11/11 suites, 115/115 tests; 4.887 s | PASS | resumen Jest ejecutado | sin PG; no se generó porcentaje de cobertura |
| HTTP | G4 | 2026-11-22T20:28:24-08:00 / 20:29:20-08:00 | e2bc9275836b642ac3e2b6086c4c15062b4dcd89 | `npm run test:e2e:ci` | fixtures HTTP sintéticos/doubles | todas las pruebas conformes | 7/7 suites, 84/84 tests; 12.909 s | PASS | resumen Jest ejecutado | no acredita persistencia PG; logs adjuntos omitidos por minimización |
| PG | G4 | 2026-11-22T20:28:24-08:00 / 20:29:20-08:00 | e2bc9275836b642ac3e2b6086c4c15062b4dcd89 | `docker compose --profile test run --build --rm test-postgres` | PG16 desechable configurado, fixtures sintéticos previstos | construir, migrar y ejecutar suite PG | Docker no logra contactar motor; código 1 antes de iniciar PG | BLOCKED | error exacto abajo | ninguna prueba PG ni migración de esta corrida llegó a ejecutarse |

La fecha de cada fila es el intervalo auditado, no una hora individual de inicio inventada. El comando Docker se envolvió en PowerShell para omitir líneas potencialmente sensibles y preservar `$LASTEXITCODE`; no se alteraron sus argumentos.

Error reproducible de infraestructura:

```text
unable to get image 'postgres:16': error during connect: Get "http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/v1.51/images/postgres:16/json": open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
QA_EXIT_CODE=1
```

No es un FAIL de test: no hubo conexión al motor Docker Desktop Linux. El integrador debe habilitar el motor y repetir el comando autorizado; no se requiere que el usuario escriba pruebas.

## Cobertura verificable T01–T31

Convenciones: U = comando UNIT; H = HTTP; P = PG de la tabla anterior. Todos se invocaron en el HEAD/intervalo arriba indicados. BLOCKED en P significa que el escenario existe en suite inspeccionada, pero no se ejecutó por el bloqueo externo. PASS de subcaso no certifica automáticamente el Txx completo. NOT_RUN significa que no se acredita ejecución de ese alcance completo. AC son familias de la matriz; no se certifica cada AC por mera coincidencia de nombre de test.

| Txx | AC / objetivo SPEC §9 | Comando | Resultado | Evidencia inspeccionada y observado | Limitaciones |
|---|---|---|---|---|---|
| T01 | P1/C1/C2/C4 alta manual inicial | P | BLOCKED | suite identidad PG contiene altas | alta manual completa no acreditada por unitarias CSV |
| T02 | P1/P2/C1–C4 maestro A1/A2 | P | BLOCKED | `test/prospect-identity.postgres-spec.ts:157` | sin PG |
| T03 | P1 nombre débil sin autoreutilización | P | BLOCKED | identidad PG:185 | sin PG |
| T04 | P1/P4 múltiples candidatos | P | BLOCKED | `test/prospect-imports.postgres-spec.ts:139` | sin PG |
| T05 | P1 crear distinto expreso | P | BLOCKED | identidad PG:185 | sin PG |
| T06 | P1 identidad fuerte dos tenants | P | BLOCKED | identidad PG:157 | sin PG |
| T07 | P1 concurrencia fuerte, un commit y 409 | P | BLOCKED | identidad PG:74 | mocks no sustituyen concurrencia real |
| T08 | P1/C1–C4/P4 vínculo ya existente | P; U | BLOCKED | identidad PG:229; U imports:93 pasa no actualización de atributos | preservar todo el contexto no acreditado sin PG |
| T09 | C1 etapa contextual | P | BLOCKED | `test/campaigns-tenant-isolation.postgres-spec.ts:362` | sin PG |
| T10 | C1/C3 reapertura y transición | P | BLOCKED | aislamiento PG:362, bloque contextual | sin PG; revisión de aserciones no exhaustiva |
| T11 | C2/C3 justificación y posterior historia | P | BLOCKED | aislamiento PG:362 | sin PG |
| T12 | C3 actividad manual contextual | P | BLOCKED | aislamiento PG:362 | sin PG |
| T13 | C3 corrección append-only y servidor | P | BLOCKED | aislamiento PG:331,362 | sin PG |
| T14 | C4 asignar/desasignar | P | BLOCKED | aislamiento PG:362 | sin PG |
| T15 | C4 elegibilidad | P | BLOCKED | aislamiento PG:260 | sin PG |
| T16 | C4 salida de elegibilidad e historia | P | BLOCKED | aislamiento PG:483 | sin PG |
| T17 | C6 AND/OR/null/páginas/orden | P | BLOCKED | aislamiento PG:362 | sin PG; no certificada exhaustividad de combinaciones |
| T18 | C6/C8 JOIN no duplica | P | BLOCKED | aislamiento PG:517 | sin PG |
| T19 | C8 agregados exactos | P | BLOCKED | aislamiento PG:362 | sin PG |
| T20 | C8 vacío/legacy/sin responsable | P | BLOCKED | aislamiento PG:517 | sin PG |
| T21 | P2 origen/asociaciones/tenant | H; P | PASS subcaso H / BLOCKED P | `test/campaigns.e2e-spec.ts:483` pasó lista única de origen/asociados | HTTP con doubles; no certificación PG |
| T22 | P3 procedencia real A1/A2 | P | BLOCKED | aislamiento PG:362 (bloque T09–T22) | sin PG |
| T23 | P3/P4 preview/SKIP/error no durable | U; P | PASS subcasos U / BLOCKED P | `src/prospects/imports/prospect-imports.service.spec.ts:75,93`; PG imports:106 | no escritura de mock no prueba ausencia durable |
| T24 | P3/P4 UPDATE consciente y contexto | U; P | PASS subcaso U / BLOCKED P | imports unitario:108 prueba campos incluidos/omitidos; `test/users-authorization.postgres-spec.ts:378` | procedencia y pipeline compartido no acreditados en esta ejecución |
| T25 | P4/regresión límites/parser/TTL/referencia/replay | U; H; P | PASS subcasos U/H / BLOCKED replay PG | parser:7–70; servicio:124–175; import HTTP:121; PG imports:70 | ver análisis específico abajo; T25 integral no se declara PASS |
| T26 | P4 MEMBER denegado; OWNER/ADMIN válido | H; P | PASS H / BLOCKED P | `test/prospect-imports.e2e-spec.ts:94,104` | autorización HTTP pasa; integración PG pendiente |
| T27 | P4 atomicidad ante fallo tardío | P | BLOCKED | `test/prospect-imports.postgres-spec.ts:106` | sin rollback real ejecutado |
| T28 | migración/P2/P3 sin pérdida ni historial fabricado | P | BLOCKED | `test/campaign-participation-migration.postgres-spec.ts:35–156` | fixture/migraciones inspeccionados, no aplicados en esta corrida |
| T29 | compatibilidad consultas/edición/UI | H; U | PASS backend parcial / NOT_RUN UI | campaigns HTTP:301,326; unitario OpenAPI ejecutado | UI existente no ejecutada; PG compatibilidad bloqueada |
| T30 | manual/CSV/campañas/prospectos/dashboard sin Prospector | H | PASS arranque parcial / NOT_RUN flujo completo | `test/without-prospector.e2e-spec.ts:68` arranque/auth/health/tenants/users y resto de suite pasan | no equivalen al flujo integral manual/CSV/dashboard requerido |
| T31 | seguridad todos endpoints nuevos y homónimos | H; P | PASS protección H parcial / BLOCKED P | campaigns HTTP:239; import HTTP:94; suite homónimos `test/campaigns-tenant-isolation.postgres-spec.ts:11` | no se acredita matriz íntegra 401/403/404 con persistencia real ni invariancia ajena |

### T25: reloj simulado, no espera real

El test `src/prospects/imports/prospect-imports.service.spec.ts:158–176`, ejecutado dentro de U, fija `Date.now`, comprueba `expiresAt = emisión + 15*60*1000` y adelanta exactamente al límite de 15 minutos. `confirm` se rechaza con `expired preview reference`. Es evidencia determinista válida de la regla temporal; el SPEC T25 no exige esperar quince minutos de reloj real. No se registra la falta de espera real como defecto funcional.

Límites de las aserciones observadas (no fallos ejecutados): no se prueba en ese test éxito justo antes del vencimiento, ni rechazo posterior separado, ni ausencia explícita de llamadas de escritura en la rama vencida, ni código HTTP específico de expiración. `mockRestore` está al final y no en `finally` (línea 175), por lo que una aserción fallida podría contaminar pruebas posteriores; en esta corrida no ocurrió. Parser ejecutado rechaza >5 MiB y 1001 registros y acepta 1000; el test de tamaño no demuestra aceptar un CSV válido de exactamente 5 MiB. Su `elapsedMs >= 0` no es un presupuesto de rendimiento ni certifica latencia. Replay 409 y atomicidad requieren el PG bloqueado; no se heredan resultados de SHAs anteriores.

### T28 y T31: inspección no equivale a ensayo

T28 prepara schema aislado y dataset legacy sintético (identificador nulo, duplicados fuertes en campañas distintas, origen cruzado y participación previa); aplica init y migraciones nuevas/forward-fix. Sus aserciones comparan filas/timestamps, mantienen participación previa y unique, evitan actividades/procedencia inventada y backfill cross-tenant. Nada de ello se ejecutó aquí. No se certificó adicionalmente reporte de colisiones ni fixtures huérfanos completos de la skill.

T31 cuenta con suite PG explícita de tenants homónimos y escenarios de responsables, agregados, CSV y correcciones; su existencia no acredita ejecución. La inspección fue de trazabilidad, no auditoría exhaustiva de cada aserción/endpoint.

## Riesgos residuales por severidad

1. **Alta — certificación crítica PG bloqueada.** Identidad/concurrencia, atomicidad CSV, migración legacy y aislamiento tenant real no corridos en este HEAD. Desbloquear Docker Linux y repetir P; no cerrar G4 con resultados de mocks.
2. **Media — entorno distinto del soportado.** PASS de build/U/H corresponde a Node 22, no al Node 20 declarado. Repetir en entorno soportado antes de certificarlo.
3. **Media — cobertura funcional parcial.** UI/flujo integral T29–T30 y exhaustividad AC/endpoint no certificados; preservar los PASS parciales y asignar las comprobaciones faltantes al integrador/implementación, sin pedir al usuario escribir tests.
4. **Baja — límites T25 adicionales.** Reloj simulado válido; faltan aserciones de frontera previa, no escritura y transporte HTTP de expiración. Medición no negativa no prueba desempeño.

No se detectó un fallo funcional en las 199 pruebas ejecutadas. Este resultado no autoriza merge, deploy, migración productiva ni cierre de gates.
