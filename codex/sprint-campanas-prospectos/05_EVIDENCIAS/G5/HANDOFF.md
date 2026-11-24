# G5 — Entrega contractual a André

**ESTADO: `LISTO_PARA_REVISION` — G4 ACEPTADO POR EL OWNER; EL OWNER DECIDE EL USO**

## Sincronización — 2026-11-23 (G5 preparado tras aceptación de G4)

El owner aceptó G4 sobre `3b5eec6fa99f846e853794fc8aedff2c4353c269` y autorizó preparar el handoff contractual sin push, merge, deploy ni migraciones remotas. Ver `../G4/ACEPTACION_G4_OWNER.md`.

- Backend SHA: `3b5eec6fa99f846e853794fc8aedff2c4353c269` (rama `feat/sprint-campana-prospector`).
- Arnés: 10 archivos, `210 689` bytes, en `06_HANDOFF_ANDRE/`. Contrato servido `openapi-served-3b5eec6.json` (162 688 bytes, SHA256 `e73bb1e924a1e956d20567768e63861552d9799c51170257b1098f424384e14c`, 39 rutas / 77 esquemas).
- Estructura: `README.md`, `PROMPT_ACTIVACION.txt`, `02_MATRIZ_API_FLUTTER.csv` (25 operaciones reales), `03_CONTRATO_IMPLEMENTADO.md`, `04_OBJETIVOS_Y_FLUJOS.md`, `05_REGLAS_FLUTTER_Y_PRUEBAS.md`, `06_RUNBOOK_QA_SINTETICO.md`; `00_CONTRATO_DE_ENTREGA.md` y `01_PLANTILLA_HARNESS_FRONTEND.md` se conservan como registro.
- Comandos documentados en el runbook: `docker compose up --build -d db db-init api`; `GET /api/v1/health/ready`; `GET /api/docs-json`; regresión con `docker compose --profile test run --build --rm test-postgres ...`.
- Integridad del arnés: con autorización del owner (opción A, 2026-11-23) se refrescó el hash de `06_HANDOFF_ANDRE/02_MATRIZ_API_FLUTTER.csv` en `MANIFEST_INTEGRIDAD.json`, con bloque `lastAuthorizedRefresh` y sin tocar otros hashes. Verificación vigente: `Checked 27 files; anomalies: 0`. Detalle en `ARNES_ANDRE_3B5EEC6.md`.
- Riesgos abiertos: `T32` sigue `NOT_RUN` y es responsabilidad del frontend; la base Flutter y el momento de uso son decisión del owner; `MASTER_UPDATE` está documentado pero no se emite; `CORRECTION` cuenta como actividad manual; no existe endpoint de reversión de importaciones (rollback transaccional). Cualquier commit backend no documental invalida la atribución de este arnés.
- No se generó ZIP de entrega ni se modificó el repositorio Flutter. G6 continúa pendiente de la revisión del owner.

## Sincronización — 2026-11-23 (O4-B / O5-A aplicadas)

El owner autorizó y el integrador aplicó las dos decisiones pendientes en el commit `3b5eec6fa99f846e853794fc8aedff2c4353c269`: `CORRECTION` cuenta como actividad manual en `activity.manual` (`G4-O4-B`) y `MASTER_UPDATE` figura en el enum de respuesta `CampaignActivityType` del contrato servido, sin habilitarse en el alta manual (`G4-O5-A`). Regresión sobre árbol limpio de ese commit: 178 unitarias, 84 HTTP y 199 PostgreSQL (461 pruebas). Estas decisiones sí afectan lo que André debe consumir; el contrato servido ya las refleja. G4 sigue pendiente de aceptación del owner y G5 continúa provisional: no se genera el ZIP de André. Evidencia en `../G4/BLOQUE_O4_O5_3B5EEC6.md` y `../G4/CONCLUSION_G4_3B5EEC6.md`.

## Sincronización — 2026-11-23 (revisión final pre-aceptación)

Revisión técnica final ejecutada por encargo del owner: sin hallazgos bloqueantes. Se resolvieron el fixture ADMIN de `AC-C4-01`, la reatribución de `AC-P4-04`, el estado intermedio de migraciones y drift documental del contrato. Quedan escaladas al owner las decisiones `G4-O4` y `G4-O5`, que afectan la representación del contrato para André. G5 se prepara tras la aceptación de G4. Evidencia en `../G4/REVISION_FINAL_G4_2026-11-23.md`. Sin push, merge, deploy ni ZIP de André.

## Sincronización — 2026-11-23 (cierre de brechas)

