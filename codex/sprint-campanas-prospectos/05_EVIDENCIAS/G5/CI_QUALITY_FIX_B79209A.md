# G5 — Corrección del check CI `quality` (push de `feat/sprint-campana-prospector`)

- Fecha: `2026-11-23` (America/Tijuana, `-08:00`).
- Commit correctivo: `b79209a786c43cacac1c99cab6bdea1c3b1fd963` (árbol limpio; padre `486d3e9`).
- Rama: `feat/sprint-campana-prospector` (remoto en `486d3e9` al emitir este documento; **el agente no ejecutó push**).
- Autorización: instrucción del owner en esta conversación: «lo que recomiendes esta bien».

## 1. Hallazgo

El job `CI / quality` falló en el paso `node codex/backend-adr006/verify-contract.cjs`:

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
46 !== 33
    at verify-contract.cjs:19:8
```

**Causa:** el verificador de ADR-006 exigía que el YAML vivo tuviera exactamente **33 operaciones** (el baseline previo a Tenant Registration) y comparaba el contrato actual contra el snapshot aprobado de onboarding. El sprint CP añadió **13 operaciones** revisadas (C1/C2/C3/C4/C6/C8 y P1/P2/P3), por lo que la aserción de conteo era incompatible con una extensión legítima y aprobada.

No era un defecto de la API: el contrato servido y las pruebas ya validaban esas 13 operaciones.

## 2. Cambio aplicado

`codex/backend-adr006/verify-contract.cjs` (sólo verificación; no cambia contrato ni código de producto):

| Garantía histórica | Cómo queda |
|---|---|
| Snapshot aprobado = 33 baseline + 5 de Tenant Registration | Se deriva el baseline quitando las 5 operaciones de registro al snapshot aprobado y se exige **38 aprobadas** y **33 baseline**. |
| Ninguna operación previa desaparece | Toda operación baseline debe existir en el YAML vivo. Las 5 de registro quedan fuera del YAML a propósito (las sirve `deploymentDocument`). |
| El contrato sólo crece por cambios revisados | `vivo − baseline` debe ser **exactamente** la lista explícita de 13 operaciones CP; cualquier ruta nueva sin revisión falla. |
| Referencias `$ref` locales resolubles | Igual que antes, sobre ambos documentos. |
| Login sin cambios de contrato de cable | Igual que antes: `security`, `requestBody` y `responses` idénticos entre vivo y aprobado. |

Salida observada del verificador corregido:

```json
{"timestamp":"2026-11-24T00:26:47.950Z","baselineOperations":33,"approvedOperations":38,"liveOperations":46,"addedTenantRegistration":5,"addedCampaignParticipation":13,"localReferences":"PASS","loginContract":"unchanged","result":"PASS"}
```

## 3. Segundo fallo del mismo job (line endings)

Al superar el paso anterior, `npm run lint:check` falló con 21 errores `prettier/prettier` por **finales de línea mezclados** en cinco archivos TypeScript:

- `src/campaigns/campaigns.controller.ts`
- `src/common/openapi/tenant-registration-document.spec.ts`
- `src/prospects/dto/resolve-prospect.request.ts`
- `test/jobs.postgres-spec.ts`
- `test/users-authorization.postgres-spec.ts`

Se normalizaron los finales de línea con `npx prettier --write` sobre esos cinco archivos. El cambio es de formato: unión de argumentos en dos llamadas, indentación de un `it(...)` y finales de línea uniformes. No hay cambios de comportamiento. Los blobs quedan en LF, igual que el resto de `src/`, `test/` y `Prisma/`.

## 4. Reproducción local de los tres jobs de CI

Todo se ejecutó dos veces con el mismo resultado: primero sobre el árbol de trabajo que se consolidó en `b79209a` y después **sobre el commit limpio `b79209a`** (único cambio sin seguimiento: este documento). Las pruebas funcionales corren en Node 20 dentro del contenedor `test-postgres`.

| Paso de CI | Comando | Resultado |
|---|---|---|
| `verify-target-guards.cjs` | `node codex/backend-adr006/verify-target-guards.cjs` | PASS, `externalConnections:0` |
| `verify-contract.cjs` | `node codex/backend-adr006/verify-contract.cjs` | PASS (JSON arriba) |
| `lint:check` | `npm run lint:check` | exit 0 |
| `format:check` | `npm run format:check` | exit 0, «All matched files use Prettier code style!» |
| `build` | dentro de `docker compose ... test-postgres` | PASS |
| `test:unit:ci` | idem | 12 suites, 178/178 |
| `test:e2e:ci` | idem | 7 suites, 84/84 |
| `npm audit --audit-level=high` | local | exit 0 (sólo 25 moderadas, umbral `high`) |
| `npm audit --omit=dev --audit-level=high` | local | exit 0, 0 vulnerabilidades |
| `postgres-integration` | `prisma:migrate:deploy` + `test:postgres` en PG16 desechable | 4 migraciones; 15 suites, 199/199 |
| `docker-build` | `docker build .` | exit 0 |

Comando único de la corrida funcional:

```text
docker compose --profile test run --build --rm test-postgres sh -c "npm run build && npm run test:unit:ci && npm run test:e2e:ci && npm run prisma:migrate:deploy && npm run test:postgres"
```

## 5. Límites

- Estos resultados son **reproducción local** de los pasos de CI sobre Linux/Node 20 en contenedor; **no** sustituyen la ejecución real de GitHub Actions, que sólo puede verificarse tras el push.
- El agente no ejecutó `git push` (prohibido por `AGENTS.md`). El push del commit `b79209a` corresponde al owner; después debe revisarse el check `CI / quality` en GitHub.
- Si CI volviera a fallar, el paso exacto debe registrarse con su log antes de declarar verde.
- Sin cambios en Auth/JWT/RBAC/TenantContext, Users/Tenants, Prospector, migraciones ni contrato funcional.
