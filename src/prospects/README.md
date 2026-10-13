# Prospects Module

Actualización: 13 de octubre de 2026.

## Propósito

Gestionar prospectos persistidos y sus asociaciones con campañas dentro del tenant
autenticado. Incluye consulta, actualización, creación manual e importación CSV V1.
Estos flujos funcionan sin Python y no reactivan scraping, persistencia de Jobs
ni exportación.

La importación se implementa en un módulo independiente:
[Prospect Imports Module](imports/README.md). Allí se documentan el formato CSV,
contratos, límites, decisiones y garantías detalladas.

## OpenAPI relacionado

| Método y ruta | Disponibilidad y permisos |
| --- | --- |
| `GET /api/v1/prospects` | Listado paginado; ADMIN, OWNER y MEMBER. |
| `GET /api/v1/prospects/{id}` | Detalle; ADMIN, OWNER y MEMBER. |
| `PATCH /api/v1/prospects/{id}` | Actualización parcial; ADMIN, OWNER y MEMBER. |
| `POST /api/v1/prospects` | Creación manual; ADMIN y OWNER. |
| `GET /api/v1/campaigns/{id}/prospects` | Consulta de origen y asociaciones, resuelta por CampaignsService. |
| `POST /api/v1/prospects/import/preview` | Preview CSV sin escrituras; ADMIN y OWNER. |
| `POST /api/v1/prospects/import/confirm` | Confirmación CSV atómica; ADMIN y OWNER. |

Contrato: [platform-api.v1.yaml](../../Docs/Contracts/platform-api.v1.yaml).
Todas las operaciones requieren JWT y organización seleccionada, incluso para
ADMIN. MEMBER no puede crear ni importar; conserva consulta y PATCH según el
contrato existente.

## Dependencias

- CommonModule: TenantContext, roles, paginación, validación, wrappers y errores.
- PrismaModule: PrismaService singleton para Prospect, Campaign y CampaignProspect.
- `TenantContextService.requireTenantId()`: autoridad única para aislamiento.
- `PaginationDto`: búsquedas y listados.
- ProspectImportsModule: registrado por separado en AppModule, sin dependencia
  del servicio del CRUD manual ni de ProspectorClient.

El controlador delega al servicio. ProspectsService valida la campaña manual
mediante Prisma; no depende de CampaignsModule para esa comprobación.

## Reglas de dominio y seguridad

- Filtrar consultas y escrituras por el tenant autenticado; no aceptar tenantId
  del cliente como autoridad.
- La campaña destino debe pertenecer al tenant; inexistente o ajena devuelve 404.
- Respetar la identidad baseline `(tenantId, campaignId, source, sourceIdentifier)`.
- Un Prospect puede estar asociado a varias campañas mediante CampaignProspect.
  Su campaignId representa la campaña de origen, no todas sus asociaciones.
- El mapping público no expone tenantId. Orígenes admitidos: google_maps, manual y csv.
- Identificadores, origen y fechas se controlan desde el backend.
- Respuestas y errores utilizan los interceptores y filtros globales, sin wrappers alternativos.

## Implementación funcional

### Consulta y actualización

GET ofrece listado paginado y detalle con aislamiento por tenant. La búsqueda
contempla nombre y correo. La consulta de prospectos de una campaña incluye los
de origen y los asociados, sin duplicarlos.

PATCH conserva campos omitidos. Campos nullable admiten null y metadata=null se
guarda como SQL NULL mediante Prisma.DbNull. Nombre y estado no admiten null.
No permite cambiar tenant, campaña de origen, source ni sourceIdentifier.

Una actualización de un registro compartido es visible en todas sus campañas.

### Creación manual

`POST /api/v1/prospects` responde 201. Solo ADMIN/OWNER con tenant seleccionado.
Recibe campaña y datos del prospecto; el backend comprueba la pertenencia y crea
Prospect junto con CampaignProspect en una única transacción.

