# QF01 — Usuarios ACME

Fecha: 28/10/2026, America/Tijuana (UTC−07). Ejecutor: Codex, G1 local.
Rama: feat/tenant-register. Baseline: ca1e7c9d55d4cad73430801140593b58cb7c413b.
Implementación: f021f1936d39f3ab3421d300b4d6261a133eb9fb; laboratorio: 3be7e4ed033a79add4183701911936f7a291cd63.
Las corridas previas al commit se hicieron sobre ca1e7c9 + cambios del worktree que quedaron versionados en esos commits; no se atribuyen al baseline intacto. La corrida posterior al commit se identifica en registros-QA.jsonl. Entorno: Docker Linux, Node20.20.2, Prisma5.22.0, PostgreSQL16 desechable. Datos exclusivamente sintéticos; ninguna credencial/URL productiva se utilizó.

Estado de investigación G1: PASS del diagnóstico sintético; incidente histórico **NO REPRODUCIDO**, causa histórica **BLOCKED por falta de copia/payload real autorizado**. No se atribuye a Flutter ni se declara resuelto en producción.

## Evidencia

Comandos: rehearsal before/old-after/candidate y test/users-authorization.postgres-spec.ts; Node20/PostgreSQL16 con ACME synthetic y B synthetic, nunca ACME productivo. Se probaron:

- ADMIN global con tenant seleccionado, OWNER y MEMBER.
- Identidad con múltiples membresías válidas Role/UserTenant en A/B.
- platformRole=null junto a roles de negocio OWNER/MEMBER válidos.
- Listado paginado, creación default MEMBER y lectura por conexión independiente.
- Cambios A→B→A e identidades scoped sin exponer membresías ajenas.
- HTTP sobre runtime original, candidato y proxy HTTPS.

Esperado: wrapper success/data/meta, IDs y strings, timestamps ISO, enums de status/role válidos, role de tenant actual y array tenants válido. Observado: respuestas consistentes y sin error de formato; nuevo MEMBER persistido y releído. PASS sintético en ambos tenants.

Se inspeccionó el consumidor Flutter9c0e556: User.fromJson admite explícitamente platformRole=null; Role se obtiene de la membresía y admite role nullable. UserMembership exige tenantId/tenantName/tenantSlug/role, que el Backend devuelve para la membresía actual. Las fechas y enums de fixtures cumplen el parser.

Por tanto, **platformRole=null no demuestra falta de rol ni explica el error ACME**. No se encontró incumplimiento Backend demostrable con las relaciones válidas solicitadas. No se introdujo una reparación especulativa ni se alteró el contrato.

## Investigación restante en G2 / carril Frontend

En una copia privada restaurada: capturar status, wrapper, claves/tipos y registro que rompe la página; comparar con B. Verificar role_id y roles.tenant_id, platform_role fuera de ADMIN/null, campos/fechas/enums, page/limit y versión efectiva Backend/Flutter. No publicar emails, JWT ni registros reales.

Pasar al reviewer Flutter una fixture mínima anonimizada que conserve la forma y provoque FormatException; comprobar json_fields/User/UserMembership/unwrapPaginated y la consulta que hizo la UI. Si la respuesta incumple el contrato, corregir Backend con regresión específica; si cumple, corregir consumidor en su PR11 independiente.

No hay evidencia suficiente para decidir cuál de esos dos casos causó el incidente real. La observación en producción precede ADR006; no se imputa al PR10. La investigación histórica continúa como condición de aceptación productiva del módulo Users. No se accedió a Supabase ni se modificó ACME.
