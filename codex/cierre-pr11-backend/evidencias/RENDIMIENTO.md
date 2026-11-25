# Rendimiento descriptivo en PostgreSQL 16

SHA `706cdbf679ec4ac82d89eddfc89fd132fd7575e1`, 2026-11-23 Tijuana. Docker Desktop Linux, Node 20.20.2, PostgreSQL 16.15 y Prisma 5.22.0. Dos tenants, tres campañas, un tenant paralelo de 1 000 maestros y tenant principal escalado. Mediciones HTTP dentro del contenedor, 20 muestras secuenciales por caso, mediana y p95 empírico. Se ejecutó en paralelo con la regresión local, por lo que refleja la carga de ese momento.

| Maestros en tenant | Filas CSV | Match mediana / p95 ms | Preview mediana / p95 ms | Confirm SKIP mediana / p95 ms |
|---:|---:|---:|---:|---:|
| 600 | 600 | 54 / 78 | 52 / 77 | 43 / 62 |
| 1 000 | 1 000 | 53 / 79 | 61 / 112 | 92 / 147 |
| 5 000 | 1 000 | 353 / 479 | 389 / 581 | 577 / 750 |

[Runtime](smoke-runtime.cjs) verifica un único candidato, el número de filas y el resultado SKIP. El smoke confirma además un CREATE real. La serie confirm mide validación transaccional SKIP y no el volumen de escritura de un CREATE por cada fila. Sin timeout observado en estas series.

En `a68cc4e` se ejecutó también `EXPLAIN (ANALYZE, BUFFERS)` sobre una consulta representativa de lectura por tenant y orden por nombre/ID: escaneo secuencial de 6 000 filas, 5 000 aceptadas, quicksort de 544 kB, ejecución de 60.2 ms. Es una consulta reducida y no el plan de toda la operación Prisma. El costo HTTP incluye transferencias, validación y normalización. Sin SLO ni extrapolación de estas mediciones a hosting.

Matching manual solicita los maestros del tenant y compara normalizaciones en memoria. CSV obtiene maestros y relaciones del tenant y clasifica por nombre. El cambio de replay añade un conteo filtrado de apariciones en la misma campaña. Se conserva la semántica de matching. Una eventual optimización debe mantener normalización, orden y detección de candidatos ambiguos.

## Dashboard y paginación

Suite PG optativa en el mismo SHA, 4/4 PASS. Fixture independiente de dos tenants, tres campañas, 6 000 maestros totales, 7 667 participaciones, 18 000 actividades y 5 001 procedencias. Verificó oráculos de agregado, aislamiento, orden y páginas. Cinco muestras por caso. El p95 empírico por rango más cercano corresponde al máximo para este tamaño.

| Caso | Mediana ms | p95 ms |
|---|---:|---:|
| Filtros combinados, página 1 | 1 104 | 2 428 |
| Página profunda 100 sin filtro | 3 322 | 6 723 |
| Dashboard de 5 000 participaciones | 395 | 439 |

La página profunda tuvo latencia variable. El SHA intermedio `aef737f` registró 94 ms de mediana con la misma implementación de lectura. Se conserva la observación del candidato y se advierte la variabilidad local. Estos datos no justifican atribuir la diferencia al cambio CSV ni certificar capacidad en hosting.
