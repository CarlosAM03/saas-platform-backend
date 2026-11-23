# G4 — Revisión independiente del candidato

- Fecha de recepción: `2026-11-22T20:29:40-08:00`.
- HEAD revisado: `e2bc9275836b642ac3e2b6086c4c15062b4dcd89`.
- Base G0: `5e214420394101ae7079f8e844cc759b01cce2a3`.
- Revisor: `sprint-reviewer`, revisión estática independiente, sin edición ni ejecución de tests/PG.
- Fuente: reporte de sesión `ses_df9571235ffe6WbMS56t4nu6B6`, recibido por el integrador.

Los hallazgos siguientes son hipótesis fundadas en inspección estática. Su reproducción ejecutada queda **NOT_RUN** en este registro. No se convierten en PASS ni FAIL funcional hasta ejecutar las pruebas correspondientes. No se aprueba G4.

| ID | Severidad reportada | Fuente en HEAD revisado | Hallazgo / escenario | Criterio | Opción de corrección | Impacto / estado |
|---|---|---|---|---|---|---|
| RI-01 | HIGH | `src/prospects/prospects.service.ts:94-101`; migración inicial del sprint `migration.sql:37-42` | Matching ignora identidades legacy con claves derivadas nulas; con otro nombre puede crear otro maestro. Varias claves originales iguales tampoco disparan conflicto. | AC-P1-01/03; SPEC §3.1/3.2/7.4 | Búsqueda legacy tenant-scoped y revalidación transaccional; no auto-merge ni edición de migraciones históricas. | Duplicación/colisión omitida; reproducción NOT_RUN. |
| RI-02 | HIGH | `src/campaigns/campaigns.service.ts:265-291,316-350,382-433` | Dos cambios concurrentes leen el mismo anterior; pueden insertar eventos duplicados o anteriores inexactos. | AC-C1-04, AC-C3-02 | Serialización o control optimista con relectura; probar etapa/evaluación/responsable. | Historial inexacto; reproducción NOT_RUN. |
| RI-03 | HIGH | `src/prospects/prospects.service.ts:113-116,136-143` | `resolve(LINK_EXISTING)` no acepta el candidato recibido en `strongProspect`, excluido de `candidates`. | P1; SPEC §3.2/3.6 | Revalidar también candidato fuerte en la confirmación tenant-scoped. | Rechazo de reutilización válida; reproducción NOT_RUN. |
| RI-04 | MEDIUM | `src/campaigns/campaigns.service.ts:579-584` | Usuario activo sin membresía permanece clasificado como elegible en dashboard. | C4, AC-C4-04, C8 | Calcular elegibilidad por estado y membresía sin borrar referencia histórica. | Responsable no elegible presentado como vigente; reproducción NOT_RUN. |
| RI-05 | MEDIUM | `src/campaigns/campaigns.service.ts:537-544,586-595` | Primer evento global posterior puede cambiar incorporación legacy desconocida a reutilizada. | C8; AC-P3-04 | Usar evidencia de incorporación específica de la participación, no actualización posterior. | Historia inferida indebidamente; reproducción NOT_RUN. |
| RI-06 | MEDIUM | `src/prospects/imports/prospect-imports.service.ts:125-128` | CSV MATCH no admite crear distinto ante coincidencia débil única. | B2; SPEC §3.2/3.3 | Contrastar decisión B2 y ratificación G4-O2; no introducir regla distinta ni `candidateId` CSV por iniciativa propia. | Posible bloqueo de homónimos; reproducción y conciliación contractual NOT_RUN. |
| RI-07 | MEDIUM | `src/prospects/prospects.service.ts:153-161,334-342` | CREATE consciente ante candidatos no conserva hecho de la decisión expresa. | AC-P1-04 | Detalle mínimo revalidado de resolución en procedencia existente. | Trazabilidad incompleta; reproducción NOT_RUN. |

## Observaciones adicionales del revisor

- C6: faltan filtros de incorporación/actividad; comprobar alcance exacto antes de implementar.
- Listado de participantes: devuelve campos maestros sin contexto de participación; existe consulta individual. Contrastar contrato y alcance.
- Procedencia global sin paginación (`provenance():210-217`); contrastar SPEC §6.1/6.2 y compatibilidad.

