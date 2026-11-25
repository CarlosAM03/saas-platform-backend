# G1 — Reconciliación de fuentes

**ESTADO: COMPLETADO**

- Base SHA, branch y fecha: `feat/sprint-campana-prospector`, `5e214420394101ae7079f8e844cc759b01cce2a3`, reconciliado el `2026-11-21`.
- ADR y guía actual: `Docs/ADRs/ADR-004-CommonBaseline.md`, `ADR-003-AuthSecureTransversal.md`, `ADR-006-TenantRegistration-APROBADO.md`, `MODULE-DEVELOPMENT.md`.
- Schema y migrations: esquema real en `Prisma/schema.prisma`; migraciones aditivas observadas `20260909152421_init` y `20261027000100_tenant_registration`.
- Actual vs SPEC A1/INV-01..12: no existe implementación de pipeline, evaluación, actividad, responsable ni procedencia; las 10 features están ausentes del checkout.
- CSV manual/preview/confirm: V1 existente conserva preview firmado, confirmación serializable y límites basales; no implementa identidad fuerte tenant-wide ni selección segura de candidatos múltiples.
- Roles y tenant sin modificaciones: no se modificaron ni se observaron cambios en Auth, RBAC, TenantContext, Users, Tenants ni Prospector.
- Swagger/OpenAPI discrepancias: el contrato `platform-api.v1.yaml` incluye CRUD/CSV actual, pero no documenta recursos C1/C2/C3/C4/C6/C8/P1/P2/P3 nuevos.
- Baseline frontend consultado: solo PR/HEAD histórico de referencia; no se editó ni clonó otro repositorio.
- Riesgos legacy y sourceIdentifier null: el unique histórico sigue siendo `(tenantId,campaignId,source,sourceIdentifier)` y acepta `null`; no aporta identidad fuerte.
- Clasificación del drift y referencias:
  - `COMPATIBLE`: `Campaign.status`, `Prospect.status`, `CampaignProspect.status` y `campaignId` de origen conservan sus semánticas históricas.
  - `LEGACY_SUPERSEDED_POR_A1`: la alta manual crea siempre `source=manual/sourceIdentifier=null` y no busca ni reutiliza maestros tenant-wide.
  - `DRIFT_A_ACLARAR`: el CSV clasifica por nombre normalizado tenant-wide y múltiples candidatos quedan `CONFLICT`, pero no existe fuente fuerte ni selección de candidato persistida.
  - `RIESGO_MIGRACION`: no existen columnas ni tablas de etapa comercial, evaluación, responsable, actividad ni procedencia.
  - `RIESGO_MIGRACION`: el modelo actual permite registrar una participación duplicada solo por clave compuesto; no hay backfill ni datos de origen contextual nuevos.
- Escalamientos necesarios:
  - Confirmar la lista efectiva de fuentes confiables y validadores disponibles para identidad fuerte antes de diseñar claves derivadas.
  - Determinar estrategia compatible con el unique histórico sin exigir una migración destructiva o fusiones automáticas.
  - Definir nombres REST/DTO locales en G2 dentro de las capacidades permitidas; no requiere regla de negocio nueva.
- Resultado: `G1 COMPLETADO; se autoriza continuar G2 sin modificar módulos protegidos`

## Inventario técnico verificable

