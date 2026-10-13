# Resumen del desarrollo de prospectos

Fecha de documentación: 13 de octubre de 2026.

## Actualización: creación manual y avances posteriores

La documentación operativa vigente está en el [README de Prospects](../src/prospects/README.md)
y el [README del importador](../src/prospects/imports/README.md). Las secciones
originales siguientes conservan el contexto y los acuerdos anteriores al CSV.

### Estado respecto de la última referencia Git disponible

La rama dev y la referencia local origin/dev coinciden en `9a40f85`
(`feat(prospects): agregar creacion manual y documentacion`). La creación manual
ya forma parte de ese commit. No se hizo fetch para certificar un estado remoto
más reciente. No se realizó commit ni push del importador durante este trabajo.

### Trabajo local posterior

- Módulo independiente `src/prospects/imports/`, registrado en AppModule.
- Preview/confirm multipart, autorizados para ADMIN/OWNER con tenant seleccionado.
- Lector csv-parse: UTF-8, BOM, coma/punto y coma, comillas y saltos de línea.
- Validación por fila, encabezados exactos, límites y tratamiento ausente/vacío.
- Candidatos por nombre en todo el tenant; diferencias y campañas compartidas.
- Acciones CREATE, LINK_EXISTING, UPDATE_EXISTING y SKIP explícitas.
- Referencia firmada de 15 minutos vinculada a usuario, tenant, campaña, archivo
  y snapshot; revalidación de coincidencias antes de escribir.
- Transacción Serializable única y hasta tres intentos ante P2034; atomicidad
  sin idempotencia durable ni nueva entidad persistente.
- OpenAPI ampliado y parámetro CampaignId para no bloquear IDs demo en Swagger.
- Dependencia csv-parse, ejemplo CSV y suites unitarias/E2E/PostgreSQL.
- Documentación CSV movida desde Docs/CSV-IMPORT-V1.md al README del módulo.
- Sin cambios al CRUD manual, Prisma, migraciones, scraping ni integración Python.

### Evidencia nueva

Build y lint del importador correctos; 34 unitarias, 73 E2E anteriores y 4 nuevas,
y 10 PostgreSQL efímeras (7 baseline y 3 CSV) aprobadas. Las pruebas reales CSV
cubren persistencia, repetición desactualizada, concurrencia y rollback completo.
Docker API/DB healthy y ambas rutas visibles en Swagger.

El usuario confirmó manualmente CREATE de dos prospectos, consulta en campaña,
source=csv, ceros iniciales del teléfono, null en vacíos, SKIP de ambos candidatos,
LINK_EXISTING en otra campaña y UPDATE_EXISTING explícito. La actualización
cambió teléfono y limpió correo en ambas campañas, conservando columnas ausentes,
ID, origen y fecha de creación. La consulta con ID demo funcionó tras corregir Swagger.

Quedan por completar la confirmación repetida manual para observar 409, casos de
error y cobertura adicional detallada en los READMEs. No se acredita producción.

## Estado actual

Actualización CSV V1: implementación y pruebas aisladas añadidas después de este
resumen. Consultar [README del importador CSV](../src/prospects/imports/README.md) para las reglas vigentes,
rutas y limitaciones. No cambia Prisma; pruebas PostgreSQL efímeras aprobadas y
rutas verificadas en Swagger. El flujo interactivo sigue pendiente. Las propuestas
anteriores se conservan como historial.

Implementamos en el entorno local la creación manual de prospectos dentro de una campaña. La compilación y las pruebas manuales realizadas en Swagger fueron confirmadas por el usuario como correctas.

La importación de archivos CSV es el siguiente bloque: sus reglas se discutieron, pero todavía no está implementada. Este documento no acredita un despliegue de estos cambios a producción ni su publicación en GitHub.

## Preparación del entorno

Después de volver a clonar el repositorio, continuamos en la rama `dev` y utilizamos Docker Compose para ejecutar el backend y PostgreSQL. Docker permite ejecutar esos servicios con las dependencias del proyecto sin instalar PostgreSQL directamente en Windows.

