# Handoff de hardening — avance al 27 de septiembre de 2026

## Funcional para el primer despliegue

Auth, Users, Tenants, Campaigns, Prospects persistidos y capacidades transversales: JWT, roles, contexto/aislamiento tenant, validacion, paginacion, wrappers, logging/requestId y Health. Requieren PostgreSQL; no requieren Python.

Los servicios de Tenants/Users ya no duplican los roles declarativos de los controladores. Se conserva la regla dinamica de ADMIN para eliminar campanas permanentemente. No se agregaron reglas de nombres, slugs o transiciones.

Prisma corresponde al baseline 9d17d0f. La unica migracion actual es 20260909152421_init. ProspectingJob se conserva; ProspectingJobRequest y la migracion adicional se retiraron.

## Preparado / no disponible

ProspectingJobs conserva lectura de registros. Sus operaciones de integracion responden 503; ProspectorClient es un adaptador deshabilitado, no un simulador de ejecuciones exitosas. No hay cliente HTTP activo ni cache de resultados. Los prospectos existentes siguen consultables/editables; no se importan BusinessResult ni se descargan resultados de scraping.

Las rutas mantienen autenticacion y validacion. Los callbacks sin credencial valida devuelven 401; los validos devuelven 503 sin procesar eventos. La respuesta de indisponibilidad incluye details.reason=PROSPECTOR_INTEGRATION_PENDING.

## Contratos y documentacion

El YAML publico objetivo no fue modificado. Swagger sirve una vista ajustada a lo disponible, sin anunciar respuestas exitosas en las operaciones deshabilitadas. El contrato interno se restauro al baseline, retirando la ruta adicional de cancelacion Python. ADR-005 es historico/propuesta pendiente.

README principal y README de modulos describen el estado actual. ENTREGA-MODULOS-BACKEND conserva el historial original y las etapas de retirada; sus descripciones antiguas no sustituyen este estado.

## Evidencia acumulada

En el cuarto paso: compilacion y ESLint correctos, 14 unitarias, 72 E2E aisladas y 7 PostgreSQL aprobadas. La prueba real uso una base separada, migrada solo con el baseline. La comparacion schema/base fue correcta en el tercer paso. El servidor temporal fue detenido tras las verificaciones.

Quinto paso: compilacion correcta y 73 E2E aprobadas, incluida la consulta HTTP de /api/docs-json, comprobacion de respuestas disponibles, seguridad y referencias locales de OpenAPI. ESLint de los TypeScript cambiados correcto y enlaces de la documentacion verificados. No se repitieron las pruebas unitarias/PostgreSQL del cuarto paso porque este ajuste afecta documentacion y su publicacion. No se ha realizado una comprobacion nueva de npm ci ni un despliegue real desde esta reconciliacion.

## Pendiente de diseno/integracion

Prospector Service y Engine; callbacks operacionales; cache real; importacion y regla de deduplicacion; exportacion; idempotencia persistente; cancelacion fisica; retries y timeout operacional. No se introdujo una arquitectura sustituta.

## Pendientes antes de cerrar la entrega

- Verificacion final de instalacion limpia, configuracion y arranque del despliegue.
- Comprobar la base habitual: no estuvo disponible para verificar su historial. No se modifico. Si recibio la migracion retirada, planificar su reconciliacion conservando los datos antes de desplegar; no hacer reset para ocultar divergencias.
- Revisar el diff acumulado y preparar entrega Git en dev. No se hizo commit, push ni merge a main; no existe aun SHA final de esta entrega.

Consultar [README](../README.md), [contratos](Contracts/README.md) y [registro por etapas](ENTREGA-MODULOS-BACKEND.md).
