# 02 — Plan de cierre autónomo

Ejecutar en orden; registrar cada gate como NOT_RUN, IN_PROGRESS, PASS, FAIL, BLOCKED o PENDING_REMOTE_CI. Los gates de este paquete no sustituyen G6 del owner. Crear `evidencias/` con las plantillas, conservar resultados previos y reanudar desde el primer gate incompleto. No repetir pruebas cuyo SHA/entorno ya esté acreditado salvo cuando un cambio invalide su alcance. No modificar evidencias históricas del arnés CP.

| Gate | Trabajo | Salida obligatoria |
|---|---|---|
| C0 | Preflight y fijación del baseline | refs, árbol, PR, alcance, entorno, plan de commits; comprobar guardas |
| C1 | Auditoría de los 36 commits propios + delta nuevo | matriz exhaustiva por commit; mapa de cambios y hallazgos |
| C2 | Reproducción de fallos y correcciones acotadas | tests dirigidos, causa raíz, diff, trazabilidad por hallazgo; sin cambios especulativos |
| C3 | Migración, datos legacy, concurrencia y aislamiento | ensayos PG16 aislados, regresión, pruebas bajo carrera y rendimiento |
| C4 | Calidad integral, contrato y reproducibilidad | pipeline local equivalente al CI, AC/T01–T31, equivalencia handoff, runtime Docker |
| C5 | Commit y push del candidato, revisión CI | SHA publicado, checks exactos y evidencia de remote; no merge |
| C6 | Handoff técnico | dictamen, riesgos residuales, plan de promoción, revisión manual pendiente |

## C0 — Preflight

Registrar hora con zona, ramas locales/remotas, SHA, versiones Node/npm/Docker/Compose/PostgreSQL, estado del PR y herramientas disponibles. Verificar ausencia de secretos y uso de bases aisladas antes de correr comandos. Leer fuentes. Copiar plantillas a evidencias; no incluir tokens ni datos reales. Si no hay Docker/PG16, no sustituir por mocks: marcar las pruebas bloqueadas y continuar auditoría estática. Si el árbol o ref son ambiguos, detener escrituras y continuar solo lectura.

## C1 — Auditoría completa de commits

Usar el rango fijo `5e214420394101ae7079f8e844cc759b01cce2a3..a68cc4e62ab7510503c617f4c78d00d561c52681` para inventariar los 36 commits originales. `git log --reverse --format=...`, `git show --stat`, `git show --format=fuller <sha>` y diffs contra padres (considerar merges). Incluir todo delta posterior hasta el candidato. No limitarse al mensaje de commit ni al checklist antiguo. Comparar también diff agregado `ADR006..HEAD` y `origin/dev...HEAD`, identificar archivos de producto, tests, migraciones, contrato, tooling y evidencias. Revisar cada cambio funcional, pruebas y modificaciones de autoridad; documentar cambios únicamente documentales sin confundirlos con funcionalidad. Registrar cada commit en `MATRIZ_COMMITS.csv`, con SHA completo, autor, alcance, archivos sensibles, AC/INV, observación y dictamen; justificar N/A. Correlacionar pruebas con los hallazgos. Confirmar no incorporación accidental del PR #6.

## C2 — Correcciones bajo control

Clasificar P0 crítico, P1 alto, P2 medio, P3 bajo. Reproducir cada problema con evidencia; distinguir defecto confirmado, riesgo, hipótesis y falso positivo. Priorizar fugas de tenant, corrupción, regresión, pérdida de historial, contrato roto, escalamiento de autoridad, carreras y migración. Para cada defecto: test que falla en baseline cuando sea factible, corrección mínima, test que pasa y regresión relevante. No corregir por mera preferencia de estilo. No optimizar consultas sin medición ni cambiar semántica de matching, paginación, permisos o estados. Si requiere decisión protegida, registrar opciones y escalar; continuar hallazgos independientes.

Usar commits pequeños, descriptivos, agrupados por causa: `test(cp-close): ...`, `fix(cp-close): ...`, `docs(cp-close): ...`. Evitar agregar archivos ajenos. Revisar `git diff --check` y staged diff antes de cada commit. Registrar SHA y relación con hallazgo en diario. No hacer commits vacíos. Una corrección posterior obliga a reejecutar pruebas afectadas y toda regresión final; no atribuir PASS anterior al nuevo SHA. No borrar evidencias fallidas.

## C3/C4 — Validación independiente

Ejecutar `03_QA_Y_AUDITORIA.md` en PG16 desechable, no en bases compartidas. Auditar incluso resultados reportados anteriormente. Si hay falsos positivos en pruebas, reforzar fixture y sensibilidad. La matriz AC debe contener referencia al test realmente ejecutado; T32 permanece NOT_RUN, responsabilidad Flutter. No rebajar cobertura ni gates para obtener verde.

## C5/C6 — Publicar y entregar

Seguir `04_PUBLICACION_Y_HANDOFF.md`. Ejecutar push autorizado solo de commits revisables en rama CP. Registrar resultados remotos del SHA exacto, limitar seguimiento al tiempo de la sesión y no inventar disponibilidad de CI. Generar handoff incluso si hay bloqueos; no fusionar, no cerrar, no aprobar G6. Una entrega técnicamente lista solo existe si pasan todas las condiciones del DoD. Cuando el owner revise, la integración se decide explícitamente.
