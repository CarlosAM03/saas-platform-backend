# G4 — Conclusión técnica propuesta para revisión del owner

**Estado propuesto por el integrador: `LISTO_PARA_REVISION_OWNER`. La aceptación del gate NO está otorgada: la decide el owner.**

- Fecha: `2026-11-23`.
- HEAD de código: `7a63dfbe1d72b695457cf99b830f186af9b3d2bb`, rama `feat/sprint-campana-prospector`.
- Último commit funcional: `feat(sprint-cp): complete contextual reads and dashboard snapshot`.
- Estado del árbol al emitir esta conclusión: worktree con cambios en pruebas (`test/campaigns-read-capabilities.postgres-spec.ts`, `test/prospect-read-capabilities.postgres-spec.ts`) y documentación, aún sin commit al momento de redactar. Ningún cambio en `src/`, `Prisma/` ni migraciones.
- Autoridad funcional: `04_REFERENCIAS/SPEC_SPRINT_CAMPANAS_PROSPECTOS_v1.0_OWNER_APROBADO.md` (A1–E5, INV-01..12, AC, gates).

## 1. Qué se ejecutó y con qué resultado

| Evidencia | Resultado | Referencia |
|---|---|---|
| Build | PASS, código 0 | este documento §4 |
| Unitarias | 12 suites, 177/177 PASS | este documento §4 |
| E2E HTTP | 7 suites, 84/84 PASS | este documento §4 |
| PostgreSQL 16 desechable | 15 suites, 181/181 PASS; 4 migraciones sin pendientes | este documento §4 |
| Rendimiento descriptivo | 4/4 casos; sin SLA | `CIERRE_LECTURA_7A63DFB.md` |
| Paridad OpenAPI/Swagger CP | rutas CP presentes; `yamlOnly=[]` en la verificación previa | `MATRIZ_QA.md` (registros por SHA) |
| Sensibilidad de prueba de instantánea | rojo con implementación secuencial, verde con `RepeatableRead` | `COBERTURA_AC_Y_CONCURRENCIA_7A63DFB.md` |
| Cobertura por AC | 34 CUBIERTO · 16 PARCIAL · 0 NO_CUBIERTO | `MATRIZ_COBERTURA_AC.md` |

Total funcional de la última corrida: **442 pruebas** en 34 suites.

## 2. Qué quedó cubierto por criterio

Los 50 AC del SPEC tienen al menos una aserción asociada. Los 34 `CUBIERTO` incluyen: pipeline por participación y separación de `status` legado, evaluación con motivo obligatorio y aislamiento A/B, bitácora contextual, dashboard de una sola instantánea, filtros server-side con conteo y paginación estables, identidad fuerte/débil con decisión explícita, campañas asociadas, procedencia global y CSV con preview/confirm, rechazo seguro de múltiples candidatos y aislamiento de tenant.

## 3. Brechas que el owner debe conocer antes de aceptar

1. **16 AC parciales.** Las más relevantes: `AC-C4-01` (no hay camino positivo con `MEMBER`/`ADMIN`), `AC-C4-02` (faltan rechazos por usuario inactivo y sin membresía en el mismo tenant), `AC-C8-04` (no se afirma explícitamente ausencia de `NaN` ni de consulta al Service), `AC-P4-03` (no se verifica el aviso de efecto global de `UPDATE_EXISTING`) y `AC-P4-07` (falta resultado por fila de vinculado/omitido en la misma respuesta). El listado completo está en `MATRIZ_COBERTURA_AC.md`.
2. **Pruebas parciales no equivalen a comportamiento ausente.** Varias brechas son de representación o de contrato, no de implementación; se declaran como tales para no inflar el estado del gate.
3. **T32 `NOT_RUN`.** Es E2E Flutter y no puede declararse desde el backend.
4. **Rendimiento.** Las mediciones son descriptivas sobre datos sintéticos (5 000 participaciones), sin SLA ni equivalencia productiva.
5. **Doble HTTP en memoria.** La regresión E2E usa dobles fieles a `select`/`where` anidados, pero no sustituye PostgreSQL para reglas de dominio.
6. **Concurrencia real.** La prueba determinista controla el intercalado mediante un proxy de pruebas; no reproduce latencia de red ni reintentos de Prisma.

## 4. Comandos exactos de la ejecución de referencia

```text
docker compose --profile test run --build --rm test-postgres sh -c "npm run build && npm run test:unit:ci && npm run test:e2e:ci && npm run prisma:migrate:deploy && npm run test:postgres"
```

Reproducción roja de la prueba de instantánea (con dashboard secuencial aplicado de forma temporal y restaurado después con `git checkout -- src/campaigns/campaigns.service.ts`):

```text
docker compose --profile test run --build --rm test-postgres sh -c "npm run test:postgres -- --testPathPatterns=campaigns-read-capabilities -t 'keeps one snapshot'"
```

## 5. Controles de alcance respetados

- Sin cambios en Auth/JWT/RBAC/TenantContext, Users/Tenants, ProspectorClient/ProspectingJobs/Engine ni infraestructura productiva.
- Sin migraciones nuevas, sin edición de migraciones históricas, sin `migrate deploy` remoto.
- Sin `git push`, merge, deploy, rebase ni modificación de PR previos.
- Sin datos reales: todos los fixtures son sintéticos y no se registraron secretos ni datos personales.

## 6. Decisión solicitada al owner

1. ¿Acepta G4 con las 16 brechas parciales declaradas y T32 reservado al frontend?
2. Si no, ¿qué brechas deben cerrarse antes de autorizar G5/handoff a André?
3. ¿Autoriza el commit de pruebas y documentación de este bloque en `feat/sprint-campana-prospector`?

Este documento no cierra G4, no autoriza merge y no declara terminado el sprint. G5 sigue provisional; G6 depende de la revisión del owner.
