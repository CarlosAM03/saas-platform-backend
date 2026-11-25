# G4 — Revisión técnica final de paridad contractual (CP)

- Fecha ISO de la revisión: `2026-11-23T14:20:00-08:00` a `2026-11-23T14:47:56-08:00`
- HEAD de ejecución real: `17d37423a38d7fd350defce18c8f62fb3a8dda16` (rama `feat/sprint-campana-prospector`, árbol limpio)
- Commit de referencia del encargo: `0d1dd02` = `0d1dd027f377373acf1b88e7db10f838694b2d4b`
- **Nota de SHA (hallazgo B6):** el SHA largo citado en el encargo (`0d1dd0235816a44d171f4d4b30a94f7c595b7ac0`) **no resuelve en el repositorio**. El prefijo `0d1dd02` corresponde a `0d1dd027f377373acf1b88e7db10f838694b2d4b`. El diff `0d1dd02..17d3742` modifica únicamente 4 archivos de evidencia/documentación (sin código), por lo que las ejecuciones de este informe aplican al mismo estado de código del sprint.
- Rol: especialista de contratos. Alcance de escritura: este archivo y `Docs/`. No se modificó `src/`, `Prisma/`, `test/`, módulos protegidos, ni se ejecutaron git push, merge, deploy ni migraciones sobre infraestructura remota.
- Método: reconciliación en cuatro direcciones (controladores NestJS ↔ DTOs ↔ `deploymentDocument()` ↔ YAML objetivo ↔ Swagger servido) más ejecución real de suites.

## Fuentes reconciliadas

1. Controladores: `src/campaigns/campaigns.controller.ts`, `src/prospects/prospects.controller.ts`, `src/prospects/imports/prospect-imports.controller.ts` y sus DTOs.
2. Contrato objetivo: `Docs/Contracts/platform-api.v1.yaml` (18 rutas CP, líneas 277–851).
3. Documento servido: `deploymentDocument()` en `src/common/openapi/deployment-document.ts` (carga el YAML; solo muta rutas de prospecting-jobs, `info`, `servers` y registro de tenants; conserva las rutas CP íntegras).
4. Ancla de prueba: `src/common/openapi/cp-document.spec.ts` (59 aserciones: esquemas, roles, filtros, envelopes, YAML → Swagger servido vía HTTP aislado).

**Correspondencia de operaciones:** 25 operaciones implementadas en los tres controladores (15 Campaigns + 8 Prospects + 2 Imports) ↔ 25 operaciones CP documentadas en el YAML. Ninguna ruta implementada sin documentar; ninguna ruta CP documentada sin implementar.

## Tabla de operaciones nuevas → ruta → estado

Estado `AVAILABLE` = implementada **y** probada en este HEAD (evidencia E1–E6 abajo). Sin `CONTRACT_ONLY` ni `503` en el perímetro CP.

