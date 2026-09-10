# ADR-003 — Seguridad, Autenticación y Componentes Transversales

> **Alineación F4:** ADR-004-CommonBaseline.md es la decisión vigente para el baseline. El JWT es un snapshot de autorización (`sub`, `tenantId`, `platformRole`, `tenantRole`); no se consulta `UserTenant` en cada request únicamente para reconstruir el rol. Cualquier redacción histórica de este ADR que exija esa revalidación por request queda superseded por F4.

## Estado

CERRADO

## Fase

Fase 3 — Diseño de seguridad, autenticación y componentes transversales

## Fecha

2026-09-08

---

# 1. Contexto

La Plataforma SaaS requiere establecer una arquitectura de seguridad transversal antes de comenzar la implementación de los módulos funcionales.

La plataforma utiliza una arquitectura multi-tenant basada en:

Shared Database + Shared Schema + tenantId.

La aplicación cliente será desarrollada con Flutter y se comunicará con el Platform Backend mediante una API protegida con JWT Bearer.

El Platform Backend también mantiene comunicación con el Prospector Service mediante autenticación basada en API Key.

La Fase 3 tiene como objetivo cerrar las decisiones necesarias para implementar los componentes transversales de seguridad, autenticación, autorización, contexto de tenant, aislamiento de datos, logging y protección básica contra ataques de autenticación.

El objetivo de esta fase no es construir una infraestructura de seguridad excesivamente compleja, sino establecer una base segura, mantenible y suficientemente robusta para el MVP, evitando sobreingeniería que retrase la implementación funcional.

---

# 2. Decisiones heredadas

Las siguientes decisiones fueron establecidas previamente y se mantienen vigentes.

## 2.1 Autenticación Flutter → Platform API

La comunicación entre Flutter y el Platform Backend utiliza JWT mediante el esquema Bearer.

Estado: CERRADA.

---

## 2.2 Expiración del JWT

Los JWT tendrán una expiración de 8 horas.

Estado: CERRADA.

---

## 2.3 Refresh Token

No se utilizarán refresh tokens durante el MVP.

Estado: CERRADA.

---

## 2.4 OAuth2

No se utilizará OAuth2 durante el MVP.

Estado: CERRADA.

---

## 2.5 Modelo de autorización

La plataforma utilizará RBAC, Role-Based Access Control.

Estado: CERRADA.

---

## 2.6 Roles

Los roles de los usuarios de la plataforma serán:

* OWNER
* MEMBER

El rol OWNER representa al administrador de un tenant.

El rol MEMBER representa a un usuario operativo dentro del tenant.

El rol ADMIN corresponde exclusivamente a un administrador global de la plataforma y no forma parte del conjunto de roles asignables a los usuarios pertenecientes a un tenant.

Por lo tanto:

```text
Plataforma
└── ADMIN
    └── Administrador global

Tenant
├── OWNER
│   └── Administrador del tenant
│
└── MEMBER
    └── Usuario operativo
```

El rol ADMIN no pertenece al dominio de usuarios normales de los tenants.

Estado: CERRADA.

---

## 2.7 Scope de roles

Los roles OWNER y MEMBER están asociados al contexto de un tenant.

El rol ADMIN tiene alcance global sobre la plataforma y no pertenece a un tenant como rol de usuario operativo.

Estado: CERRADA.

---

## 2.8 Multi-tenancy

La plataforma utiliza:

Shared Database + Shared Schema + tenantId.

El aislamiento lógico de los datos se realizará mediante `tenantId`.

Estado: CERRADA.

---

## 2.9 Platform → Prospector Service

La comunicación entre el Platform Backend y el Prospector Service utiliza `X-API-Key`.

Estado: CERRADA.

---

## 2.10 Prospector Service → Platform

La comunicación del Prospector Service hacia el Platform Backend utiliza `X-API-Key`.

Estado: CERRADA.

---

## 2.11 Auditoría

