---
name: Sprint PG Rehearsal
description: Cómo ensayar migraciones y pruebas PostgreSQL 16 desechables del sprint CP, incluido el backfill T28, sin tocar datos remotos.
---

# Ensayo PostgreSQL — sprint CP

Usa español de México y no uses voseo.

## Entorno

Solo el profile `test` de Docker Compose, que usa una base **desechable**:

```powershell
docker compose --profile test run --build --rm test-postgres
```

Nunca uses `DATABASE_URL` de Supabase, ni la base `saas_local` con datos que quieras conservar, ni ninguna credencial de producción. Nunca ejecutes `prisma migrate deploy` fuera del contenedor de prueba.

## Migración legacy y T28

1. Aplica las tres migraciones oficiales sobre el contenedor de prueba (la imagen ya corre `npm run prisma:migrate:deploy`).
2. Cargá un dataset legacy sintético: participaciones existentes, prospectos con `sourceIdentifier` null, campañas y prospectos huérfanos, y un par de colisiones fuertes controladas.
3. Verifica el backfill:
   - no se fabrican eventos/etapas/evaluaciones para datos previos
   - no se pierden participaciones existentes
   - no se crean participaciones cross-tenant
   - las colisiones de identidad fuerte quedan reportadas, no fusionadas
   - el unique histórico sigue intacto
4. Verifica forward-fix: la migración nueva puede corregirse con una migración posterior, sin editar las históricas.

## Concurrencia

Para identidad fuerte: dos operaciones simultáneas con la misma clave deben producir un éxito y un conflicto (`409`), nunca dos maestros. Ejecuta sobre PostgreSQL real, no con mocks.

## Evidencia

Registra con la skill `sprint-evidence`: SHA, comando, dataset, resultado por caso y limitaciones. Un caso no corrido es `NOT_RUN`.
