# Registro de fuentes y contexto (pinned vs runtime)

## Entregados íntegros en el ZIP

1. `SPEC_SPRINT_CAMPANAS_PROSPECTOS_v1.0_OWNER_APROBADO.md` — **única especificación de resultados y decisiones del owner para este sprint** (ratificada 19/11/2026).
2. `auditoria_pre_spec_sprint_campanas_prospectos_2026-11-19.md` — estado real observado al auditar; **histórico, no HEAD futuro**.
3. `alcance_sprint_campanas_prospectos_v1_revision.md` — selección previa, reglas entonces abiertas; **superada por SPEC**.
4. `contexto_base_campanas_y_arneses_v0.md` — discusión inicial; contiene propuestas no aprobadas; **no normativa**.

## Leer SIEMPRE en el checkout autorizado del backend

- `Docs/ADRs/ADR-004-CommonBaseline.md` (invariantes transversales)
- `Docs/ADRs/ADR-003-AuthSecureTransversal.md` (seguridad, subordinado en puntos supersedidos por F4)
- `Docs/ADRs/ADR-006-TenantRegistration-APROBADO.md` y notas/handoff recientes (onboarding fuera de sprint)
- `Docs/ADRs/ADR-001-DecisionesDeDominioMVP.md` (solo identidad por campaña simplificada queda sustituida por A1)
- `MODULE-DEVELOPMENT.md` (NestJS, DTO, guards, tests y errores)
- `Prisma/schema.prisma` + migraciones **presentes en el HEAD actual**
- `Docs/Contracts/platform-api.v1.yaml` + Swagger servido + `src/common/openapi/*`
- `src/campaigns/*`, `src/prospects/*`, `src/prospects/imports/*`, tests asociados
- `AGENTS.md` cuando exista

## Leer en frontend solo como referencia de contrato/handoff

- `FEATURE-DEVELOPMENT.md`
- `Docs/ADRs/ADR-005-FlutterFoundation.md` (si existe en la base autorizada)
- `lib/platform_api/*`, `lib/features/campaigns/*`, `lib/features/prospects/*`, `lib/features/dashboard/*`
- `codex/*` y guías/AGENTS.md aplicables

## Enlaces de contexto remoto observados

- Backend PR #10: https://github.com/CarlosAM03/saas-platform-backend/pull/10 — HEAD observado `5e214420394101ae7079f8e844cc759b01cce2a3`.
- Flutter PR #11: https://github.com/CarlosAM03/saas-platform-client/pull/11 — HEAD observado `0fe5d368e11b1da745ccf42ead3892470dcae0be`.

**No** descargar y fijar ciegamente esos documentos desde main: su contenido operativo proviene del HEAD que apruebe el owner. Si no hay conectividad, leer la copia local, registrar limitaciones y no afirmar estado de PR actual.