| Área | Estado real en el HEAD | Evidencia |
|---|---|---|
| Campañas CRUD/listado/prospectos | Implementado sobre modelo histórico | `src/campaigns/campaigns.controller.ts`, `campaigns.service.ts` |
| Participación N:M | Existe `CampaignProspect(campaignId,prospectId)` con `status` legado | `Prisma/schema.prisma`, migración init |
| Alta manual | Transacción crea maestro + asociación; no busca coincidencias; MEMBER 403 | `src/prospects/prospects.service.ts`, `prospects.controller.ts` |
| CSV V1 | Preview/confirm, signed reference 15 min, Serializable, límites existentes | `src/prospects/imports/prospect-imports.service.ts`, README |
| Identidad fuerte | No existe; el legacy unique incluye campaña y permite null | esquema Prisma y migración init |
| C1/C2/C3/C4 | Sin tablas, enums, DTO, controladores ni servicios específicos | búsqueda de baseline G1 |
| C6/C8/P2 | Sin filtros comerciales avanzados ni dashboard por campaña; solo listado maestro básico | `campaigns.service.ts`, contratos actuales |
| P3 procedencia | Sin modelo global confirmado; solo campos `campaignId/source/sourceIdentifier/createdAt` maestros | esquema actual |
| P4 CSV ampliado | Base V1 compatible, pero falta resolución fuerte/de candidato seleccionado en contrato | `prospect-imports.*` |
| Prospector/Jobs | Se conserva fuera de alcance; los módulos no fueron modificados | G1 solo lectura |

## Hallazgos de implementación

1. **CREACIÓN MANUAL SIN P1**: `ProspectsService.create` crea directamente el maestro con `sourceIdentifier=null` y una asociación, sin consultar candidatos ni permitir link/manual consciente. Clasificación `LEGACY_SUPERSEDED_POR_A1`.
2. **COINCIDENCIA CSV SOLO POR NOMBRE**: el importador carga todos los candidatos del tenant por nombre normalizado y marca múltiples coincidencias como `CONFLICT`; no usa una clave fuerte válida ni conserva una selección explícita de candidato en el DTO actual. Clasificación `DRIFT_A_ACLARAR`.
3. **ASOCIACIÓN REPETIDA NO REINICIA CONTEXTO**: CSV usa `upsert` compuesto y confirma la asociación existente, compatible con la intención B6; sin embargo no existen campos comerciales independientes ni eventos. Clasificación `COMPATIBLE` pero incompleto.
4. **DEFAULTS COMERCIALES AUSENTES**: `CampaignProspect.status` sigue siendo `ACTIVO`, sin traducción a etapa comercial; no existe evaluacion, responsable ni actividad. Clasificación `RIESGO_MIGRACION`.
5. **PROCEDENCIA LEGACY LIMITADA**: el código conserva campaña origen, source y sourceIdentifier, pero no registra apariciones confirmadas ni actualizaciones globales. Clasificación `RIESGO_MIGRACION`.
6. **FILTRADO BASE CORRECTO**: campañas y prospectos filtran por tenant y el listado de campaña ya combina origen y asociaciones. Esto puede reutilizarse, pero no satisface C6/C8 ni evita join multiplicador sin agregados adicionales. Clasificación `COMPATIBLE`.
7. **CSV POSIBLEMENTE COMPATIBLE**: referencia HMAC, hash de archivo, snapshot, 15 minutos, límite de payload, action set y rollback ya existen. Deben mantenerse y extenderse con revalidación/candidatos. Clasificación `COMPATIBLE`.
8. **PRIORIDAD DE QA**: las pruebas de campaña existentes usan mocks/fake Prisma en parte; el PostgreSQL real ya existe para CSV. G4 seguirá exigiendo PG real sintético para concurrencia, migración e aislamiento de las nuevas tablas. Clasificación `DRIFT_A_ACLARAR`.
9. **CONTRATO PRELIMINAR INCOMPLETO**: no inventar endpoints nuevos como disponibles. G2 debe diseñarlos y G4 comprobar Swagger antes de G5. Clasificación `DRIFT_A_ACLARAR`.

## Estructuras protegidas no modificadas

- Auth/JWT: sin cambios.
- RBAC/RolesGuard: sin cambios.
- TenantContext/guards: sin cambios.
- Users/UserTenant: sin cambios.
- Tenants/onboarding ADR-006: sin cambios.
- ProspectorClient/ProspectingJobs/Jobs/Engine/infra: sin cambios.
- PR #10/#11: sin cambios ni merge.
