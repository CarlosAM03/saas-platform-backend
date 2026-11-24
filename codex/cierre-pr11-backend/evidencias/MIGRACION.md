# Migración y recuperación local

SQL histórico intacto en los commits de cierre. Blobs Git del baseline:

| Migración | Blob |
|---|---|
| Core `20260909152421_init` | `8424c41f9a882919560116a7bd166d61b9e7e7ce` |
| ADR-006 `20261027000100_tenant_registration` | `af476ee108d362edf525ad168a0a52cf27813db0` |
| CP inicial `20261122000100_campaign_participation_sprint` | `3f5b8bbbf921523f4688e9a2922b6fb357e8411e` |
| CP forward-fix `20261123000100_campaign_participation_history_forward_fix` | `2e5c72f1b3c05c448d01b42410b3b229a3a8ac35` |

PG 16.15 (Debian), Prisma 5.22.0. `a68cc4e`, 2026-11-23 Tijuana. Runtime en base vacía: `npm run prisma:migrate:deploy` aplicó cuatro migraciones, `prisma migrate status` salió 0 y reportó al día. La suite PG incluyó cuatro casos de migración y restricciones, ejecutados en esquemas separados.

## Ensayo ADR-006 y secuencia interrumpida

[ensayo-migracion.cjs](ensayo-migracion.cjs) toma las migraciones exactas de la imagen. En dos esquemas sintéticos aplica primero Core y ADR-006 vía Prisma. Después agrega el SQL CP al directorio temporal de cada fase. Ejecutar enviando por stdin a `docker exec -i <runtime-local> node -` con las variables de destino sintéticas del laboratorio.

- Esquema legacy: tres maestros, dos tenants y una relación previa. Tras la primera CP hubo cuatro participaciones y tres procedencias fabricadas. Se agregó una procedencia sintética legítima para demostrar sensibilidad del filtro. La forward-fix conservó cuatro participaciones, fechas, fuentes, relación previa y la única procedencia legítima. Comparación exacta de columnas de origen y estado de migraciones al día.
- Esquema interrumpido: colisión DDL tardía controlada. Prisma devolvió P3018, no persistieron ni el enum ni columna anterior inspeccionada y la entrada quedó inconclusa. El segundo deploy devolvió P3009. Esta prueba demuestra el comportamiento observado de este motor/archivo ante esa colisión. La migración inicial carece de `BEGIN` explícito y una ejecución manual por sentencias tiene un límite transaccional distinto.

En la imagen de `706cdbf679ec4ac82d89eddfc89fd132fd7575e1` se repitieron ambos ensayos y se ejecutó `pg_dump -Fc` seguido de `pg_restore --exit-on-error` a otra base del contenedor. Origen y restauración devolvieron tres maestros, cuatro participaciones, una procedencia y cuatro migraciones completas. La muestra y el respaldo fueron sintéticos y el proyecto de runtime se destruyó al terminar.

## Recuperación para revisión

Ante incidente entre fases, mantener API detenida, registrar estado de `_prisma_migrations` y catálogo, verificar blobs, comparar relaciones e historia contra un respaldo comprobado y replicar el diagnóstico en un laboratorio. Resolver el incidente con una nueva autorización, revisión de historial y plan de recuperación antes de reanudar migrations o API. El criterio de salida es ambas fases aplicadas, sin procedencia fabricada y con las restricciones y datos válidos. Evitar revertir el esquema mediante borrado de historia.