| ID | Método y ruta | Estado | Campos de contrato (request → response) | Errores | Roles / tenant |
|---|---|---|---|---|---|
| C1 | `PATCH /api/v1/campaigns/{campaignId}/prospects/{prospectId}/stage` | AVAILABLE | `UpdateStageRequest{stage: CommercialStage}` → `data: CampaignParticipation` | 400, 401, 403, 404 | ADMIN, OWNER, MEMBER / tenant seleccionado |
| C1 | `GET /api/v1/campaigns/{campaignId}/prospects/{prospectId}/participation` | AVAILABLE | — → `data: CampaignParticipation` | 401, 403, 404 | ídem |
| C2 | `PATCH /api/v1/campaigns/{campaignId}/prospects/{prospectId}/evaluation` | AVAILABLE | `UpdateEvaluationRequest{evaluation: CommercialEvaluation, reason?: ≤1000}` → `data: CampaignParticipation` (NO_APTO exige reason no vacío tras trim) | 400, 401, 403, 404 | ídem |
| C3 | `GET /api/v1/campaigns/{campaignId}/prospects/{prospectId}/activities` | AVAILABLE | `page, limit, search, sortBy, sortOrder` (aceptados; orden fijo `recordedAt desc, id desc`) → `data: CampaignActivity[], meta: PaginationMeta` | 400, 401, 403, 404 | ídem |
| C3 | `POST /api/v1/campaigns/{campaignId}/prospects/{prospectId}/activities` | AVAILABLE | `CreateCampaignActivityRequest{type: NOTE\|CALL\|EMAIL\|MEETING\|OTHER, content ≤5000, declaredAt?, correctsId?}` → `201 data: CampaignActivity` (con `correctsId` el tipo es `CORRECTION`) | 400, 401, 403, 404 | ídem |
| C4 | `GET /api/v1/campaigns/{campaignId}/prospects/{prospectId}/responsibles` | AVAILABLE | — → `data: ResponsibleUser[]` (activos con membresía; orden nombre, id) | 401, 403, 404 | ídem |
| C4 | `PUT /api/v1/campaigns/{campaignId}/prospects/{prospectId}/responsible` | AVAILABLE | `AssignResponsibleRequest{responsibleId: ≤128, no blanco}` → `data: CampaignParticipation` | 400 (no activo/no miembro), 401, 403, 404 | ídem |
| C4 | `DELETE /api/v1/campaigns/{campaignId}/prospects/{prospectId}/responsible` | AVAILABLE | — → `data: CampaignParticipation` (responsable nulo; historia preservada) | 401, 403, 404 | ídem |
| C6 | `GET /api/v1/campaigns/{id}/prospects` | AVAILABLE | `page, limit, search, sortBy(name\|email\|status\|createdAt\|updatedAt), sortOrder, category, address, source, stage, evaluation, responsibleId(+UNASSIGNED), addedFrom, addedTo, activityFrom, activityTo` → `data: (Prospect + participation: CampaignParticipation)[], meta` | 400 (fecha inválida/sin zona/rango invertido), 401, 403, 404 | ídem |
| C8 | `GET /api/v1/campaigns/{id}/dashboard` | AVAILABLE | — → `data: CampaignDashboard{total, stages, evaluations, responsibility, activity{total,manual,events}, incorporation{new,reused,unknownLegacy}}` | 401, 403, 404 | ídem |
| P1 | `POST /api/v1/prospects` | AVAILABLE | `CreateProspectRequest` → `201 data: Prospect` (crea o reutiliza; identidad fuerte reutiliza sin editar) | 400, 401, 403, 404, 409 | ADMIN, OWNER / tenant seleccionado |
| P1 | `POST /api/v1/prospects/match` | AVAILABLE | `CreateProspectRequest` → `201 data: ProspectMatch{strongProspect, candidates, resolutionRequired}` | 400, 401, 403, 404 (+ **409 producido y no documentado**, ver M2) | ADMIN, OWNER |
| P1 | `POST /api/v1/prospects/resolve` | AVAILABLE | `ResolveProspectRequest{campaignId, name, resolution: CREATE\|LINK_EXISTING\|SKIP, candidateId?}` → `201 data: ProspectResolve{action, prospect?}` | 400, 401, 403, 404, 409 | ADMIN, OWNER |
| P2 | `GET /api/v1/prospects/{id}/campaigns` | AVAILABLE | `page, limit` (máx. 100) → `data: ProspectCampaigns{originCampaignId, campaigns[], **meta anidado en data**}`; orden `addedAt desc, campaignId asc` | 400, 401, 403, 404 | ADMIN, OWNER, MEMBER |
| P3 | `GET /api/v1/prospects/{id}/provenance` | AVAILABLE | `page, limit` → **envelope** `success, data: ProspectProvenanceEvent[], meta` (meta en nivel superior); orden `recordedAt desc, id desc` | 400, 401, 403, 404 | ADMIN, OWNER, MEMBER |
| P3 | `PATCH /api/v1/prospects/{id}` (contexto) | AVAILABLE | `UpdateProspectRequest{contextCampaignId? ≤128 + campos maestros}` → `data: Prospect`; solo `contextCampaignId` → 400; `MASTER_UPDATED` se registra en la campaña de contexto | 400, 401, 404, 409 | ADMIN, OWNER, MEMBER |
| P4 | `POST /api/v1/prospects/import/preview` | AVAILABLE | multipart `campaignId, file` → `data: ProspectImportPreview{previewReference, expiresAt(15 min), summary{total,new,matches,invalid,conflicts}, rows[]}` | 400, 401, 403, 404, 413 | ADMIN, OWNER |
| P4 | `POST /api/v1/prospects/import/confirm` | AVAILABLE | multipart `campaignId, file, previewReference, decisions(JSON texto)` → `data: ProspectImportResult{summary{total,created,linked,updated,skipped,rejected}, rows[{record, action: CREATE\|LINK_EXISTING\|UPDATE_EXISTING\|SKIP\|REJECTED, prospectId?, errors?}]}` | 400, 401, 403, 404, 409, 413 | ADMIN, OWNER |

