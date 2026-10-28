# ADR-006 — Registro asistido de tenants y primer acceso

> **SUSTITUIDO. Evidencia histórica, no implementar.** La autoridad vigente es
> [ADR-006 aprobado](ADR-006-TenantRegistration-APROBADO.md). Contraseña temporal,
> oneOf en login y PLATFORM_LOGIN_URL fueron descartados; se usa enlace de activación,
> canje separado y PLATFORM_ACTIVATION_URL.

Estado: PROPUESTO para revisión. No implementado.
Fecha: 2026-10-27. Rama de trabajo: feat/tenant-register.

## Contexto y autoridad

El usuario autorizó preparar el ADR y OpenAPI del registro asistido por empleados ADMIN. El alcance solicitado incluye organización, primer OWNER, correo de bienvenida con contraseña temporal y cambio obligatorio antes de usar la plataforma. Los detalles operativos siguientes son propuestas concretas, no decisiones históricas ya aprobadas.

Fuentes: [ADR-004](ADR-004-CommonBaseline.md), secciones 4, 12–19, 22–25, 30–43, 51 y 65; [ADR-003](ADR-003-AuthSecureTransversal.md), F3-06 y F3-10; [guía de módulos](../../MODULE-DEVELOPMENT.md), Decisiones congeladas; [Core V1 / SEC-01](../Avance2/CORE_V1_VALIDATION.md).

Hoy POST /tenants solo crea tenant y roles. User.email es globalmente único. No hay correo, vencimiento temporal ni primer acceso. SEC-01 protege identidad global compartida. No se debe reutilizar la creación de usuarios mediante tenant seleccionado para simular el alta global ni modificar el contexto del ADMIN.

## Ampliaciones explícitas del baseline

| Fuente y restricción | Ampliación propuesta | Impacto |
| --- | --- | --- |
| Guía: esquema y contrato congelados | Migración aditiva y rutas de onboarding | Revisión de migración y consumidores antes de implementación. |
| ADR-004: login entrega contexto JWT | Login temporal devuelve credencial limitada, sin JWT | Frontend debe reconocer la segunda respuesta. |
| ADR-004: JWT HS256 de 8h, sin refresh/blacklist | Mantenerlo para sesiones normales | La credencial limitada es opaca, no JWT ni refresh token. |
| ADR-004: no secretos en logs | Contraseña temporal solo en memoria durante generación y envío | No incluir cuerpos de correo, credenciales o desafíos en logs/respuestas administrativas. |
| SEC-01: identidad global | Rechazar correo existente, sin cambiar credenciales | Invitación de cuentas existentes queda fuera de esta versión. |

Alternativa de activación mediante enlace para elegir contraseña: evita enviar contraseña por correo, pero cambia el flujo solicitado. Se propone conservar el flujo solicitado con caducidad y acceso limitado. Un JWT normal más una pantalla obligatoria no garantiza el bloqueo backend y se descarta.

## Registro y permisos

POST /api/v1/tenants/register exige JWT y @Roles('ADMIN'), sin tenant seleccionado obligatorio. Entrada cerrada: tenantName, tenantSlug, ownerName, ownerEmail. Nombres recortados no vacíos, máximo 120 caracteres; slug minúsculo de 3–63 caracteres alfanuméricos con guiones interiores; email válido, máximo 254 caracteres.

Correo: recortar y normalizar a minúsculas para cuentas nuevas; comprobar conflictos sin distinguir mayúsculas. Antes de implementar, auditar colisiones existentes y elegir una garantía de unicidad insensible a mayúsculas en PostgreSQL mediante migración, sin fusionar cuentas automáticamente. La restricción actual sensible a mayúsculas no basta contra registros concurrentes.

Una transacción crea Tenant ACTIVO, roles OWNER/MEMBER, User ACTIVO sin platformRole, UserTenant con OWNER y registro de onboarding. La contraseña temporal es aleatoria criptográfica de al menos 20 caracteres y satisface la política vigente. Solo su hash bcrypt costo 12 persiste; se reutiliza PasswordService.

