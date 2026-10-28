# Archivo histórico — README de Ángel en ca1e7c9

No es configuración operativa vigente. Se conserva íntegro como evidencia anterior al hardening G1.

# Tenant Registration — ADR-006

Implementación **local, pendiente de gates PostgreSQL y revisión del owner**.
Implementación y validación: 27–28/10/2026. Rama autorizada: `feat/tenant-register`.
Baseline inspeccionado: `b51b265f1a545fa915f1dd1c57ef2f5858ec6492`.

## Autoridad y alcance

- [ADR-006 aprobado](../../Docs/ADRs/ADR-006-TenantRegistration-APROBADO.md).
- [OpenAPI aprobado](../../Docs/Contracts/platform-api.tenant-registration.approved.yaml).
- [Guía de módulos](../../MODULE-DEVELOPMENT.md), ADR-004, ADR-003 y
  [Core V1 / SEC-01](../../Docs/Avance2/CORE_V1_VALIDATION.md).

Las copias aprobadas se compararon byte a byte mediante SHA-256 con los originales
externos indicados por el owner. No se modificaron. SHA-256 ADR:
`5BE9757AF462510D7F30D8D41EA9539FC8BDE9FBA5944CBBDF574C62A4A456B1`;
YAML: `5F2E2A70F87C57289D10AAF0FD37737D03E841FF44B71328BF01608CED2721DC`.
Las marcas de diseño/no implementado en esos originales son evidencia histórica,
no una declaración de disponibilidad actual. La propuesta anterior está marcada
como sustituida: contraseña temporal, oneOf en login y PLATFORM_LOGIN_URL no aplican.

## Comportamiento

1. ADMIN global, con o sin tenant seleccionado, registra organización y primer OWNER.
2. Una transacción crea Tenant ACTIVO, roles OWNER/MEMBER, User ACTIVO sin platformRole,
   membresía OWNER, onboarding, hash del enlace e intento inicial con lease.
3. Después del commit se intenta enviar el correo. Fallo/timeout del transporte no
   elimina el alta: devuelve 201 con estado de entrega separado.
4. El enlace tiene 32 bytes aleatorios, es opaco, no JWT, y dura 24 horas.
5. Canjearlo consume el enlace y crea un desafío diferente, máximo 15 minutos,
   nunca posterior al vencimiento del enlace. Responde CHANGE_PASSWORD_REQUIRED.
6. Completar con contraseña válida consume el desafío, invalida credenciales
   restantes y completa el onboarding. Responde LOGIN_REQUIRED, sin sesión.
7. El usuario inicia sesión por el login habitual, con AuthContext sin cambios.

No se envían contraseñas. No se cambia el JWT ni el contexto del ADMIN.
`POST /tenants` conserva Tenant + roles, sin OWNER/correo implícitos. Crear MEMBER
por Users sigue siendo creación convencional, no invitación. No se modifican CSV,
Jobs, Prospector Service ni Flutter; Jobs conserva escrituras deshabilitadas.

## Rutas y autorización

| Ruta | Autoridad | Resultado |
| --- | --- | --- |
| POST `/api/v1/tenants/register` | JWT + ADMIN global | 201 tenant/onboarding; 503 si flag apagado. |
| GET `/api/v1/tenants/{id}/onboarding` | JWT + ADMIN global | 200 estado; 404 si no existe onboarding. |
| POST `/api/v1/tenants/{id}/resend-welcome` | JWT + ADMIN global | 200 estado; sin body, ni siquiera `{}`; 503 si flag apagado. |
| POST `/api/v1/auth/redeem-first-access` | activationToken en JSON | 200 CHANGE_PASSWORD_REQUIRED, firstAccessToken, expiresAt. |
| POST `/api/v1/auth/complete-first-access` | firstAccessToken + newPassword en JSON | 200 LOGIN_REQUIRED. |

Las rutas administrativas no requieren tenant seleccionado. OWNER/MEMBER reciben
403. Canje y completado no utilizan el secreto como Bearer y nunca emiten JWT.
Los DTO son cerrados mediante ValidationPipe existente. Tokens desconocidos,
vencidos, consumidos, generación anterior o cuentas no activas: 401 genérico.
Contraseña inválida: 400 sin consumir desafío. Límites: 429. Conflictos de alta,
lease activo o onboarding completado: 409 en las operaciones administrativas.