| Campo | Regla de entrada manual |
| --- | --- |
| campaignId | Obligatorio, texto no vacío y sin espacios; campaña del tenant actual. |
| name | Obligatorio; no vacío ni compuesto solo por espacios. |
| category, address, phone, language | Opcionales, texto o null; sin formato especial de teléfono. |
| email | Opcional/null; con contenido debe ser correo válido. Una cadena vacía es inválida. |
| website | Opcional/null; URL válida con protocolo. Una cadena vacía es inválida. |
| status | Opcional, ACTIVO o INACTIVO; predeterminado ACTIVO, no admite null. |
| metadata | Opcional, objeto JSON válido o null. |

```json
{
  "campaignId": "demo-campaign-demo-norte-1",
  "name": "Contacto de prueba",
  "email": "contacto@example.com",
  "website": "https://example.com",
  "status": "ACTIVO"
}
```

El backend asigna source=manual y sourceIdentifier=null. No se implementó
deduplicación por nombre en la creación manual: solicitudes distintas pueden
crear prospectos con el mismo nombre. No se modificó esa regla al añadir CSV.

### Importación CSV V1

1. Cargar campaña y CSV UTF-8 mediante multipart en preview.
2. Revisar nuevos, candidatos, diferencias, filas inválidas y conflictos.
3. Elegir acción explícita por fila válida.
4. Confirmar con el mismo archivo, referencia firmada y decisiones.
5. Consultar resumen y prospectos de la campaña.

| Acción | Efecto |
| --- | --- |
| CREATE | Crear Prospect con source=csv y sourceIdentifier=null, junto con asociación. |
| LINK_EXISTING | Asociar existente sin modificar sus atributos. |
| UPDATE_EXISTING | Actualizar campos importables presentes y asegurar asociación; afecta al registro compartido. |
| SKIP | No modificar atributos ni asociaciones. |

Candidatos por nombre normalizado en todo el tenant: ignorar mayúsculas y
espacios sobrantes, conservar acentos y signos. Esto no cambia la identidad
baseline. Todas las filas con nombres repetidos dentro del CSV son inválidas;
varios candidatos existentes son conflicto y no se elige uno automáticamente.

Columnas V1: name, category, address, phone, email, website, language y status.
No admite metadata ni campos internos. Columnas nullable presentes y vacías
se limpian a null; ausentes se conservan al actualizar. name/status vacíos son
inválidos. El CSV no usa exactamente la representación de entrada del JSON manual.

Límites: 5 MB de archivo, 1000 registros, 2000 caracteres por celda y 5 MB de
resultados de preview. Referencia válida 15 minutos. Preparación fuera de la
transacción; confirmación en una transacción Serializable, hasta tres intentos
ante P2034. Cambios relevantes respecto de preview producen 409.

Atomicidad: ante error inesperado se revierte todo el lote. No hay idempotencia
durable, historial de importación ni recuperación persistente del resultado.

### Integración de Jobs

`persistResults` y la importación anterior desde scraping fueron retirados durante
el hardening. CSV/manual son capacidades independientes: no importan BusinessResult,
no reactivan callbacks ni cambian las operaciones Jobs que devuelven 503.
ADR-005 se conserva como historial, no como autoridad de reglas nuevas.

## Archivos y responsabilidades

Rutas relativas a la raíz del repositorio.