Notas de `deploymentDocument()` (fuera del perímetro CP, verificado sin regresión): las 4 operaciones de prospecting-jobs de escritura/exportación quedan marcadas «No disponible» con `503` `PROSPECTOR_INTEGRATION_PENDING`, coherente con el código y con `test/jobs.postgres-spec.ts`. No contradice el YAML CP.

## Verificaciones específicas solicitadas

| # | Punto | Esperado | Observado | Estado |
|---|---|---|---|---|
| 1 | Filtros contextuales `addedFrom/addedTo/activityFrom/activityTo` | Paridad YAML ↔ DTO ↔ servicio | YAML líneas 403–414 con `ContextRangeTimestamp`; `CampaignProspectsQuery` con `IsISO8601(strict)` + regex idéntico al patrón YAML + `OrderedRange` (from ≤ to); servicio aplica `addedAt` sobre la participación y `activities.some.recordedAt`; 400 en fecha inválida/sin zona/rango invertido (anclado en spec) | PASS |
| 2 | Esquema `CampaignParticipation` | Campos, `commercialStage` por `$ref`, `responsible` nullable | YAML 1289–1302; requeridos `[campaignId, prospectId, status, commercialStage, evaluation, responsibleId, addedAt, updatedAt]` cubiertos por el modelo `CampaignProspect`; ver observación B1 sobre `responsible` en PATCH | PASS |
| 3 | Descripción de instantánea del dashboard | «instantánea» en la descripción y consistencia real | YAML 425: «Todos los agregados se leen de una misma instantánea…»; código: una transacción `RepeatableRead` que lee participaciones + conteos de actividades juntos | PASS |
| 4 | Campos de responsables con `eligible` | `ResponsibleUser.eligible: boolean`, sin `userTenants` | YAML 1280–1288; `withResponsibleEligibility` elimina `userTenants` y calcula `eligible = ACTIVO && membresía actual`; `ProspectCampaigns[].responsable` incluye `eligible` | PASS |
| 5 | P2 `campaignsForProspect` con `meta` anidado | `meta` dentro de `data` | Servicio devuelve `{originCampaignId, campaigns, meta}` sin clave `data`; `ResponseInterceptor` envuelve todo como `data` → `meta` queda anidado; YAML `ProspectCampaigns.meta` (1401); ancla spec valida el ejemplo | PASS |
| 6 | P3 `provenance` con envelope | `data` arreglo + `meta` en nivel superior | Servicio devuelve `{data, meta}` y el interceptor lo conserva como envelope; YAML 1150–1152; ancla spec rechaza `{data:{events,meta}}` | PASS |
| 7 | Acciones CSV `CREATE/LINK_EXISTING/UPDATE_EXISTING/SKIP/REJECTED` con `summary` y `rows` | Enum completo y ambas colecciones | YAML 1638–1658 y servicio (filas `result` con `action`; summary `total/created/linked/updated/skipped/rejected`); preview con `summary{total,new,matches,invalid,conflicts}` y `rows[].classification` | PASS |
| 8 | `UPDATE_EXISTING` con efecto global | Documentado «afecta a todas las campañas que comparten el prospecto» | YAML confirm, líneas 696–699: texto exacto presente; servicio edita el maestro `Prospect` (efecto en todas las asociaciones) y asegura la asociación; `sharedWithOtherCampaigns` y `campaignIds` lo hacen visible en preview | PASS |