Slug o correo en conflicto: 409 y ninguna escritura parcial. Un reintento de alta no reenvía correo ni restablece contraseñas; la recuperación utiliza consulta y reenvío. El POST /tenants existente conserva su contrato y no obtiene comportamiento de correo implícito.

## Estado persistente propuesto

- User: mustChangePassword=false por defecto y temporaryPasswordExpiresAt nullable. Usuarios actuales conservan login normal.
- TenantOnboarding: tenantId único, ownerUserId, createdBy, createdAt, completedAt nullable, generation, deliveryStatus, lastAttemptAt, providerAcceptedAt, attemptId y leaseExpiresAt nullable. Estado de activación separado del envío.
- FirstAccessChallenge: hash único de secreto aleatorio de 32 bytes, userId, onboardingId, generation, expiresAt y consumedAt nullable. No almacenar el secreto recuperable.

Los nombres físicos y relaciones finales se cerrarán al revisar la migración. No se modifica la migración inicial ni se obliga a los usuarios anteriores a cambiar contraseña. Plan de rollback: retirar la función sin borrar cuentas creadas; las columnas aditivas pueden permanecer. El despliegue de código anterior exige resolver primero las cuentas temporales, pues ese código no impone la restricción.

## Correo y recuperación

Tras commit se envía bienvenida en texto y HTML escapado con nombre, organización, correo, contraseña temporal, vigencia y PLATFORM_LOGIN_URL. No aceptar URL o destinatario alternativo en la solicitud. Contraseña válida 24 horas desde su generación, no desde lectura del correo.

Estados deliveryStatus: PENDING, SENDING, ACCEPTED, FAILED, UNKNOWN. ACCEPTED significa aceptación del transporte, no entrega al buzón. Activación: PENDING_FIRST_ACCESS o COMPLETED. Nunca mezclar ambos estados.

El alta responde 201 con onboarding persistido aunque el envío falle o sea incierto. Fallos de persistencia siguen siendo errores, no altas exitosas. El correo tiene timeout de 15 segundos; no se mantiene una transacción de base abierta durante I/O de correo.

Cada intento se reserva mediante actualización atómica con attemptId y lease de 60 segundos; solicitudes concurrentes reciben 409. Resultados tardíos solo actualizan el intento vigente. Una operación interrumpida se considera UNKNOWN al vencer el lease y permite recuperación; no se promete exactly-once del correo ni envío automático tras reinicio.

Reenvío ADMIN solo antes de completar primer acceso: genera nueva contraseña y generación, invalida desafíos anteriores y persiste el intento antes de enviar. Máximo un intento por minuto y cinco en una hora por onboarding, con conteo persistido de intentos para no perder el límite al reiniciar; requiere tabla de intentos asociada. Carrera con completar primer acceso: ambas operaciones deben serializarse sobre el onboarding, una no puede restablecer la contraseña después de completar la otra. Un correo tardío de una generación anterior contiene credenciales ya inválidas.

No guardar contraseñas cifradas recuperables ni cuerpos de correo para reintentos. Si falla el proceso, se genera otra contraseña por reenvío explícito. Worker/outbox y recuperación automática quedan fuera de esta versión.

## Primer acceso

1. Login valida usuario activo, contraseña y vencimiento. Una temporal vencida devuelve 401 genérico; ADMIN puede reenviar.
2. Si mustChangePassword=true, no emite JWT ni AuthContext. Devuelve action=CHANGE_PASSWORD_REQUIRED, firstAccessToken y expiresAt; desafío válido 15 minutos y como máximo hasta vencimiento de la contraseña temporal. Rate limit del login existente se conserva.
3. POST /auth/complete-first-access recibe firstAccessToken y newPassword, sin Bearer. No es acceso anónimo libre: su autorización es el desafío válido, de un solo uso. Límite 5 intentos/60 segundos/IP.
4. Comprueba usuario y tenant activos, generación vigente, desafío no vencido/consumido, pendiente de primer acceso y contraseña distinta de la temporal. Nueva contraseña sigue política ADR-004: mínimo 10 caracteres Unicode, letra, número y especial; rechazar más de 72 bytes UTF-8 para evitar truncamiento bcrypt y documentar ese límite adicional.
5. En transacción consume desafío, cambia hash, limpia marca/vencimiento, completa onboarding e invalida los demás desafíos. Dos confirmaciones simultáneas no pueden completar ambas.
6. Responde action=LOGIN_REQUIRED; cliente inicia sesión con nueva contraseña y recibe JWT normal.