Las cinco rutas usan Cache-Control: no-store, incluidos errores de guards y
parser (con requestId aun si falla antes del middleware). Los errores 400 de estas rutas se sanitizan para que un error de JSON
no refleje un fragmento del secreto enviado. RequestId y wrapper permanecen.

## Registro y estados

Registro acepta solo tenantName, tenantSlug, ownerName y ownerEmail:

- Nombres con trim, no vacíos, máximo 120 caracteres.
- Slug minúsculo, 3–63 caracteres alfanuméricos/guiones interiores.
- Correo válido, máximo 254, trim y minúsculas.
- Correo global o slug existente: 409 sin cuentas vinculadas, cambios de clave,
  correo ni entidades parciales. Repetir POST no reenvía; usar consulta/reenvío.

Activación: PENDING_FIRST_ACCESS / COMPLETED.
Entrega: PENDING / SENDING / ACCEPTED / FAILED / UNKNOWN.
ACCEPTED solo significa aceptación del transporte, **no entrega al buzón**.

`mustChangePassword=false` por defecto preserva usuarios previos. El nuevo OWNER
empieza con true. Mientras tanto passwordHash contiene un digest aleatorio con
prefijo deliberadamente inválido para bcrypt (`!activation-only!`), no una clave
utilizable ni un hash de contraseña conocida. El secreto generador se descarta.
La contraseña definitiva solo se guarda mediante PasswordService/bcrypt costo 12.

## Modelo y migración

Migración aditiva: `Prisma/migrations/20261027000100_tenant_registration/migration.sql`.
No se reescribe init ni se crean onboardings para tenants anteriores.

| Modelo | Responsabilidad y constraints |
| --- | --- |
| User | Marca mustChangePassword con default false. |
| TenantOnboarding | Tenant y primer OWNER únicos; ADMIN creador; generación positiva; estados independientes; COMPLETED exige completedAt. |
| ActivationLink | Hash SHA-256 único, onboarding/generación únicos, expedición, vencimiento y consumo; TTL máximo 24h. |
| FirstAccessChallenge | Otro hash único, onboarding/generación únicos, FK a generación de enlace, TTL máximo 15min y consumo. |
| DeliveryAttempt | ID propio, generación única por onboarding, fecha/resultado y lease persistente. |
| ActivationRateLimit | Claves hasheadas por IP/credencial, contador y ventana persistentes. |

Los tokens se asocian al OWNER a través del onboarding exclusivo; no hay DTO
para modificar esa relación ni el flag. Solo se guardan hashes de secretos,
nunca enlaces recuperables o cuerpos del correo. Tablas nuevas tienen FKs
restrictivas; ninguna eliminación en cascada afecta cuentas existentes.

### Auditoría y normalización histórica del correo

1. Respaldar y ejecutar **solo lectura** `Prisma/audit-email.sql` con acceso
   administrativo restringido. Devuelve IDs en conflicto, no correos.
2. Si hay colisiones, detener despliegue y resolverlas por decisión humana.
   No fusionar, eliminar ni renombrar automáticamente.
3. La migración repite la auditoría bajo lock exclusivo de users y transacción.
   En colisión lanza ADR006_EMAIL_COLLISION antes de modificar datos o tablas.
4. Sin colisiones, transforma emails históricos mediante trim Unicode explícito
   y lower de PostgreSQL. No cambia IDs, hashes, membresías, estado ni updatedAt.
5. Conserva users_email_key/@unique para findUnique/upsert de Prisma y añade
   índice único de expresión sobre canonical_user_email(email), con protección
   concurrente. Trigger normaliza también INSERT/UPDATE SQL externos.

No requiere citext ni instalar extensiones. El índice funcional, trigger, checks
y función SQL están gestionados por la migración; Prisma 5 no representa todos
estos elementos. No sustituir la migración por db push ni eliminar el índice
funcional al generar cambios futuros. La equivalencia case-insensitive de la DB
usa lower y la colación de PostgreSQL; incluir correos internacionalizados de
los datos reales en la auditoría antes del despliegue.