## Evidencia de ejecución

Formato: `ID | gate | fecha ISO | HEAD | comando | dataset/fixture | esperado | observado | estado | evidencia | limitaciones`

```text
E1 | G4 | 2026-11-23T14:22:00-08:00 | 17d37423a38d7fd350defce18c8f62fb3a8dda16 | npx jest src/common/openapi/cp-document.spec.ts --runInBand | DTOs y YAML sintéticos | 59 aserciones contractuales en verde | 59 passed / 59 total | PASS | src/common/openapi/cp-document.spec.ts | no prueba lógica de negocio, solo contrato
E2 | G4 | 2026-11-23T14:23:00-08:00 | 17d37423a38d7fd350defce18c8f62fb3a8dda16 | npx jest src/prospects/imports --runInBand | CSV sintéticos | parser + servicio de importación en verde | 25 passed / 25 total (2 suites) | PASS | src/prospects/imports/prospect-imports.service.spec.ts | Prisma simulado en la suite de servicio
E3 | G4 | 2026-11-23T14:25:00-08:00 | 17d37423a38d7fd350defce18c8f62fb3a8dda16 | npx jest --runInBand | unit suite completa | 12 suites en verde | 177 passed / 177 total | PASS | src/**/*.spec.ts | sin base de datos
E4 | G4 | 2026-11-23T14:31:00-08:00 | 17d37423a38d7fd350defce18c8f62fb3a8dda16 | npx jest --config ./test/jest-e2e.json --runInBand | app aislada con Prisma reemplazado | 7 suites e2e en verde | 84 passed / 84 total | PASS | test/*.e2e-spec.ts | sin PostgreSQL real
E5 | G4 | 2026-11-23T14:35:00-08:00 | 17d37423a38d7fd350defce18c8f62fb3a8dda16 | docker compose --profile test run --rm --build test-postgres | PostgreSQL 16 desechable (compose perfil test, tmpfs, BD saas_test; datos sintéticos) | 15 suites de integración en verde tras prisma migrate deploy local | 196 passed / 196 total; 4 migraciones, 0 pendientes | PASS | test/*.postgres-spec.ts | infraestructura local aislada; no aplica a remoto/producción
E6 | G4 | 2026-11-23T14:44:00-08:00 | 17d37423a38d7fd350defce18c8f62fb3a8dda16 | contenedor aislado: nest build + node dist/src/main.js + comparación HTTP del documento servido vs Docs/Contracts/platform-api.v1.yaml | YAML del contrato | rutas CP y schemas servidos idénticos al YAML | PARITY_OK: 18/18 rutas CP, PATH_DRIFT 0, SCHEMA_DRIFT 0, UI /api/docs 200, JSON servido en /api/docs-json | PASS | este archivo (salida reproducible con el comando) | comparación por serialización JSON; no cubre entorno de staging/producción
E7 | G4 | 2026-11-23T14:47:00-08:00 | 17d37423a38d7fd350defce18c8f62fb3a8dda16 | inspección estática (grep/read de controladores, DTOs, servicios, Prisma/schema.prisma, deployment-document.ts, YAML) | — | correspondencia 25 ↔ 25 operaciones y 8 puntos específicos sin drift | 25 operaciones CP código = YAML; 8/8 verificaciones PASS; drift residual en sección siguiente | PASS | src/**, Prisma/schema.prisma, Docs/Contracts/platform-api.v1.yaml | lectura estática; la validación dinámica está en E1–E6
E8 | G4 | 2026-11-23T14:47:56-08:00 | 17d37423a38d7fd350defce18c8f62fb3a8dda16 | GET /api/docs sobre despliegue real (staging/producción) | — | — | no ejecutado | NOT_RUN | — | fuera de alcance y prohibido para este rol; no se convierte en PASS
```

