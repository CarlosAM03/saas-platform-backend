# G4 — QA por SHA y rastreabilidad

**ESTADO: EJECUCIÓN PARCIAL — G4 NO CERRADO**

- Backend HEAD exacto: `f09fbee77e26b9b0cdfa3581883b87209b75e`, validado el 2026-11-21
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

| Test | SHA | Comando / fixture | Resultado | Evidencia | Limitación |
|---|---|---|---|---|---|
| Build/Prisma | f09fbee77e26b9b0cdfa3581883b87209b75e | `npm run prisma:generate`; `npm run build` | PASS | salida del shell | generación/compilación |
| Unitarias | f09fbee77e26b9b0cdfa3581883b87209b75e | `npm run test:unit:ci` | 113/113 PASS | suites Jest | no cubre todos los AC sprint |
| E2E HTTP | f09fbee77e26b9b0cdfa3581883b87209b75e | `npm run test:e2e:ci` | 84/84 PASS | suites Jest HTTP | no prueba todos los endpoints nuevos |
| PostgreSQL 16 | f09fbee77e26b9b0cdfa3581883b87209b75e | `docker compose --profile test run --build --rm test-postgres` | 59/59 PASS | suites PostgreSQL desechables | migración aplicada; T28 específico pendiente |
| T25–P4 CSV | f09fbee77e26b9b0cdfa3581883b87209b75e | suites existentes CSV E2E/PostgreSQL | PARCIAL PASS | pruebas CSV existentes | límites/múltiples candidatos no completos |
| T28 | f09fbee77e26b9b0cdfa3581883b87209b75e | migración aplicación PostgreSQL | NO_EJECUTADO ESPECÍFICO | — | solo aplicación DDL demostrada |
| T30 | f09fbee77e26b9b0cdfa3581883b87209b75e | `without-prospector.e2e-spec.ts` | PASS | suite E2E | módulos externos intactos |
| T32 | f09fbee77e26b9b0cdfa3581883b87209b75e | — | NO_EJECUTADO | — | Flutter fuera de backend |