La carpeta del backend utilizada es:

```text
C:\Users\angel\OneDrive\Documentos\saas-backendProspector\saas-platform-backend
```

Durante la preparación, un intento de compilación ejecutó un proyecto Vite ubicado fuera del backend. Para trabajar con este repositorio, los comandos deben ejecutarse desde la carpeta anterior; la compilación dentro del servicio de Docker se realiza con:

```powershell
docker compose exec api npm run build
```

La guía completa del entorno está en [DevelopmentEnvironment.md](DevelopmentEnvironment.md).

## Qué permite la creación manual

Un usuario autorizado elige una campaña y envía los datos de un prospecto mediante `POST /api/v1/prospects`.

El backend realiza lo siguiente:

1. Verifica la autenticación y los permisos. Solo `ADMIN` y `OWNER` pueden crear prospectos; `MEMBER` no puede hacerlo.
2. Valida los campos enviados.
3. Obtiene la organización activa del contexto autenticado. El cliente no decide la organización enviando un campo en el formulario.
4. Comprueba que la campaña existe y pertenece a esa organización.
5. Guarda el prospecto con `source: "manual"` y `sourceIdentifier: null`.
6. Crea su asociación con la campaña en `CampaignProspect`.
7. Devuelve el registro creado con código HTTP `201`.

El prospecto y su asociación se guardan en una transacción: ambas operaciones deben completarse para confirmar la escritura. Esto evita guardar solo una parte si falla la otra.

`ADMIN` también necesita una organización seleccionada para esta operación. Las restricciones por rol se declaran en el controlador y las aplican los guards globales; el servicio comprueba la campaña y mantiene el aislamiento entre organizaciones.

## Archivos creados o modificados

Las rutas parten de la raíz del repositorio.

| Archivo | Cambio y función |
| --- | --- |
| `src/prospects/dto/create-prospect.request.ts` | Archivo nuevo. Define qué datos acepta la creación manual y cómo se validan antes de guardarlos. |
| `src/prospects/prospects.controller.ts` | Añade la ruta POST y restringe su acceso a ADMIN y OWNER. Entrega la solicitud validada al servicio. |
| `src/prospects/prospects.service.ts` | Añade `create`: verifica la campaña dentro de la organización, guarda el prospecto y su asociación en una transacción y construye la respuesta pública. |
| `src/prospects/dto/prospect.response.ts` | Amplía los valores de origen admitidos en la respuesta a `google_maps`, `manual` y `csv`. No expone `tenantId`. |
| `Docs/Contracts/platform-api.v1.yaml` | Documenta la ruta POST, su cuerpo, permisos y respuestas para que aparezcan en Swagger. Actualiza los orígenes del esquema Prospect. |

Aceptar `csv` como valor de origen en una respuesta no significa que ya exista un importador. La creación manual siempre asigna `manual` desde el backend.

No se añadieron tablas ni migraciones Prisma para esta funcionalidad.

## Datos que acepta la solicitud

| Campo | Regla |
| --- | --- |
| `campaignId` | Obligatorio. Texto no vacío y sin espacios. La campaña debe existir dentro de la organización activa. |
| `name` | Obligatorio. Texto que no puede estar vacío ni contener únicamente espacios. |
| `category`, `address`, `phone`, `language` | Opcionales. Aceptan texto o `null`. El teléfono no tiene una validación específica de formato. |
| `email` | Opcional. Si se proporciona un valor distinto de `null`, debe ser un correo válido. |
| `website` | Opcional. Si se proporciona un valor distinto de `null`, debe ser una URL válida con protocolo, por ejemplo `https://example.com`. |
| `status` | Opcional. Acepta `ACTIVO` o `INACTIVO`; si se omite, se utiliza el valor predeterminado `ACTIVO`. No acepta `null`. |
| `metadata` | Opcional. Objeto con contenido JSON válido o `null`. |

Para un correo o sitio web sin información, hay que omitir el campo o enviar `null`; una cadena vacía no pasa su validación. Los identificadores, fechas y campos de origen los controla el backend.

