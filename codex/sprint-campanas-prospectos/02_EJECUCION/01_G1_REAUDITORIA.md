# G1 — Reauditoría mínima obligatoria del checkout autorizado

**Entrada:** G0 aprobado con SHA real, rama nueva segura.  
**Salida:** `05_EVIDENCIAS/G1/RECONCILIACION.md`.

Inspeccionar realmente, sin asumir que la auditoría de 2026-11-19 sigue vigente:

- Prisma schema y migraciones, tablas `Campaign`, `Prospect`, `CampaignProspect`, `UserTenant`; FK, nullability, unique con `sourceIdentifier=null`, datos legacy, semántica de status.
- `src/campaigns`, `src/prospects`, `src/prospects/imports`: controladores/DTOs/servicios, CRUD, CSV preview/confirm, parser, límites, errores, reintentos, dependencias de Jobs.
- Auth/TenantContext/RBAC **solo para lectura/compatibilidad**; permisos efectivos de `ADMIN/OWNER/MEMBER`, current tenant y endpoints de Users disponibles para elegir responsable.
- OpenAPI aprobado vs generado/servido y tests. Anotar representaciones de `GET /campaigns/{id}/prospects`, altas e importación.
- Frontend en PR/HEAD autorizado para lectura: `lib/platform_api`, pantallas de campañas/prospectos/importador y dashboard; respetar sus protecciones; no editar Flutter.
- PR #10/#11 pueden haberse movido o fusionado; registrar antes/después con SHAs y consecuencias.

Clasificar cada hallazgo: `COMPATIBLE`, `LEGACY_SUPERSEDED_POR_A1`, `DRIFT_A_ACLARAR`, `REQUIERE_OWNER`, `RIESGO_MIGRACION`. No modificar un endpoint protegido durante esta fase.

**Prueba de salida:** matriz de diferencias, fuentes exactas y alcance G2; ningún conflicto crítico sin clasificación y escalamiento.
