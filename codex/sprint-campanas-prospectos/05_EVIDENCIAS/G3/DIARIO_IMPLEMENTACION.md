# G3 — Diario de implementación

**ESTADO: IMPLEMENTACIÓN COMPLETA — G4 EN CONCLUSIÓN TÉCNICA PARA REVISIÓN DEL OWNER**

## Bloque O4-B / O5-A — 2026-11-23

Commit `3b5eec6fa99f846e853794fc8aedff2c4353c269`. Por instrucción del owner se implementó `G4-O4-B`: `CORRECTION` se suma a `manualTypes` en el dashboard (`activity.total = manual + events` se conserva y los eventos automáticos siguen en `events`), y `G4-O5-A`: el enum `CampaignActivityType` del YAML incorpora `MASTER_UPDATE` por paridad con Prisma, sin habilitarlo en el alta manual. Se actualizó la descripción del dashboard y del alta de actividades en `Docs/Contracts/platform-api.v1.yaml`. Pruebas nuevas: una PostgreSQL (`counts a human correction as manual activity and keeps automatic events apart`, con reproducción roja previa) y un ancla de contrato en `src/common/openapi/cp-document.spec.ts`, más las comprobaciones del Swagger servido en `test/without-prospector.e2e-spec.ts`. Regresión sobre árbol limpio del commit: build PASS, 178 unitarias, 84 HTTP, 199 PostgreSQL (461 en total) sobre PG16 desechable. Sin cambios de esquema, migraciones ni módulos protegidos. Evidencia: `../G4/BLOQUE_O4_O5_3B5EEC6.md`.

## Cierre del bloque de brechas — 2026-11-23

HEAD de código `7a63dfbe1d72b695457cf99b830f186af9b3d2bb` + worktree de pruebas. Tras la decisión del owner de no aceptar G4 con parciales, se añadieron doce pruebas dirigidas que cierran `AC-C4-01`, `AC-C3-05`, `AC-P4-03`, `AC-P4-07`, `AC-C1-03`, `AC-C2-03`, `AC-C2-04`, `AC-C3-02`, `AC-C3-03`, `AC-C6-04`, `AC-P2-04` y `AC-P3-04`. Regresión: build PASS, 177 unitarias, 84 HTTP, 196 PostgreSQL (457 en total) sobre PG16 desechable. Cobertura: 50 `CUBIERTO`, 0 `CUBIERTO_PARCIAL`, 0 `NO_CUBIERTO`. Sin cambios en `src/`, `Prisma/`, migraciones ni módulos protegidos. Evidencia: `../G4/CIERRE_BRECHAS_AC_7A63DFB.md`. G4 sigue sin cerrar; la aceptación es del owner.

## Cierre del bloque de cobertura — 2026-11-23

HEAD de código `7a63dfbe1d72b695457cf99b830f186af9b3d2bb` + worktree de pruebas. Se añadieron ocho pruebas de AC (`AC-C2-01`, `AC-C2-02`, `AC-C3-04`, `AC-C4-02`, `AC-C4-03`, `AC-C8-01`, `AC-C8-04`, `AC-P2-02`) y se reforzó la prueba de instantánea del dashboard con aserciones exactas y un intercalado determinista. Regresión: build PASS, 177 unitarias, 84 HTTP, 184 PostgreSQL (445 en total) sobre PG16 desechable. Sin cambios en `src/`, `Prisma/`, migraciones ni módulos protegidos. Evidencia: `../G4/COBERTURA_AC_Y_CONCURRENCIA_7A63DFB.md`. G4 sigue sin cerrar; la aceptación es del owner.

## Sincronización de seguimiento — 2026-11-22

HEAD candidato: `e2bc9275836b642ac3e2b6086c4c15062b4dcd89`; inicio registrado en `../G4/INICIO_VALIDACION_E2BC927.md`. Los límites de cierre de G3 que aparecen abajo son históricos, no un inventario vigente de pendientes. G4 ya registra Swagger servido/paridad CP y ensayos PostgreSQL de concurrencia, tenant y legacy en SHAs posteriores a la implementación inicial. La última regresión completa documentada antes de este candidato corresponde a `71ef72d95537b12713dc81bb91b6abd03018df1c` (114 unitarias, 84 HTTP, 98 PostgreSQL); no se traslada su PASS al HEAD actual. La validación independiente del candidato está en curso.

| Fecha | SHA | Feature(s) | Código/contrato/migración | Prueba incremental | Resultado observado | Restricción / próximo paso |
|---|---|---|---|---|---|---|
| 2026-11-21 | `810723b1314ef04abbb1812b7ddde91a7f6f546` | C1/C2/C3/C4/C6/C8/P1/P2/P3/P4 | Prisma, migración aditiva, servicios y rutas del dominio | `npm run prisma:generate`; `npm run build` | PASS compilación | Ejecutar G4 unit/E2E/PG y publicar Swagger real |

No documentar PASS basándose únicamente en intención o mocks.

## Cambios implementados

- Migración aditiva `20261122000100_campaign_participation_sprint` con estados comerciales, evaluación, responsable, actividades, procedencia y respaldo inicial de participaciones origen.
- `CampaignProspect` conserva `status` histórico y agrega stage/evaluación/responsable sin mapear el estado legado.
- Endpoints de participación: lectura, etapa, evaluación, responsables elegibles, reasignación/desasignación y actividades/correcciones.
- Dashboard por campaña con total, distribuciones, responsabilidad, actividad y clasificación de incorporaciones conocida.
- Filtros adicionales de prospectos por categoría, dirección, fuente, etapa, evaluación y responsable.
- Alta manual con matching explícito: identidad fuerte google_maps por par fuente/identificador, candidatos débiles bloquean creación silenciosa y endpoints `match/resolve`.
- Vista de campañas asociadas y procedencia global por prospecto.
- CSV V1 conserva preview/confirm y ahora registra procedencia/aparición/actualización y actividad de asociación en confirmaciones reales.

## Límites reales al cerrar G3

- OpenAPI/Swagger aún no fue reconciliado ni comprobado contra las rutas nuevas.
- Las pruebas T01–T31 no han sido ejecutadas sobre el HEAD final.
- El PostgreSQL real sintético no ha probado la migración ni los nuevos casos de concurrencia.
- T32 queda reservado para André; no se declara ejecutado por el backend.
- Los endpoints se consideran implementados a nivel código, no validados hasta G4.
