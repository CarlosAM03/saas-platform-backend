# G4 — Cierre de brechas por AC y validación de roles, paginación, dashboard e importación

- Fecha: `2026-11-23`.
- HEAD de código del sprint: `7a63dfbe1d72b695457cf99b830f186af9b3d2bb`; HEAD documental de partida: `e4348f302ad1d2d125d51d508ccaca47bcfd12a4`.
- Rama: `feat/sprint-campana-prospector`.
- Alcance autorizado: decisión del owner de **no aceptar G4 con parciales** y cerrar las brechas antes de G5. Solo pruebas y evidencias; sin cambios en `src/`, `Prisma/`, migraciones, contrato ni módulos protegidos.

## 1. Objetivo

Reducir la cobertura parcial sin inflar estados: cada AC debía pasar a `CUBIERTO` únicamente con una aserción que verificara el comportamiento descrito por el SPEC, no por el nombre del test ni por una suite verde.

## 2. Brechas cerradas y aserción que las cierra

| AC | Brecha previa | Prueba añadida | Qué demuestra |
|---|---|---|---|
| `AC-C4-01` | Solo había camino positivo con OWNER | `AC-C4-01 lets OWNER, MEMBER and a tenant-selected ADMIN assign an eligible responsible` (HTTP, AppModule real) | OWNER, MEMBER y ADMIN con tenant seleccionado asignan; cadena exacta de eventos `RESPONSIBLE_CHANGE`. |
| `AC-C3-05` | Solo se pedía la página 1 | `AC-C3-05 paginates activities with stable order, exact counts and no duplicates` | Recorrido 1..N con empates de `recordedAt`, orden `recordedAt desc, id desc`, ids únicos, página fuera de rango vacía y 404 de otro tenant. |
| `AC-P4-03` | Solo se verificaba el efecto en datos | `AC-P4-03 UPDATE_EXISTING from B changes the shared master seen from A and records the change` | La fila reporta `UPDATE_EXISTING`, el maestro compartido cambia para la campaña A, el origen se conserva y se registra `MASTER_UPDATED`. |
| `AC-P4-07` | Faltaba cubrir vinculado y omitido por fila | `AC-P4-07 reports created, linked, updated and skipped rows faithfully in one confirmation` | Una sola confirmación con las cuatro acciones devuelve filas y resumen coherentes con el estado persistido. |
| `AC-C1-03` | Solo se verificaban los 200 | `AC-C1-03 records CERRADO to EN_SEGUIMIENTO with one traceable event and no automatic sale` | Dos eventos `STAGE_CHANGE` encadenados, sin otros efectos, campaña y maestro intactos. |
| `AC-C2-03` | Solo secuencia concurrente | `AC-C2-03 keeps both evaluation events and the original NO_APTO reason` | Secuencia manual conservando el motivo inicial y el encadenamiento. |
| `AC-C2-04` | Faltaba demostrar no-efecto | `AC-C2-04 changes evaluation only: stage, campaign and jobs stay untouched` | Etapa, campaña y conteo de jobs idénticos; sin `STAGE_CHANGE`. |
| `AC-C3-02` | Faltaban no-op y fallo | `AC-C3-02 records exactly one event per effective change and none for no-op or failed retries` | Conteo de eventos en cambio efectivo, no-op y rechazo. |
| `AC-C3-03` | No se comparaba el original | `AC-C3-03 appends a correction and leaves the original activity intact` | La fila original queda idéntica campo por campo. |
| `AC-C6-04` | Sin caso de volumen | `AC-C6-04 filters and paginates hundreds of participations server-side` | 300 participaciones, 25 por página, filtro con total 100. |
| `AC-P2-04` | Sin comparación de roles en P2 | `AC-P2-04 serves P2 to OWNER and MEMBER under existing rights and hides foreign masters` | Payload idéntico entre roles y 404 para maestro ajeno. |
| `AC-P3-04` | Sin verificación fecha por fecha | `AC-P3-04 returns only provenance rows backed by the database` | Cada fecha, tipo y campaña coincide con la fila almacenada. |
| `AC-P3-02` | Preview y omisión cubiertos; «revertir» sin ejercicio | `AC-P3-02 rolls back a reverted batch without leaving durable provenance` | El lote con fallo inyectado revierte y deja 0 procedencias y 0 actividades. |

## 3. Brecha que exige interpretación, no implementación

`AC-P3-02` menciona «preview/omitir/**revertir**». La API no expone un verbo de reversión manual y el contrato no lo declara. El criterio se cubre como **lote revertido por rollback**: la prueba inyecta un fallo en la segunda escritura y verifica 0 maestros, 0 participaciones, 0 eventos de procedencia y 0 actividades. Preview, omisión y rechazo también se verifican sin escrituras. Si el owner espera una operación de reversión explícita, es funcionalidad nueva y queda fuera de este bloque.

## 4. Dos defectos de prueba detectados y corregidos durante el bloque

1. El primer fixture de `AC-C2-03` usaba una participación ya evaluada, de modo que `previousValue` era `APTO` y no `SIN_EVALUAR`. Se movió la prueba a la campaña cuya participación nace sin evaluar.
2. El primer `AC-C1-03` contaba tipos de actividad, pero el fixture ya incluía `NOTE`. Se cambió a conteo incremental exacto (antes/después) para no confundir estado previo con efecto de la transición.

Ambos casos se conservan aquí como evidencia de que una prueba verde puede medir lo equivocado.

## 5. Ejecución

Ejecutada sobre el árbol limpio del SHA `0d1dd02` (pruebas en `30017d9`).

```text
docker compose --profile test run --build --rm test-postgres sh -c "npm run build && npm run test:unit:ci && npm run test:e2e:ci && npm run prisma:migrate:deploy && npm run test:postgres"
```

| ID | Gate | Comando interno | Esperado | Observado | Estado |
|---|---|---|---|---|---|
| BUILD-BRE | G4 | `npm run build` | compila | código 0 | PASS |
| UNIT-BRE | G4 | `npm run test:unit:ci` | verde | 12 suites, 177/177 | PASS |
| HTTP-BRE | G4 | `npm run test:e2e:ci` | verde | 7 suites, 84/84 | PASS |
| MIG-BRE | G4 | `npm run prisma:migrate:deploy` | sin pendientes | 4 migraciones, ninguna pendiente | PASS |
| PG-BRE | G4 | `npm run test:postgres` | verde | 15 suites, 196/196 | PASS |
| LINT-BRE | G4 | `npx eslint`; `npx prettier --check` | código 0 | código 0 en los archivos tocados | PASS |

Total funcional: **457 pruebas** (177 + 84 + 196).

## 6. Efecto en la matriz

`MATRIZ_COBERTURA_AC.md` pasa de 37 `CUBIERTO` / 13 `CUBIERTO_PARCIAL` a **50 `CUBIERTO` / 0 `CUBIERTO_PARCIAL` / 0 `NO_CUBIERTO`**.

## 7. Limitaciones

1. Los fixtures son sintéticos; no sustituyen datos productivos ni latencias reales.
2. `AC-C2-04` verifica ausencia de jobs y de cambio de etapa, no intercepta red hacia Prospector.
3. `AC-C4-01` prueba tres roles en un tenant; no recorre todos los roles de plataforma.
4. `AC-P4-03` deja el «aviso» al frontend: el backend expone acción explícita y efecto verificable.
5. `T32` sigue `NOT_RUN` y G4 no se marca aceptado.
