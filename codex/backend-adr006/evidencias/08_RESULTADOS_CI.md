# Resultados de CI y trazabilidad del HEAD

Fecha: 28/10/2026, America/Tijuana (UTC−07). Ejecutor: Codex, G1 local.
Rama: feat/tenant-register. Baseline: ca1e7c9d55d4cad73430801140593b58cb7c413b.
Implementación: f021f1936d39f3ab3421d300b4d6261a133eb9fb; laboratorio: 3be7e4ed033a79add4183701911936f7a291cd63; ensayos adicionales: 514dca4. Corrida integral final: 5e986cc850dd45e352892bde56d4117cfffebfb3.
Las primeras corridas se hicieron sobre ca1e7c9 + cambios del worktree; el diagnóstico de login se añadió sobre3be7e4e y quedó versionado en514dca4. Las corridas posteriores identifican su SHA en los registros; no se atribuyen al baseline intacto. La corrida posterior al commit se identifica en registros-QA.jsonl. Entorno: Docker Linux, Node20.20.2, Prisma5.22.0, PostgreSQL16 desechable. Datos exclusivamente sintéticos; ninguna credencial/URL productiva se utilizó.

La evidencia CI se obtiene de GitHub, separada de las ejecuciones locales. No se infiere PASS por la existencia de pruebas ni por un commit anterior.

| SHA | Run | quality | postgres-integration | docker-build | Clasificación |
| --- | --- | --- | --- | --- | --- |
| ca1e7c9d55d4cad73430801140593b58cb7c413b | [40711778812](https://github.com/CarlosAM03/saas-platform-backend/actions/runs/40711778812) | SUCCESS | SUCCESS | SUCCESS | CI histórico del PR recibido, reconfirmado28/10 |
| 3be7e4ed033a79add4183701911936f7a291cd63 | [40776912982](https://github.com/CarlosAM03/saas-platform-backend/actions/runs/40776912982) | SUCCESS | SUCCESS | SUCCESS | CI nuevo de implementación/laboratorio, verificado28/10≈15:07Tijuana |

quality ejecutó npm ci, generate, guardas de destino y contrato añadidas, lint, formato, build, unitarias, HTTP y dos audits. postgres-integration ejecutó migrate deploy y las ocho suites sobre PostgreSQL16 real. docker-build construyó runtime. Se conservan exactamente los tres jobs.

El commit documental que contiene este informe cambia el HEAD. Su CI debe verificarse otra vez tras el push; el registro inmutable de esa última comprobación se publica en la descripción de [PR10](https://github.com/CarlosAM03/saas-platform-backend/pull/10), con SHA y run exactos, y en la entrega de este chat. No se presenta la fila3be7e4e como CI de un HEAD documental posterior ni se genera una cadena infinita de commits para incluir su propio SHA.

## Resultado local independiente

Baseline original:90 unitarias,84HTTP,35PostgreSQL. Final:113 unitarias,84HTTP,59PostgreSQL, todos PASS. Docker, Prisma, tipos, build, lint, formato y contrato PASS. La nueva corrida después de commits se ejecutó mediante node codex/backend-adr006/qa.cjs y terminó22:07:29UTC; [registros-QA.jsonl](registros-QA.jsonl).

npm audit final: ocho LOW en tooling transitivo deepmerge; cero moderate/high/critical. npm audit --omit=dev: cero vulnerabilidades. No se hizo downgrade/force fix de Nest/Jest para ocultar LOW. Estado: PASS para gates existentes; riesgo residual LOW de desarrollo conocido.

El HEAD final solo se declara listo en el handoff externo tras comprobar los tres jobs de ese SHA. G2/G3–G6 y pruebas remotas productivas no quedan certificados por Actions.

## Cierre posterior de CI sobre la entrega 5e986cc

Verificado el28/10/2026: HEAD5e986cc850dd45e352892bde56d4117cfffebfb3, [run40778515211](https://github.com/CarlosAM03/saas-platform-backend/actions/runs/40778515211), conclusiónSUCCESS. Jobs: quality123133929101 SUCCESS, postgres-integration123133929173 SUCCESS, docker-build123133928948 SUCCESS. Esta evidencia sí incluye el commit documental5e986cc. Esperado: tresSUCCESS; observado: tresSUCCESS; PASS. Entorno: GitHub Actions Node20/PostgreSQL16, rama feat/tenant-register.

Después se archivaron únicamente nuevos resultados documentales. El CI del commit que los incorpora se comprueba otra vez y se registra con su SHA/run en la descripción del PR10; no se extrapola este run a un SHA posterior.