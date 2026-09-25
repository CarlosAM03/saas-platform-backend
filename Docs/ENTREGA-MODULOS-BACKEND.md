# Entrega de los módulos funcionales del backend

Fecha de documentación: 25 de septiembre de 2026.

## 1. Resultado y alcance

Se desarrollaron los cinco módulos que estaban preparados como estructuras vacías: Tenants, Campaigns, Prospects, ProspectorClient y ProspectingJobs. Se reutilizó la infraestructura F4 existente: autenticación JWT, roles, contexto de organización, Prisma, validación, respuestas, errores y logging.

El backend está implementado para el alcance del MVP. Esto no significa que el scraping real esté conectado: el servicio Python es externo a este repositorio y todavía debe integrarse y verificarse de extremo a extremo.

Este documento describe el trabajo conjunto: Tenants y Campaigns se implementaron directamente; el desarrollador incorporó Prospects y la primera versión de ProspectorClient siguiendo instrucciones archivo por archivo; después se completaron Jobs, la persistencia de resultados, la cancelación y las pruebas.

## 2. Conceptos para entender el código

| Concepto | Significado |
| --- | --- |
| Tenant | Organización o cliente cuyos datos deben permanecer separados de los de otros clientes. |
| Campaign | Campaña de marketing que agrupa actividades de prospección. |
| Prospect | Negocio o contacto guardado en PostgreSQL. |
| Job | Trabajo de scraping solicitado al servicio Python. |
| Controller | Recibe solicitudes HTTP y llama al servicio correspondiente. |
| Service | Aplica reglas y coordina consultas, cambios o comunicaciones. |
| DTO de solicitud | Define y valida los datos que pueden recibirse. |
| Interfaz de respuesta | Describe la estructura de salida para TypeScript; no sustituye validación en ejecución. |
| Module | Registra y conecta controladores, servicios y dependencias en NestJS. |
| Idempotencia | Repetir una solicitud con la misma clave no crea otro trabajo. |
| Callback | Solicitud que Python envía al backend para informar progreso, resultados o errores. |

## 3. Recorrido completo

1. El usuario inicia sesión y selecciona una organización mediante Auth.
2. Crea una campaña mediante Campaigns.
3. Solicita un job con campaña, palabra de búsqueda, ubicación, fuente y límite.
4. Jobs valida el contexto y crea en PostgreSQL el trabajo y su registro de idempotencia.
5. ProspectorClient pide a Python iniciar el trabajo; Python confirma aceptación con HTTP 202.
6. Python envía callbacks autenticados: RUNNING y posteriormente COMPLETED, FAILED o CANCELLED.
7. El backend guarda el estado del job en PostgreSQL y conserva los resultados temporalmente en memoria.
8. El usuario puede exportarlos o persistirlos. Persistir crea Prospect y CampaignProspect.
9. Prospects permite consultar y actualizar los registros guardados.

Flutter se comunica con NestJS; no accede directamente a PostgreSQL ni al motor Python.

## 4. Tenants: organizaciones

### Archivos

| Ruta desde la raíz del repositorio | Acción y responsabilidad |
| --- | --- |
| `src/tenants/dto/create-tenant.request.ts` | Creado. Valida name y slug como textos. |
| `src/tenants/dto/tenant.response.ts` | Creado. Describe los campos públicos de una organización. |
| `src/tenants/tenants.controller.ts` | Creado. Expone listado, consulta y creación; restringe la creación a ADMIN. |
| `src/tenants/tenants.service.ts` | Creado. Filtra organizaciones accesibles, crea tenant y roles de forma atómica y traduce slugs duplicados a 409. |
| `src/tenants/tenants.module.ts` | Modificado. Conecta el controlador, el servicio, Common y Prisma. |

ADMIN lista todas las organizaciones. Los otros usuarios consultan únicamente organizaciones activas de las que son miembros. El descubrimiento funciona antes de seleccionar un tenant. Crear una organización genera OWNER y MEMBER, pero no convierte al ADMIN en miembro.

El listado devuelve un array sin paginación porque así lo define su contrato específico. No se agregaron actualización ni eliminación de tenants. Name y slug se validan como textos; no se inventaron requisitos de longitud o formato ausentes del contrato.

## 5. Campaigns: campañas

| Ruta | Acción y responsabilidad |
| --- | --- |
| `src/campaigns/dto/campaign.request.ts` | Creado. Contiene validadores para creación, actualización y el parámetro permanent. |
| `src/campaigns/dto/campaign.response.ts` | Creado. Describe la respuesta pública de campaña. |
| `src/campaigns/campaigns.controller.ts` | Creado. Expone las seis operaciones del módulo. |
| `src/campaigns/campaigns.service.ts` | Creado. Aplica tenant, creador, búsqueda, orden, paginación, actualización, archivo, borrado y consulta de prospectos. |
| `src/campaigns/campaigns.module.ts` | Modificado. Registra y exporta el servicio. |

