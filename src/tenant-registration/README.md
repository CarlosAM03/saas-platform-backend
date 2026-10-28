# Tenant Registration — ADR-006

Las autoridades son el [ADR aprobado](../../Docs/ADRs/ADR-006-TenantRegistration-APROBADO.md) y el [contrato aprobado](../../Docs/Contracts/platform-api.tenant-registration.approved.yaml). Permanecen intactos. La versión implementada conserva las 33 operaciones Core y añade cinco; login sigue devolviendo AuthContext.

El [README previo de Ángel](../../Docs/Avance2/TENANT_REGISTRATION_README_CA1E7C9.md) conserva la implementación SMTP y los resultados históricos de ca1e7c9. D1–D9 sustituyen ese transporte y endurecen Users; no confundir esa historia con la configuración vigente.

## Flujo y estados

Solo ADMIN global registra un tenant ACTIVO y su primer OWNER mediante POST /api/v1/tenants/register. La transacción crea roles, identidad pendiente, membresía, onboarding, hash de enlace y primer intento. El correo se intenta después del commit. La respuesta 201 conserva tenant y OWNER aunque el proveedor falle.

El enlace opaco de 32 bytes dura 24 horas y se canjea una vez mediante POST /api/v1/auth/redeem-first-access. El desafío distinto dura como máximo 15 minutos, nunca más que el enlace. POST /api/v1/auth/complete-first-access establece bcrypt cost 12 y devuelve LOGIN_REQUIRED. No emite JWT. Contraseña: diez caracteres Unicode, letra, número, especial y máximo 72 bytes UTF-8.

Mientras mustChangePassword sea true se rechazan login, JWT, me, select-tenant y cambios administrativos de credenciales que evadan activación. GET /tenants/{id}/onboarding y POST /tenants/{id}/resend-welcome son ADMIN. El reenvío manual sustituye generaciones y anula enlaces/desafíos anteriores.

Entrega: PENDING, SENDING, ACCEPTED, FAILED, UNKNOWN. Activación: PENDING_FIRST_ACCESS o COMPLETED, en columna independiente. ACCEPTED solo indica aceptación del proveedor.

## Transporte vigente: Brevo HTTPS/443

WelcomeMailService usa una sola solicitud POST a https://api.brevo.com/v3/smtp/email, con cabecera api-key y remitente configurado. No acepta endpoint desde el cliente ni sigue redirecciones. TLS conserva la verificación de certificados de Node.

201 con messageId válido produce ACCEPTED. HTTP 4xx, incluidos rechazo y 429/cuota, produce FAILED. 5xx, interrupciones, timeout y respuestas inesperadas producen UNKNOWN porque el resultado de entrega puede ser incierto. El plazo total de petición y lectura de respuesta es 15 segundos. No se registran errores/cuerpos del proveedor, destinatarios, claves ni enlaces. No hay reintentos ni fallback.

La API de Brevo está documentada en [su referencia oficial](https://developers.brevo.com/reference/send-transac-email). No se utilizaron claves reales ni se enviaron correos durante G1. La cuenta, dominio, remitente, cuota efectiva gratuita y recepción quedan pendientes de los gates autorizados.

## Configuración

| Variable | Regla |
| --- | --- |
| TENANT_REGISTRATION_ENABLED | false por defecto; limita únicamente nuevas altas y reenvíos |
| PLATFORM_ACTIVATION_URL | URL confiable sin credenciales/query; HTTPS en producción, fragmento opcional #/activate |
| BREVO_API_KEY | Clave API HTTPS, nunca credenciales SMTP; secret manager |
| BREVO_FROM_EMAIL | Remitente verificado; secret manager |
| TRUSTED_PROXY_CIDRS | Vacía: ningún proxy confiable. IP/CIDR explícitos del ingress comprobado |

Con flag OFF no se necesitan credenciales de correo. Canje, completado y consulta de pendientes siguen disponibles. Con flag ON se valida configuración antes de arrancar.

Compose transmite solo las variables declaradas; no inyecta un .env completo. db-init fuerza flag OFF y pertenece exclusivamente al entorno de desarrollo. El Dockerfile runtime arranca node dist/src/main.js y no ejecuta migraciones.

## Seguridad Users y concurrencia

POST/PATCH/DELETE Users revalidan identidad, estado y autoridad actuales en PostgreSQL dentro de transacciones Serializable. Se bloquean en lectura las filas del actor y de su membresía para coordinar degradaciones concurrentes. No cambia el JWT de ocho horas ni el snapshot de operaciones normales.

Solo ADMIN asigna OWNER. El predicado de asignaciones OWNER se lee en la misma transacción que crea/actualiza la membresía; PostgreSQL SSI aborta carreras y el servicio reintenta hasta tres veces desde estado fresco. Un segundo OWNER devuelve 409 sin escrituras parciales. No se añade una restricción destructiva que invalide múltiples OWNER históricos: el preflight los reporta y detiene la promoción.

OWNER administra MEMBER exclusivo de su tenant; conserva self-edit exclusivo compatible con SEC-01. No puede promover OWNER, editar ADMIN/otros OWNER, ni editar identidades compartidas, incluso la propia. La baja global o degradación no puede dejar un tenant ACTIVO sin OWNER activo. DELETE conserva su autorización ADMIN. Transferencias e invitaciones MEMBER quedan fuera.

## Límites y proxy

La entrega cuenta el intento inicial: máximo uno por minuto y cinco por hora por onboarding, persistidos. Lease de 60 segundos. Un proceso interrumpido termina en UNKNOWN al vencer el lease; la recuperación es manual y conserva el historial.

Canje y completado tienen buckets persistentes por operación, IP y hash de credencial, con cinco intentos por ventana de 60 segundos. Solicitudes inválidas también cuentan. No se confía en X-Forwarded-For salvo que el peer pertenezca al allowlist explícito. El ingress debe sobrescribir cabeceras entrantes. No configurar trust proxy=true ni un número de saltos. La IP real de Render requiere G4.

## Ejecución y evidencias

El [runbook](../../codex/backend-adr006/RUNBOOK.md) contiene el comando PowerShell de VS Code, preflight, migración, condiciones de promoción y rollback. El [handoff](../../codex/backend-adr006/evidencias/10_HANDOFF_GATE1.md) distingue resultados locales, CI e historia de Ángel.

No ejecutar pruebas contra bases remotas ni introducir DATABASE_URL de Supabase en G1. El ensayo usa migraciones oficiales y PostgreSQL 16 con datos sintéticos; G2_REAL_DATA = NOT RUN. G3–G6 tampoco se ejecutaron.
