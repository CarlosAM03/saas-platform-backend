# Prospect Imports Module — CSV V1

Fecha de documentación: 13 de octubre de 2026.

## Propósito y alcance

Importar prospectos desde un CSV a una campaña de la organización autenticada,
con previsualización sin escrituras y confirmación explícita de las acciones.

Implementado como `ProspectImportsModule`, independiente del CRUD manual de
Prospects y registrado en `src/app.module.ts`. No depende de Python,
ProspectorClient ni ProspectingJobs. No reactiva scraping ni exportación.

Se conservan `Prospect` y `CampaignProspect`: no se modificó el esquema Prisma
ni se generaron migraciones. No existe una entidad `ProspectImport` ni historial
persistente de importaciones. La V1 ofrece atomicidad, no idempotencia durable.

## OpenAPI relacionado

| Método y ruta | Función |
| --- | --- |
| `POST /api/v1/prospects/import/preview` | Analiza CSV, clasifica filas y genera referencia firmada. No escribe. |
| `POST /api/v1/prospects/import/confirm` | Revalida archivo, referencia, coincidencias y decisiones; persiste el lote. |

Ambas rutas reciben `multipart/form-data` y responden HTTP `200` con el wrapper
global `{ success: true, data }`. El contrato está en
[platform-api.v1.yaml](../../../Docs/Contracts/platform-api.v1.yaml).

## Dependencias y arquitectura

- `CommonModule`: guards globales, roles, TenantContext, validación, respuestas y errores.
- `PrismaModule`: singleton `PrismaService`, acceso a PostgreSQL desde el servicio.
- `ConfigModule`: clave de firma obtenida de `JWT_SECRET`.
- `csv-parse`: lectura de comillas, delimitadores y saltos de línea dentro de campos.
- `class-validator`: DTOs multipart y validadores de correo/URL ya usados en el dominio.
- `node:crypto`: SHA-256, HMAC-SHA-256 y comparación de firma en tiempo constante.

```text
HTTP multipart
  -> AuthGuard / RolesGuard / TenantContext
  -> FileInterceptor + ValidationPipe
  -> ProspectImportsController
  -> ProspectImportsService
     -> ProspectCsvParser (lectura y validación fuera de la transacción)
     -> PrismaService (campaña, coincidencias y persistencia)
  -> ResponseInterceptor / GlobalExceptionFilter
```

Los controladores no acceden a Prisma. El CRUD manual no fue modificado y no
depende del importador. No se introdujeron cambios en guards, JWT ni contexto.

## Autenticación, permisos y aislamiento

- Solo `ADMIN` y `OWNER`, declarados mediante `@Roles` en el controlador.
- `MEMBER`: `403`. Sin autenticación: `401`.
- Toda operación exige tenant seleccionado, incluso para ADMIN.
- El tenant proviene de `TenantContextService.requireTenantId()`, nunca del CSV
  ni de un campo enviado por el cliente.
- La campaña debe pertenecer al tenant; ajena o inexistente: `404`.
- Coincidencias y actualizaciones se restringen al tenant autenticado.
- El frontend no selecciona un ID de prospecto: envía registro y acción. El
  backend vuelve a resolver el candidato real y valida la acción permitida.
- El importador no registra contenido CSV ni contactos completos en logs.

## Formato y límites del CSV

| Regla | Comportamiento V1 |
| --- | --- |
| Codificación | UTF-8 válido, con o sin BOM; secuencias inválidas se rechazan. |
| Separador | Coma o punto y coma, detección mediante lectura completa y encabezados válidos. Si ambas interpretaciones difieren y son admisibles, se rechaza por ambigüedad. |
| Comillas | Se admiten separadores y saltos de línea dentro de campos entrecomillados. |
| Encabezados | Exactos, sensibles a mayúsculas; desconocidos o repetidos invalidan el archivo. No se convierten encabezados arbitrarios. |
| Archivo | Máximo 5 MB, límite aplicado durante la recepción multipart. |
| Registros | Máximo 1000 registros leídos tras el encabezado, antes de filtrar registros completamente vacíos. |
| Campos | Máximo 2000 caracteres por celda. |
| Preview | Máximo 5 MB para el JSON de resultados por fila; si se supera, dividir el archivo. |
| Referencia | Vigencia de 15 minutos. |
| Excel | `.xls` y `.xlsx` rechazados; exportar como CSV. También se valida el contenido, no solo el nombre. |
| Contenido binario | Bytes nulos y contenido que no pueda leerse con el formato admitido se rechazan. |

