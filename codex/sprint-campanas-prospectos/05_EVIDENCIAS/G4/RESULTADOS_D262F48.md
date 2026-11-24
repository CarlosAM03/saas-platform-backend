# G4 — Revalidacion sobre HEAD documental

- Fecha: `2026-11-22T14:19:54-08:00`
- Rama: `feat/sprint-campana-prospector`
- HEAD: `d262f48e9ab6b344c472df60588c2261d377c884`
- Entorno: host local y Docker Compose; PostgreSQL 16 desechable
- Fixtures: suites existentes con datos sintéticos; Swagger servido desde Compose local
- Cambios posteriores verificados: reconciliación OpenAPI CP en `Docs/Contracts/platform-api.v1.yaml` y aserciones de Swagger en `test/without-prospector.e2e-spec.ts`; no se modificaron módulos protegidos

| Comando | Esperado | Observado | Resultado |
|---|---|---|---|
| `npm run build` | compilacion sin errores | codigo 0 | PASS |
| `npm run test:unit:ci` | suites verdes | 11 suites, 113/113 | PASS |
| `npm run test:e2e:ci` | suites verdes | 7 suites, 84/84 | PASS |
| `docker compose --profile test run --build --rm test-postgres` | PostgreSQL sintético verde | 11 suites, 93/93 | PASS |
| `docker compose up --build --wait api`, `curl.exe http://127.0.0.1:3000/api/docs-json`, `curl.exe http://127.0.0.1:3000/api/docs` | API y Swagger accesibles | JSON 39 rutas/51 operaciones; UI HTTP 200 | PASS para disponibilidad, no para drift |
| `npm run test:e2e:ci -- test/without-prospector.e2e-spec.ts` | Swagger CP publicado y rutas CP marcadas AVAILABLE | 5/5 PASS; rutas CP presentes | PASS PARCIAL contractual |
| `docker compose --profile test run --build --rm test-postgres` | Suite completa del bloque T01–T31 disponible | 11 suites, 94/94 PASS | PASS de suite; G4 no cerrado por casos NOT_RUN/PARCIAL |

Limitaciones:
- Esta ejecución no reemplaza la revisión independiente ni completa la matriz T01–T31.
- Rendimiento y volumen sintético: NOT_RUN.
- T32 permanece fuera del backend.
- El Swagger servido no elimina el drift contractual ya registrado; G4 sigue NO CERRADO.