Login, DTOs, servicios Users y registro normalizan entradas; seed administrativo
normaliza ADMIN_EMAIL. Seeds no sobrescriben contraseñas de cuentas pendientes.
Los correos de seed_dev ya son canónicos. La auditoría/migración **no se ejecutó
contra bases habituales, compartidas ni productivas** durante esta tarea.

## Transacciones y concurrencia

`RegistrationPersistence.serializable` usa una única transacción Prisma, máximo
tres intentos, timeout 10s. Reintenta P2034 y SQLSTATE 40001/40P01 de operaciones
SQL parametrizadas; no reintenta SMTP. Cada transición existente bloquea primero
la fila del onboarding con SELECT FOR UPDATE y vuelve a leer el estado.
El tiempo procede de clock_timestamp() de PostgreSQL, nunca del cliente.
La consulta administrativa usa RepeatableRead, sin mutaciones ni nuevo 409
fuera del contrato de consulta.

- Alta: unicidad de slug/correo y rollback del mismo cliente transaccional.
- Canje: lock, estados activos, generación, TTL y consumo condicional; enlace y
  desafío se modifican atómicamente. Solo una respuesta puede tener éxito.
- Completado: política y bcrypt fuera de la transacción; dentro se revalida todo,
  consume y actualiza usuario/onboarding/credenciales en conjunto.
- Reenvío: mismo lock que completado. Si completó primero, no reenvía. Si reenvió
  primero, cambia generación e invalida el desafío anterior.
- Resultados SMTP: lock y comparación de attemptId/generación/estado/lease. No
  sobrescriben una generación nueva ni onboarding completado.

Agotar reintentos administrativos devuelve 409. En activación se conserva el
401 genérico; en antiabuso la contención excesiva falla cerrada con 429.
No se promete ausencia de errores transitorios ni exactly-once del correo.

### Límites

- Envío: al menos 60s entre intentos y máximo cinco en 60min por onboarding;
  el intento inicial cuenta. Consulta y reserva dentro de la misma transacción.
- Lease: 60s. Envío interrumpido con lease vencido se interpreta como UNKNOWN
  en consulta y se materializa al reservar recuperación. No hay envío automático.
- Transporte: timeout total 15s; se cierra el transporte. Errores SMTP no se
  registran ni se devuelven, solo ACCEPTED/FAILED/UNKNOWN.
- Canje/completado: cinco intentos/60s por IP y por credencial, por operación.
  Ventana fija persistente con UPSERT atómico; cuenta fallos y solicitudes con
  DTO inválido. IP denegada no crea nuevas filas arbitrarias de credenciales.
- Los contadores de login existentes (5/60s/IP en memoria) no se modifican.

No hay limpieza automática de historial. Planificar retención administrativa de
contadores expirados sin borrar ventanas activas; no se introduce worker/outbox.

## Bloqueo de bypass y SEC-01

Login y emisión normal rechazan pendientes; JwtStrategy comprueba la marca aun
con flag apagado. AuthService también rechaza pendientes en me/select-tenant.
PATCH Users no permite cambiar correo/contraseña de pendientes ni editar flags,
tokens o desafíos; conserva la transacción y las protecciones SEC-01 de identidad
global. Otros cambios permitidos no limpian mustChangePassword. No se añadió
revalidación general de roles/membresías por request.

Política de contraseña inicial: mínimo diez caracteres Unicode, letra, número,
especial; máximo **72 bytes UTF-8**. Validación fallida no consume el desafío.
Tras perder respuesta del canje o vencer desafío, recuperación por ADMIN con
nuevo enlace, nunca reutilizando el token anterior.

## Configuración

`TENANT_REGISTRATION_ENABLED=false` por defecto, también en `.env.example`.
El backend arranca sin SMTP si no está habilitado. No se activó en producción.

| Variable | Uso |
| --- | --- |
| TENANT_REGISTRATION_ENABLED | true habilita únicamente altas y reenvíos; default false. |
| PLATFORM_ACTIVATION_URL | Ubicación confiable del frontend; cambiar aquí al desplegarlo. Opcional #/activate; sin query/credenciales; HTTPS en producción. |
| SMTP_HOST | Host del transporte configurado por operación, no por ADMIN. |
| SMTP_PORT | Recomendado para Brevo Free: 587 con starttls. |
| SMTP_USER / SMTP_PASSWORD | Secret manager; SMTP key, no API key para Brevo. |
| SMTP_FROM | Correo remitente verificado, no un destinatario alternativo. |
| SMTP_TLS_MODE | Recomendado: starttls, certificados verificados. El transporte también admite implicit. |