Las líneas físicas vacías se omiten durante la lectura. Los registros cuyos
campos están todos vacíos o contienen únicamente espacios también se ignoran.

La propiedad `record` identifica el **registro lógico**, empezando en 1 después
del encabezado. Un salto dentro de un campo entrecomillado no crea otro registro.
Un registro vacío formado por separadores puede dejar un hueco en los números
reportados; las decisiones deben usar `record` devuelto, no el índice del array.

### Columnas importables

| Columna | Obligatoria | Validación |
| --- | --- | --- |
| `name` | Sí, encabezado y contenido | Texto no vacío ni compuesto únicamente por espacios. |
| `category` | No | Texto o celda vacía. |
| `address` | No | Texto o celda vacía. |
| `phone` | No | Texto; conserva ceros iniciales y prefijos, sin conversión numérica. |
| `email` | No | Correo válido si tiene contenido. |
| `website` | No | URL válida con protocolo si tiene contenido. |
| `language` | No | Texto o celda vacía. |
| `status` | No | Exactamente `ACTIVO` o `INACTIVO`; celda vacía inválida. |

`metadata` queda fuera de V1. Tampoco se admiten `id`, `tenantId`, `campaignId`,
`source`, `sourceIdentifier`, `createdAt` ni `updatedAt` como columnas.
La campaña se envía aparte y es única para todo el lote.

Los valores no vacíos se conservan tal como fueron enviados; la normalización
del nombre se utiliza exclusivamente para buscar candidatos.

Ejemplo: [prospects-import.csv](../../../Docs/examples/prospects-import.csv).

```csv
name,category,address,phone,email,website,language,status
Cafetería Central,Cafetería,Calle Principal 123,+526641234567,contacto@example.com,https://example.com,es,ACTIVO
Papelería Norte,Papelería,Avenida Norte 45,0012345,,,es,ACTIVO
```

### Ausente frente a vacío

| Situación | CREATE | UPDATE_EXISTING |
| --- | --- | --- |
| `name` vacío | Rechazar fila. | Rechazar fila. |
| Columna nullable ausente | Sin valor. | Conservar existente. |
| Columna nullable presente y vacía | Guardar `null`. | Limpiar a `null`. |
| Columna presente con contenido válido | Guardar contenido. | Reemplazar contenido. |
| Contenido inválido | Rechazar fila. | Rechazar fila. |
| `status` ausente | Usar `ACTIVO`. | Conservar existente. |
| `status` vacío o no admitido | Rechazar fila. | Rechazar fila. |

Las columnas nullable son category, address, phone, email, website y language.
Una fila con cantidad de columnas distinta al encabezado es inválida.

## Identidad y búsqueda de candidatos

La identidad del baseline sigue siendo
`(tenantId, campaignId, source, sourceIdentifier)`. No se añadió unicidad por
nombre ni se generó un hash como `sourceIdentifier` para CSV.

La búsqueda por nombre es una regla de **selección de candidatos para revisión**,
aprobada para CSV V1, no una identidad universal de negocios:

1. Quitar espacios al inicio y al final.
2. Reducir espacios consecutivos a uno.
3. Comparar sin distinguir mayúsculas y minúsculas.
4. Conservar diferencias de acentos y signos.

Se buscan candidatos en todo el tenant, incluyendo otras campañas. No se elige
automáticamente un prospecto compartido para actualizarlo.

### Clasificaciones del preview

| Clasificación | Significado | Decisiones admitidas |
| --- | --- | --- |
| `NEW` | Fila válida sin candidatos. | CREATE, SKIP. |
| `MATCH` | Fila válida con un candidato. | LINK_EXISTING, UPDATE_EXISTING, SKIP. |
| `INVALID` | Validación fallida o nombre repetido dentro del archivo. | Ninguna; se reporta REJECTED. |
| `CONFLICT` | Más de un candidato existente. | Ninguna; corregir y generar otro preview. |

Todas las apariciones del mismo nombre normalizado en el CSV se marcan como
inválidas; no gana la primera ni la última fila. La V1 no permite resolver varias
coincidencias existentes seleccionando arbitrariamente un ID desde el frontend.

Cada candidato informa `id`, `campaignIds`, `sharedWithOtherCampaigns` y
`differences`. Las diferencias incluyen únicamente columnas presentes con valores
distintos, con `field`, `existing` e `imported`. Las campañas incluyen la de origen
y las asociaciones. `sharedWithOtherCampaigns` indica que existe alguna distinta
de la campaña destino.

