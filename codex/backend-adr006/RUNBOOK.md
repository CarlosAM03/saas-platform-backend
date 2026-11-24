# Operación ADR-006 desde Visual Studio Code

Ámbito ejecutado: G1 local. Este procedimiento no autoriza merge, despliegue ni acceso a Supabase. Consultar las decisiones D1–D9 entregadas por el owner en Docs/Planeacion del checkout original; sus archivos y el ADR/contrato aprobados no se modifican.

## Laboratorio completo y reproducible

Requisitos: Git con b51b265f1a545fa915f1dd1c57ef2f5858ec6492 disponible, Docker Desktop Linux activo, PowerShell y espacio para imágenes Node20/PostgreSQL16. No se utiliza Node22 del host. Ejecutar desde la raíz Backend, en terminal integrada VS Code:

~~~powershell
./codex/backend-adr006/lab/Invoke-G1.ps1 -RunId ensayo-nuevo -HttpsPort 3444
~~~

Elegir RunId y puerto libres. El script no reutiliza contenedores, volúmenes ni carpetas previas. Se detiene con cualquier fallo. Construye runtime y herramienta Node20 desde el candidato, extrae el Core inmutable mediante git archive y crea una red interna nueva. Solo usa credenciales sintéticas visibles de laboratorio. PostgreSQL usa tmpfs sin puerto publicado. El proxy HTTPS escucha exclusivamente 127.0.0.1.

Secuencia realmente automatizada: QA completa; base de colisiones y fallo atómico; init oficial; datos Core; Core original contra esquema original; snapshot; respaldo sintético; preflight + migrate deploy; integridad; Core original contra esquema expandido; candidato flag OFF; segunda vuelta desde pg_restore; toda la suite PostgreSQL sobre base poblada; comparación de integridad posterior; HTTPS con Nginx y CA privada solo para el proceso de prueba. Los logs privados viven en /tmp del contenedor tools. No copiar esos logs sin revisión.

La red usa por defecto 172.30.66.0/24; si Docker reporta solapamiento elegir otra red privada libre mediante -Subnet. El único proxy confiable es la dirección .200/32 de esa red. Esto no afirma que Render use esa topología.

El script deja PostgreSQL y el proxy activos para revisión. Los contenedores y red llevan etiqueta prospector.g1=synthetic. Antes de retirar recursos identificar nombres, etiqueta y RunId; detener solo esos recursos. No hay teardown automático, limpieza de volúmenes ajenos ni comandos Docker prune.

No ejecutar el harness sobre una copia real: prepare/seed están destinados exclusivamente al laboratorio sintético.

## Preflight y migración locales por separado

DATABASE_URL debe existir explícitamente en el proceso. No se imprime ni se carga un .env por el script. El preflight comprueba protocolo, host y base esperados, PostgreSQL16 local, checksum de migraciones, historial completo, colisiones de correo, múltiples OWNER y relaciones Role/UserTenant. No corrige identidades. Localmente solo acepta hosts de laboratorio y bases g1_*.

~~~powershell
$env:DATABASE_ENV = 'test'
# Inyectar DATABASE_URL sintética desde el laboratorio; nunca pegar una URL productiva.
node codex/backend-adr006/preflight.cjs --expected-host localhost --expected-db g1_test
if ($LASTEXITCODE -ne 0) { throw 'Preflight fallido: detener' }

# Escribir exclusivamente sobre el destino local confirmado.
node codex/backend-adr006/preflight.cjs --expected-host localhost --expected-db g1_test --apply
if ($LASTEXITCODE -ne 0) { throw 'Migración fallida: detener' }
~~~

Dentro del laboratorio Docker, host esperado prospector-g1-pg. Prisma Migrate Deploy es el único mecanismo de promoción. No db push, migrate dev, reset ni seeds en producción. El postflight verifica las dos migraciones, flag histórico false/not-null, cinco tablas, índice canónico, trigger, constraints y cuentas pendientes. La ejecución del CLI tiene un límite local de 120 segundos; si se interrumpe revisar sesiones, locks y journal antes de repetir. No representa RTO productivo.

Ante colisión, la migración SQL original contiene BEGIN/COMMIT y aborta antes de normalizar correos o añadir columnas. Prisma puede conservar una entrada fallida en _prisma_migrations: eso no es DDL parcial de negocio. No marcarla como aplicada. En una copia desechable restaurar desde el respaldo; en una operación autorizada posterior, confirmar rollback de todas las escrituras y usar migrate resolve --rolled-back únicamente tras revisión DBA y resolución explícita de la causa. Nunca editar un checksum aplicado.

## G2 formal: copia real, todavía NOT RUN

El owner debe certificar respaldo íntegro, checksum, fecha, retención y restauración utilizable. El respaldo y su copia permanecen privados; no van a Git ni a CI. Restaurar con herramientas PostgreSQL en una instancia aislada sin salida hacia producción. Confirmar versión real, schemas, extensiones, funciones, triggers, policies, FKs y _prisma_migrations; no asumir que el ensayo sintético cubre objetos particulares de Supabase.

En esa instancia, crear una base local diferenciada para la copia; para ejecutar las suites protegidas puede utilizarse g1_history_2 dentro de una red aislada NUEVA. Registrar expresamente que contiene datos reales restaurados y un nuevo ID de evidencia G2. No ejecutar Invoke-G1.ps1 ni la fase prepare sobre ella.

