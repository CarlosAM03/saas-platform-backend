# Cierre técnico de prospectos y de dev

Fecha de cierre: 20 de octubre de 2026.

## Aceptación del estado actual

El owner acepta la creación manual de prospectos y CSV Import V1 y ratifica
expresamente los cambios de `Docs/Contracts/platform-api.v1.yaml`, incluidos
`POST /api/v1/prospects`, `/api/v1/prospects/import/preview` y
`/api/v1/prospects/import/confirm`, con sus schemas relacionados. Esta aprobación
satisface ADR-004; el contrato no tiene una decisión arquitectónica abierta.

El estado técnico de `dev` queda cerrado y aceptado como candidato a producción,
listo para integrarse a `main`. La aceptación corresponde al alcance implementado
y validado, independientemente del ciclo operativo del PR o del despliegue.
Este documento no requiere cambios por esos eventos posteriores.

## Baseline verificado

- `origin/main`: `2f5ccb6c6ae6da1d28afb587b3bff2e38a5f2704`.
- `origin/dev` al iniciar el cierre: `a91b79e38e19f9ad9e4f064f65765ae767eaae58`.
- Referencias sincronizadas con `git fetch origin --prune`; árbol inicial limpio.
- `dev` contiene `main`: 0 commits exclusivos de main y 4 exclusivos de dev.
- La creación manual (`9a40f85`) y CSV V1 (`670fb98`) están incluidos; `715f1d2`
  integró main y `a91b79e` corrigió exclusivamente formato.
- El cierre corrige documentación y el schema de valores del preview: una fila
  INVALID puede devolver una celda de más de 2000 caracteres junto con su error.
  El límite de entrada y el comportamiento del importador se conservan.

## Alcance funcional aceptado

| Área | Disponible |
| --- | --- |
| Auth | Login, logout, selección de tenant y me. |
| Tenants | Listado, detalle y creación exclusiva de ADMIN. |
| Users | Listado, búsqueda/paginación, detalle, creación, actualización y desactivación/eliminación conforme a las reglas actuales. |
| Campaigns | Listado, búsqueda, paginación, ordenamiento, creación, detalle, actualización, estado, archivo, borrado permanente ADMIN y prospectos por campaña. |
| Prospects | Listado, búsqueda, detalle, actualización, creación manual ADMIN/OWNER, orígenes google_maps/manual/csv y relaciones con campañas. |
| CSV Import V1 | Preview, clasificación NEW/MATCH/INVALID/CONFLICT, deduplicación por nombre normalizado, diferencias, sharedWithOtherCampaigns y confirmación con CREATE/LINK_EXISTING/UPDATE_EXISTING/SKIP. |
| Jobs | Listado y detalle de registros existentes. |

La creación manual guarda Prospect y CampaignProspect en una transacción y
asigna source=manual. CSV crea con source=csv y no modifica la identidad baseline.
Se conserva la evidencia manual reportada por el owner: creación/consulta,
permisos y errores de creación manual; CREATE, SKIP, LINK_EXISTING y
UPDATE_EXISTING CSV, teléfonos con ceros, vacíos a null y columnas ausentes
conservadas. La repetición desactualizada está verificada automáticamente en
PostgreSQL; no se atribuye una ejecución manual adicional.

## Arquitectura, seguridad y garantías verificadas

- Módulo NestJS → Controller → Service → TenantContext → Prisma → PostgreSQL.
- AuthGuard/RolesGuard, AsyncLocalStorage, JWT/RBAC, ValidationPipe,
  response wrapper, GlobalExceptionFilter, requestId y logging intactos.
- Auth/Common, esquema Prisma y migraciones sin diferencias respecto de main.
- ADMIN/OWNER con tenant obligatorio; MEMBER no puede crear ni importar.
  Campañas, candidatos y actualizaciones están filtrados por tenant; tenantId
  enviado por el cliente no constituye autoridad.
- Preview sin escrituras en RepeatableRead. Referencia HMAC con separación de
  dominio, vigencia de 15 minutos y vínculo a usuario, tenant, campaña, archivo
  y snapshot; confirm rechaza archivo o contexto distintos.
- Confirmación Serializable, validación de todas las decisiones antes de escribir,
  rollback completo y hasta tres intentos totales ante P2034. Cambios relevantes
  del snapshot o conflictos agotados devuelven 409.
- Contrato y código cotejados para DTOs, multipart, roles, límites, enums,
  respuestas y errores 400/401/403/404/409/413 según la operación.

## Evidencia de validación del cierre

Gates ejecutadas desde `dev` el 20 de octubre de 2026, sin relajar tests,
workflows ni el umbral HIGH de npm audit:

| Gate | Resultado real |
| --- | --- |
| npm ci / prisma:generate | PASS. |
| lint:check / format:check / build | PASS. |
| test:unit:ci | 34/34; 5 suites, incluidos prospect-csv.parser y prospect-imports.service. |
| test:e2e:ci | 77/77; 6 suites, incluida prospect-imports.e2e. |
| PostgreSQL 16 desechable | 10/10; 2 suites, incluida prospect-imports.postgres con persistencia, repetición, concurrencia y rollback real. |
| docker build . / docker compose config | PASS. |
| npm audit --audit-level=high | PASS: 21 vulnerabilidades, todas MODERATE; HIGH/CRITICAL = 0. |
| npm audit --omit=dev --audit-level=high | PASS: 2 vulnerabilidades, ambas MODERATE; HIGH/CRITICAL = 0. |
| OpenAPI | YAML válido; 267 referencias locales resueltas y las tres operaciones cotejadas. |
| Revisión de secretos | Sin secretos nuevos; credenciales locales documentadas conservadas. |

PostgreSQL se ejecutó con el mecanismo oficial en un proyecto Compose aislado:
`docker compose -p saas-backend-dev-close --profile test run --build --rm test-postgres`.
Solo se aplicó la migración baseline a test-db efímera; después se retiraron
sus contenedores y red. No se usaron shared-dev, Supabase ni producción.
Las gates del host usaron Node 22.16.0; Docker y CI usan Node 20 conforme al proyecto.

El [CI remoto del baseline funcional a91b79e](https://github.com/CarlosAM03/saas-platform-backend/actions/runs/38909222312)
fue consultado: quality, postgres-integration y docker-build terminaron SUCCESS.
El workflow conserva las mismas gates para cada HEAD publicado. El ruleset activo
de main exige PR y esos tres checks, con la rama actualizada y sin force push.

## Límites de V1 aceptados

CSV síncrono UTF-8, coma/punto y coma, encabezados exactos, máximo 5 MB y 1000
registros. No incluye XLS/XLSX, mapeo arbitrario, metadata importable, historial,
idempotencia durable, undo, jobs de fondo ni índice/columna de nombre normalizado.
La comparación recorre candidatos del tenant; JWT_SECRET conserva la firma con
separación de dominio. Estas limitaciones no bloquean la aceptación de V1.

Prospector Service/Engine, scraping, creación/cancelación real de jobs,
persistencia de resultados, exportación y callbacks operativos no están
habilitados. Se conservan las respuestas y restricciones actuales: 503 tras
validación en operaciones de prospección deshabilitadas y 401 en callbacks sin
clave válida. CSV/manual no activan esos flujos.

Reglas detalladas: [Prospects](../src/prospects/README.md),
[CSV Import V1](../src/prospects/imports/README.md),
[OpenAPI](Contracts/platform-api.v1.yaml) y [ADR-004](ADRs/ADR-004-CommonBaseline.md).