HEAD de código `7a63dfbe1d72b695457cf99b830f186af9b3d2bb` + worktree de pruebas. Cobertura por AC: **50 `CUBIERTO` · 0 `CUBIERTO_PARCIAL` · 0 `NO_CUBIERTO`** según `../G4/MATRIZ_COBERTURA_AC.md`. `AC-P3-02` se cubre como lote revertido por rollback. Evidencia del bloque en `../G4/CIERRE_BRECHAS_AC_7A63DFB.md` y conclusión para el owner en `../G4/CONCLUSION_G4_7A63DFB.md`. Sin push, merge, deploy ni ZIP de André; `06_HANDOFF_ANDRE/` sigue sin generar hasta la aceptación de G4.

## Sincronización — 2026-11-23

HEAD de código `7a63dfbe1d72b695457cf99b830f186af9b3d2bb` + worktree de pruebas. La cobertura por AC quedó mapeada en `../G4/MATRIZ_COBERTURA_AC.md` (37 `CUBIERTO`, 13 `CUBIERTO_PARCIAL`, 0 `NO_CUBIERTO`) y la conclusión técnica de G4 está en `../G4/CONCLUSION_G4_7A63DFB.md`, pendiente de decisión del owner. Mientras G4 no se acepte, no se genera el ZIP de André ni se declara disponibilidad `AVAILABLE` de las rutas CP. La matriz de entrega y el arnés de `06_HANDOFF_ANDRE/` permanecen sin generar; los contratos implementados ya están descritos en `Docs/Contracts/platform-api.v1.yaml` con prueba de anclaje.

## Sincronización — 2026-11-22

HEAD candidato actual: `e2bc9275836b642ac3e2b6086c4c15062b4dcd89`. G4 está en validación independiente, conforme a `../G4/INICIO_VALIDACION_E2BC927.md`. Los puntos siguientes se conservan como registro provisional histórico y no describen todos los avances posteriores: Swagger/paridad CP y T28 ya tienen evidencia histórica en G4. No se hereda su PASS al candidato sin verificar atribución. La entrega final y el ZIP de André no se generan mientras G4 permanezca abierto; se conserva el manifiesto original. La aceptación y la base Flutter siguen a cargo del owner.

## Bloque correctivo del candidato (HEAD + worktree)

La revisión independiente encontró defectos aun con regresión general verde. Se reprodujeron y corrigieron fallos dirigidos de identidad, concurrencia e incorporación legacy, incluyendo el residual RI08. La validación independiente final en Node 20.20.2 pasó build, 143 unitarias, 84 HTTP y 127 PG sobre `e2bc9275836b642ac3e2b6086c4c15062b4dcd89` + worktree identificado por hashes, no un SHA correctivo confirmado. Ver `../G4/VALIDACION_FINAL_WORKTREE_E2BC927.md`, `../G4/BLOQUE_CORRECTIVO_E2BC927.md` y `../G4/CONTRATO_CORRECCIONES_E2BC927.md`. Aún quedan por reconciliar filtros/contexto de participantes C6, paginación P3, actividad contextual P2 y marca de elegibilidad en lecturas de responsable; D06/G4-O3 requiere aclaración de la política de identidad. No se ofrece ZIP ni contrato final a André desde este worktree. La regresión verde no cierra G4 ni acredita los AC ausentes.

## Registro provisional histórico

- Backend SHA probado / HEAD documental / branch / PR: `cd7227def8eee323cff3df666c25610486ceeb04` / `d262f48e9ab6b344c472df60588c2261d377c884`, `feat/sprint-campana-prospector`, PR del sprint pendiente
- Contrato servidor JSON/YAML generado vs Swagger observable: código disponible; Swagger/OpenAPI objetivo aún NO_EJECUTADO/NO reconciliado
- Matriz métodos/roles/requests/responses/errores: matriz provisional de este gate basada en controladores reales
- Disponibilidad real por operación: `PROVISIONAL` hasta pruebas HTTP específicas y Swagger
- Cambios de endpoints existentes y compatibilidad: POST manual conserva ruta y agrega match/resolve aditivos; CSV conserva preview/confirm
- Versión Flutter HEAD consultada como lectura: `0fe5d368e11b1da745ccf42ead3892470dcae0be`, solo referencia
- Fixtures sintéticos y scripts de prueba: suites existentes; fixtures sprint específicas pendientes
- Pantallas/client SDK a adaptar: campañas detalle/prospectos, importador CSV y dashboard; no se modificó Flutter
- Desviaciones del SPEC autorizadas: ninguna; rutas/DTO locales documentados como diseño G2
- Arnés André generado: NO — plantilla existente en `06_HANDOFF_ANDRE/` permanece no generada
- Riesgos/pendientes conocidos: G4 específico incompleto, Swagger/OpenAPI, pruebas C1–C8/P1–P4 por AC, migración legacy T28
- Estado: `PROVISIONAL`; no marcar `LISTO_PARA_REVISION` ni entregar arnés final a André
