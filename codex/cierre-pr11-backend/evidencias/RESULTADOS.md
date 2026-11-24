# Resultados reproducibles por SHA

Fecha 2026-11-23 (America/Tijuana). Comandos completos y fixtures en [Reproducir](REPRODUCIR.md). Esperado: mismas suites y guardas vigentes, cero fallos y ejecución aislada. Salidas extensas quedaron en `.tmp/cp-close-11/` y se conservan los siguientes resultados sanitizados.

| SHA | Proceso | Observado | Estado |
|---|---|---|---|
| `a68cc4e62ab7510503c617f4c78d00d561c52681` | Docker build y perfil test, npm ci, Prisma, guardas, lint y formato | Exit 0 para cada proceso. 12 suites, 178 unitarias. 7 suites, 84 HTTP. 15 suites, 199 PG. Cuatro migraciones. | PASS (461 pruebas) |
| `a68cc4e62ab7510503c617f4c78d00d561c52681` | `smoke-runtime.cjs`, selector de responsables | HTTP 200 y owner elegible presente. Campo `eligible` ausente. El smoke básico completó Auth, CRUD, alta, CSV y dashboard. Marca de reproducción exit 2. | FAIL C4-SEL reproducido |
| `a68cc4e62ab7510503c617f4c78d00d561c52681` con test nuevo montado | `npm run test:postgres -- --runTestsByPath test/prospect-imports.postgres-spec.ts -t 'requires a fresh preview'` | Esperado 409. La segunda confirmación resolvió LINK_EXISTING. Salida 1, test dirigido falló. Código productivo del baseline intacto. | FAIL P3-CSV reproducido |
| `aef737f20382c7886c57975e327c6f63a07bc68b` | Regresión Linux/Node 20 y PG16 | 178 unitarias, 84 HTTP y 200 PostgreSQL. Caso de replay secuencial PASS. | PASS intermedio |
| `d3d52ee3b3bff172cd7a925334432d7c4791e1a4` | `npm run lint:check` en Linux | Salida 1 por `no-unsafe-assignment` en el test concurrente. Runtime, migración y restauración se ejecutaron aparte. | FAIL corregido en 706cdbf |
| `706cdbf679ec4ac82d89eddfc89fd132fd7575e1` | `npm run test:unit:ci -- --verbose` | 178/178, 12 suites, 25.155 s | PASS |
| `706cdbf679ec4ac82d89eddfc89fd132fd7575e1` | `npm run test:e2e:ci -- --verbose` | 84/84, 7 suites, 30.985 s | PASS |
| `706cdbf679ec4ac82d89eddfc89fd132fd7575e1` | `npm run test:postgres -- --verbose` | 200/200, 15 suites, 76.256 s. Caso concurrente y HTTP selector incluidos. | PASS |
| `706cdbf679ec4ac82d89eddfc89fd132fd7575e1` | Guardas, ESLint, Prettier, Prisma Client, build, docker build, dos auditorías npm | Exit 0. Node 20.20.2, npm 10.8.2, Prisma 5.22.0. Guardas `externalConnections:0`. Sin alertas altas, críticas ni del árbol productivo. | PASS |
| `706cdbf679ec4ac82d89eddfc89fd132fd7575e1` | [Smoke](smoke-runtime.cjs) en runtime Docker, PG16 y red interna | Exit 0. Health/live/ready, login y selección de tenant, CRUD de campaña, alta, CSV, dashboard, selector con eligible=true y cero jobs. | PASS |
| `706cdbf679ec4ac82d89eddfc89fd132fd7575e1` | [Ensayo de migración](ensayo-migracion.cjs) y restauración | Exit 0. Cuatro migraciones, cero pendientes, forward-fix de procedencia, P3018/P3009 esperados. Restauración verificada. | PASS |
| `706cdbf679ec4ac82d89eddfc89fd132fd7575e1` | `npm run test:postgres -- --testRegex 'campaigns-performance[.]postgres-spec[.]ts$' --verbose` | 4/4, una suite, 61.228 s, datos de rendimiento conservados. | PASS |

Total de regresión principal del candidato: 462 pruebas en 34 suites. El aumento es de una prueba PostgreSQL de replay CSV. Las pruebas de performance usan ejecución separada. [Rendimiento](RENDIMIENTO.md), [QA por criterio](MATRIZ_QA.csv).

El commit documental de publicación agrega exclusivamente el paquete de cierre y utilidades de reproducción dentro de `codex/cierre-pr11-backend/`. El SHA de código probado se consigna arriba y la comprobación de CI remoto del SHA de publicación queda en el recibo local.