No se implementará auditoría event-driven durante el MVP.

Se utilizará logging básico de seguridad y operación.

Estado: CERRADA.

---

## 2.12 Identificadores

Se respetará la estrategia definida en Fase 2:

* CUID para las entidades persistidas según el modelo establecido.
* UUID para jobs y eventos relacionados con los jobs cuando corresponda.

Esta decisión se mantiene alineada con el modelo de Prisma establecido para la plataforma.

Estado: CERRADA.

---

## 2.13 Idempotency-Key

Se utilizará `Idempotency-Key` conforme a la decisión establecida en Fase 2.

Estado: CERRADA.

---

# 3. Decisiones de Fase 3

# F3-01 — Algoritmo y estrategia criptográfica del JWT

## Estado

DECIDIDA — CERRADA

## Contexto

La plataforma necesita establecer el mecanismo criptográfico mediante el cual se firmarán y validarán los JWT.

Actualmente el Platform Backend es responsable de emitir y validar los tokens. No existe una necesidad arquitectónica actual de distribuir la validación criptográfica entre múltiples servicios independientes.

## Decisión

Se utilizará **HS256** para firmar los JWT.

El algoritmo utiliza un secreto compartido entre la emisión y validación del token.

## Alternativas consideradas

* HS256
* RS256
* ES256

## Justificación

Se selecciona HS256 debido a:

* simplicidad de implementación;
* menor complejidad operacional;
* adecuación al MVP;
* arquitectura centralizada de autenticación;
* ausencia de una necesidad actual de distribuir claves públicas entre múltiples consumidores del JWT.

La decisión podrá revisarse posteriormente si la arquitectura evoluciona hacia múltiples servicios que requieran validar tokens de manera independiente.

## Consecuencias

### Positivas

* Implementación sencilla.
* Menor complejidad de infraestructura.
* Fácil integración con NestJS.
* Adecuado para el MVP.

### Negativas

* El secreto de firma debe protegerse adecuadamente.
* Los componentes que puedan validar tokens necesitan acceso al secreto.
* No ofrece las ventajas de distribución de claves públicas de un algoritmo asimétrico.

## Alcance

Afecta:

* Auth Module.
* JWT generation.
* JWT validation.
* AuthGuard.
* configuración de secrets del backend.

---

# F3-02 — Claims y fuente de verdad de autorización

## Estado

DECIDIDA — CERRADA

## Contexto

El JWT necesita transportar información suficiente para identificar al usuario y mantener el contexto necesario para procesar las requests sin introducir consultas innecesarias.

Al mismo tiempo, la arquitectura multi-tenant necesita garantizar que un usuario realmente mantiene acceso al tenant indicado por el token.

## Decisión

El JWT contendrá los siguientes claims:

```text
sub
iat
exp
email
tenantId
platformRole
tenantRole
```

Donde:

* `sub` identifica al usuario.
* `iat` representa la fecha de emisión.
* `exp` representa la fecha de expiración.
* `email` identifica el correo asociado a la cuenta.
* `tenantId` representa el tenant activo o `null`.
* `platformRole` representa la autoridad global (`ADMIN`) o `null`.
* `tenantRole` representa el rol tenant-scoped (`OWNER` o `MEMBER`) o `null`.

El JWT tendrá una duración máxima de 8 horas.

## Modelo de autorización

Se utilizará un modelo híbrido.

El JWT transportará:

```text
userId
tenantId
platformRole
tenantRole
```

para permitir una autorización sencilla y eficiente.

La pertenencia se valida mediante UserTenant al iniciar sesión o seleccionar tenant. En requests posteriores se usa el snapshot JWT y se comprueba identidad activa, firma y expiración (ADR-004 §31).

La base de datos continuará siendo responsable de garantizar que:

```text
usuario
    ↓
pertenece al tenant
    ↓
puede operar sobre datos del tenant
```

El `tenantId` del JWT no será considerado una autorización suficiente por sí mismo.

