# 01 — Gobierno y línea base

## Autoridad

El SPEC-CP-2026-01 aprobado (28 decisiones A1–E5, INV-01..12) y decisiones posteriores registradas gobiernan el negocio; AGENTS.md y las restricciones del arnés original siguen vigentes salvo la autorización específica de push de este paquete y su prompt de activación. No reinterpretar requisitos por conveniencia. Corregir defectos demostrados dentro del dominio Campañas/Prospectos/CSV, tests, documentación y verificadores de calidad, conservando contrato y semántica. No realizar refactors masivos ni cambios de dependencias/Node, schema o infraestructura no indispensables. Nueva migración forward-only solo si una corrección inequívoca dentro del SPEC la exige; si cambia reglas, restricciones de negocio o compatibilidad, escalar primero. No modificar migraciones históricas.

Protegidos: Auth/JWT/RBAC/TenantContext/guards, Users/Tenants/onboarding, ProspectorClient/ProspectingJobs, Service, Engine, CLI, infraestructura y configuración productiva. Si se identifica un problema transversal, demostrarlo con pruebas y escalar, no introducir un arreglo lateral. T32 pertenece a André. No reabrir decisiones ratificadas: CORRECTION manual; MASTER_UPDATE enum documentado, no emitido; rollback transaccional CSV, no endpoint de reversión; identidad fuerte según SPEC y decisiones posteriores.

## Checkpoint remoto confirmado al preparar el paquete

| Ref | SHA / estado |
|---|---|
| Backend PR #11 | OPEN, head `feat/sprint-campana-prospector`, base `dev`, mergeable reportado true (no equivale a CI verde) |
| Head CP | `a68cc4e62ab7510503c617f4c78d00d561c52681` |
| ADR-006 | `5e214420394101ae7079f8e844cc759b01cce2a3` |
| main | `431ca90af3ade893e35195a2d7143e8ad36ee1f5` (PR #10 fusionado) |
| dev | `09593bb715cd83270821d34126a4344c8ef97cb0` |
| Flutter base de André (solo referencia) | `0fe5d368e11b1da745ccf42ead3892470dcae0be` en nueva rama `feat/sprint-campana-prospector`; PR Flutter #11 intacto |
| Contrato entregado a André | backend `3b5eec6fa99f846e853794fc8aedff2c4353c269`; OpenAPI servido de 39 rutas / 77 esquemas; matriz CP 25 operaciones |
| PR backend #6 | experimental, fuera de alcance, conservar abierto e intacto |

En el checkpoint, CP contiene ADR-006 y 36 commits exclusivos (123 archivos de diff); dev está 44 commits detrás de CP y no contiene el merge de main. CP respecto a main: 36 adelantados, 1 atrasado. Recalcular antes de operar; no forzar estos números si el remoto cambia. No atribuir todos los commits a Ángel sin revisar autoría. La aceptación G4 anterior acredita un candidato histórico, no el nuevo SHA. Última reproducción local reportada: 178 unitarias + 84 HTTP + 199 PG = 461; auditoría de producción 0 y árbol completo 25 moderadas reportadas (no observación propia).

## Fuentes a leer (rutas relativas a la raíz del backend)

- `AGENTS.md`, `.github/workflows/ci.yml`, `package.json`, `package-lock.json`, `compose.yml`, `Dockerfile`.
- `codex/sprint-campanas-prospectos/04_REFERENCIAS/SPEC_SPRINT_CAMPANAS_PROSPECTOS_v1.0_OWNER_APROBADO.md`, `01_GOBIERNO/01_AUTORIDAD_PRECEDENCIA.md`, `03_CALIDAD/GATES_Y_DOD.md` (estas dos últimas relativas al arnés original).
- `codex/sprint-campanas-prospectos/05_EVIDENCIAS/decisiones/` y G4: `ACEPTACION_G4_OWNER.md`, `REVISION_FINAL_G4_2026-11-23.md`, `MATRIZ_COBERTURA_AC.md`, `MATRIZ_QA.md`, `CONCLUSION_G4_3B5EEC6.md`.
- G5: `HANDOFF.md`, `CI_QUALITY_FIX_B79209A.md`; G6: `REVISION_OWNER.md`; `06_HANDOFF_ANDRE/` completo, `MANIFEST_INTEGRIDAD.json`.
- `Docs/Contracts/platform-api.v1.yaml`, ADR-003/004/006 y contratos aprobados; `codex/backend-adr006/evidencias/10_HANDOFF_GATE1.md`.
- `Prisma/schema.prisma`, migraciones, controladores/DTO/servicios CP y suites correspondientes.

Si una fuente no existe, registra su ausencia y localiza el equivalente por búsqueda local; no inventes su contenido.

## Control Git y coexistencia

- Comprobar `git rev-parse --show-toplevel`, `git remote -v` (sanitizado), `git status --short`, `git branch --show-current`, `git rev-parse HEAD`, `git worktree list` y `git fetch origin` (sin prune). Verificar PR mediante `gh pr view 11 --repo CarlosAM03/saas-platform-backend --json state,baseRefName,headRefName,headRefOid,mergeable,url` si existe gh autenticado. No exponer tokens.
- Si hay cambios ajenos, no stash/reset/clean; trabajar en otro worktree desde el SHA confirmado sin modificar el original. La carpeta nueva del paquete es el único cambio inicial propio permitido; copiarla de forma explícita si se usa otro worktree. No usar checkout de rama ocupada; puede usarse worktree detached y commits locales, publicando HEAD con refspec explícito después de verificar ascendencia. Registrar ubicación. No borrar worktrees de terceros.
- El SHA inicial debe ser ancestro del head actual. Si el remoto avanzó, verificar cambios/autoría y no pisar trabajo; continuar solo si el nuevo candidato es compatible y su alcance inequívoco. Si hay divergencia, parar escrituras/push y escalar. No rebase, reset, clean, cherry-pick, force-push ni merge en ramas compartidas.
- Push ordinario autorizado solo al PR #11 existente: `git push origin HEAD:refs/heads/feat/sprint-campana-prospector`. No crear otros PR, cambiar descripción/base, aprobar, cerrar o fusionar PR. No activar auto-merge. No modificar dev/main ni la rama ADR-006, ni PR #6.
- No operar sobre infra productiva, datos reales, credenciales, correos externos ni endpoints de scraping. Aislar redes/volúmenes Docker con nombre de proyecto único; no reutilizar DB de otros agentes. No usar comandos de limpieza global. Variables/secretos exclusivamente sintéticos y fuera de evidencias.