Total reproducido en este HEAD: **457/457 pruebas** (177 unit + 84 e2e + 196 PostgreSQL), consistente con el run atribuido a `0d1dd02`.

## DRIFT por severidad

### Crítico — ninguno
### Alto — ninguno
No se detecta `BREAKING_CHANGE`: ninguna forma de respuesta CP cambia respecto del contrato publicado y el documento servido coincide con el YAML.

### Medio

| ID | Drift | Riesgo | Evidencia |
|---|---|---|---|
| M1 | El enum `CampaignActivityType` de Prisma incluye `MASTER_UPDATE` (`Prisma/schema.prisma:79`) que **no existe** en el enum del contrato (`platform-api.v1.yaml:1201`). | Latente: hoy ningún código escribe `MASTER_UPDATE` (solo `MASTER_UPDATED` de procedencia), pero una fila con ese valor rompería validación de consumidores generados desde el YAML. Requiere decisión del owner: eliminar el valor en migración aditiva futura o ampliar el contrato. | `Prisma/schema.prisma:68-80` vs `platform-api.v1.yaml:1201` |
| M2 | `POST /api/v1/prospects/match` puede responder **409** (`PROSPECT_MATCH_REQUIRES_DECISION`, con `details.candidates`) ante identidad fuerte duplicada o hash de identidad en conflicto, pero el YAML solo declara 201/400/401/403/404 (líneas 800–805). | Un consumidor tipado desde el contrato no contempla 409 en `match`; puede tratarlo como error genérico en lugar de decisión manual. Es omisión documental, no cambio de forma; corregible en Docs con aprobación del integrador. | `src/prospects/prospects.service.ts:89-161` vs `platform-api.v1.yaml:791-805` |

### Bajo

