# G4 — Revisión técnica final antes de la aceptación (2026-11-23)

- HEAD de código del sprint: `7a63dfbe1d72b695457cf99b830f186af9b3d2bb`.
- Candidato revisado: commits de pruebas y documentación hasta `0d1dd027f377373acf1b88e7db10f838694b2d4b`.
- Alcance: revisión de cobertura, fixtures de roles, aislamiento de tenant, migraciones y paridad contractual, instruida por el owner antes de aceptar G4.
- Resultado: **sin hallazgos bloqueantes**. Cinco hallazgos resueltos en este bloque y tres decisiones escaladas al owner.

## 1. Hallazgos de la revisión independiente

| ID | Severidad | Hallazgo | Estado | Acción tomada |
|---|---|---|---|---|
| ALTO-01 | Alto | `AC-C4-01` usaba un token ADMIN firmado sobre un usuario que **no** era ADMIN en BD y que además era miembro OWNER del tenant; el PASS podía darse por la membresía, no por la autoridad ADMIN. | RESUELTO | El fixture crea ahora un usuario con `platformRole: 'ADMIN'` en BD, **sin** `UserTenant`, con el payload que emite `AuthService.createToken` (`tenantRole: null`). Se asienta además que un usuario sin membresía y sin ADMIN queda rechazado. |
| MEDIO-01 | Medio | `AC-P4-04` estaba sobreafirmada: el test citado rechazaba por una llave extra (`candidateId`) en el DTO, no por revalidar el candidato. | RESUELTO | Nueva prueba `AC-P4-04: explicit choice is revalidated server-side when the candidate no longer matches` en la ruta manual (`resolve`/`linkExisting`), que exige el `ConflictException('Candidate changed…')` y demuestra cero escrituras. Se reatribuye la fila al camino manual, conforme a la decisión G4-O2 (rechazo seguro en CSV). |
| MEDIO-02 | Medio | La migración `20261122000100` fabrica un evento `CREATED` sintético por prospecto legacy; solo la forward-fix `20261123000100` lo elimina. Un entorno que aplique solo la primera conservaría historial inventado. | RESUELTO (documentado y probado) | Nueva prueba `requires both migrations together: the sprint migration alone leaves fabricated provenance` verifica el estado intermedio (procedencia > 0) y el estado neto tras ambas (procedencia = 0, participación intacta). No se editó ninguna migración histórica. |
| MEDIO-03 | Medio | `campaigns-tenant-isolation` crea su fixture en `beforeAll` sin reset por caso; varias aserciones de conteo dependen del orden de declaración. | RESUELTO (declarado) | Nota de contexto en `MATRIZ_COBERTURA_AC.md` y Limitación en las filas afectadas. `AC-C4-01` ya usa fixture dedicado con limpieza. |
| BAJO-01 | Bajo | `AC-C2-04` era cuasi-tautológica en su parte de «no dispara Jobs/Prospector». | RESUELTO (declarado) | La fila ahora cita la suite `without-prospector` y explícita que la garantía es estructural (sin inyección de ProspectorClient/Jobs, INV-11), no por espía de red. |

## 2. Decisiones escaladas al owner (no resueltas unilateralmente)

| ID | Tema | Por qué no se decidió aquí |
|---|---|---|
| G4-O4 | `CORRECTION` se clasifica como evento automático en `activity.events`, pero el SPEC §4.C3 distingue declaración manual. | Cambiar la partición modifica el contrato publicado que consumirá André. Requiere decisión sobre A/B/C. |
| G4-O5 | El enum `CampaignActivityType` de Prisma incluye `MASTER_UPDATE`, ausente del YAML. | Ampliar el enum afecta contrato; eliminarlo requiere migración. Se documenta la latencia. |

## 3. Hallazgos de paridad contractual

| Severidad | Hallazgo | Estado |
|---|---|---|
| Medio M1 | `MASTER_UPDATE` en el enum de Prisma, no en el de YAML. | ESCALADO (G4-O5). |
| Medio M2 | `POST /prospects/match` puede devolver `409` (hash en conflicto o múltiples identidades fuertes) y YAML no lo declaraba. | RESUELTO: se añadió `'409': Conflict` y la descripción del caso. |
| Bajo B3 | Sin `x-contract-status: AVAILABLE` en `listCampaignProspects`, `createProspect` y `updateProspect` (rutas CP extendidas). | RESUELTO: se marcó `AVAILABLE` solo en las tres rutas CP; las lecturas baseline quedan sin la marca por convención del encabezado. |
| Bajo B4 | `SortBy` documentado como string libre vs enum real del DTO. | RESUELTO: `enum: [name, email, status, createdAt, updatedAt]` y `400/403` en `listCampaigns`/`listProspects`. |
| Bajo B2 | JSON servido en `/api/docs-json`, no `/api/docs/json`. | REGISTRADO para el handoff de André (no es drift de implementación). |

Ver `CONTRATO_REVISION_FINAL_0d1dd02.md` para el detalle de la paridad (25 ↔ 25 operaciones, Swagger servido `PARITY_OK`).

## 4. Ejes sin hallazgo

- **Aislamiento de tenant:** revisado en `campaigns.service.ts`, `prospects.service.ts` y `prospect-imports.service.ts`; `tenantId` presente en cada filtro/JOIN y referencias de preview firmadas. Sin fuga detectada.
- **Migraciones:** sin `DROP`, unique legacy intacto, nuevo unique aditivo, backfill sin cruces de tenant, FKs `Restrict`.
- **Historial vía API:** el DTO de actividades solo admite tipos manuales; no se pueden inyectar eventos automáticos.

## 5. Alcance del bloque

Solo pruebas y documentación: `test/campaigns-tenant-isolation.postgres-spec.ts`, `test/prospect-review-regressions.postgres-spec.ts`, `test/campaign-participation-migration.postgres-spec.ts`, `Docs/Contracts/platform-api.v1.yaml` y evidencias. `git diff` de código productivo del sprint: sin cambios en `src/`, `Prisma/` ni migraciones.