Config al habilitar falla si faltan datos o el modo/URL no es seguro. La URL se
construye desde configuración, nunca Host/body. Formato final:
`https://frontend.example/#/activate?code=<token>`. Plantilla texto/HTML escapado
incluye nombre, organización, correo, vigencia y recuperación mediante ADMIN.

### Configuración personal del equipo (Docker local)

Cada integrante usa sus propias credenciales. Desde la raíz, en PowerShell,
crear `.env` **solo si no existe**, para no sobrescribir configuración personal:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
git check-ignore .env
```

`.env` ya está ignorado por Git y excluido del contexto de build por
`.dockerignore`; no modificar esas reglas ni usar `git add -f`. Solo se comparte
`.env.example`, nunca `.env`, capturas del panel, keys ni archivos de salida con
configuración resuelta. Para secretos con `$` o `#`, usar comillas simples en
`.env` para preservar el valor literal. No pegar claves en comandos/historial.
El archivo debe permanecer privado; al estar el repositorio en OneDrive, revisar
también sincronización/permisos: ignorado por Git no significa fuera de OneDrive.

Bloque final de ADR-006 para el `.env` personal (sin valores reales):

```dotenv
TENANT_REGISTRATION_ENABLED=false
PLATFORM_ACTIVATION_URL=http://localhost:4200/#/activate
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
SMTP_TLS_MODE=starttls
```

- `SMTP_USER`: usuario SMTP mostrado en el panel Brevo.
- `SMTP_PASSWORD`: **SMTP key** generada en Brevo; no contraseña de cuenta ni API key.
- `SMTP_FROM`: remitente verificado en Brevo; no se comparte en la plantilla.
- Mantener Free sin tarjeta, recargas ni upgrades. Revisar cuota antes de probar.

Compose usa `.env` para **sustitución**, no como `env_file` completo. Solo las ocho
variables de registro se propagan explícitamente a `api`; las otras variables de
runtime del Compose local conservan sus valores existentes. `db-init` fuerza el
flag a false y no recibe SMTP, incluso cuando `api` se habilita. Con flag false
se permiten credenciales vacías; con true la validación existente impide arrancar
si falta configuración. El entorno de PowerShell tiene prioridad sobre `.env`;
eliminar overrides antiguos si los resultados no coinciden con el archivo.

Arranque local con flag apagado (no envía correo):

```powershell
$env:TENANT_REGISTRATION_ENABLED = 'false'
docker compose --env-file .env config --quiet
docker compose --env-file .env up --build -d api
```

**Atención:** `up api` también ejecuta migraciones y seed por `db-init` sobre el
volumen local `dev-postgres` existente. No apuntar a bases compartidas/productivas;
respaldar datos locales importantes. No usar `down -v` para preparar SMTP.

### Prueba controlada posterior (no ejecutada en esta preparación)

Primero completar las tres credenciales en `.env`, confirmar remitente/destinatario
de prueba autorizado y disponibilidad de la ruta frontend `/activate`. Arrancar
por sí solo no envía correo; invocar registro o reenvío **sí puede enviarlo**.
Después del arranque apagado anterior, habilitar solo temporalmente `api`:

```powershell
try {
  $env:TENANT_REGISTRATION_ENABLED = 'true'
  docker compose --env-file .env config --quiet
  docker compose --env-file .env up -d --no-deps --force-recreate api
  # Obtener JWT ADMIN local por el login habitual. En /api/docs usar Authorize
  # y POST /api/v1/tenants/register con datos únicos y destinatario autorizado.
  # Revisar deliveryStatus y el panel Brevo; no imprimir token, JWT ni enlaces.
  Read-Host 'Al terminar la prueba, pulsa Enter para volver a apagar el flag'
} finally {
  $env:TENANT_REGISTRATION_ENABLED = 'false'
  docker compose --env-file .env up -d --no-deps --force-recreate api
}
```

