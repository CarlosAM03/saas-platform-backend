# G4 — Cierre del bloque de lectura: dashboard coherente y contrato reconciliado

- Registro: `2026-11-23T13:00:45-08:00`. Cada ejecución conserva su comando y su salida; no se inventan horas por paso.
- HEAD exacto probado: `7a63dfbe1d72b695457cf99b830f186af9b3d2bb`, rama `feat/sprint-campana-prospector`.
- Commit funcional: `feat(sprint-cp): complete contextual reads and dashboard snapshot`.
- Alcance autorizado: continuar el bloque pendiente del sprint (instrucción del owner en conversación «retoma la implementacion»). No incluye push, merge, deploy, datos reales, cambios protegidos ni aceptación de gates del owner.
- Estado de entrada: worktree sin commit sobre `e2bc927` con 354 pruebas verdes de una corrida anterior; esas pruebas **no** certificaban las ampliaciones posteriores de lectura.

## Cambios implementados en este bloque

| ID | Archivo | Cambio | Motivo |
|---|---|---|---|
| DASH-SNAP | `src/campaigns/campaigns.service.ts` | `dashboard()` valida campaña y lee participaciones + dos conteos de actividad dentro de una sola transacción interactiva con `RepeatableRead`. | Un lector secuencial podía devolver totales de participaciones y de actividad de instantes distintos. |
| DASH-TEST | `test/campaigns-read-capabilities.postgres-spec.ts` | Nueva prueba con 20 lectores concurrentes y 20 escritores que crean participación + evento automático en la misma transacción; verifica sumas iguales al total y `events >= total`. | Reproducir la incoherencia señalada y dejarla cubierta. |
| DASH-TENANT | mismo archivo | Verifica 404 del dashboard para tenant ajeno. | Aislamiento explícito del agregado. |
| E2E-FAKE | `test/campaigns.e2e-spec.ts` | El doble en memoria ahora aplica `select`/`where` anidados en relaciones; las fixtures de `campaignProspects` incluyen `prospect.tenantId`. | La regresión HTTP quedaba en `total: 0` y filtraba `tenantId` por fidelidad insuficiente del doble, no por fuga real del servicio. |
| CONTRATO | `Docs/Contracts/platform-api.v1.yaml` | Dashboard declara lectura de una misma instantánea y elegibilidad por membresía; filtros `addedFrom/addedTo/activityFrom/activityTo`, participación contextual, elegibilidad, paginación P2/P3 y `contextCampaignId` ya estaban descritos y se mantienen. | Alinear contrato con el código implementado sin inventar campos. |
| CONTRATO-TEST | `src/common/openapi/cp-document.spec.ts` | Nueva prueba que ancla filtros contextuales, esquema `CampaignParticipation` y descripción de instantánea; además se tipó el servidor HTTP y la app para lint. | Evitar que el YAML vuelva a divergir del código. |

No se modificaron Prisma, migraciones, Auth/JWT/RBAC/TenantContext, Users/Tenants ni Prospector. `git diff --stat` del commit funcional no toca esas rutas.

## Ejecución de regresión completa (Node 20 dentro de contenedor)

Comando único, todos los pasos alcanzados con `&&`:

```text
docker compose --profile test run --build --rm test-postgres sh -c "npm run build && npm run test:unit:ci && npm run test:e2e:ci && npm run prisma:migrate:deploy && npm run test:postgres && npm run test:postgres -- --testRegex campaigns-performance"
```

| ID | Gate | Comando interno | Dataset | Esperado | Observado | Estado | Evidencia |
|---|---|---|---|---|---|---|---|
| BUILD-7A63 | G4 | `npm run build` | árbol del commit | compila | `nest build` código 0 | PASS | salida de la cadena |
| UNIT-7A63 | G4 | `npm run test:unit:ci` | fixtures unitarios sintéticos | verde | 12 suites, **177/177** | PASS | resumen Jest |
| HTTP-7A63 | G4 | `npm run test:e2e:ci` | HTTP con dobles en memoria | verde | 7 suites, **84/84** | PASS | resumen Jest |
| MIG-7A63 | G4 | `npm run prisma:migrate:deploy` | PG16 desechable | sin pendientes | 4 migraciones encontradas, ninguna pendiente | PASS | salida Prisma |
| PG-7A63 | G4 | `npm run test:postgres` | PG16 desechable, fixtures sintéticos | verde | 15 suites, **175/175** | PASS | resumen Jest |
| PERF-7A63 | G4 | `npm run test:postgres -- --testRegex campaigns-performance` | 5 000 participaciones, 2 tenants | 4 casos verdes | 4/4 PASS; 74.313 s la primera corrida | PASS descriptivo | `G4_PERF_SUMMARY` |

Total de la regresión funcional: **436 pruebas** (177 + 84 + 175), 34 suites entre tres invocaciones. Las 4 pruebas de rendimiento no se suman a ese total.

Suites PostgreSQL ejecutadas (15): `campaigns-tenant-isolation`, `prospect-review-regressions`, `campaigns-read-capabilities`, `users-authorization`, `campaigns-review-regressions`, `prospect-read-capabilities`, `jobs`, `tenant-registration`, `prospect-imports`, `onboarding-http`, `prospect-identity`, `core-isolation`, `campaign-participation-migration`, `proxy-rate-limit`, `tenant-registration-migration`.

## Rendimiento observado (descriptivo, sin SLA)

Dos mediciones sobre el mismo SHA y el mismo fixture:

| Etiqueta | Corrida A (mediana) | Corrida B (mediana) | Nota |
|---|---|---|---|
| `filter_page_1` | 22.306 ms | 22.313 ms | Primera muestra 63.187 s / 31.215 s; el valor atípico se conserva, no se elimina ni se promedia. |
| `unfiltered_page_100` | 32.172 ms | 31.058 ms | — |
| `dashboard_5000` | 260.864 ms | 274.181 ms | Incluye ahora una sola transacción `RepeatableRead`. |

Dataset total: 6 000 maestros, 7 667 participaciones, 18 000 actividades y 5 001 procedencias, dos tenants. No equivale a producción ni mide concurrencia real de usuarios.

## Verificación de alcance y estilo

- `npx prettier --check` y `npx eslint` sobre los archivos tocados de dominio y pruebas: código 0.
- Sin cambios en `Prisma/`, migraciones, `src/auth`, `src/users`, `src/tenants`, guards ni contexto de tenant.
- Sin `git push`, merge, deploy, migración remota ni edición de PR previos.

## Limitaciones y riesgos residuales

1. **Certificación G4:** la regresión verde cubre lo ejecutado; no demuestra por sí sola conformidad exhaustiva de todos los AC ni autoriza liberación. La matriz por AC en `03_CALIDAD/MATRIZ_AC_Y_TESTS.md` explicita qué queda cubierto y qué no.
2. **Concurrencia del dashboard:** la prueba usa PostgreSQL real con 20 lectores y 20 escritores; no reproduce carga de producción ni latencias de red.
3. **Doble en memoria HTTP:** se mejoró su fidelidad; sigue siendo un doble y no sustituye PostgreSQL para las reglas de dominio.
4. **Primera muestra de rendimiento:** los valores atípicos en frío se conservan tal cual; no se declaran como rendimiento estable.
5. **T32** permanece fuera del backend y **G6** depende de la aceptación del owner.
