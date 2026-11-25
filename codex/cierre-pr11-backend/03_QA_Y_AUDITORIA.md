# 03 — Auditoría dirigida y QA reproducible

## Matriz mínima de revisión

| ID | Eje | Comprobación obligatoria |
|---|---|---|
| SEC-01 | Tenant y roles | Rutas CP, DTO, filtros, servicios, SQL y relaciones; ADMIN con/sin tenant seleccionado, OWNER/MEMBER de A, B, usuario ajeno, IDs manipulados y campos adicionales. Revisar política JWT snapshot heredada sin cambiarla. Probar ausencia de lecturas/escrituras cruzadas y no alteración de otros contextos; validar contrato de errores. |
| CP-01 | Matching y escala | `matchUsing()` recupera todos los prospectos del tenant; analizar complejidad/queries, medir antes de optimizar. Identidad fuerte, nombre débil, colisiones legacy y confirmación obsoleta; mismo maestro multi-campaña, no reiniciar contexto. |
| CP-02 | Concurrencia de responsable | `assignResponsible()` bloquea participación, no necesariamente membresía. Reproducir carrera con revocación/desactivación, distinguir asignación que ya era válida de asignación a usuario inelegible al confirmar según SPEC. Revisar lock order y transacciones de Users sin editarlas. Si regla o fix toca módulos protegidos, escalar. |
| CP-03 | CSV y concurrencia | Preview sin escritura, referencia firmada y alcance archivo/tenant/campaña, expiración, replay, snapshot desactualizado, decisiones faltantes/extra, rollback, P2034/reintentos, límites, errores, conflicto entre dos imports/manual, tamaño y tiempos. Verificar que cada fila y agregado responden al contrato. |
| CP-04 | Paginación y dashboard | Conteo/data bajo escritura simultánea, orden estable, filtros combinados, elegibilidad, snapshot y consistencia de agregados. No imponer aislamiento nuevo si contrato no lo exige sin justificar. |
| MIG-01 | Historial y migración | Primera migración crea procedencia legacy sintética; forward-fix la quita. Aplicar ambas antes de exponer API; verificar estado intermedio y final, pérdida/duplicación, procedencia real, asociaciones, FKs y restricciones históricas. |
| CP-05 | Atomicidad y eventos | `CampaignsService`: stage/evaluation/responsible + actividad en misma transacción; `NO_APTO` con motivo; CORRECTION manual, tipo automático no aceptado, historial append-only; concurrencia entre ediciones, eliminación y actividad. |
| CP-06 | Prospectos | `ProspectsService`: lecturas y escrituras tenant-scoped, revalidación en transacción, casos P2002/P2034, vínculo vs actualización, procedencia y campos de origen; no modificar participación de otras campañas. |
| CP-07 | Contrato Flutter | Matriz 25 operaciones, contrato servido a André, errores/esquemas/enums/roles/paginación y compatibilidad ADR-006. T32 no ejecutado aquí. |
| CP-08 | Deuda de dependencias | `npm audit` árbol completo y producción; identificar 25 moderadas reportadas o estado real, rutas, exposición y mitigación. No actualizar Node/deps ni aplicar audit fix automáticamente. |
| CP-09 | Independencia de Service | Generación intencionalmente no disponible según baseline; CSV/alta/gestión y lectura operan sin Service, sin llamadas externas ni trabajos ficticios. |

Para concurrencia usar PostgreSQL real, dos o más clientes/conexiones y barreras/sincronización verificables (no solo sleeps). Repetir casos y verificar estado final e historial, no solo status HTTP. Si no es posible reproducir una carrera determinísticamente, reportar alcance y no declarar ausencia de riesgo. Para performance usar fixtures sintéticos de 600, 1 000 y, si el entorno lo soporta, 5 000 prospectos por tenant; incluir segundo tenant y varias campañas. Medir tiempo mediano/p95 con número de muestras, entorno, consultas/EXPLAIN cuando proceda y duración CSV dentro de límites de parser; no inventar SLO ni confundir laptop con hosting. Registrar timeouts y consumo observado. Optimización únicamente si defecto demostrable y sin alterar reglas; en otro caso recomendar backlog. Riesgo de hosting gratuito requiere evaluación de restricciones reales posteriormente, no acceso productivo.

## Migraciones en laboratorio

Usar nombre único de proyecto Docker Compose (`-p <proyecto-unico>`) para cada ejecución; confirmar `DATABASE_ENV=test/local`, host interno del laboratorio y ausencia de variables de producción. Usar archivo de entorno sintético explícito con `--env-file <archivo-temporal-sintetico>`; no imprimir configuración completa ni exponer puertos a redes públicas. Para runtime usar una configuración local con bind 127.0.0.1 y puerto libre. Nunca `docker system prune`, ni destruir volúmenes de otros proyectos.