## Fuente de verdad

Para el contexto inmediato de autorización:

```text
JWT
 ├── sub
 ├── tenantId
 ├── platformRole
 └── tenantRole
```

Al emitir un JWT mediante login/select-tenant se valida la pertenencia:

```text
JWT
 ↓
userId + tenantId
 ↓
UserTenant
 ↓
pertenencia válida
 ↓
operación
```

El aislamiento de datos seguirá dependiendo de `tenantId`.

## Justificación

Este modelo evita introducir consultas adicionales innecesarias para obtener el rol en cada request, manteniendo la simplicidad del MVP, con validación persistente de la relación al emitir contexto, no en cada request.

## Consecuencias

### Positivas

* Arquitectura sencilla.
* Menor cantidad de consultas para autorización basada en rol.
* El contexto del tenant está disponible desde el JWT.
* Los cambios de membresía/rol se reflejan al emitir nuevo contexto; la desactivación global del usuario se comprueba por request.
* Compatible con el modelo multi-tenant existente.

### Negativas

Un cambio de rol puede no reflejarse en un JWT ya emitido hasta su expiración, salvo que se implemente posteriormente un mecanismo adicional de invalidación o revalidación.

La pertenencia sigue la misma política snapshot; no se consulta UserTenant por request.

## Alcance

Afecta:

* Auth Module.
* JWT strategy.
* AuthGuard.
* TenantContext.
* RolesGuard.
* UserTenant.
* acceso a datos.

---

# F3-03 — Resolución y contexto del tenant

## Estado

DECIDIDA — CERRADA

## Contexto

La plataforma permite que un mismo usuario pueda pertenecer a más de un tenant.

Por ejemplo:

```text
Usuario
└── correo@example.com
    ├── Empresa A
    │   └── Tenant A
    │
    └── Empresa B
        └── Tenant B
```

El usuario debe poder operar sobre diferentes tenants manteniendo el aislamiento de información entre ellos.

## Decisión

El tenant activo forma parte del JWT.

Cuando un usuario tiene acceso a múltiples tenants, podrá seleccionar el tenant con el que desea trabajar.

El endpoint:

```text
POST /auth/select-tenant
```

será utilizado para establecer el tenant activo.

La selección de un tenant requiere la emisión de un JWT correspondiente al nuevo contexto.

## Validación

El backend deberá validar que:

```text
userId + tenantId
```

corresponden a una relación activa en `UserTenant`.

El `tenantId` no será aceptado como una autoridad proveniente directamente del cliente.

## Cambio de tenant

Cambiar de tenant implica cambiar el contexto de autorización.

Por lo tanto, se emitirá un nuevo JWT con el nuevo:

```text
tenantId
tenantRole
```

correspondiente al contexto seleccionado.

Un `ADMIN` global puede autenticarse sin registros en `UserTenant` y sin tenant seleccionado. En ese caso, el JWT contiene `platformRole = ADMIN`, `tenantId = null` y `tenantRole = null`. Si selecciona un tenant con autoridad global, conserva `platformRole = ADMIN`; la selección no lo convierte en `OWNER` ni `MEMBER`.

## Pertenencia eliminada o desactivada

F4 supersede la revocación inmediata por membership: los tokens emitidos conservan su snapshot hasta expirar; nuevos login/select-tenant consultan la relación vigente. Un usuario globalmente INACTIVO se rechaza por request.

## Suspensión del tenant

Login y select-tenant rechazan tenants suspendidos. F4 no agrega revalidación transversal de UserTenant por request.

## Manipulación del tenantId

El cliente no podrá seleccionar arbitrariamente un `tenantId` para obtener acceso.

El tenant proviene del snapshot autenticado; al seleccionarlo se valida UserTenant o autoridad global ADMIN.

## Justificación

Esta estrategia permite soportar usuarios pertenecientes a múltiples empresas sin duplicar innecesariamente cuentas globales y mantiene el aislamiento de información por tenant.

