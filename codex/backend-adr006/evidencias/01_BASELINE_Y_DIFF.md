# Baseline y auditoría del diff

Fecha: 28/10/2026, America/Tijuana (UTC−07). Ejecutor: Codex, G1 local.
Rama: feat/tenant-register. Baseline: ca1e7c9d55d4cad73430801140593b58cb7c413b.
Implementación: f021f1936d39f3ab3421d300b4d6261a133eb9fb; laboratorio: 3be7e4ed033a79add4183701911936f7a291cd63; ensayos adicionales: 514dca4. Corrida integral final: 5e986cc850dd45e352892bde56d4117cfffebfb3.
Las primeras corridas se hicieron sobre ca1e7c9 + cambios del worktree; el diagnóstico de login se añadió sobre3be7e4e y quedó versionado en514dca4. Las corridas posteriores identifican su SHA en los registros; no se atribuyen al baseline intacto. La corrida posterior al commit se identifica en registros-QA.jsonl. Entorno: Docker Linux, Node20.20.2, Prisma5.22.0, PostgreSQL16 desechable. Datos exclusivamente sintéticos; ninguna credencial/URL productiva se utilizó.

## Preparación y autoridades

El checkout recibido estaba en feat/prospector-service-mvp-integration@a80871b6c5ebf39b4fca69eaf5f6352ab342da96, con ADR-006 aprobado y Docs/Planeacion sin rastrear. Se preservaron su rama, archivos y worktrees existentes. Se creó el worktree administrado backend-adr006-g1 y la rama local feat/tenant-register a partir de origin. No se mezcló dev ni el Service.

Los tres documentos del owner se localizaron y leyeron completos en el checkout original:

- Docs/Planeacion/01_PLAN_6_GATES_QA_RELEASE_BACKEND_ADR006.md.
- Docs/Planeacion/02_REGISTRO_BR_DECISIONES_Y_PENDIENTES.md.
- Docs/Planeacion/DecisionesCerradas/03_DECISIONES_CERRADAS_GATE1_BACKEND_ADR006.md.

Se consultaron ADR-003/004, ADR-006 aprobado, contrato aprobado/Core, MODULE-DEVELOPMENT, CORE_V1_VALIDATION, código, migraciones, suites y documentación del PR. No se encontraron AGENTS.md aplicables en el repositorio/ancestros inspeccionados. D1–D9 alternativa A se trataron como aprobadas.

GitHub y fetch confirmaron main=b51b265f1a545fa915f1dd1c57ef2f5858ec6492 y PR#10=ca1e7c9d55d4cad73430801140593b58cb7c413b. Merge base Core correcto. Diff original: 55 archivos, 10813 altas, 17 bajas. La instalación host es Node22; no se utilizó para acreditar engines20. Docker requirió acceso autorizado al pipe.

Los helpers remotos de Git en el worktree largo de Windows fallaron con GIT_DIR too big. Fetch/push ordinario se hicieron desde el checkout original, referenciando explícitamente feat/tenant-register y sin cambiar su checkout. No se ocultó la limitación ni se recurrió a force push.

## Baseline sin correcciones — 21:23:52–21:25:22 UTC

Entorno prospector-g1-baseline-qa, imagen ca1e7c9, base local g1_test, red interna y tmpfs nuevos.

| Comando | Esperado | Observado | Estado |
| --- | --- | --- | --- |
| docker build --target development / docker build runtime | Node20, instalación exacta y runtime compilable | npm ci, Node20.20.2 y ambas imágenes construidas | PASS |
| npm run prisma:generate; npx prisma validate | Cliente/esquema válidos | Prisma5.22.0 válido | PASS |
| npx tsc --noEmit; npm run build | Compilar sin errores | Código cero | PASS |
| npm run lint:check; npm run format:check | Sin errores | Sin errores | PASS |
| npm run test:unit:ci | Suite original | 90/90, diez suites | PASS |
| npm run test:e2e:ci | HTTP original | 84/84, siete suites | PASS |
| npm run prisma:migrate:deploy; npm run test:postgres | Dos migraciones y PostgreSQL real | 35/35, cinco suites | PASS |
| npx prisma migrate status | Historial consistente | Schema up to date | PASS |

CI anterior confirmado por separado: [40711778812](https://github.com/CarlosAM03/saas-platform-backend/actions/runs/40711778812), tres jobs SUCCESS en ca1e7c9. Es evidencia CI previa de Ángel/PR, no de las correcciones Codex.

## Mapa de cambios

| Área | PR recibido | Hardening G1 |
| --- | --- | --- |
| Prisma | Flag pendiente, normalización/index/trigger, cinco tablas nuevas | Sin alterar schema ni migraciones; preflight y ensayo poblado |
| Auth/JWT | Normalización y bloqueo pending | Contrato JWT intacto; QA login/activación real |
| Users | Normalización y bloqueo credenciales pending | Autoridad DB actual, OWNER ADMIN-only, unicidad SSI, SEC-01 y último OWNER |
| Correo | Nodemailer/SMTP | Brevo HTTPS nativo Node20; se retiran dos dependencias SMTP |
| Rate limiting | Buckets persistentes por req.ip/credencial | Allowlist proxy explícito, pruebas TCP/HTTPS reales y persistencia |
| OpenAPI | Composición de cinco rutas | Ningún YAML aprobado ni Core modificado; validadores adicionales |
| Operación/CI | Tres jobs y Docker runtime sin migrate | Se conserva ese arranque; guardas de destino y contrato añadidas a quality |
| Documentación | SMTP/historia y duplicados | Historia preservada y runbook/evidencias actuales por SHA |

Prueba específica BR03 sobre imagen original: users-authorization, diez casos: nueve FAIL, uno PASS; después los mismos diez PASS y dos regresiones Core adicionales PASS. Por tanto, el baseline verde no se presenta como demostración de esos arreglos.

Referencias: [BR](02_HALLAZGOS_Y_CORRECCIONES_BR.md), [migración](05_ENSAYO_MIGRACION_POSTGRES_LOCAL.md), [CI](08_RESULTADOS_CI.md). Riesgo residual: registros reales/infraestructura remota no inspeccionados en G1.