1. Obtener conteos y huellas privadas antes de migrar; ejecutar Prisma/audit-email.sql con salida restringida. El preflight solo publica cantidades de conflictos.
2. Ejecutar preflight con host/base exactos. Cualquier colisión, múltiples OWNER, membresía cruzada o migración desconocida exige resolución del owner; sin fusión ni reparación automática.
3. Repetir respaldo/restore de la copia si hay que resolver datos. Medir locks y duración en esa copia.
4. Aplicar migrate deploy exclusivamente a la copia; comprobar constraints, tablas, índice y defaults con preflight --apply.
5. Ejecutar la suite PostgreSQL del candidato con INTEGRATION_TEST_DATABASE_URL apuntando solo a la copia local; sus fixtures usan IDs nuevos y se retiran al terminar. Revisar primero los tests y prohibir toda limpieza global.
6. Comparar registros y relaciones históricos, hashes de contraseñas, conteos y lecturas independientes. El helper snapshot/save/check de rehearsal.cjs sirve para huellas globales; omitir sus smokes dependientes de IDs sintéticos. Conservar las huellas privadas, no los registros.
7. Probar login/Core con identidades de prueba autorizadas de la copia y candidato/original. La normalización histórica cambia emails deliberadamente; verificar acceso antes/después con el operador.
8. Documentar resultados G2 separados. Solo entonces solicitar GO productivo G3.

G2_REAL_DATA = NOT RUN durante esta entrega.

## G3: comandos productivos reservados al owner tras nuevo GO

Esta sección es preparación documental; NO se ejecuta durante G1. El operador debe usar una terminal segregada y una conexión directa TLS de migración, no el pooler transaccional ni las credenciales de runtime. Confirmar Render auto-deploy de main, ventana de tráfico, respaldo restaurable y rollback. Mantener TENANT_REGISTRATION_ENABLED=false.

Inyectar DATABASE_URL y DATABASE_ENV=production mediante el gestor autorizado, sin mostrar valores. Conocer HOST_CONFIRMADO y BASE_CONFIRMADA por un canal seguro. El script exige coincidencia literal y sslmode=require; rechaza pooler 6543/pgbouncer=true. Los argumentos de GO y respaldo son comprobaciones explícitas del operador, no un permiso concedido por este documento.

~~~powershell
# SOLO OPERADOR CON GO ESCRITO G3. Variables anteriores inyectadas de forma privada.
node codex/backend-adr006/preflight.cjs --production --expected-host HOST_CONFIRMADO --expected-db BASE_CONFIRMADA --owner-go ADR006_OWNER_GO --verified-backup-id RESPALDO_RESTAURABLE_CONFIRMADO --ack-restore-tested
if ($LASTEXITCODE -ne 0) { throw 'STOP: preflight productivo' }

# Añadir --apply únicamente tras revisar el preflight y confirmar el mismo destino.
node codex/backend-adr006/preflight.cjs --production --expected-host HOST_CONFIRMADO --expected-db BASE_CONFIRMADA --owner-go ADR006_OWNER_GO --verified-backup-id RESPALDO_RESTAURABLE_CONFIRMADO --ack-restore-tested --apply
if ($LASTEXITCODE -ne 0) { throw 'STOP: migración productiva' }
~~~

Guardar salida JSON sanitizada y timestamp en registro operativo privado. La secuencia es auditoría/restauración → migración → postflight → comprobación Core viejo → aprobación de merge por owner → Render candidato flag OFF. No incorporar migrate deploy en CMD/arranque de todos los contenedores. Si Render arranca antes de migrar, detener esa promoción y revisar el esquema; no tratar errores de columnas como un smoke aceptable.

Confirmar host/base/rol segregado, versión PostgreSQL, sesiones/locks, migraciones conocidas y estado de respaldo antes de cualquier escritura. El operador verifica el endpoint directo efectivo y las opciones TLS del servicio en G2/G3; no se acreditaron aquí.

## Recuperación y rollback

Sin cuentas pendientes: mantener esquema expandido y flag OFF; el Core anterior puede funcionar sobre él según el ensayo sintético. Revalidar con copia real en G2 antes de reutilizar esa conclusión en producción. No revertir SQL ni normalización de email a ciegas.

El ensayo check-legacy-login.cjs demuestra un límite adicional: el Core original busca emails literalmente. Un correo histórico válido en mayúsculas inicia sesión antes de migrar; después solo funciona su entrada canónica minúscula en ese código antiguo. La versión candidata sí normaliza. Revisar formas de entrada/consumidor en G2; si no se garantiza compatibilidad, mantener una revisión compatible y usar forward-fix incluso sin cuentas pendientes. Invoke-G1.ps1 incluye esta prueba diagnóstica en una tercera base separada g1_case; PASS del ensayo no significa que la grafía histórica funcione tras volver al código viejo.

Con cualquier cuenta pendiente: prohibido volver a un Backend que ignore mustChangePassword. Apagar nuevas altas/reenvíos, mantener canje/completado, investigar entrega y aplicar forward-fix compatible. No borrar tenants, credenciales ni historial. Un fallo de Brevo no deshace la transacción; consultar onboarding y recuperar mediante reenvío manual tras lease/límites. No automatizar recuperación ni contratar fallback.

G4 comprobará la IP efectiva de Render. G6 comprobará cuenta/remitente/dominio/cuota gratuitos y recepción. G3–G6 = NOT RUN aquí.