## Consecuencias

### Positivas

* Soporte para usuarios multi-tenant.
* Contexto de tenant explícito.
* Aislamiento de información.
* Implementación relativamente sencilla.
* Compatible con JWT.

### Negativas

* El cambio de tenant requiere generar un nuevo JWT.
* La pertenencia al tenant debe validarse.
* El flujo de autenticación debe contemplar usuarios con uno o múltiples tenants.

## Alcance

Afecta:

* Auth Module.
* `UserTenant`.
* JWT.
* TenantContext.
* AuthGuard.
* acceso a datos.

---

# F3-04 — Arquitectura transversal de autenticación y autorización en NestJS

## Estado

DECIDIDA — CERRADA

## Contexto

La autenticación y autorización deben aplicarse de manera transversal para evitar depender de que cada desarrollador recuerde proteger manualmente cada endpoint.

## Decisión

Se utilizará una arquitectura basada en guards globales.

El flujo será:

```text
Request
   ↓
Global AuthGuard
   ↓
¿@Public()?
   ├── Sí → Controller
   │
   └── No
       ↓
   JWT validation
       ↓
   TenantContext
       ↓
   RolesGuard
       ↓
   @Roles(...)
       ↓
   Controller
```

Los endpoints que no requieran autenticación podrán declararse mediante `@Public()`.

Los endpoints que requieran autorización basada en roles utilizarán `@Roles(...)`.

## Componentes

Se utilizarán:

* AuthGuard global.
* `@Public()`.
* TenantContext.
* RolesGuard.
* `@Roles(...)`.

## Justificación

Esta arquitectura proporciona una aplicación transversal de las políticas de seguridad y mantiene los controladores limpios.

También reduce el riesgo de que un endpoint quede accidentalmente sin protección.

## Consecuencias

### Positivas

* Seguridad centralizada.
* Menor duplicación.
* Control declarativo.
* Fácil extensión.
* Compatible con NestJS.

### Negativas

* Los desarrolladores deberán comprender correctamente los decorators y guards.
* Los endpoints públicos deberán marcarse explícitamente.

## Alcance

Afecta al Common Module y a todos los módulos protegidos del Platform Backend.

---

# F3-05 — Estrategia de aislamiento multi-tenant en acceso a datos

## Estado

DECIDIDA — CERRADA

## Contexto

El modelo multi-tenant utiliza una base de datos y schema compartidos.

Por ello, el aislamiento lógico debe garantizar que una request autenticada para un tenant no pueda acceder accidentalmente a información perteneciente a otro.

## Decisión

Se utilizará un **TenantContext transversal**.

Los servicios y/o repositorios que trabajen con información multi-tenant deberán operar dentro del contexto del tenant autenticado.

El `tenantId` utilizado para las operaciones no deberá depender de un valor arbitrario enviado por el cliente.

El contexto se deriva del JWT validado. UserTenant se consulta al emitir contexto; ADMIN global puede operar sin membership.

## Principio

Toda operación multi-tenant deberá respetar:

```text
Request
 ↓
Authenticated User
 ↓
TenantContext
 ↓
tenantId autorizado
 ↓
Data Access
 ↓
tenantId isolation
```

## Justificación

La solución proporciona transversalidad suficiente para evitar depender exclusivamente de disciplina manual, sin introducir una infraestructura excesivamente compleja.

Se prioriza:

* simplicidad;
* seguridad;
* mantenibilidad;
* velocidad de implementación.

## Consecuencias

### Positivas

* Reduce riesgo de fuga entre tenants.
* Centraliza el contexto.
* Evita depender directamente de parámetros enviados por el cliente.
* Permite dejar la infraestructura preparada para los módulos funcionales.

### Negativas

* Los servicios y repositorios deben respetar el TenantContext.
* Se requiere disciplina en la capa de acceso a datos.
* La solución no pretende proporcionar aislamiento físico de base de datos.

