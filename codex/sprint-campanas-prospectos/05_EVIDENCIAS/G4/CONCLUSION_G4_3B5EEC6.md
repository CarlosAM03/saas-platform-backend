# G4 — Conclusión técnica vigente del candidato `3b5eec6`

**Estado propuesto por el integrador: `LISTO_PARA_ACEPTACION_OWNER`. La aceptación del gate NO está otorgada: la decide el owner. Este documento no cierra G4, no abre G5 y no autoriza merge ni deploy.**

- Fecha: `2026-11-23`.
- Rama: `feat/sprint-campana-prospector`.
- SHA verificado en árbol limpio: `3b5eec6fa99f846e853794fc8aedff2c4353c269` (commit de implementación y pruebas del bloque O4-B/O5-A).
- SHA base previo: `fd513fc046415925a61252adbed350fbd70eed8f` (HEAD al iniciar el bloque).
- Sustituye como conclusión vigente a `CONCLUSION_G4_7A63DFB.md`, que se conserva como registro histórico de su propio SHA.
- Autoridad funcional: `04_REFERENCIAS/SPEC_SPRINT_CAMPANAS_PROSPECTOS_v1.0_OWNER_APROBADO.md`.

## 1. Decisiones del owner aplicadas en este bloque

| ID | Decisión owner (2026-11-23) | Implementación | Evidencia |
|---|---|---|---|
| G4-O4 | Opción B: `CORRECTION` cuenta como actividad manual | `manualTypes` incluye `CORRECTION`; `events = total - manual`; contrato del dashboard actualizado | `BLOQUE_O4_O5_3B5EEC6.md` |
| G4-O5 | Opción A: `MASTER_UPDATE` en el enum de respuesta del YAML | Enum del YAML igual al de Prisma; DTO de alta manual sin cambios; descripción aclara que documentarlo no implica generarlo y que no es `MASTER_UPDATED` | mismo documento |
| AC-P3-02 | Ratificado: cubre rollback, no exige endpoint de reversión | Se mantiene la cobertura por lote revertido; no se implementó reversión manual | `CIERRE_BRECHAS_AC_7A63DFB.md` |

## 2. Ejecución de referencia sobre el commit limpio

```text
docker compose --profile test run --build --rm test-postgres sh -c "npm run build && npm run test:unit:ci && npm run test:e2e:ci && npm run prisma:migrate:deploy && npm run test:postgres"
```

| Prueba | Resultado | Estado |
|---|---|---|
| Build | código 0 | PASS |
| Unitarias (12 suites) | 178/178 | PASS |
| E2E HTTP (7 suites) | 84/84 | PASS |
| PostgreSQL 16 desechable (15 suites) | 199/199; 4 migraciones sin pendientes | PASS |
| Total funcional | 461 pruebas en 34 suites; `compose` exit 0 | PASS |
| Swagger servido (`/api/docs-json` en app Nest real) | `CORRECTION` manual, `MASTER_UPDATE` en enum, entrada manual restringida | PASS |
| Sensibilidad O4-B | rojo con `CORRECTION` fuera de `manualTypes`, verde restaurado | PASS de sensibilidad |
| Integridad del arnés | `Checked 27 files; anomalies: 0` | PASS |

Detalle, comandos y límites en `BLOQUE_O4_O5_3B5EEC6.md`.

## 3. Cobertura por criterio

La matriz `MATRIZ_COBERTURA_AC.md` conserva **50 `CUBIERTO` · 0 `CUBIERTO_PARCIAL` · 0 `NO_CUBIERTO`**; en este bloque se refuerzan `AC-C3-03` (corrección preserva el original y se cuenta como manual) y `AC-C8-02` (partición de actividad exacta).

## 4. Riesgos y brechas que el owner debe conocer

1. **Clasificación de `CORRECTION`.** El SPEC §4.C3 no la clasifica explícitamente; la decisión `G4-O4-B` del owner fija el criterio y el contrato lo publica. André debe consumir `activity.manual` con ese significado.
2. **`MASTER_UPDATE` documentado, no emitido.** Ningún código escribe ese tipo hoy. Si en el futuro se emite, el contrato ya lo admite; no se promete emisión.
3. **T32 `NOT_RUN`.** E2E Flutter, fuera del backend.
4. **Rendimiento descriptivo.** Mediciones sintéticas previas, sin SLA ni equivalencia productiva; no se repitieron en este bloque.
5. **Dobles HTTP en memoria.** La regresión E2E usa dobles fieles, no PostgreSQL, para reglas de dominio.
6. **Swagger.** La verificación es del documento servido por la app Nest en pruebas; no se levantó el contenedor `api` en puerto local en este bloque, y la UI no se inspeccionó visualmente.
7. **Commit posterior documental.** Cualquier commit de evidencias después de `3b5eec6` es documental y no hereda la ejecución.

## 5. Controles de alcance respetados

- Sin cambios en Auth/JWT/RBAC/TenantContext, Users/Tenants, ProspectorClient/ProspectingJobs/Engine ni infraestructura productiva.
- Sin cambios en `Prisma/schema.prisma` ni migraciones; sin `migrate deploy` remoto.
- Sin `git push`, merge, deploy, reset, rebase ni modificación de PR previos.
- Sin subagentes, sin Flutter y sin ZIP de André.
- Sin datos reales: fixtures sintéticos, sin secretos.

## 6. Decisión solicitada

Aceptación de G4 por el owner sobre el candidato `3b5eec6fa99f846e853794fc8aedff2c4353c269`. Con la aceptación, el integrador prepararía G5; `G5` sigue provisional y `T32` permanece `NOT_RUN` hasta que el frontend lo ejecute.
