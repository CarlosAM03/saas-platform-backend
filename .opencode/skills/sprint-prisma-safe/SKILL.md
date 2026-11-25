---
name: Sprint Prisma Safe
description: Checklist de migración Prisma aditiva y segura para el sprint CP. Detecta cambios destructivos y backfills que inventan historial.
---

# Migración Prisma segura — sprint CP

Usa español de México y no uses voseo.

Antes de aprobar cualquier `migration.sql` del sprint, verifica punto por punto.

## Aditivo

- [ ] Solo agrega columnas, tablas, índices y constraints nuevos.
- [ ] No modifica ni elimina columnas/tablas existentes.
- [ ] No altera el unique histórico de `CampaignProspect` ni `users_email_key`.
- [ ] No agrega `ON DELETE CASCADE` sobre tablas con datos históricos.
- [ ] No edita migraciones anteriores (`20260909152421_init`, `20261027000100_tenant_registration`).

## Defaults que no fabrican historial

- [ ] Los defaults de estados nuevos inicializan registros existentes en el valor neutro (`SIN_GESTIONAR`, `SIN_EVALUAR`, responsable nulo).
- [ ] No se insertan actividades, eventos ni procedencias para datos legacy no verificables.
- [ ] La procedencia legacy solo nace de un origen verificable; lo demás queda `LEGADO_DESCONOCIDO`.

## Identidad fuerte

- [ ] La clave derivada es nullable y permite duplicados (`NULL` no colisiona).
- [ ] Se rellena solo para fuente confiable con identificador no vacío.
- [ ] `manual` y `csv` con `sourceIdentifier` null jamás se consideran fuertes.
- [ ] Existe preflight que reporta colisiones antes de escribir, sin fusionar automáticamente.

## Backfill

- [ ] Solo crea participaciones faltantes cuando `Prospect.campaignId` y la campaña son del mismo tenant.
- [ ] No reescribe `updatedAt` de entidades que no cambian.
- [ ] Es forward-fix: no requiere rollback destructivo.

## Previo a ejecutar

- [ ] Preflight: conteos de huérfanos, duplicados fuertes y cross-tenant.
- [ ] Ensayo en PostgreSQL desechable con la skill `sprint-pg-rehearsal`.
- [ ] Registro en `05_EVIDENCIAS/` con la skill `sprint-evidence`.

Si algo de esta lista falla, escalalo al integrador: no se corrige editando la migración histórica.