| Archivo | Responsabilidad |
| --- | --- |
| `src/prospects/dto/create-prospect.request.ts` | Validación de campaña y datos para creación manual. |
| `src/prospects/dto/update-prospect.request.ts` | Validación de actualización parcial. |
| `src/prospects/dto/prospect.response.ts` | Respuesta pública sin tenantId; orígenes google_maps/manual/csv. |
| `src/prospects/prospects.controller.ts` | GET, POST y PATCH; permisos declarativos. |
| `src/prospects/prospects.service.ts` | Consultas tenant-aware, actualización, creación manual transaccional y mapping. |
| `src/prospects/prospects.module.ts` | Registra y exporta el CRUD de prospectos. |
| `src/prospects/imports/` | Módulo separado de CSV; inventario detallado en su README. |
| `src/app.module.ts` | Registra también ProspectImportsModule. |
| `Docs/Contracts/platform-api.v1.yaml` | Creación manual, preview/confirm y parámetros de campañas. |
| `test/prospect-imports.e2e-spec.ts` | Permisos, aislamiento de campaña, DTOs y multipart. |
| `test/prospect-imports.postgres-spec.ts` | Persistencia, repetición, concurrencia y rollback real de CSV. |
| `test/jobs.postgres-spec.ts` | Consulta/edición baseline y ausencia de efectos de scraping deshabilitado. |

## Pruebas y verificaciones

### Creación manual

El usuario confirmó en Swagger: OWNER crea con 201, consulta individual y en
campaña con 200, source=manual, MEMBER recibe 403, nombre vacío/correo inválido
reciben 400 y campaña ajena recibe 404. Compilación y publicación del contrato
fueron verificadas. Ese avance no añadió una suite automatizada específica de
creación manual; quedan ADMIN, opcionales y rollback manual por ampliar.

### CSV y cambios posteriores

- Build correcto y lint de archivos del importador sin errores.
- 34 unitarias aprobadas; 73 E2E anteriores y 4 nuevas del importador aprobadas.
- 10 PostgreSQL efímeras aprobadas: 7 baseline y 3 del importador, incluyendo
  lote completo, confirmaciones simultáneas, repetición desactualizada y rollback.
- Docker API/DB healthy, readiness database=up, ambas rutas publicadas en Swagger.
- Usuario confirmó CREATE, consulta, SKIP, LINK_EXISTING y UPDATE_EXISTING.
- Teléfono con ceros conservado, vacíos a null, campos ausentes conservados y
  actualización visible en ambas campañas con el mismo ID.
- Bloqueo CUID en rutas de campaña de Swagger corregido con CampaignId; consulta
  usando ID demo confirmada por el usuario.
- Confirmación repetida manual para observar 409 sigue sin resultado comunicado.

```powershell
npm run build
npm run test:unit:ci
npm run test:e2e:ci
docker compose --profile test run --build --rm test-postgres
```

PostgreSQL de tests debe ser desechable, nunca shared-dev/producción. La evidencia
local no acredita despliegue productivo ni publicación de cambios locales.

## Estado Git y cambios desde la última referencia publicada

Al revisar este trabajo, dev y la referencia local origin/dev coinciden en
`9a40f85` (`feat(prospects): agregar creacion manual y documentacion`). Por tanto,
la creación manual ya pertenece a esa referencia, no al diff local posterior.
No se hizo fetch en esta revisión; no se certifica el estado remoto más reciente.

Los cambios locales posteriores incluyen módulo CSV, registro en AppModule,
dependencia csv-parse, contrato preview/confirm, parámetro CampaignId, plantilla,
pruebas unitarias/E2E/PostgreSQL y documentación local actualizada/movida.
No incluyen cambios Prisma ni migraciones. No se hizo commit, push ni merge del
importador durante este trabajo; mantener su entrega separada del CRUD manual.

## Pendientes y referencias

- Completar prueba manual de referencia desactualizada y casos de error.
- Ampliar pruebas automatizadas específicas de creación manual.
- Ampliar escenarios CSV de firma/vencimiento, múltiples candidatos y límites.
- Medir búsqueda de candidatos para tenants grandes; V1 compara en aplicación.
- Preparar entrega Git y verificación de despliegue cuando corresponda.

Referencias: [guía de módulos](../../MODULE-DEVELOPMENT.md),
[resumen de prospectos](../../Docs/RESUMEN-PROSPECTOS.md),
[CSV V1](imports/README.md) y
[entrega/historial](../../Docs/ENTREGA-MODULOS-BACKEND.md).
