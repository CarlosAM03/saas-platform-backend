# G5 — Arnés contractual para André (backend `3b5eec6`)

- Fecha: `2026-11-23` (America/Tijuana, `-08:00`).
- Backend SHA de referencia: `3b5eec6fa99f846e853794fc8aedff2c4353c269`, rama `feat/sprint-campana-prospector`.
- HEAD del repositorio al emitir: `1ca647a7f63174a34326748eb8ea13e58a014061` (commit documental posterior; el código es idéntico a `3b5eec6`).
- G4: aceptado por el owner el `2026-11-23` (`../G4/ACEPTACION_G4_OWNER.md`).
- Alcance autorizado: preparar el handoff contractual. Sin push, merge, deploy ni migraciones remotas.

## 1. Artefacto

Directorio: `codex/sprint-campanas-prospectos/06_HANDOFF_ANDRE/`.

| Archivo | Bytes | SHA256 |
|---|---|---|
| `README.md` | 3269 | `af90e34fe7d5a87be7158beaa1e1dc9a4beaeb0901c546834db81757a388016b` |
| `PROMPT_ACTIVACION.txt` | 2292 | `edd4dfd84124e51eed427a36f82a8aca7868bc3222af9e099df10ae6ab14eed3` |
| `02_MATRIZ_API_FLUTTER.csv` | 13172 | `b356324466af9542da915b4122549b2cbb0814c527c1779b8ef5184c8f2fb065` |
| `03_CONTRATO_IMPLEMENTADO.md` | 10164 | `ed14803ee25106d49a762e532a4f36fd743eb0475fbf18eabe013ed25fbc9e0c` |
| `04_OBJETIVOS_Y_FLUJOS.md` | 6366 | `e9b9e46c11a956350807fb020b037a275f0c624f0189cd2ef972805418f0fff3` |
| `05_REGLAS_FLUTTER_Y_PRUEBAS.md` | 3798 | `ce15b776bba133581885e9f29c897421c6a82677fb8f590bf731b6d2640544e2` |
| `06_RUNBOOK_QA_SINTETICO.md` | 4408 | `7d1c1c64112512f7788718d198f2a6409f449b3b3d37bd6f7dd0d06531822bcd` |
| `openapi-served-3b5eec6.json` | 162688 | `e73bb1e924a1e956d20567768e63861552d9799c51170257b1098f424384e14c` |

Se conservan sin cambios `00_CONTRATO_DE_ENTREGA.md` y `01_PLANTILLA_HARNESS_FRONTEND.md` como registro de requisitos. Total del directorio: 10 archivos, `210 689` bytes. **No se generó ZIP** y no se modificó el repositorio Flutter.

## 2. Contrato servido

El JSON del arnés se generó ejecutando el mismo `deploymentDocument()` que sirve la aplicación (`GET /api/docs-json`) sobre `Docs/Contracts/platform-api.v1.yaml` del candidato:

```text
npx ts-node -e "import { deploymentDocument } from './src/common/openapi/deployment-document'; ... writeFileSync('06_HANDOFF_ANDRE/openapi-served-3b5eec6.json', JSON.stringify(deploymentDocument(), null, 2));"
```

Comprobación ejecutada sobre el artefacto (script local, sin DB ni red):

| Comprobación | Observado | Resultado |
|---|---|---|
| Rutas del YAML presentes en el artefacto | 34 de 34 (`missingFromArtifact=[]`) | PASS |
| Rutas extra del artefacto | 5 rutas de Tenant Registration añadidas deliberadamente por `deploymentDocument()` | PASS (esperado) |
| Total de rutas | 39; 77 esquemas | OK |
| `CampaignActivityType.enum` | incluye `MASTER_UPDATE` y `CORRECTION` | PASS |
| `CreateCampaignActivityRequest.type.enum` | `[NOTE, CALL, EMAIL, MEETING, OTHER]` | PASS |
| Descripción del dashboard | menciona `CORRECTION` y `activity.manual` | PASS |
| `x-contract-status` de etapa | `AVAILABLE` | PASS |

