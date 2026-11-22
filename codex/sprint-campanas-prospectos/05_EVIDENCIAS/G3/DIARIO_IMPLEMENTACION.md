# G3 — Diario de implementación

**ESTADO: IMPLEMENTACIÓN DE BASE COMPLETADA — VALIDACIÓN G4 PENDIENTE**

| Fecha | SHA | Feature(s) | Código/contrato/migración | Prueba incremental | Resultado observado | Restricción / próximo paso |
|---|---|---|---|---|---|---|
| 2026-11-21 | `PENDIENTE_COMMIT_G3` | C1/C2/C3/C4/C6/C8/P1/P2/P3/P4 | Prisma, migración aditiva, servicios y rutas del dominio | `npm run prisma:generate`; `npm run build` | PASS compilación | Ejecutar G4 unit/E2E/PG y publicar Swagger real |

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