Las operaciones globales de `ADMIN` no requieren un tenant seleccionado, pero las operaciones tenant-scoped deben exigir explícitamente un `tenantId` válido.

## Alcance

Afecta:

* Common Module.
* TenantContext.
* Services.
* Repositories.
* Prisma.
* Todos los módulos multi-tenant.

---

# F3-06 — Password hashing y política de credenciales

## Estado

DECIDIDA — CERRADA

## Contexto

La plataforma necesita almacenar contraseñas de forma segura y establecer una política mínima de credenciales.

## Decisión

Se utilizará:

```text
bcrypt
cost factor = 12
```

Las contraseñas deberán cumplir una política mínima:

* mínimo 10 caracteres;
* al menos un número;
* al menos un carácter alfanumérico o especial adicional según la política definida.

Ante credenciales inválidas, la API deberá evitar revelar si el usuario existe.

## Respuesta de autenticación

Se utilizará un error genérico de autenticación.

No se deberá distinguir públicamente entre:

* usuario inexistente;
* correo incorrecto;
* contraseña incorrecta.

## Justificación

bcrypt ya forma parte de la experiencia técnica del equipo y permite implementar un mecanismo suficientemente robusto para el MVP sin añadir complejidad innecesaria.

## Consecuencias

### Positivas

* Implementación sencilla.
* Tecnología conocida por el equipo.
* Hashing resistente a ataques de fuerza bruta en comparación con algoritmos rápidos.
* Reduce enumeración de usuarios.

### Negativas

* El cost factor introduce consumo computacional durante autenticación.
* La política de contraseñas es deliberadamente sencilla y puede endurecerse posteriormente.

## Alcance

Afecta:

* Auth Module.
* creación de usuarios;
* login;
* almacenamiento de credenciales;
* validación de credenciales.

---

# F3-07 — Protección contra brute force y rate limiting

## Estado

DECIDIDA — CERRADA

## Contexto

Los endpoints de autenticación pueden ser objetivo de ataques automatizados de fuerza bruta.

El MVP necesita una protección básica sin introducir infraestructura adicional.

## Decisión

Se implementará rate limiting para los endpoints de autenticación.

La política será:

```text
Máximo:
5 intentos

Ventana:
1 minuto

Scope:
IP
```

No se implementará bloqueo temporal por cuenta.

El estado del rate limiting se almacenará en memoria del proceso durante el MVP.

## Justificación

Se busca una protección básica contra ataques automatizados manteniendo la infraestructura sencilla.

No se introduce almacenamiento externo como Redis durante esta fase debido a que no es necesario para los requerimientos actuales del MVP.

## Consecuencias

### Positivas

* Protección básica contra brute force.
* Implementación sencilla.
* Sin dependencia adicional de infraestructura.

### Negativas

* El estado se pierde cuando reinicia el proceso.
* No existe coordinación entre múltiples instancias.
* Un despliegue multi-instancia requeriría revisar esta estrategia.

## Alcance

Afecta principalmente:

* Auth Module.
* endpoints de autenticación.

---

# F3-08 — Logging y trazabilidad de seguridad

## Estado

DECIDIDA — CERRADA

## Contexto

La plataforma necesita registrar eventos relevantes de seguridad y operación sin implementar un sistema completo de auditoría event-driven.

## Decisión

Se registrarán los siguientes eventos:

* login exitoso;
* login fallido;
* acceso rechazado por autorización;
* logout;
* peticiones al servicio externo.

No se implementarán eventos adicionales de auditoría durante el MVP salvo que sean necesarios operacionalmente.

## Campos

Los logs podrán incluir:

* `requestId`;
* `userId`;
* `tenantId`;
* IP;
* User-Agent;
* resultado;
* código de error o ejecución;
* timestamp;
* endpoint;
* método HTTP.

El `tenantId` deberá tratarse como información de contexto y no deberá exponerse innecesariamente en respuestas públicas.