No habilitar permanentemente el flag en `.env`. `ACCEPTED` no garantiza entrega;
la cuota puede producir cola y el enlace puede vencer. Para recuperar, consultar
onboarding y reenviar manualmente conforme a límites, nunca repetir el registro.
No compartir salida de `docker compose config` sin `--quiet`, `docker inspect`
o dumps del entorno: pueden contener credenciales.

### Entorno desplegado (solo instrucciones, no despliegue)

Configurar esas mismas ocho variables en el panel del hosting/secret manager,
por entorno, nunca mediante un `.env` subido a GitHub ni dentro de la imagen.
El hosting inyectará las credenciales al proceso API; el bootstrap/migrador no
debe heredarlas ni habilitar registro. Mantener el flag false hasta aprobación.
El Compose de desarrollo no es una configuración productiva.

Cuando el frontend esté desplegado, para cambiar el destino de activación solo
se cambia `PLATFORM_ACTIVATION_URL`, por ejemplo
`https://frontend-del-proyecto.com/#/activate`, y se reinicia/recrea la API para
aplicar el entorno. No requiere cambios de código ni de credenciales SMTP por
ese cambio de URL; CORS y otros requisitos del despliegue se revisan aparte.
HTTPS es obligatorio en producción. Rotar/revocar keys desde Brevo si se filtran;
variables de entorno siguen siendo visibles a administradores Docker/hosting.

## Brevo Free: investigación, no cuenta configurada

Fuentes oficiales consultadas el **27/10/2026**:

