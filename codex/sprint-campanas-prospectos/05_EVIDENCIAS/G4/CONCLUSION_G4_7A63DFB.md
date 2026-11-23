# G4 — Conclusión técnica propuesta para revisión del owner

**Estado propuesto por el integrador: `LISTO_PARA_REVISION_OWNER`. La aceptación del gate NO está otorgada: la decide el owner.**

- Fecha: `2026-11-23`.
- HEAD de código: `7a63dfbe1d72b695457cf99b830f186af9b3d2bb`, rama `feat/sprint-campana-prospector`.
- Commits del bloque: `a5055b5` (pruebas) y `d42be1c` (documentación), más el segundo bloque de pruebas y documentación registrado después de esta conclusión.
- Estado del árbol al emitir esta conclusión: worktree con pruebas y documentación adicionales sin commit. Ningún cambio en `src/`, `Prisma/` ni migraciones.
- Autoridad funcional: `04_REFERENCIAS/SPEC_SPRINT_CAMPANAS_PROSPECTOS_v1.0_OWNER_APROBADO.md` (A1–E5, INV-01..12, AC, gates).

## 1. Qué se ejecutó y con qué resultado

| Evidencia | Resultado | Referencia |
|---|---|---|
| Build | PASS, código 0 | §4 |
| Unitarias | 12 suites, 177/177 PASS | §4 |
| E2E HTTP | 7 suites, 84/84 PASS | §4 |
| PostgreSQL 16 desechable | 15 suites, 196/196 PASS; 4 migraciones sin pendientes | §4 |
| Rendimiento descriptivo | 4/4 casos; sin SLA | `CIERRE_LECTURA_7A63DFB.md` |
| Paridad OpenAPI/Swagger CP | rutas CP presentes; `yamlOnly=[]` en la verificación previa | `MATRIZ_QA.md` (registros por SHA) |
| Sensibilidad de prueba de instantánea | rojo con implementación secuencial, verde con `RepeatableRead` | `COBERTURA_AC_Y_CONCURRENCIA_7A63DFB.md` |
| Cobertura por AC | 49 CUBIERTO · 1 CUBIERTO_PARCIAL · 0 NO_CUBIERTO | `MATRIZ_COBERTURA_AC.md` |

Total funcional de la última corrida: **457 pruebas** en 34 suites (177 unitarias + 84 HTTP + 196 PostgreSQL).

## 2. Qué quedó cubierto por criterio

Los 50 AC del SPEC tienen al menos una aserción asociada y los 49 `CUBIERTO` incluyen: pipeline por participación con transiciones trazadas y sin venta automática, evaluación con motivo obligatorio y secuencia manual conservando el motivo, bitácora contextual con correcciones que preservan el original, paginación 1..N con orden estable, dashboard de una sola instantánea con campaña vacía coherente, filtros server-side con volumen de 300 participaciones, identidad fuerte/débil con decisión explícita, campañas asociadas con roles OWNER/MEMBER equivalentes y resumen de A intacto al mutar B, procedencia respaldada por BD, CSV con resultado por fila de creado/vinculado/actualizado/omitido y efecto global de `UPDATE_EXISTING` verificado.

## 3. Brechas que el owner debe conocer antes de aceptar

1. **1 AC parcial: `AC-P3-02`.** El SPEC menciona «preview/omitir/revertir». Preview, omisión y rechazo están cubiertos sin escrituras; **la API no expone operación de reversión** y el contrato no la declara. La brecha es de alcance funcional, no de prueba: se requiere decisión del owner sobre si el sprint debe incluirla o si basta el rechazo seguro actual.
2. **Pruebas parciales no equivalen a comportamiento ausente.** Varias brechas históricas eran de representación o contrato, no de implementación.
3. **T32 `NOT_RUN`.** Es E2E Flutter y no puede declararse desde el backend.
4. **Rendimiento.** Las mediciones son descriptivas sobre datos sintéticos (5 000 participaciones), sin SLA ni equivalencia productiva.
5. **Doble HTTP en memoria.** La regresión E2E usa dobles fieles a `select`/`where` anidados, pero no sustituye PostgreSQL para reglas de dominio.
6. **Concurrencia real.** La prueba determinista controla el intercalado mediante un proxy de pruebas; no reproduce latencia de red ni reintentos de Prisma.
7. **`AC-C2-04`.** Verifica ausencia de jobs y de cambio de etapa; no intercepta tráfico de red hacia Prospector.
8. **`AC-P4-03`.** El «aviso» de efecto global es presentación en Flutter; el backend entrega la acción explícita y el efecto verificable.

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

1. ¿Acepta G4 con 49 AC cubiertos y `AC-P3-02` parcial por ausencia de operación de reversión en el contrato?
2. ¿Exige implementar o documentar formalmente una operación de reversión antes de G5, o acepta que el rechazo seguro actual cubre el criterio?
3. ¿Autoriza el commit de pruebas y documentación de este bloque en `feat/sprint-campana-prospector`?

Este documento no cierra G4, no autoriza merge y no declara terminado el sprint. G5 sigue provisional; G6 depende de la revisión del owner.