## Información prohibida en logs

Nunca se registrarán:

* password;
* password hash;
* JWT;
* API Key;
* secrets.

## Request ID

Se utilizará `requestId` como identificador transversal de la request.

No se implementará un concepto separado de `CorrelationId` para cumplir la misma función.

## Justificación

La solución proporciona trazabilidad suficiente para el MVP y mantiene consistencia con el patrón de logging transversal ya utilizado en proyectos anteriores del equipo.

## Consecuencias

### Positivas

* Facilita debugging.
* Permite correlacionar requests.
* Proporciona trazabilidad básica de seguridad.
* Evita implementar auditoría compleja.

### Negativas

* No constituye un sistema completo de auditoría.
* La retención y análisis avanzado de logs quedan fuera del alcance del MVP.

## Alcance

Afecta:

* Common Module.
* Auth Module.
* comunicación con Prospector Service.
* middleware/interceptors de request.
* sistema de logging.

---

# F3-09 — Seguridad de endpoints transversales

## Estado

DECIDIDA — CERRADA

## Contexto

Los endpoints transversales requieren diferentes mecanismos de protección dependiendo de su función.

## Decisión

### Health checks

Los siguientes endpoints serán públicos:

```text
/health
/health/live
/health/ready
```

No requieren JWT.

Su finalidad es permitir que infraestructura y mecanismos de monitoreo comprueben el estado del servicio.

### Login

```text
/auth/login
```

Será público.

El usuario necesita poder iniciar el proceso de autenticación sin disponer previamente de un JWT.

### Logout

```text
/auth/logout
```

Requiere JWT.

### Select tenant

```text
/auth/select-tenant
```

Requiere JWT.

Su función es establecer el contexto de tenant cuando el usuario dispone de acceso a múltiples tenants.

### Me

```text
/auth/me
```

Requiere JWT.

### Endpoints internos

Los endpoints destinados exclusivamente a comunicación servicio-a-servicio deberán utilizar el mecanismo de autenticación correspondiente a la arquitectura de servicios.

En particular, las comunicaciones entre Platform Backend y Prospector Service utilizarán `X-API-Key`.

## Resumen

| Endpoint                      | Protección |
| ----------------------------- | ---------- |
| `/health`                     | Público    |
| `/health/live`                | Público    |
| `/health/ready`               | Público    |
| `/auth/login`                 | Público    |
| `/auth/logout`                | JWT        |
| `/auth/select-tenant`         | JWT        |
| `/auth/me`                    | JWT        |
| Endpoints servicio-a-servicio | API Key    |

## Justificación

Cada endpoint utiliza el mecanismo mínimo necesario para cumplir su función.

Los health checks permanecen públicos para facilitar operación y monitoreo.

Los endpoints de autenticación que requieren identidad utilizan JWT.

La comunicación entre servicios utiliza API Key.

## Alcance

Afecta:

* Auth Module.
* Common Module.
* Health checks.
* comunicación Platform ↔ Prospector.

---

# F3-10 — Logout JWT

## Estado

DECIDIDA — CERRADA

## Contexto

La plataforma utiliza JWT sin refresh tokens durante el MVP.

No se requiere implementar un mecanismo complejo de revocación server-side.

## Decisión

El logout será **stateless**.

El flujo será:

```text
Flutter
   ↓
POST /auth/logout
   ↓
Platform API
   ↓
200 OK
   ↓
Flutter elimina JWT
```

El backend no mantendrá una blacklist de tokens ni un sistema de revocación individual durante el MVP.

## Justificación

La decisión es coherente con:

* JWT;
* expiración de 8 horas;
* ausencia de refresh tokens;
* prioridad de simplicidad del MVP.

## Consecuencias

### Positivas

* Implementación muy sencilla.
* No requiere almacenamiento de tokens revocados.
* Menor complejidad operacional.

### Negativas

