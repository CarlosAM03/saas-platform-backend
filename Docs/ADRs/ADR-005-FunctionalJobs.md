# ADR-005: Integracion funcional de trabajos de prospeccion

Estado: aceptado. Fecha: 2026-09-24.

## Autorizaciones

El responsable del proyecto aprobo expresamente en la sesion de desarrollo:

1. Agregar `POST /api/v1/prospecting/jobs/{jobId}/cancel` al contrato interno de Python, autenticado con X-API-Key. Un trabajo RUNNING permanece asi hasta el callback CANCELLED.
2. Ampliar Prisma y agregar una migracion para idempotencia persistente, con unicidad por organizacion, usuario y clave.

Estas son extensiones del baseline F4, no cambios a JWT, roles o TenantContext.

## Idempotencia persistente

`ProspectingJobRequest` guarda tenantId, userId, SHA-256 de la clave, SHA-256 del payload canonico, jobId y acceptedAt. No se almacena la clave original. El job y su registro de idempotencia se crean en una misma transaccion. La restriccion unica protege incluso solicitudes de instancias distintas. Se conservan identificadores CUID generados por Prisma.

Misma clave/payload devuelve el mismo job; payload distinto devuelve 409. Si falla la comunicacion antes de confirmar aceptacion, la siguiente solicitud con esa clave vuelve a enviar el mismo jobId. Prospector Service debe respetar la idempotencia por jobId ya definida en ADR-002. No se implementan reintentos de red automaticos.

## Cancelacion

El contrato interno agrega una solicitud idempotente que responde 202 cuando acepta cancelar o el job ya esta cancelado. COMPLETED/FAILED devuelve 409. La API key y la politica de no seguir redirecciones son iguales a las del inicio de trabajos.

QUEUED pasa inmediatamente a CANCELLED en PostgreSQL; si consta aceptacion externa tambien se pide detenerlo en Python. RUNNING envia la solicitud a Python y conserva su estado hasta el callback. Los eventos tardios de jobs cancelados no los reactivan. No se implementa ni se simula como real la detencion fisica del motor Python en este repositorio.

## Resultados temporales y ejecucion

Conforme a ADR-002 seccion 17, la cache concreta es una decision de implementacion: memoria de un proceso, TTL de 24 horas desde la ultima actualizacion y maximo 1000 jobs retenidos; al excederlo se retira el mas antiguo. Los resultados y el progreso se pierden al reiniciar o expirar. `resultsAvailable=false` y 409 en persist/export hacen visible esa ausencia.

El estado del job y la idempotencia de creacion son persistentes. El ultimo sequence/eventId y la marca de resultados ya importados son temporales. El MVP requiere una sola instancia para el flujo de callbacks/resultados; no ofrece replay persistente ni cache distribuida. El estado terminal en PostgreSQL sigue protegido aun sin cache. No se agregan tablas de resultados temporales, Redis ni una cola/worker no previstos.

La recepcion de eventos requiere X-API-Key y validacion de DTOs. Se omite exclusivamente JWT en la ruta interna; no se permite acceso anonimo. La autoridad tenant deriva del job persistido. Las actualizaciones comparan el estado y updatedAt para detectar carreras. Un evento final debe seguir a RUNNING, segun el lifecycle V1.

`PLATFORM_CALLBACK_BASE_URL` es opcional. Si se configura, debe ser el origen del backend alcanzable por Python. Si se omite, se envia la ruta relativa permitida por el contrato y Python necesita conocer el origen del backend.

## Persistencia y exportacion

ProspectsService crea Prospect y CampaignProspect en una transaccion SERIALIZABLE. Los conflictos concurrentes de serializacion/unicidad se reintentan hasta tres veces. La identidad con sourceIdentifier utiliza la clave compuesta del esquema. Sin identificador, se compara exactamente source, name, address, phone, email y website dentro del tenant/campana; esta regla es conservadora y no pretende detectar negocios equivalentes con datos diferentes. No sobrescribe prospectos existentes.

Repetir persist para el mismo job conservado en cache no recrea registros que el usuario haya editado despues de importarlos.

CSV escapa delimitadores y neutraliza formulas. XLSX usa celdas de texto con ExcelJS. Ambas rutas devuelven archivos sin wrapper JSON. Solo se exportan los resultados exactos conservados del job: no se sustituyen por todos los prospectos de su campana. Si la cache desaparece, los prospectos ya importados siguen accesibles por Prospects; el esquema no guarda procedencia por job para reconstruir ese archivo.

## Verificacion

Pruebas unitarias del cliente/cache; pruebas E2E existentes; `npm run test:jobs:db` con JOBS_TEST_DATABASE_URL apuntando a una base de pruebas migrada. Esa suite usa PostgreSQL real, sustituye solo el servicio Python, y limpia exclusivamente los IDs de sus fixtures. La integracion real con Python requiere que ese servicio implemente ambos endpoints internos y sus callbacks.