| ID | Drift | Riesgo | Evidencia |
|---|---|---|---|
| B1 | `PATCH .../stage` y `PATCH .../evaluation` devuelven la fila de participación **sin la clave `responsible`** (retornan la fila cruda de `CampaignProspect`), mientras `GET .../participation`, la lista de campañas y asignación sí incluyen `responsible` con `eligible`. | Formalmente válido (`responsible` no está en `required`), pero un consumidor que asuma la clave presente o nula podría fallar en tipado estricto. | `src/campaigns/campaigns.service.ts:334-352,386-414` vs `platform-api.v1.yaml:1289-1302` |
| B2 | `main.ts` no define `jsonDocumentUrl`; el JSON servido queda en **`/api/docs-json`** (verificado 200), mientras `cp-document.spec.ts` ancla `api/docs/json`. | Solo diferencia de URL, contenido idéntico. Relevante para el handoff de André: la URL real del JSON es `/api/docs-json`. | `src/main.ts:47-52`; E6 |
| B3 | Operaciones CP implementadas y probadas **sin** `x-contract-status: AVAILABLE`: `GET /api/v1/campaigns/{id}/prospects` (C6), `POST /api/v1/prospects` (P1), `PATCH /api/v1/prospects/{id}` (contexto P3) y lecturas baseline `GET /api/v1/prospects`, `GET /api/v1/prospects/{id}`. | Asimetría documental: el encabezado YAML (línea 10) solo afirma disponibilidad de lo marcado; un consumidor podría leer ausencia de marcador como disponibilidad inferior. Sugiere normalizar marcadores (cambio documental) con aprobación del integrador. | `platform-api.v1.yaml:10,427-843` |
| B4 | Operaciones baseline `GET /api/v1/campaigns` y `GET /api/v1/prospects` declaran solo 200/401, pero el runtime produce **400** (`sortBy` validado contra `IsIn([name,email,status,createdAt,updatedAt])`; `findAll` de campañas rechaza además `sortBy=email`) y **403** (rol/tenant). El parámetro `SortBy` se documenta como `type: string` libre (líneas 1017–1021). | Preexistente al sprint CP (no introducido por C1–P4). Documentación más laxa que el comportamiento; consumidor podría enviar `sortBy` no contemplado y recibir 400 no esperado. | `src/common/dto/pagination.dto.ts:10-11`, `src/campaigns/campaigns.service.ts:104-106` vs `platform-api.v1.yaml:277-286,619-627,1017-1021` |
| B5 | Los patrones de parámetros de ruta (`EntityId: ^c[a-z0-9]{20,}$`, `CampaignId/ProspectPathId/CampaignPathId: ^\S+$`) no se validan en el código: un id malformado produce 404 (compatible con lo documentado, que no declara 400 para path params). | Mínimo: el contrato es más estricto que el runtime; sin impacto para consumidores que solo manejen 404. | `platform-api.v1.yaml:980-1001` vs controladores |
| B6 | Administrativo: SHA largo del encargo no resuelve (`0d1dd02358...` inválido); el real es `0d1dd027f377373acf1b88e7db10f838694b2d4b`. | Trazabilidad: los registros que citen el SHA largo completo deben corregirse al SHA real. | `git rev-parse 0d1dd02` |

## Filas YAML que divergen (lista exacta)

1. `platform-api.v1.yaml:1201` — `CampaignActivityType` (enum): falta `MASTER_UPDATE` presente en `Prisma/schema.prisma:79` (M1).
2. `platform-api.v1.yaml:800-805` — `responses` de `POST /api/v1/prospects/match`: falta `'409': { $ref: '#/components/responses/Conflict' }` producido por el servicio (M2).
3. `platform-api.v1.yaml:277-286` y `619-627` — `responses` de `listCampaigns`/`listProspects`: faltan `'400'` y `'403'` que el runtime produce (B4, preexistente).
4. `platform-api.v1.yaml:1017-1021` — `SortBy`: `schema: { type: string }` sin `enum [name, email, status, createdAt, updatedAt]` que `PaginationDto` sí impone (B4, preexistente).
5. `platform-api.v1.yaml:371,566,741` (operaciones `listCampaignProspects`, `createProspect`, `updateProspect`, más `listProspects`/`getProspect`) — ausencia de `x-contract-status: AVAILABLE` frente a sus operaciones hermanas (B3, documental).

No hay divergencias en: filtros contextuales, `CampaignParticipation`, instantánea del dashboard, `ResponsibleUser.eligible`, `ProspectCampaigns.meta` anidado, envelope de `ProspectProvenanceResponse`, enum y formas de acciones CSV, ni el texto de efecto global de `UPDATE_EXISTING`.

## Limitaciones

- `NOT_RUN`: comparación de `/api/docs` contra un despliegue real (staging/producción); fuera de alcance y prohibido para este rol. La comparación servida se hizo con el bootstrap real de `main.ts` en contenedor aislado (E6), cuyo contenido es el que `deploymentDocument()` publica.
- E5/E6 usan infraestructura local desechable (compose perfil `test`, tmpfs); no acreditan comportamiento en remoto.
- Este informe no cierra gates, no autoriza merge/deploy ni marca el sprint terminado; la aceptación de G4 es decisión del integrador y del owner.
- No se modificaron Auth, JWT, RBAC, TenantContext, Users/Tenants, ProspectorClient/Jobs/Engine, migraciones históricas ni PR previos.