## Acciones de confirmación y persistencia

| Acción | Efecto |
| --- | --- |
| `CREATE` | Crear Prospect con source=csv, sourceIdentifier=null y campaña de origen destino; crear CampaignProspect. |
| `LINK_EXISTING` | Asegurar asociación a la campaña destino; no editar atributos ni reactivar una asociación existente. |
| `UPDATE_EXISTING` | Editar exclusivamente columnas importables presentes y asegurar asociación a la campaña destino. |
| `SKIP` | No escribir atributos ni asociaciones. |

LINK_EXISTING y UPDATE_EXISTING usan upsert de CampaignProspect con actualización
vacía si la asociación ya existe. El contador `linked` cuenta acciones ejecutadas,
no necesariamente asociaciones recién creadas.

UPDATE_EXISTING requiere decisión explícita. Modifica el mismo registro compartido
y puede reflejarse en todas sus campañas. Conserva ID, tenant, campaña de origen,
source, sourceIdentifier, metadata, fecha de creación y asociaciones existentes.
No es una consecuencia implícita de LINK_EXISTING.

`Prospect.campaignId` representa la **campaña de origen**: no cambia cuando se
vincula a otra. Las asociaciones adicionales viven en CampaignProspect. Por eso,
consultar el prospecto en otra campaña puede devolver el campaignId original.

## Flujo HTTP y uso en Swagger

Swagger local: `http://localhost:3000/api/docs`.

### 1. Autenticarse y seleccionar campaña

Iniciar sesión con OWNER o ADMIN y autorizar con el JWT. Si no hay organización
seleccionada, usar Auth para seleccionarla. Consultar `GET /api/v1/campaigns` y
copiar una campaña del tenant. Los IDs demo son válidos, por ejemplo
`demo-campaign-demo-norte-1`; no se debe inventar un CUID para reemplazarlos.

### 2. Preview

En `POST /api/v1/prospects/import/preview`, enviar:

- `campaignId`: campaña destino.
- `file`: archivo CSV.

La respuesta `data` incluye `previewReference`, `expiresAt`, `summary` y `rows`.
El resumen contiene total, new, matches, invalid y conflicts. Las filas incluyen
record, values, errors, classification y matches. Los errores indican campo y
motivo, sin convertir errores de infraestructura en errores de fila.

No se guarda ningún prospecto ni asociación durante preview.

### 3. Confirmar

En `POST /api/v1/prospects/import/confirm`, enviar:

- El mismo `campaignId`.
- **Exactamente el mismo archivo**, no uno editado después del preview.
- `previewReference`: cadena completa recibida, incluyendo punto y firma, sin
  comillas. No es el token de login.
- `decisions`: array JSON **como texto del campo multipart**.

```json
[{"record":1,"action":"CREATE"},{"record":2,"action":"SKIP"}]
```

Debe haber exactamente una decisión por fila NEW o MATCH y ninguna para
INVALID/CONFLICT. Se rechazan registros repetidos, acciones no aplicables,
propiedades adicionales y decisiones faltantes o sobrantes.

La respuesta incluye summary con total, created, linked, updated, skipped y
rejected. Cada resultado informa record y action; las acciones persistidas
incluyen prospectId y las filas rechazadas incluyen errors.

### 4. Consultar y revisar

Usar `GET /api/v1/campaigns/{id}/prospects` para comprobar asociaciones y datos.
Los nuevos registros deben tener source=csv. Al actualizar un compartido,
comprobar ambas campañas y la conservación de campos ausentes/protegidos.

### Errores principales

| HTTP | Situación |
| --- | --- |
| 400 | CSV/DTO/decisiones inválidos, referencia inválida o vencida, archivo distinto o preview demasiado grande. |
| 401 | No autenticado o credencial inválida. |
| 403 | Rol no permitido o falta tenant seleccionado. |
| 404 | Campaña inexistente o de otro tenant. |
| 409 | Candidatos o datos relevantes cambiaron, o se agotaron reintentos transaccionales. Generar otro preview. |
| 413 | Archivo supera el límite de recepción. |
| 500 | Falla inesperada de infraestructura; no se presenta como fila inválida. |

Los errores mantienen el formato del GlobalExceptionFilter del baseline.

## Transacciones, referencia y concurrencia

El análisis/validación del CSV ocurre fuera de la transacción. Preview consulta
campaña y candidatos en RepeatableRead para construir una vista consistente.

