# G4 — Bloque correctivo O4-B / O5-A

- Fecha de ejecución: `2026-11-23` (America/Tijuana, `-08:00`).
- Rama: `feat/sprint-campana-prospector`.
- HEAD base al iniciar el bloque: `fd513fc046415925a61252adbed350fbd70eed8f`.
- Commit de implementación y pruebas verificado en árbol limpio: `3b5eec6fa99f846e853794fc8aedff2c4353c269`.
- Autoridad funcional: `04_REFERENCIAS/SPEC_SPRINT_CAMPANAS_PROSPECTOS_v1.0_OWNER_APROBADO.md` (A1–E5, INV-01..12, AC, gates).
- Alcance: dashboard C3/C8 (`activity.manual`/`activity.events`) y paridad del enum `CampaignActivityType`. Sin cambios en Auth/JWT/RBAC/TenantContext, Users/Tenants, Prospector, esquema Prisma ni migraciones.

## 1. Autorización del owner (transcrita, vigente)

Instrucción recibida del owner en esta conversación el `2026-11-23` (canal: mensaje directo del owner al agente integrador):

> «AUTORIZACIÓN DEL OWNER
> Autorizo exclusivamente:
> 1. G4-O4, opción B: contar CORRECTION como actividad manual en el dashboard.
> 2. G4-O5, opción A: agregar MASTER_UPDATE al enum de respuesta del YAML para alinearlo con Prisma.
> 3. Ejecutar pruebas y verificar el contrato Swagger servido del candidato resultante.
> 4. Actualizar evidencias y presentar G4 para mi aceptación, sin autoaprobarlo.
>
> Ratifico además que AC-P3-02 cubre operaciones revertidas mediante rollback y NO exige un endpoint para deshacer importaciones.»

Límites explícitos de la misma instrucción que se respetaron: sin push, merge, deploy ni migraciones remotas; sin tocar Flutter ni PR anteriores; sin generar el ZIP de André; sin subagentes; sin modificar módulos protegidos ni migraciones históricas.

Esta autorización resuelve `G4-O4` por la opción B y `G4-O5` por la opción A. No modifica las decisiones históricas registradas (`G2-O1`, `G4-O2`, `G4-O3`), que se conservan intactas.

## 2. Cambios aplicados

| Archivo | Cambio |
|---|---|
| `src/campaigns/campaigns.service.ts` | `CampaignActivityType.CORRECTION` se añade a `manualTypes`; `activity.events` sigue siendo `activities - manualActivities`, por lo que `activity.total = activity.manual + activity.events` se mantiene. Comentario explicativo del criterio. |
| `Docs/Contracts/platform-api.v1.yaml` | Descripción del dashboard: `activity.manual` incluye `CORRECTION` y se documenta la partición. Descripción del alta de actividades: solo declaraciones manuales. `CampaignActivityType`: descripción nueva (incluye que `MASTER_UPDATE` no se genera hoy y no debe confundirse con `MASTER_UPDATED`) y enum ampliado con `MASTER_UPDATE`. `CreateCampaignActivityRequest.type` conserva `[NOTE, CALL, EMAIL, MEETING, OTHER]` con descripción de rechazo. |
| `src/common/openapi/cp-document.spec.ts` | Prueba ancla: enum de respuesta igual al enum de `Prisma/schema.prisma`, presencia de `MASTER_UPDATE`, DTO y enum del contrato restringidos a tipos manuales, y descripción contractual del dashboard. |
| `test/campaigns-read-capabilities.postgres-spec.ts` | Prueba PostgreSQL nueva `counts a human correction as manual activity and keeps automatic events apart`: crea un evento automático, una actividad manual y su corrección; verifica `{ total: 3, manual: 2, events: 1 }`, la igualdad de la partición y que el original queda idéntico campo por campo. |
| `test/without-prospector.e2e-spec.ts` | La prueba de Swagger servido verifica en el documento realmente servido: `CORRECTION` y `MASTER_UPDATE` en el enum de respuesta, `no lo genera` en la descripción, enum de entrada manual restringido y descripción de dashboard con `CORRECTION`/`activity.manual`. |

No se tocaron `Prisma/schema.prisma`, migraciones, Auth/JWT/RBAC/TenantContext, Users/Tenants, ProspectorClient/ProspectingJobs/Engine ni configuración productiva.

## 3. Ejecución de referencia (árbol limpio de `3b5eec6`)

Comando exacto (perfil `test` de `compose.yml`, PostgreSQL 16 desechable en `tmpfs`):