## Seguridad y correcciones anteriores

No se identificó una fuga de tenant ni bypass de rol demostrado en caminos ordinarios inspeccionados. Esto no equivale a una prueba ejecutada ni auditoría completa de Auth. No se encontró reinterpretación del estado legado. Los forward-fix de REV-01/REV-02 están presentes estáticamente; no se volvieron a ejecutar por el revisor. No se propone modificar módulos protegidos.

## Siguiente sincronización

La regresión independiente del candidato continúa separada de estos hallazgos. Se preparan pruebas dirigidas fuera del checkout mientras termina QA para no contaminar el SHA atribuido. Antes de aplicar correcciones se verificará el reporte de QA y se conservarán los resultados previos. Handoff y conclusión técnica de G4 siguen bloqueados por hallazgos pendientes de resolución.

## Segunda revisión — HEAD + worktree correctivo

Fecha de integración del reporte: `2026-11-22T20:43:31-08:00`. HEAD base exacto: `e2bc9275836b642ac3e2b6086c4c15062b4dcd89`; código correctivo local aún sin commit.

Fuente: segunda entrega del mismo revisor independiente, sin ejecutar tests ni editar archivos. La revisión observa correcciones presentes para RI01/02/03/04/05/07 y D02; **no constituye PASS de ejecución**. RI04 se limita al dashboard: representación de elegibilidad en otras lecturas sigue pendiente. D02 preserva el wrapper común `error.code=CONFLICT` y entrega el marcador en `error.details.reason`; compatibilidad con consumidores no queda certificada por inspección.

### RI08 — MEDIUM, incorporación mediante UPDATE_EXISTING CSV

- Fuente: `src/prospects/imports/prospect-imports.service.ts:183-191,243-263` y `src/campaigns/campaigns.service.ts:540-547,602-608` del worktree revisado.
- Escenario: maestro en A sin participación en B; CSV B confirma UPDATE_EXISTING. Se crea participación y actividad ASSOCIATION, pero solo procedencia MASTER_UPDATED. Dashboard B consulta CREATED/LINKED y lo cuenta como unknownLegacy en lugar de reused.
- Criterio: C8, clasificación al incorporarse a la campaña; P3, procedencia confirmada.
- Opción: conservar evidencia LINKED en la misma transacción únicamente cuando se crea realmente la asociación; una actualización posterior de participación existente no debe alterar legado desconocido.
- Impacto: omisión de reutilización actual verificable. Reproducción **NOT_RUN** al recibir este reporte; no se presenta como prueba fallida ejecutada.

### Cobertura pendiente de vínculo concurrente

El revisor no sostiene un defecto de asociación duplicada por la lectura previa al upsert bajo Serializable: PK y serialización deben impedir dos commits incompatibles y el error se convierte en 409. Falta una prueba dirigida de dos LINK simultáneos al mismo vínculo ausente. Se registra como falta de cobertura, no bug demostrado. Un REAPPEARED posterior no equivale a idempotencia durable.

No se identificaron nuevos CRITICAL/HIGH ni fuga tenant/bypass de rol en este bloque; no equivale a una certificación de seguridad completa. No se cierran gates.

## Tercera revisión acotada de RI08

Integrada el `2026-11-22T20:50:01-08:00`, sobre el mismo HEAD exacto + worktree posterior al arreglo RI08. El revisor confirma estáticamente que MASTER_UPDATED y LINKED representan hechos distintos de una operación actual confirmada; LINKED y ASSOCIATION solo se agregan ante vínculo nuevo, en la misma transacción Serializable, con campos de auditoría de servidor. Snapshot y validación total de decisiones siguen antes de las escrituras. No identificó defecto residual en este cambio acotado.

Inspeccionó las dos aserciones unitarias RI08 y el caso PG de reutilización B/origen legacy A/repetición sin duplicado. No ejecutó pruebas: esta conclusión es revisión de código, **no PASS de runtime**. Límite de cobertura: no se inyectó específicamente un fallo entre MASTER_UPDATED, LINKED y ASSOCIATION en esta nueva prueba; la atomicidad está respaldada estáticamente por su transacción común y no se extiende el resultado de otras pruebas como si ejecutaran esa intercalación.