Toda operación exige tenant seleccionado, incluso para ADMIN. La campaña nace ACTIVA y el creador se obtiene de la sesión. Estados: ACTIVA, PAUSADA, COMPLETADA y ARCHIVADA.

PATCH conserva los campos omitidos y permite description null. Una actualización vacía se rechaza. DELETE sin permanent, o con permanent=false, archiva. El borrado físico exige ADMIN; las claves foráneas impiden eliminar campañas con dependencias y producen 409. No se borran registros relacionados en cascada.

La consulta de prospectos incluye los de origen y los asociados por CampaignProspect, sin duplicados y dentro del tenant. Se resuelve desde CampaignsService para evitar dependencias circulares.

## 6. Prospects: contactos guardados

| Ruta | Acción y responsabilidad |
| --- | --- |
| `src/prospects/dto/update-prospect.request.ts` | Creado durante el desarrollo guiado. Valida nombre, contacto, idioma, estado y metadata. |
| `src/prospects/dto/prospect.response.ts` | Creado durante el desarrollo guiado. Describe la salida pública sin tenantId. |
| `src/prospects/prospects.controller.ts` | Creado durante el desarrollo guiado. Registra listado, consulta y actualización. |
| `src/prospects/prospects.service.ts` | Creado y ampliado. Consulta por tenant, aplica actualizaciones y persiste resultados de Jobs con deduplicación. |
| `src/prospects/prospects.module.ts` | Modificado. Conecta las piezas y exporta el servicio. |

No permite modificar tenantId, campaignId, source ni sourceIdentifier. Campos omitidos se conservan; campos nullable aceptan null. Nombre y estado no admiten null. Metadata se valida como objeto JSON y null se traduce a SQL NULL mediante Prisma.DbNull.

`persistResults` es un método interno, no una ruta de creación pública. Crea Prospect y CampaignProspect en una transacción SERIALIZABLE y reintenta hasta tres veces los conflictos de serialización/unicidad.

Con sourceIdentifier, la deduplicación utiliza tenant, campaña, fuente e identificador. Sin él, compara exactamente nombre, dirección, teléfono, correo y sitio web dentro de la misma fuente/organización/campaña. Es una comparación conservadora: no identifica automáticamente dos negocios cuyos datos difieren. Los prospectos existentes no se sobrescriben.

## 7. ProspectorClient: comunicación con Python

| Ruta | Acción y responsabilidad |
| --- | --- |
| `src/prospector-client/dto/start-prospecting-job.request.ts` | Creado. Describe el trabajo que NestJS envía a Python. |
| `src/prospector-client/dto/accepted-job.response.ts` | Creado. Describe la confirmación de aceptación. |
| `src/prospector-client/dto/job-event.request.ts` | Creado. Valida eventos, progreso, errores y resultados anidados recibidos por callback. |
| `src/prospector-client/prospector-client.service.ts` | Creado y ampliado. Envía inicio y cancelación mediante fetch, usa API key y comprueba las respuestas. |
| `src/prospector-client/prospector-client.module.ts` | Modificado. Proporciona configuración y exporta el servicio; no expone rutas públicas. |
| `src/prospector-client/prospector-client.service.spec.ts` | Creado y ampliado. Prueba solicitudes, códigos HTTP, respuestas inválidas, fechas y cancelación. |

Inicio exige 202, success=true, el mismo jobId, QUEUED y una fecha válida. Cancelación exige 202; 409 se mantiene como conflicto. Fallos de conexión o respuestas no aceptables se convierten en indisponibilidad. Las llamadas no siguen redirecciones y no exponen la credencial en respuestas.

No ejecuta scraping, no guarda jobs y no introduce reintentos de red automáticos ni una política propia de timeout operacional.

## 8. ProspectingJobs: coordinación del scraping

| Ruta | Acción y responsabilidad |
| --- | --- |
| `src/prospecting-jobs/dto/job.request.ts` | Creado. Valida creación, consulta paginada y formato de exportación. |
| `src/prospecting-jobs/prospecting-jobs.controller.ts` | Creado. Contiene el controlador público y el de callbacks internos; entrega exportaciones binarias. |
| `src/prospecting-jobs/prospecting-jobs.service.ts` | Creado. Coordina idempotencia, estados, cancelación, eventos, guardado y exportación. |
| `src/prospecting-jobs/internal-api-key.guard.ts` | Creado. Autentica callbacks mediante X-API-Key usando comparación de hashes en tiempo constante. |
| `src/prospecting-jobs/services/job-memory.service.ts` | Creado. Guarda resultados/progreso temporales y serializa operaciones de un mismo job dentro del proceso. |
| `src/prospecting-jobs/services/job-memory.service.spec.ts` | Creado. Prueba caducidad, capacidad, copias independientes y liberación de bloqueos. |
| `src/prospecting-jobs/services/job-export.service.ts` | Creado. Construye CSV y XLSX; escapa CSV y evita interpretar resultados como fórmulas. |
| `src/prospecting-jobs/prospecting-jobs.module.ts` | Modificado. Integra Campaigns, Prospects, ProspectorClient, Common y Prisma. |