```text
docker compose --profile test run --build --rm test-postgres sh -c "npm run build && npm run test:unit:ci && npm run test:e2e:ci && npm run prisma:migrate:deploy && npm run test:postgres"
```

| Prueba | HEAD / árbol | Esperado | Observado | Estado |
|---|---|---|---|---|
| Build | `3b5eec6` limpio | compila | código 0; `docker compose` exit 0 | PASS |
| Unitarias | `3b5eec6` limpio | verde | 12 suites, **178/178** | PASS |
| E2E HTTP | `3b5eec6` limpio | verde | 7 suites, **84/84** | PASS |
| PostgreSQL 16 | `3b5eec6` limpio | verde; migraciones sin pendientes | 15 suites, **199/199**; 4 migraciones sin pendientes | PASS |
| Total funcional | `3b5eec6` limpio | — | **461 pruebas** en 34 suites | PASS |

El `docker compose ... run` devolvió código de salida `0`. La cadena completa se ejecutó una primera vez sobre el árbol de trabajo (HEAD `fd513fc` + cambios sin commit) con resultado idéntico (178/84/199, exit 0) y se repitió sobre el commit limpio `3b5eec6`; ambos registros coinciden.

Una ejecución previa de la misma cadena (árbol de trabajo) reportó `COMPOSE_EXIT=1` a través del pipeline de PowerShell con `Tee-Object`, aunque las tres suites terminaron en verde y el paso siguiente de la cadena sí se ejecutó. La cadena se repitió con redirección directa de salida, obteniendo `COMPOSE_EXIT=0` en dos ocasiones. Se registra la anomalía del pipeline; **no** se atribuye PASS al resultado con exit code 1.

## 4. Pruebas dirigidas y sensibilidad

| Caso | Comando | Resultado |
|---|---|---|
| Ancla de contrato | `npx jest src/common/openapi/cp-document.spec.ts --verbose -t 'activity type enums aligned'` | 1/1 PASS (59 skipped) |
| Swagger servido | `npx jest --config ./test/jest-e2e.json --runInBand test/without-prospector.e2e-spec.ts -t 'publishes Swagger'` | 1/1 PASS (4 skipped) |
| PostgreSQL O4-B | `npm run test:postgres -- --testPathPatterns=campaigns-read-capabilities -t 'human correction'` | 1/1 PASS (29 skipped) |
| Sensibilidad O4-B (rojo) | misma prueba con `CORRECTION` retirado temporalmente de `manualTypes` | **FAIL** en `expect(dashboard.activity).toEqual({ total: 3, manual: 2, events: 1 })`; restaurado de inmediato y confirmado con `git diff` |

La reproducción roja demuestra que la prueba detecta la clasificación anterior (una corrección contada como evento automático).

## 5. Swagger servido

- El documento servido por la aplicación (`GET /api/docs-json`) se construye con `deploymentDocument()` leyendo `Docs/Contracts/platform-api.v1.yaml`; por eso la verificación se hace sobre la respuesta HTTP de la app Nest real en `test/without-prospector.e2e-spec.ts`, no solo comparando YAML contra código.
- Comprobaciones en el documento servido:
  - (a) `activity.manual` incluye `CORRECTION` en la descripción del dashboard (`CORRECTION` y `activity.manual` presentes).
  - (b) `CampaignActivityType.enum` contiene `MASTER_UPDATE`.
  - (c) `CreateCampaignActivityRequest.properties.type.enum` es exactamente `[NOTE, CALL, EMAIL, MEETING, OTHER]`; no habilita eventos automáticos, `CORRECTION` ni `MASTER_UPDATE`.
- No se levantó el contenedor `api` en un puerto local: la verificación usa la app Nest instanciada por la propia suite E2E. No se midió la UI de Swagger; su disponibilidad HTTP ya está registrada en bloques anteriores.

## 6. Integridad del arnés

```text
node codex/sprint-campanas-prospectos/herramientas/verificar-integridad.mjs
```

Resultado: `Checked 27 files; anomalies: 0.` El verificador solo compara los archivos del arnés contra su manifiesto; no evalúa código del producto, pruebas ni el gate G4.

## 7. Límites de esta evidencia

- Los resultados se atribuyen al SHA exacto `3b5eec6fa99f846e853794fc8aedff2c4353c269` en árbol limpio. Cualquier commit posterior de documentación no hereda esta ejecución.
- Todos los fixtures son sintéticos; no se usaron bases remotas, datos reales ni secretos.
- `T32` permanece `NOT_RUN` (E2E Flutter, fuera del backend).
- Esta evidencia no cierra G4 ni G5, no autoriza merge, deploy ni migración remota.