Un JWT robado continuará siendo técnicamente válido hasta su expiración o hasta que la validación contextual del usuario/tenant determine que ya no tiene autorización.

La protección contra robo de tokens depende de la seguridad del cliente y del transporte.

## Alcance

Afecta:

* Auth Module.
* endpoint `/auth/logout`.
* cliente Flutter.

---

# 4. Decisiones deliberadamente fuera del ADR como decisiones independientes

Los siguientes elementos no constituyen decisiones arquitectónicas independientes de Fase 3.

## 4.1 flutter_secure_storage

La utilización de almacenamiento seguro para el JWT es responsabilidad de la aplicación Flutter.

No forma parte de la arquitectura interna del Platform Backend.

---

## 4.2 Orden exacto de guards

El orden general se deriva de la arquitectura definida:

```text
Authentication
↓
Tenant Context
↓
Authorization
```

No se mantiene como una decisión independiente.

---

## 4.3 Decoradores y estructura básica de NestJS

Elementos como:

```text
@Injectable()
@Module()
```

son detalles de implementación.

---

## 4.4 Helmet

Helmet se considera una medida de hardening de implementación y no requiere un ADR independiente.

---

## 4.5 ValidationPipe

La validación mediante `ValidationPipe` se considera estándar de implementación.

---

## 4.6 CSRF

No se considera una preocupación central para el mecanismo de autenticación seleccionado, basado en Bearer JWT y sin autenticación de sesión mediante cookies.

---

## 4.7 CORS

CORS deberá configurarse de acuerdo con la arquitectura de deployment y los consumidores reales de la API.

No requiere una decisión arquitectónica independiente en este ADR.

---

## 4.8 Correlation ID

Se utilizará `requestId`.

No se implementará un segundo identificador transversal equivalente.

---

## 4.9 403 vs 404

La decisión sobre códigos HTTP ante recursos no accesibles deberá respetar la política general de autorización y aislamiento multi-tenant.

No se considera una decisión independiente de arquitectura.

---

# 5. Resumen arquitectónico resultante

La arquitectura de seguridad de Fase 3 queda definida de la siguiente manera:

```text
                         ┌─────────────────┐
                         │  Flutter Client  │
                         └────────┬────────┘
                                  │
                              JWT Bearer
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │    Platform Backend     │
                    │        NestJS            │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    Global AuthGuard      │
                    └────────────┬────────────┘
                                 │
                         JWT validation
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │      TenantContext       │
                    │                           │
                    │ userId                    │
                    │ tenantId                  │
                    │ role                      │
                    └────────────┬────────────┘
                                 │
               Snapshot JWT autenticado
                         validation
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │       RolesGuard         │
                    │                           │
                    │ tenantRole / platformRole│
                    └────────────┬────────────┘
                                 │
                                 ▼
                         Controller / Service
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │   Tenant-aware Data      │
                    │        Access            │
                    │                           │
                    │ tenantId isolation       │
                    └────────────┬────────────┘
                                 │
                                 ▼
                           PostgreSQL
```

Para comunicación con el Prospector Service:

```text
Platform Backend
       │
       │ X-API-Key
       ▼
Prospector Service
       │
       │ X-API-Key
       ▼
Platform Backend
```

---

# 6. Flujo de autenticación

## Usuario con un solo tenant

```text
Flutter
   ↓
POST /auth/login
   ↓
Validación de credenciales
   ↓
Usuario identificado
   ↓
Tenant asociado
   ↓
JWT
   ├── sub
   ├── iat
   ├── exp
   ├── email
   ├── tenantId
   └── role
   ↓
Flutter
```

## Usuario con múltiples tenants

```text
Flutter
   ↓
POST /auth/login
   ↓
Validación de credenciales
   ↓
Usuario identificado
   ↓
Se detectan múltiples tenants
   ↓
Selección de tenant
   ↓
POST /auth/select-tenant
   ↓
Snapshot JWT validado (UserTenant al emitir contexto)
   ↓
Nuevo JWT
   ├── sub
   ├── iat
   ├── exp
   ├── email
   ├── tenantId
   └── role
   ↓
Acceso al tenant seleccionado
```