### Idempotencia

La clave se exige en Idempotency-Key. Su hash y el del contenido se guardan por tenant/usuario. Job y clave se crean atómicamente; la restricción única también protege solicitudes de instancias independientes.

Misma clave y contenido devuelven el mismo trabajo, incluso tras reiniciar. Misma clave con otro contenido devuelve 409. Si no se confirma la aceptación de Python, una nueva solicitud con esa clave puede reenviar el mismo jobId: Python debe deduplicar por ese identificador.

### Estados y cancelación

El flujo normal es QUEUED → RUNNING → COMPLETED, FAILED o CANCELLED. Se rechazan regresiones y cambios incompatibles de estados terminales. QUEUED puede cancelarse inmediatamente. RUNNING solicita cancelación a Python y espera su callback; no se afirma que el motor se haya detenido antes de confirmarlo.

Los callbacks exigen API key. `@Public()` solo omite el guard JWT de esa ruta; el guard interno sigue exigiendo autenticación. El tenant se obtiene del job almacenado, no del mensaje externo. Sequence/eventId evitan eventos antiguos o repetidos mientras existe su registro en memoria.

### Memoria temporal y límites

- Una instancia del backend para el flujo de resultados y callbacks.
- TTL de 24 horas desde la última actualización del registro temporal.
- Máximo 1000 jobs retenidos; se retiran los más antiguos cuando se alcanza la capacidad.
- Reiniciar, expirar o retirar un registro pierde resultados, progreso, cursor de eventos y marca de importación temporal.
- PostgreSQL conserva los jobs, las claves de creación y los prospectos ya guardados.
- Sin resultados disponibles, persist/export devuelve 409. Nunca sustituye los resultados del job por todos los prospectos de la campaña.
- No hay caché distribuida ni garantía persistente de secuencias/replay. La idempotencia persistente de creación es independiente de este límite.

CSV y XLSX se devuelven como archivos, sin envoltorio JSON. ExcelJS se agregó para generar XLSX. Volver a persistir un job retenido en memoria no vuelve a importar los resultados aunque después se hayan editado sus prospectos.

## 9. Rutas disponibles

Todas las rutas siguientes usan el prefijo `/api/v1`.

| Módulo | Método y ruta |
| --- | --- |
| Tenants | GET/POST `/tenants`; GET `/tenants/{id}` |
| Campaigns | GET/POST `/campaigns`; GET/PATCH/DELETE `/campaigns/{id}`; GET `/campaigns/{id}/prospects` |
| Prospects | GET `/prospects`; GET/PATCH `/prospects/{id}` |
| Jobs | GET/POST `/prospecting-jobs`; GET `/prospecting-jobs/{id}` |
| Jobs | POST `/prospecting-jobs/{id}/cancel`; POST `/prospecting-jobs/{id}/persist`; GET `/prospecting-jobs/{id}/export?format=csv` o `xlsx` |
| Callback interno | POST `/internal/prospecting-jobs/{jobId}/events`, protegido por API key |

El servicio Python debe implementar POST `/api/v1/prospecting/jobs` y POST `/api/v1/prospecting/jobs/{jobId}/cancel`. Estas dos rutas pertenecen a Python, no a los controladores públicos de NestJS.

## 10. Cambios transversales y de base de datos

| Archivo | Cambio |
| --- | --- |
| `Prisma/schema.prisma` | Se agregó ProspectingJobRequest y sus relaciones con Tenant, User y ProspectingJob. |
| `Prisma/migrations/20260925000100_job_idempotency/migration.sql` | Crea la tabla, índices únicos y claves foráneas. No elimina datos existentes. |
| `Docs/Contracts/prospector-service-api.v1.yaml` | Agrega la solicitud interna de cancelación. |
| `Docs/ADRs/ADR-005-FunctionalJobs.md` | Registra las dos autorizaciones expresas y las decisiones de implementación. |
| `.env.example` | Agrega PLATFORM_CALLBACK_BASE_URL como configuración opcional. |
| `package.json` y `package-lock.json` | Agregan ExcelJS y el comando test:jobs:db. |
| `test/setup-env.ts` | Configura el entorno antes de importar la aplicación; admite JOBS_TEST_DATABASE_URL para pruebas reales. |
| `test/jest-e2e.json` | Carga setup-env antes de los módulos. |
| `test/support/fake-prisma.ts` | Amplía el doble de Prisma para Tenants y sus roles. |
| `test/platform.e2e-spec.ts` | Incorpora pruebas de Tenants y su integración con Auth/Users. |
| `test/campaigns.e2e-spec.ts` | Agrega pruebas HTTP de campañas, permisos, validación y aislamiento. |
| `test/jobs.postgres-spec.ts` | Agrega pruebas integradas con PostgreSQL real para Prospects y Jobs. |
| README principal, README de módulos y MODULE-DEVELOPMENT | Documentan capacidades, archivos, uso y límites. |