- [Pricing](https://www.brevo.com/pricing/): Free forever, no credit card needed.
- [Límites Free](https://help.brevo.com/hc/en-us/articles/208580669): 300 envíos/día,
  sin límite temporal ni acumulación; transaccionales pueden entrar en cola de
  reintento de hasta 1000 tras agotar cuota; fuera de esa cola no se entregan.
- [SMTP](https://help.brevo.com/hc/en-us/articles/7924908994450): host
  smtp-relay.brevo.com, cuenta/SMTP key, dominio autenticado y remitente configurado.
- [Puertos/TLS](https://help.brevo.com/hc/en-us/articles/10905415650322): TLS en 587,
  alternativa 465. Esta integración exige TLS, no degrada a texto plano.
- [Remitente](https://help.brevo.com/hc/en-us/articles/208836149): verificación por
  código si no hay dominio autenticado; dominio propio recomendado y autenticación
  necesaria para requisitos Gmail/Yahoo. No se compró un dominio.

Selección técnica: SMTP compatible con Brevo Free, sin SDK/billing ni fallback.
Antes de usar una cuenta: responsable debe confirmar que permanece en Free,
sin tarjeta, recarga, upgrade ni servicios pagos. No se creó cuenta ni se
certificó una configuración comercial que no se inspeccionó. No se contrató
ningún servicio, se introdujo tarjeta ni se enviaron mensajes reales.

Supervisar saldo diario y logs de Transactional en el panel, además de estados
locales y límites de aplicación. Consumos externos de la misma cuenta no son
conocidos por este backend. Ante cuota agotada/desconocida, apagar flag y revisar
cola del proveedor antes de reenvío manual. Si SMTP rechaza, FAILED; timeout o
resultado incierto, UNKNOWN; aceptación/encolado SMTP puede ser ACCEPTED sin
entrega. No hay consulta automática de cuota ni promesa de entrega inmediata.
No se elimina el tenant, no se paga por fallback ni se reintenta automáticamente.

## Contrato y Swagger

El contrato core `platform-api.v1.yaml` se conserva. `deploymentDocument` compone
de forma controlada únicamente las cinco rutas y esquemas nuevos del aprobado;
no copia encima las 33 operaciones ni esquemas core/login. Swagger identifica
1.1.0 como implementación de rama, no release productivo habilitado. Con flag
apagado no anuncia 201/200 en altas/reenvíos. Jobs conserva su vista 503.
Las pruebas comparan 33+5, operationId únicos, referencias y conservación exacta
de las operaciones existentes. No se modificó el contrato de Flutter.

## Archivos y responsabilidades

| Archivo | Responsabilidad |
| --- | --- |
| registration.dto.ts / registration.response.ts | Entrada cerrada y proyección pública sin secretos. |
| tenant-registration.controller.ts / service.ts | Alta global, consulta y recuperación administrativa. |
| activation.controller.ts / service.ts | Canje, política inicial y completado, sin sesiones. |
| delivery.service.ts | Reserva/límites/lease/generación y aplicación condicional del resultado SMTP. |
| welcome-mail.service.ts | Plantilla y transporte sustituible con timeout/sanitización. |
| registration.persistence.ts | Transacciones, reintentos, lock y reloj de PostgreSQL. |
| activation-rate-limit.guard.ts / service.ts | Límites persistentes antes de validar DTO. |
| tenant-registration.module.ts | Composición independiente, middleware no-store. |
| ../common/config/tenant-registration.config.ts | Validación condicional centralizada. |
| ../common/openapi/tenant-registration-document.ts | Composición contractual aprobada sin reemplazar core. |
| ../../Prisma/audit-email.sql y migración nueva | Preflight, normalización, constraints y persistencia. |
| Auth/Users/seeds | Normalización y anti bypass mínimos; SEC-01 conservado. |
| *.spec.ts y ../../test/tenant-registration*.ts | Unitarias, HTTP y pruebas PostgreSQL/migración. |

## Tratamiento del trabajo parcial encontrado

1. **Preservado:** CSV local `Docs/examples/update-prospect.csv`, documentos y
   cambios no relacionados; no reset, limpieza ni borrado de trabajo ajeno.
2. **Completado:** marca de usuario, normalización, bloqueos login/JWT/Users,
   modelos iniciales, DTOs, plantilla SMTP y dependencias Nodemailer ya añadidas.
3. **Corregido:** faltaban migración, constraints/estados explícitos, tiempos de
   expedición, límites persistentes, rutas, módulo, configuración, canje/completado
   y pruebas; se añadió bloqueo interno de me/select-tenant y límite UTF-8.
4. **Reconciliado:** propuestas sustituidas se conservan rotuladas. Copias
   aprobadas intactas, incluida copia redundante bajo ADRs, como evidencia.

## Despliegue y rollback seguro (no ejecutados)

1. Completar PostgreSQL real, concurrencia, migración/colisiones, core y seguridad.
2. Auditoría de correo y respaldo; resolver colisiones con aprobación humana.
3. Aplicar migración solo tras aprobación, sin reescribir init ni reset.
4. Backend compatible con flag false; usuarios normales siguen operando y se
   bloquean pendientes incluso con flag apagado.
5. Frontend futuro: ruta pública /activate, captura temprana del fragmento y
   limpieza inmediata del historial; secreto solo en memoria; sin recursos de
   terceros, analytics/storage/logs. Canje y complete por JSON, después login.
6. Configurar cuenta Free/dominio/remitente y secretos, smoke controlado y GO del owner.
7. Solo entonces habilitar flag; no es parte de esta tarea.

Recuperación: apagar flag no detiene consulta/canje/completado de pendientes.
Para FAILED/UNKNOWN, ADMIN consulta, verifica lease/cuota y reenvía manualmente
con nueva generación. No restablecer una contraseña definitiva.

Rollback: **no volver a un backend que ignore mustChangePassword mientras haya
pendientes**. Mantener migración/tablas, desplegar revisión compatible con flag
false y recuperación disponible. No eliminar cuentas ni revertir normalización
sin plan y auditoría específica. La tabla de migraciones fallida tras colisión
se resuelve por procedimiento Prisma y revisión de DBA, nunca reset ni marca de
éxito ficticia. El SQL usa BEGIN/COMMIT y revierte cambios ante colisión.

## Evidencia y gates

Ver [registro de validación](../../Docs/Avance2/TENANT_REGISTRATION_VALIDATION.md).
Los tests PostgreSQL se añadieron pero **no se certifican sin ejecutarlos**.
SMTP real, laboratorio TLS y despliegue no se ejecutaron. No listo para producción.

Comandos desde raíz, Node 20:

```powershell
npm run prisma:generate
npm run build
npm run lint:check
npm run format:check
npm run test:unit:ci
npm run test:e2e:ci
docker compose --profile test run --build --rm test-postgres
```

No usar production/shared-dev para tests. Nunca imprimir links, tokens ni correos
de bienvenida en la consola. Las pruebas usan dobles SMTP sin enviar mensajes.