---

# 7. Principios de implementación

La implementación de Fase 3 deberá respetar los siguientes principios:

1. El cliente nunca determina unilateralmente el tenant sobre el que puede operar.

2. El `tenantId` utilizado para autorización debe provenir del contexto autenticado.

3. UserTenant valida la pertenencia al emitir contexto en login/select-tenant, no por request.

4. Toda operación de datos multi-tenant debe respetar el aislamiento por `tenantId`.

5. El rol del JWT se utilizará para autorización durante el MVP.

6. No se introducirán refresh tokens, blacklist de JWT, OAuth2 ni infraestructura equivalente no requerida.

7. Los secretos no deberán aparecer en logs.

8. La autenticación deberá aplicarse transversalmente mediante guards.

9. Los endpoints públicos deberán estar explícitamente identificados.

10. La implementación deberá priorizar seguridad, funcionalidad y mantenibilidad evitando sobreingeniería.

---

# 8. Componentes que deberán quedar preparados

Como consecuencia de este ADR, el trabajo de implementación transversal deberá dejar preparados como mínimo:

```text
Common
├── RequestId
├── Logging
├── TenantContext
├── Guards
│   ├── AuthGuard
│   └── RolesGuard
├── Decorators
│   ├── @Public()
│   └── @Roles()
└── manejo transversal correspondiente

Auth
├── Login
├── Logout
├── Select Tenant
├── Me
├── JWT
├── bcrypt
└── Rate Limiting

Users
├── User
├── UserTenant
└── roles

Data Access
└── Tenant-aware access
```

La estructura exacta de carpetas y clases queda como decisión de implementación y no como parte del diseño arquitectónico.

---

# 9. Consecuencias generales del ADR

## Positivas

La arquitectura resultante proporciona:

* autenticación JWT;
* autorización RBAC;
* contexto de tenant;
* soporte para usuarios multi-tenant;
* aislamiento lógico de información;
* protección básica contra brute force;
* logging de seguridad;
* comunicación autenticada entre servicios;
* logout stateless;
* infraestructura transversal reutilizable;
* una implementación adecuada para el alcance del MVP.

## Negativas y limitaciones conocidas

La arquitectura deliberadamente mantiene algunas limitaciones:

* los JWT tienen una duración de hasta 8 horas;
* un cambio de rol puede no reflejarse inmediatamente en un JWT ya emitido;
* el rate limiting en memoria no es adecuado para múltiples instancias coordinadas;
* no existe revocación individual de JWT;
* no existe auditoría event-driven;
* no existe OAuth2;
* no existe refresh token;
* el aislamiento es lógico dentro de un schema compartido.

Estas limitaciones son aceptadas para el MVP y podrán revisarse mediante nuevos ADR cuando los requerimientos evolucionen.

---

# 10. Estado final

Todas las decisiones de Fase 3 definidas en este documento quedan:

**CERRADAS**

Decisiones cerradas:

* F3-01 — Algoritmo JWT.
* F3-02 — Claims y fuente de verdad.
* F3-03 — Resolución y contexto de tenant.
* F3-04 — Arquitectura transversal Auth/RBAC.
* F3-05 — Aislamiento multi-tenant.
* F3-06 — Password hashing y política de credenciales.
* F3-07 — Brute force y rate limiting.
* F3-08 — Logging y trazabilidad.
* F3-09 — Seguridad de endpoints transversales.
* F3-10 — Logout JWT.

A partir de este ADR, estas decisiones deben considerarse **congeladas para la implementación del MVP**, salvo que aparezca un requerimiento nuevo o una incompatibilidad técnica que justifique abrir una nueva decisión arquitectónica.

El siguiente paso corresponde a implementación y validación, no a continuar ampliando indefinidamente el diseño.