La referencia contiene versión, usuario, tenant, campaña, huella SHA-256 del
archivo, huella del estado de candidatos y vencimiento. Se firma con
HMAC-SHA-256 usando JWT_SECRET y un prefijo específico del importador; no emite
un token de acceso ni cambia el mecanismo de autenticación. No contiene los
contactos completos ni es un archivo almacenado.

Confirmación:

1. Exige contexto autenticado y prepara CSV.
2. Verifica firma, usuario, tenant, campaña, archivo y vencimiento.
3. Abre una única transacción Serializable.
4. Reconsulta campaña y candidatos, incluidos atributos, updatedAt y asociaciones.
5. Compara la huella contra preview; cambios relevantes producen 409.
6. Valida todas las decisiones antes de la primera escritura.
7. Ejecuta acciones válidas y registra los resultados en memoria para la respuesta.
8. Confirma todas las escrituras juntas.

Filas inválidas/conflictivas se reportan como REJECTED y no se guardan. Las demás
acciones se confirman **todas o ninguna** ante un error inesperado. No hay bloques
parcialmente confirmados. La transacción tiene timeout de 30 segundos.

Se permiten hasta tres intentos totales ante Prisma P2034. Cada reintento vuelve
a consultar y comparar el snapshot. Otros errores se propagan sin presentarlos
como errores de fila. Al agotarse los intentos, se devuelve 409.

### Ausencia de idempotencia durable

No existe tabla de operaciones ni resultado persistente para recuperar una
confirmación anterior. Repetir una solicitud reevalúa la base actual:

- Tras crear/actualizar/cambiar asociaciones, el snapshot anterior normalmente
  queda desactualizado y se responde 409.
- Si la operación no cambió el snapshot, como SKIP o vincular una asociación ya
  existente, una repetición puede ejecutarse nuevamente.
- Si venció la referencia, se responde 400 antes de comprobar el snapshot.
- Si se pierde la respuesta, no se recupera automáticamente el resumen original.
- Cambiar JWT_SECRET invalida referencias pendientes.

Una firma garantiza integridad y correspondencia, no ejecución única. Historial,
auditoría específica o idempotencia durable requerirían otra decisión arquitectónica.

## Archivos y responsabilidades

Rutas relativas a la raíz del repositorio.

| Archivo | Cambio y responsabilidad |
| --- | --- |
| `src/prospects/imports/prospect-imports.module.ts` | Nuevo. Registra controlador, servicio, parser y dependencias. |
| `src/prospects/imports/prospect-imports.controller.ts` | Nuevo. Rutas, roles, límites multipart, recepción del archivo y delegación. |
| `src/prospects/imports/prospect-imports.service.ts` | Nuevo. Campaña, candidatos, diferencias, firma, decisiones, snapshot y transacción. |
| `src/prospects/imports/prospect-csv.parser.ts` | Nuevo. Lectura, detección de delimitador, transformación de vacíos, validación y repetidos. |
| `src/prospects/imports/dto/prospect-import.request.ts` | Nuevo. DTOs de preview y confirm; decisions se valida estructuralmente en el servicio. |
| `src/prospects/imports/prospect-csv.parser.spec.ts` | Nuevo. Pruebas de lectura y validación. |
| `src/prospects/imports/prospect-imports.service.spec.ts` | Nuevo. Pruebas aisladas de acciones, referencia, cambios y reintentos. |
| `src/app.module.ts` | Registra el módulo independiente. |
| `Docs/Contracts/platform-api.v1.yaml` | Documenta entradas, resultados, acciones, límites y errores. Añade CampaignId para rutas de campañas compatibles con el dataset. |
| `package.json`, `package-lock.json` | Añaden csv-parse con versión directa exacta. |
| `test/prospect-imports.e2e-spec.ts` | Nuevo. HTTP multipart, permisos, validación y confirmación con Prisma sustituido. |
| `test/prospect-imports.postgres-spec.ts` | Nuevo. Persistencia, repetición, concurrencia y rollback real. |
| `test/jest-postgres.json` | Incluye la suite PostgreSQL del importador. |
| `Docs/examples/prospects-import.csv` | Plantilla de ejemplo usada en pruebas manuales. |
| `src/prospects/imports/README.md` | Guía local del módulo; sustituye Docs/CSV-IMPORT-V1.md. |

## Pruebas y evidencia

### Automatizadas ejecutadas

