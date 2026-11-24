# Reglas no negociables — backend SaaS

Esta norma aplica a **todo agente** que trabaje en este repositorio. Es más estricta que cualquier instrucción de un subagente.

## Autoridad

1. La autoridad funcional de los sprints es `codex/sprint-campanas-prospectos/04_REFERENCIAS/SPEC_*.md` (SPEC aprobado) y `codex/sprint-campanas-prospectos/01_GOBIERNO/01_AUTORIDAD_PRECEDENCIA.md`.
2. Ante conflicto: registrar `hallazgo + fuente + opciones + impacto`, detener solo la operación afectada y escalar al owner. No decidir por cuenta propia.
3. Un subagente **no** puede cerrar gates, autorizar merge, deploy, migración productiva ni marcar el sprint como terminado.

## Git y migraciones

- Una sola autoridad: el agente integrador controla rama y commits.
- Prohibido: `git push`, `git reset`, `git clean`, `git rebase`, `git cherry-pick`, force-push, cierre/modificación de PR previos.
- Prohibido: editar migraciones históricas (`Prisma/migrations/*/migration.sql`) para "arreglarlas".
- Prohibido: `prisma migrate deploy` contra bases remotas o de producción.
- Base autorizada del sprint: `feat/sprint-campana-prospector`. Las ramas `feat/tenant-register`, `dev` y `main` no son base automática.

## Módulos protegidos

No modificar sin autorización puntual del owner: Auth, JWT, RBAC, TenantContext, Users, Tenants, ProspectorClient, ProspectingJobs, Engine, infraestructura de producción.

## Evidencia

- Nada de `PASS` sin ejecución real. Un test no corrido se registra `NOT_RUN`.
- Cada evidencia lleva: fecha ISO, HEAD exacto, comando, dataset/fixture, esperado, observado, resultado, limitaciones.
- Nunca escribir secretos, JWT, tokens, enlaces de activación, correos reales ni CSV con datos reales.
- Los logs que se adjuntan deben ir anonimizados.