Credencial inválida, usada, vencida o de generación anterior: 401 genérico. Política de nueva contraseña: 400. No se incluye credencial en URL ni logs. Cliente la mantiene temporalmente, no como token de sesión.

Defensa adicional: cuentas mustChangePassword no pueden usar JWT normal, incluso si uno se presenta; revalidar este estado en el servicio de autenticación/estrategia. Es una ampliación acotada del baseline, no revalidación general de membresías. Revisar PATCH /users para rechazar cambios de credenciales de una cuenta pendiente fuera del flujo; estados y desafíos no son campos editables de User DTO. El alta de MEMBER existente no se convierte automáticamente en invitación.

## Configuración y dependencias

PLATFORM_LOGIN_URL es la ubicación única para cambiar el enlace al frontend desplegado. Validar URL absoluta y HTTPS en producción; no derivarla de Host o del formulario. Configuración de transporte: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM y política TLS explícita. Las credenciales se gestionan fuera del repositorio.

Propuesta: TENANT_REGISTRATION_ENABLED=false por defecto. Si se activa, validar configuración completa al arrancar. Rutas de registro/reenvío con función desactivada responden 503 antes de escribir; consulta de onboarding y cambio de contraseña deben seguir disponibles para cuentas ya creadas. Nunca desactivar la protección de cuentas temporales por este flag.

Módulos: tenants/registration coordina; mail transporta y renderiza; Auth completa primer acceso; Users conserva identidad; Common conserva guards y formato. Sin ciclos Common→Auth, sin Prisma desde controlador. Proveedor y dependencia concreta de correo quedan por seleccionar; tests usan doble de transporte y buzón local.

## Contrato y documentación de disponibilidad

[OpenAPI propuesto completo](../Contracts/platform-api.tenant-registration.proposed.yaml) deriva del contrato V1 actual. No lo carga deploymentDocument ni sustituye el YAML disponible. Al implementar se trasladan únicamente las operaciones/esquemas nuevos y el cambio de login, revisando divergencias con el contrato vigente. No reemplazar a ciegas el archivo principal por esta copia.

Las rutas ADMIN devuelven 401/403; consulta/reenvío 404 si no existe onboarding. Reenvío devuelve 200 aunque deliveryStatus sea FAILED/UNKNOWN; 409 para onboarding completado o intento activo; 429 para límite. Identificadores de ruta son texto no vacío sin espacios, compatibles con seed. Respuestas conservan success/data y ErrorResponse.

## Verificación requerida antes de declarar implementado

- ADMIN con y sin tenant; OWNER/MEMBER rechazados; no altera contexto del ADMIN.
- Transacción completa, rollback, conflictos simultáneos de slug/correo, colisiones de mayúsculas.
- Credenciales temporales nunca generan JWT ni acceso normal; PATCH no permite bypass.
- Caducidad, uso único, nueva clave distinta, Unicode y límite bytes; confirmaciones concurrentes.
- Reenvío contra confirmación, invalidación de generaciones, fallos y timeout SMTP, proceso interrumpido y límite persistente.
- Usuario/tenant inactivos, aislamiento, login anterior y SEC-01 sin regresiones.
- Contraseñas/desafíos ausentes de logs y respuestas administrativas; correo correctamente escapado.
- Migración sobre usuarios existentes, unitarias, HTTP, PostgreSQL efímero y contrato válido.

## Estado de entrega

Este cambio entrega documentación y contrato propuesto. No crea tablas, rutas, correos ni credenciales. La aprobación de estos detalles y la selección del transporte anteceden a la implementación afectada; las duraciones y límites aquí fijados constituyen la propuesta revisable.