| Verificación | Resultado registrado |
| --- | --- |
| Build | Correcto. |
| ESLint de archivos cambiados | Sin errores. |
| Suite unitaria | 34 pruebas aprobadas, incluyendo lector y servicio del importador. |
| E2E aisladas | 73 anteriores y 4 nuevas del importador aprobadas. |
| PostgreSQL efímero en Docker | 10 aprobadas: 7 baseline y 3 del importador. |
| Readiness y Swagger | API/DB healthy, database=up y ambos endpoints publicados. |

Las pruebas aisladas cubren CSV con coma/punto y coma, BOM, comillas y saltos,
teléfono texto, columnas ausentes/vacías, estructura inválida, estados/correo/URL,
repetidos, UTF-8 inválido, límites de registros, preview sin escritura, creación,
LINK sin actualización, UPDATE explícito, snapshot modificado, correspondencia
de referencia, decisiones inválidas, reintentos limitados y fallas inesperadas.
HTTP cubre 401/403, ADMIN/OWNER, tenant obligatorio, campaña ajena y multipart.

Las tres pruebas reales verifican:

1. Lote completo y rechazo de confirmación repetida con snapshot desactualizado.
2. Confirmaciones simultáneas: una se confirma, sin duplicar el lote.
3. Fallo inyectado en la segunda escritura: revierte prospectos y asociaciones
   previamente escritos en la misma transacción.

El fallo se inyecta mediante una extensión Prisma exclusiva del test; no se
añadió ninguna extensión al código productivo. Estas pruebas usan PostgreSQL
efímero, no el volumen de desarrollo ni bases remotas.

### Flujo manual confirmado por el usuario

Durante la prueba en Swagger se confirmó:

- Preview del ejemplo: dos NEW, sin errores.
- CREATE: dos creados, consultables en campaña con source=csv.
- Conservación del teléfono `0012345`; email/website vacíos como null.
- Nuevo preview y SKIP: dos omitidos, sin creaciones ni actualizaciones.
- LINK_EXISTING a otra campaña: mismos IDs, sin sobrescritura.
- UPDATE_EXISTING explícito de Cafetería Central: teléfono cambiado y correo
  limpiado; ambas campañas muestran el mismo registro actualizado.
- Columnas ausentes y campos protegidos conservados tras UPDATE.
- Se corrigió el bloqueo de Swagger que exigía CUID para IDs demo de campaña;
  la consulta de campaña funcionó tras publicar CampaignId.

La repetición manual de confirmación para comprobar 409 fue solicitada, pero
no se recibió todavía su resultado. No se acredita aquí como prueba manual
realizada. Tampoco se acredita despliegue a producción, commit o push.

### Comandos

Desde la raíz del backend:

```powershell
npm run build
npm run test:unit:ci
npm run test:e2e:ci
docker compose --profile test run --build --rm test-postgres
```

Las pruebas PostgreSQL requieren una base desechable migrada. No apuntarlas a
shared-dev ni producción. Para Docker, reconstruir la imagen tras cambiar
dependencias; el bind mount de src no actualiza node_modules.

## Limitaciones y pendientes

- V1 consulta los prospectos del tenant y compara nombres en aplicación; no hay
  columna normalizada ni índice nuevo. Medir rendimiento para tenants grandes.
- No se almacena el CSV ni se puede deshacer automáticamente una importación.
- No se admite metadata, mapeo arbitrario de columnas ni resolución de múltiples candidatos.
- La referencia tiene vencimiento fijo y no persiste un resultado anterior.
- Ampliar cobertura de vencimiento/firma manipulada, límites de recepción/respuesta
  y múltiples candidatos existentes; las pruebas actuales no certifican todos
  los casos posibles.
- Completar pruebas manuales de referencia desactualizada y escenarios de error.
- Mantener entrega Git separada del CRUD manual; no se realizó commit durante este trabajo.

## Referencias

- [Guía de módulos](../../../MODULE-DEVELOPMENT.md).
- [ADR-004: baseline](../../../Docs/ADRs/ADR-004-CommonBaseline.md).
- [ADR-001: identidad](../../../Docs/ADRs/ADR-001-DecisionesDeDominioMVP.md).
- [ADR-002: contrato e identidad](../../../Docs/ADRs/ADR-002-ContratoAPI.md).
- [Prospects CRUD](../README.md).
- [Resumen y contexto de prospectos](../../../Docs/RESUMEN-PROSPECTOS.md).
- [Entorno de desarrollo](../../../Docs/DevelopmentEnvironment.md).
