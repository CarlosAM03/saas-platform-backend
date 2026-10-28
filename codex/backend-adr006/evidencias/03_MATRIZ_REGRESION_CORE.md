# Regresión Core 1.0.0

Fecha: 28/10/2026, America/Tijuana (UTC−07). Ejecutor: Codex, G1 local.
Rama: feat/tenant-register. Baseline: ca1e7c9d55d4cad73430801140593b58cb7c413b.
Implementación: f021f1936d39f3ab3421d300b4d6261a133eb9fb; laboratorio: 3be7e4ed033a79add4183701911936f7a291cd63; ensayos adicionales: 514dca4. Corrida integral final: 5e986cc850dd45e352892bde56d4117cfffebfb3.
Las primeras corridas se hicieron sobre ca1e7c9 + cambios del worktree; el diagnóstico de login se añadió sobre3be7e4e y quedó versionado en514dca4. Las corridas posteriores identifican su SHA en los registros; no se atribuyen al baseline intacto. La corrida posterior al commit se identifica en registros-QA.jsonl. Entorno: Docker Linux, Node20.20.2, Prisma5.22.0, PostgreSQL16 desechable. Datos exclusivamente sintéticos; ninguna credencial/URL productiva se utilizó.

Comandos: npm run test:e2e:ci, npm run test:postgres, node codex/backend-adr006/qa.cjs y Invoke-G1.ps1. Datos PostgreSQL: g1_test, g1_history_2 en replayqa1 y g1_history_3 en corrida final poblada. Esperado general: contrato conservado, aislamiento y escrituras íntegras; observado: todos los escenarios siguientes aprobados. La suite original pasaba antes; estos resultados acreditan regresión, no corrección de BR específicos.

| ID | Escenario | Evidencia ejecutada | Resultado |
| --- | --- | --- | --- |
| CORE-01 | Login ADMIN/OWNER/MEMBER, JWT válido/vencido/inactivo; me y logout | platform.e2e, onboarding-http, Core runtime histórico/candidato; login normal tras bcrypt12 | PASS |
| CORE-02 | Tenant A→B→A, ADMIN sin tenant, tenant ajeno | platform.e2e, tenant-context y rehearsal before/old-after/candidate sobre PostgreSQL | PASS |
| CORE-03 | Users paginados, POST default MEMBER, PATCH diferencial, email único, relectura | users-authorization y core-isolation; PrismaClient independiente | PASS |
| CORE-04 | SEC-01 shared/global/ADMIN, self compartido, actor incorrecto | core-isolation y users-authorization;403/404 y objetos DB idénticos antes/después | PASS |
| CORE-05 | ADMIN primer OWNER, OWNER denegado, segundo OWNER409, carreras POST/PATCH, JWT anterior degradación | users-authorization; predicado SSI en PostgreSQL, cero identidad/membresía parcial | PASS |
| CORE-06 | Campaign creación, lectura, PATCH nullable/estado, archivo, borrado prohibido y FKs | campaigns.e2e + users-authorization HTTP/DB, lectura independiente y tenant B404 | PASS |
| CORE-07 | Prospect manual, nullable/status, campaña/tenant, búsqueda y paginación | jobs.postgres y users-authorization HTTP/DB; mutación tenant ajeno404 sin cambios | PASS |
| CORE-08 | CSV preview y CREATE/SKIP/LINK_EXISTING/UPDATE_EXISTING | users-authorization HTTP multipart real, prospect-imports.postgres atomicidad/concurrencia/rollback y prospect-imports.e2e validaciones | PASS |
| CORE-09 | Jobs consulta aislada y operaciones503 sin mutaciones | jobs.postgres + without-prospector HTTP; start/cancel/persist/export/callback siguen deshabilitados | PASS |
| CORE-10 | 400/401/403/404/409/413/429/503; wrappers/paginación | Suites HTTP y PostgreSQL; proxy-rate-limit y TLS deployment para429 real | PASS |
| OPS-01 | Producción validada, flagOFF, CORS, Node20, health/ready, runtime USER node, HTTPS proxy | Docker runtime original/candidato, rehearsal y check-deployment con CA verificada, origen incorrecto sin cabecera CORS | PASS |
| Dashboard | Operación Backend dedicada | No existe operación dashboard entre las33 Core; no se inventa una API. Agregación/presentación Flutter fuera de esta revisión | NOT RUN / no aplica como endpoint |

La suite PostgreSQL final tiene59 pruebas en ocho suites; las84 HTTP incluyen doubles cuando corresponde a validación aislada. Las escrituras de persistencia descritas arriba usan PostgreSQL real. Las suites se ejecutaron también sobre datos históricos sintéticos y una comparación posterior de las ocho tablas confirmó que esos registros permanecieron intactos.

Riesgos residuales: Core con datos reales queda reservado a G2; UI real y despliegue a gates posteriores. QF01 histórico no se declara solucionado por esta matriz.