La equivalencia entre este artefacto y el documento realmente servido está además cubierta por la prueba `publishes Swagger with unavailable integration operations and real read routes` (e2e sobre `GET /api/docs-json`), ejecutada en la regresión de `3b5eec6`.

## 3. Contenido del arnés

- `02_MATRIZ_API_FLUTTER.csv`: **25 operaciones** reales (18 de features CP + 7 baseline) con `feature, method, path, disponibilidad_real, backend_sha, roles_y_tenant, request_schema, response_schema, errores, ejemplo_sintetico, pantalla_consumidora, prueba_referencia, evidencia`. CSV validado: 26 filas × 13 columnas, sin filas mal formadas (reparto: C1=6, C2=1, C3=3, C4=3, C6=1, C8=1, P1=4, P2=2, P3=2, P4=2).
- `03_CONTRATO_IMPLEMENTADO.md`: autenticación/tenant (JWT, `select-tenant`, 8 h, 5 intentos/60 s), envoltura, códigos, paginación y semántica por feature, incluida la decisión `CORRECTION` = manual y `MASTER_UPDATE` documentado-no-emitido.
- `04_OBJETIVOS_Y_FLUJOS.md`: siete pantallas/flujos (lista, detalle, bitácora, alta con coincidencias, ficha maestra, importador, dashboard).
- `05_REGLAS_FLUTTER_Y_PRUEBAS.md`: arquitectura `UI → Riverpod → repo → lib/platform_api → ApiClient`, carpetas protegidas, 10 grupos de pruebas incluido T32.
- `06_RUNBOOK_QA_SINTETICO.md`: `docker compose up --build -d db db-init api`, health, Swagger, usuarios sintéticos, flujo de sesión y regresión en perfil `test`.
- `README.md` y `PROMPT_ACTIVACION.txt`: instalación en `saas-platform-client/codex/<nombre-sprint-frontend>/` y prompt reproducible.

## 4. Integridad del arnés del sprint

```text
node codex/sprint-campanas-prospectos/herramientas/verificar-integridad.mjs
Checked 27 files; anomalies: 1.
CHANGED 06_HANDOFF_ANDRE/02_MATRIZ_API_FLUTTER.csv
```

- **Causa:** el archivo estaba en el manifiesto como plantilla vacía y G5 exige rellenarlo con las rutas reales (`01_PLANTILLA_HARNESS_FRONTEND.md` lo indica expresamente). No es una alteración oculta: el contenido nuevo está descrito en este documento y es el entregable del gate.
- **No se actualizó `MANIFEST_INTEGRIDAD.json`** para no renovar la línea base de integridad por cuenta propia.
- **Opciones para el owner:** (A) autorizar la actualización del manifiesto con el nuevo hash; (B) dejar la matriz fuera del manifiesto en una próxima revisión del arnés; (C) mantener la anomalía declarada como cambio autorizado de G5.
- **Impacto:** sólo afecta la detección de cambios de la plantilla; ningún otro archivo del arnés cambió (26 `OK`).

## 5. Límites y riesgos abiertos

- `T32` sigue `NOT_RUN`: es E2E Flutter contra entorno sintético y corresponde al frontend.
- La base Flutter autorizada y el momento de uso del arnés son decisión del owner.
- El arnés describe el contrato de `3b5eec6`; cualquier commit backend no documental posterior invalida su atribución y exige regenerarlo.
- `MASTER_UPDATE` está en el contrato pero no se emite; `CORRECTION` cuenta como manual; no existe endpoint de reversión de importaciones.
- El runbook usa datos sintéticos del seed de desarrollo; no se usaron datos reales ni secretos.

## 6. Estado

`G5 LISTO_PARA_REVISION`. No se declara `APROBADO`, no se generó ZIP de entrega, G6 sigue pendiente de la revisión del owner y el sprint no se declara terminado.