Ejemplo de solicitud; sustituir el identificador por el de una campaña de la organización seleccionada:

```json
{
  "campaignId": "demo-campaign-demo-norte-1",
  "name": "Contacto de prueba",
  "email": "contacto@example.com",
  "website": "https://example.com",
  "status": "ACTIVO"
}
```

Actualmente no se evita que dos solicitudes manuales creen prospectos con el mismo nombre. La deduplicación discutida para CSV todavía no está implementada.

## Problemas corregidos

- **Método faltante:** el controlador llamaba a `create`, pero el servicio todavía no tenía ese método. Se añadió su implementación y el usuario confirmó la compilación sin errores.
- **Identificador de campaña:** una validación inicial exigía un formato incompatible con los identificadores del dataset de desarrollo. Se cambió para aceptar texto no vacío y sin espacios, manteniendo la comprobación de existencia y pertenencia en la base de datos.
- **Contrato YAML:** se corrigió una comilla adicional en el patrón de `campaignId`, se comprobó la lectura del contrato y se reinició el servidor. También se verificaron readiness y la publicación del patrón corregido en Swagger.

## Verificaciones realizadas

Las siguientes comprobaciones de la funcionalidad fueron realizadas manualmente por el usuario y confirmadas en la conversación:

| Comprobación | Resultado confirmado |
| --- | --- |
| Compilación del backend | Sin errores. |
| Nueva ruta en Swagger | Visible. |
| OWNER crea un prospecto válido | `201 Created`. |
| Consulta del prospecto creado | `200 OK`, con origen manual. |
| Consulta de prospectos de la campaña | `200 OK`, con el prospecto visible. |
| MEMBER intenta crear | `403 Forbidden`. |
| OWNER envía nombre vacío | `400 Bad Request`. |
| OWNER envía correo inválido | `400 Bad Request`. |
| OWNER utiliza una campaña de otra organización | `404 Not Found`. |

No se ejecutó una nueva suite automatizada para acreditar esta ampliación. Quedan por añadir pruebas automatizadas de creación, permisos, aislamiento y transacción. Tampoco se registró una prueba manual específica de creación con ADMIN ni de todos los casos de campos opcionales.

## Importación CSV: acuerdos y pendientes

### Reglas acordadas

- El usuario selecciona una campaña y carga un archivo CSV.
- Solo ADMIN y OWNER podrán importar.
- Los encabezados y datos deberán cumplir el formato definido para los campos importables del modelo de prospectos. No se acordó una conversión automática de encabezados arbitrarios de otros sistemas.
- El sistema deberá indicar qué filas no se importaron y el motivo.
- Los duplicados se detectarán por nombre y el usuario podrá elegir entre sobrescribir o no registrar el duplicado.
- Los nuevos prospectos importados se identificarán con `source: "csv"`.
- Un valor obligatorio vacío será un error.
- Para sobrescritura, un campo opcional incluido y vacío se limpiará si admite `null`; una columna opcional ausente conservará el dato existente. Esta distinción debe quedar explícita en el contrato y las pruebas del importador.

### Trabajo pendiente

1. Definir la plantilla exacta, los campos importables y la representación de `metadata`.
2. Definir límites de tamaño y número de filas.
3. Precisar la comparación de nombres: espacios, mayúsculas, alcance dentro de la campaña y tratamiento de varias coincidencias o duplicados dentro del mismo archivo.
4. Definir qué ocurre con el origen de un prospecto existente al sobrescribirlo.
5. Cerrar el contrato de carga, previsualización y confirmación. Las rutas de preview y confirm discutidas son propuestas, no endpoints implementados.
6. Implementar lectura del CSV, validación por fila, detección de duplicados, confirmación y reporte de resultados.
7. Documentar y probar permisos, aislamiento entre organizaciones y comportamiento ante errores.

La creación manual y el futuro importador CSV son independientes de la integración con Python. Este avance no reactiva el scraping, la persistencia de resultados de Jobs ni la exportación.
