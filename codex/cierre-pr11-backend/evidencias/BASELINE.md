# C0 — Línea base verificada

- Inicio de verificaciones: 2026-11-23, America/Tijuana (UTC−08:00). Repositorio `CarlosAM03/saas-platform-backend`, checkout `Backend_Nestjs/saas-platform-backend`, rama `feat/sprint-campana-prospector`.
- HEAD y ref remota de la rama y de `refs/pull/11/head`: `a68cc4e62ab7510503c617f4c78d00d561c52681`. `git fetch origin` sin prune y `git ls-remote` confirmaron el checkpoint.
- `origin/dev`: `09593bb715cd83270821d34126a4344c8ef97cb0`. `origin/main`: `431ca90af3ade893e35195a2d7143e8ad36ee1f5`. ADR-006: `5e214420394101ae7079f8e844cc759b01cce2a3`. La CLI `gh` no está instalada. La búsqueda de GitHub con filtros PR abierto, head CP y base dev devolvió [PR #11](https://github.com/CarlosAM03/saas-platform-backend/pull/11).
- Único cambio inicial: paquete suministrado sin seguimiento, dentro de un directorio adicional de extracción. Se instaló en `codex/cierre-pr11-backend/` sin sobrescribir archivos. Se reutilizó el checkout CP. `git worktree list` mostró otros cuatro checkouts, respetados.
- Host Node 22.16.0, npm 11.7.0, Git 2.52.0.windows.1, Docker Desktop cliente/servidor 29.9.2, Compose 5.6.1. Laboratorio Linux usa la imagen Node 20 del Dockerfile, Prisma 5.22.0 y PostgreSQL 16. `package-lock.json`: lockfile v3, 811 entradas; no se cambió.
- `verify-target-guards.cjs` comprobó cinco rechazos previos a conexión y `externalConnections:0`. `verify-contract.cjs` comprobó 33/38/46 operaciones y login idéntico. Ambas corridas a las 23:04:29–30 UTC−08:00 sobre `a68cc4e`.
- Los proyectos de laboratorio tienen nombres exclusivos. Docker excluye `.env`, `.env.*` fuera de ejemplos, `.tmp` y archivos locales de claves. Se usó `--env-file` explícito y el perfil `test` con credenciales sintéticas de Compose. Ningún puerto de PostgreSQL se publicó.

## Alcance revisado

`5e21442..a68cc4e`: 36 commits lineales, 123 archivos. `origin/dev...a68cc4e`: 0/44 commits y 206 archivos. `origin/main...a68cc4e`: 1/36 commits y 123 archivos. Los archivos productivos del delta se concentran en Campañas, Prospectos/CSV, Prisma y el YAML de plataforma. Los cambios de suites de Jobs y Users en ese rango son de limpieza de fixtures y formato. Sin cambios en servicios protegidos o workflow. El head del PR #6, `3db53f1154396af853b786f8b955938af0247fbf`, no es ancestro del candidato (`git merge-base --is-ancestor`, salida 1).