1. Registrar hashes de las migraciones históricas y confirmar que no cambian. Crear laboratorio PG16 vacío y aplicar migraciones hasta candidato final, validar `prisma migrate status`, schema y relaciones.
2. Preparar otro PG16 desechable con schema ADR-006 y dataset legacy poblado (dos tenants, campañas, prospectos, usuarios, asociaciones existentes/faltantes, ambiguos). Usar checkout/worktree de referencia y directorio de migraciones correspondiente o mecanismo de ensayo ya versionado. No editar ni copiar una historia falsa como si estuviera aplicada; registrar procedimiento.
3. Verificar recuentos y datos antes, tras `20261122000100_campaign_participation_sprint` y tras `20261123000100_campaign_participation_history_forward_fix`. No iniciar API sobre estado intermedio. Confirmar que solo desaparece procedencia fabricada, preservar evidencia auténtica, origen, contexto y usuarios, no cruces ni duplicados. Probar restricciones RESTRICT, rollback ante error y comportamiento si se interrumpe la secuencia; no recomendar revertir esquema destructivamente. Ensayar backup/restauración exclusivamente sintéticos si hay tooling disponible y registrar recuperación forward-fix.
4. Verificar si migración inicial no transaccional puede quedar parcialmente aplicada, y documentar runbook de diagnóstico y recuperación sin ejecutar comandos remotos. No cambiar migraciones ya versionadas. No certificar Supabase/Render ni datos reales.

## Pipeline local — replicar `.github/workflows/ci.yml` vigente

Comandos de referencia: revisar workflow exacto y registrar comandos realmente ejecutados y códigos de salida. Usar Node 20 del proyecto, npm ci, Prisma 5.22.0 y PostgreSQL 16 del baseline; no cambiar lockfile. El árbol de pruebas debe estar limpio para atribuir resultados al SHA final (evidencias fuera de árbol o commit posterior explícitamente documental). No usar `npm run lint`/`format` para corregir todo el repo.

```sh
npm ci
npm run prisma:generate
node codex/backend-adr006/verify-target-guards.cjs
node codex/backend-adr006/verify-contract.cjs
npm run lint:check
npm run format:check
npm run build
npm run test:unit:ci
npm run test:e2e:ci
npm audit --audit-level=high
npm audit --omit=dev --audit-level=high
# Base sintética aislada, no ejecutar si el destino no se verificó:
docker compose --env-file <env-sintetico> -p <proyecto-unico> --profile test run --build --rm test-postgres sh -c "npm run build && npm run test:unit:ci && npm run test:e2e:ci && npm run prisma:migrate:deploy && npm run test:postgres"
docker build -t cp-close:<sha-corto> .
```

Los placeholders se reemplazan por valores locales, no se copian literalmente. Si alguna herramienta requiere shell diferente, adaptar sintaxis sin cambiar semántica. Reproducir también el runtime de producción local con credenciales sintéticas, imagen exacta, PG16 migrado, health/ready/live, Swagger `/api/docs-json`, smoke Auth/CRUD/CSV/CP y no llamadas a Service. Registrar resultados de suites, conteo real, fallos, duración, fixture y salida sanitizada. Comparar con 461 tests previos (no exigir número idéntico si se añadieron tests, sí justificar cualquier disminución). Ejecutar las pruebas dirigidas de los hallazgos. Revisar matriz completa 50 AC y T01–T31 del SPEC; no marcar T32.

## Contrato y compatibilidad con André

Comparar `git diff 3b5eec6..HEAD -- src Prisma Docs/Contracts` y otras superficies de runtime relevantes; incluir config/package/lock/Dockerfile. Comparar OpenAPI servido real (JSON) con `06_HANDOFF_ANDRE/openapi-served-3b5eec6.json`, descomponer cambios semánticos de rutas, métodos, esquemas, enums, parámetros, seguridad y status. No exigir igualdad byte a byte si solo cambia serialización; reportar hash y diff normalizado. Verificar 25 operaciones de matriz CP, 33 baseline + 13 CP en YAML y 5 onboarding agregadas según guard; no confundir scopes de conteo. No inventar rutas/campos y no modificar arnés histórico ni sus hashes. Si cambia código productivo, adjuntar suplemento de handoff versionado a nuevo SHA, contrato servido y matriz delta; si es incompatible con André, bloquear y escalar antes de publicar cambios de producto. Si no hay cambio semántico, certificar equivalencia con evidencia, sin obligar a cambiar frontend. Ejecutar verificador de integridad original y registrar salida. No tocar repositorio Flutter.