No fue necesario volver a registrar los cinco módulos en AppModule: ya estaban importados en F4. Se conservaron JWT HS256 de 8h, roles existentes, TenantContext/AsyncLocalStorage, autenticación global y formato de respuestas.

## 11. Verificación realizada

Resultados registrados al cerrar la implementación; esta entrega documental no vuelve a ejecutar pruebas ni representa una nueva auditoría:

| Verificación | Resultado |
| --- | --- |
| Compilación | Correcta. |
| ESLint | Sin errores ni advertencias en la revisión final. |
| Pruebas unitarias | 40 aprobadas. |
| Pruebas E2E aisladas | 64 aprobadas. |
| Pruebas con PostgreSQL real | 17 aprobadas. |
| Total de pruebas | 121 aprobadas. |
| Validación de Prisma | Esquema válido. |
| Migraciones | Aplicadas en instancia PostgreSQL temporal aislada. |
| Comparación esquema/base | Sin diferencias detectadas. |
| Contrato interno | YAML leído correctamente y ruta de cancelación presente. |

La instancia temporal se detuvo después de verificar. Los tests limpiaron únicamente sus IDs de fixtures. No se aplicó esta migración en la base habitual del usuario. En las pruebas PostgreSQL, Python fue sustituido: no se ejecutó scraping real.

Se comprobó recuperación de claves tras reinicio, solicitudes simultáneas, deduplicación de identificadores nulos, permisos, validación, callbacks, errores, cancelación, edición de prospectos, caducidad de resultados y lectura de un XLSX generado.

## 12. Cómo preparar el entorno habitual

Desde la raíz de `saas-platform-backend`, configurar `.env` a partir de `.env.example` si todavía no existe. No sobrescribir credenciales locales existentes.

| Variable | Uso |
| --- | --- |
| DATABASE_URL | Conexión a la base PostgreSQL del entorno. |
| PROSPECTOR_SERVICE_URL | Origen del servicio Python. |
| PROSPECTOR_API_KEY | Credencial compartida para inicio, cancelación y callbacks. |
| PLATFORM_CALLBACK_BASE_URL | Origen de NestJS alcanzable desde Python. Si se omite, Python recibe una ruta relativa y debe resolverla contra el backend. |
| JOBS_TEST_DATABASE_URL | Solo para la suite de pruebas reales; usar una base de pruebas migrada. |

Las demás variables F4 de autenticación, CORS y administrador siguen siendo necesarias según `.env.example`.

```powershell
npm ci
npx prisma migrate deploy
npm run prisma:generate
npm run build
npm run start:dev
```

Para un entorno nuevo que necesite el ADMIN inicial, ejecutar también `npm run prisma:seed` con ADMIN_NAME, ADMIN_EMAIL y ADMIN_PASSWORD configurados. El seed pertenece a la infraestructura existente.

Para repetir verificaciones:

```powershell
npm run build
npx eslint "{src,apps,libs,test}/**/*.ts"
npm run test -- --runInBand
npm run test:e2e -- --runInBand
# Después de definir JOBS_TEST_DATABASE_URL y migrar esa base de pruebas:
npm run test:jobs:db
```

## 13. Pendientes fuera del cierre del backend

1. Aplicar la migración en la base habitual y configurar las variables del entorno.
2. Implementar o confirmar en Python ambos endpoints internos, idempotencia por jobId y callbacks del contrato.
3. Verificar que Python alcance la URL de callback y comparta la API key.
4. Ejecutar una búsqueda real desde el cliente, esperar su finalización, persistir y descargar resultados.
5. Verificar la detención física al cancelar un scraping en ejecución.
6. Antes de escalar a varias instancias, diseñar caché compartida y almacenamiento persistente del cursor de eventos. No están implementados en este MVP.

## 14. Referencias

- [Guía de desarrollo](../MODULE-DEVELOPMENT.md).
- [Decisiones funcionales aprobadas](ADRs/ADR-005-FunctionalJobs.md).
- [Contrato público](Contracts/platform-api.v1.yaml).
- [Contrato interno de Python](Contracts/prospector-service-api.v1.yaml).
- [Tenants](../src/tenants/README.md), [Campaigns](../src/campaigns/README.md), [Prospects](../src/prospects/README.md), [ProspectorClient](../src/prospector-client/README.md) y [ProspectingJobs](../src/prospecting-jobs/README.md).
