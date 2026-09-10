# ADR-002 — Contratos de API, integración y modelo persistente

**Estado:** CERRADA CON CORRECCIONES MENORES
**Fecha:** 7 de septiembre de 2026
**Áreas:** Flutter / Platform Backend / Prospector Service

---

## 1. Contexto

La plataforma está compuesta por:

```text
Flutter
   │
   │ HTTPS + JWT
   ▼
Platform Backend
(NestJS + Prisma + PostgreSQL)
   │
   │ HTTP interno + API Key
   ▼
Prospector Service
(Python + FastAPI)
   │
   ▼
Prospector Engine
(Python)
```

La plataforma necesita establecer contratos estables entre Flutter, Platform Backend y Prospector Service, al mismo tiempo que mantiene un modelo persistente coherente con el esquema Prisma aprobado para el proyecto.

Durante el diseño se identificó un riesgo importante:

> Confundir los objetos utilizados para comunicación mediante API con los modelos utilizados para persistencia.

Por lo tanto, este ADR establece explícitamente que **API Contract, Integration DTO y Persistent Model son capas conceptualmente distintas**.

---

# 2. Decisión

Se establecen tres niveles independientes:

```text
┌──────────────────────────────────────────────┐
│              API CONTRACT                    │
│                                              │
│  Request DTOs                                │
│  Response DTOs                               │
│  Error DTOs                                  │
│  Callback Events                             │
│  Export representations                      │
└──────────────────────┬───────────────────────┘
                       │
                       │ mapping
                       ▼
┌──────────────────────────────────────────────┐
│           APPLICATION / INTEGRATION          │
│                                              │
│  BusinessResult                              │
│  PipelineProgress                            │
│  JobSummary                                  │
│  JobDetail                                   │
│  Service Events                              │
└──────────────────────┬───────────────────────┘
                       │
                       │ mapping
                       ▼
┌──────────────────────────────────────────────┐
│             PERSISTENT MODEL                 │
│                                              │
│  Prisma Models                               │
│  PostgreSQL                                  │
│                                              │
│  Tenant                                      │
│  User                                        │
│  UserTenant                                  │
│  Role                                        │
│  Campaign                                    │
│  Prospect                                    │
│  CampaignProspect                            │
│  ProspectingJob                              │
└──────────────────────────────────────────────┘
```

### Regla normativa

**Un cambio en un DTO o contrato de API no implica automáticamente un cambio en Prisma.**

**Un cambio en Prisma no implica automáticamente un cambio en el contrato público de la API.**

Cuando ambos necesitan evolucionar, se debe definir explícitamente el mapping entre ellos.

---

# 3. Modelo persistente vs contrato de API

## 3.1 Modelo persistente

El **modelo persistente** representa exclusivamente aquello que debe almacenarse en PostgreSQL.

La fuente de verdad para esta capa es el esquema Prisma congelado del proyecto.

Los modelos persistentes son:

```text
Tenant
User
UserTenant
Role
Campaign
Prospect
CampaignProspect
ProspectingJob
```

Este ADR **no agrega modelos persistentes adicionales**.

Particularmente:

```text
BusinessResult
PipelineProgress
ProspectingJobSummary
ProspectingJobDetail
CallbackEvent
```

**NO son modelos Prisma.**

Son estructuras de aplicación/integración/API.

---

## 3.2 Contrato de API

El **contrato de API** define cómo los componentes se comunican.

Incluye:

* Requests.
* Responses.
* DTOs.
* códigos HTTP.
* errores.
* paginación.
* filtros.
* eventos.
* callbacks.
* autenticación entre componentes.
* formatos de exportación.

Los contratos pueden presentar una estructura diferente al modelo persistente siempre que exista un mapping definido.

---

## 3.3 Regla de exposición

Los modelos Prisma **no se exponen directamente como respuesta pública de API**.

El flujo esperado es:

```text
Prisma Model
     │
     ▼
Application mapping
     │
     ▼
Response DTO
     │
     ▼
API
```

Esto evita acoplar directamente la API pública a la estructura interna de PostgreSQL.

---

# 4. Persistencia — modelo aprobado

El modelo persistente aprobado es el siguiente.

## 4.1 Tenant

```text
Tenant
- id
- name
- slug
- status
- createdAt
- updatedAt
```

`slug` es único globalmente.

---

## 4.2 User

```text
User
- id
- name
- email
- passwordHash
- platformRole (nullable; ADMIN global)
- status
- createdAt
- updatedAt
```

`email` es único globalmente.

La API puede recibir:

```json
{
  "name": "Carlos",
  "email": "carlos@example.com",
  "password": "..."
}
```

pero la persistencia utiliza:

```text
passwordHash
```

El `passwordHash` **nunca forma parte de una respuesta pública de API**.

---

## 4.3 UserTenant

Representa la pertenencia de un usuario a un tenant.

```text
UserTenant
- userId
- tenantId
- roleId
- joinedAt
```

La clave primaria es:

```text
(userId, tenantId)
```

---

## 4.4 Role

```text
Role
- id
- tenantId
- name
- description
- createdAt
- updatedAt
```

Los roles tenant-scoped disponibles son (ADMIN pertenece a User.platformRole):

```text
OWNER
MEMBER
```

La combinación:

```text
(tenantId, name)
```

es única.

**Nota:** aunque `Role` está asociado a un tenant, `UserTenant` mantiene directamente `roleId`. `User.platformRole` representa únicamente la autoridad global `ADMIN`. La resolución y validación de pertenencia pertenece a la lógica de aplicación y seguridad.

---

## 4.5 Campaign

```text
Campaign
- id
- tenantId
- createdBy
- name
- description
- status
- createdAt
- updatedAt
```

Una campaña pertenece a un tenant y mantiene referencia a su creador.

---

## 4.6 Prospect

El modelo persistente de prospecto es:

```text
Prospect
- id
- tenantId
- campaignId
- name
- category
- address
- phone
- email
- website
- source
- sourceIdentifier
- language
- status
- metadata
- createdAt
- updatedAt
```

No se agregan campos persistentes adicionales en este ADR.

En particular, los siguientes campos **no forman parte del modelo Prisma aprobado**:

```text
websiteTitle
websiteDescription
websiteStatus
```

Si una implementación futura necesita manejar dichos datos temporalmente, deberán pertenecer a un DTO o estructura de integración y **no deben asumirse como campos persistentes** sin modificar formalmente el esquema Prisma.

---

## 4.7 CampaignProspect

```text
CampaignProspect
- campaignId
- prospectId
- status
- addedAt
```

Su clave primaria es:

```text
(campaignId, prospectId)
```

`status` permanece como `String`, de acuerdo con el modelo Prisma congelado.

---

## 4.8 ProspectingJob

El modelo persistente de ejecución es:

```text
ProspectingJob
- id
- tenantId
- campaignId
- requestedBy
- status
- query
- requestedLimit
- startedAt
- completedAt
- error
- createdAt
- updatedAt
```

Estados:

```text
QUEUED
RUNNING
COMPLETED
FAILED
CANCELLED
```

`query` se almacena como JSON.

Para el MVP, su estructura contractual es:

```json
{
  "keyword": "restaurantes",
  "location": "Tijuana, Baja California",
  "source": "google_maps",
  "limit": 50
}
```

La estructura anterior representa el **contrato lógico del contenido de `query`**; no convierte sus propiedades en columnas individuales de PostgreSQL.

---

# 5. Contrato de API

## 5.1 Convenciones

Las APIs utilizan:

* Recursos en plural.
* kebab-case.
* HTTP verbs estándar.
* JSON.
* UTF-8.
* Fechas ISO 8601 en UTC.
* IDs CUID para entidades persistentes.
* `eventId` UUID para eventos.
* Versionado mediante URL.

Ejemplo:

```text
/api/v1/campaigns
/api/v1/prospects
/api/v1/prospecting-jobs
```

La fuente utilizada en el MVP es:

```text
google_maps
```

---

# 6. Respuesta estándar

Las respuestas JSON utilizan:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

Las respuestas paginadas utilizan:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

Las respuestas binarias, como CSV/XLSX, quedan fuera de este wrapper.

---

# 7. Contrato de error

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Descripción del error",
    "details": {},
    "timestamp": "2026-09-07T12:00:00Z"
  }
}
```

---

# 8. Códigos HTTP

Se establecen como mínimo:

```text
200 OK
201 Created
202 Accepted
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
500 Internal Server Error
503 Service Unavailable
```

---

# 9. Paginación

Para recursos paginables:

```text
page
limit
```

Reglas:

```text
page = 1-based
limit default = 20
limit maximum = 100
```

Aplicable inicialmente a:

```text
users
campaigns
prospects
prospecting-jobs
campaign prospects
```

---

# 10. Filtros y búsqueda

Los filtros se combinan mediante:

```text
AND
```

Se permite:

```text
sortBy
sortOrder
search
```

La búsqueda simple se limita inicialmente a:

```text
users
campaigns
prospects
```

No se establece full-text search en esta fase.

---

# 11. API de Platform Backend

## 11.1 Authentication

```text
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/select-tenant
GET  /api/v1/auth/me
```

Flutter utiliza JWT Bearer para comunicarse con Platform Backend.

---

## 11.2 Tenants

```text
GET  /api/v1/tenants
POST /api/v1/tenants
GET  /api/v1/tenants/{id}
```

---

## 11.3 Users

```text
GET    /api/v1/users
POST   /api/v1/users
GET    /api/v1/users/{id}
PATCH  /api/v1/users/{id}
DELETE /api/v1/users/{id}
```

`DELETE /api/v1/users/{id}` desactiva un usuario estableciendo su estado en `INACTIVO`. La eliminación física, cuando corresponda según las reglas de autorización definidas, está restringida al rol `ADMIN`.

---

## 11.4 Campaigns

```text
GET    /api/v1/campaigns
POST   /api/v1/campaigns
GET    /api/v1/campaigns/{id}
PATCH  /api/v1/campaigns/{id}
DELETE /api/v1/campaigns/{id}
```

Prospectos de campaña:

```text
GET /api/v1/campaigns/{id}/prospects
```

---

## 11.5 Prospects

```text
GET   /api/v1/prospects
GET   /api/v1/prospects/{id}
PATCH /api/v1/prospects/{id}
```

---

# 12. Prospecting Jobs

## 12.1 Creación

```text
POST /api/v1/prospecting-jobs
```

Platform Backend es el propietario del Job.

Flutter **no crea Jobs directamente en Prospector Service**.

Flujo:

```text
Flutter
   │
   │ POST /prospecting-jobs
   ▼
Platform Backend
   │
   │ crea ProspectingJob
   │ status = QUEUED
   ▼
PostgreSQL
   │
   │
   ▼
Prospector Service
```

El `jobId` corresponde al `ProspectingJob.id` generado por Platform.

---

# 13. Contrato de Job vs modelo persistente

El recurso expuesto por API puede representarse como:

```typescript
interface ProspectingJobSummary {
  id: string;
  campaignId: string;
  status:
    | "QUEUED"
    | "RUNNING"
    | "COMPLETED"
    | "FAILED"
    | "CANCELLED";
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}
```

En el contrato OpenAPI, `startedAt` y `completedAt` se definen explícitamente como valores `date-time` nullable. Un Job en estado `QUEUED` todavía no tiene fecha de inicio, y `completedAt` solo adquiere valor cuando la ejecución llega a un estado terminal.

Este objeto es un **Response DTO**.

No es un modelo Prisma.

El modelo Prisma contiene además información interna como:

```text
tenantId
requestedBy
query
requestedLimit
error
updatedAt
```

La API puede decidir qué información exponer dependiendo del endpoint.

---

# 14. Job Detail

El contrato de detalle puede contener:

```typescript
interface ProspectingJobDetail {
  id: string;
  tenantId: string;
  campaignId: string;
  requestedBy: string;
  status:
    | "QUEUED"
    | "RUNNING"
    | "COMPLETED"
    | "FAILED"
    | "CANCELLED";
  query: {
    keyword: string;
    location: string;
    source: "google_maps";
    limit: number;
  };
  requestedLimit: number | null;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  resultsAvailable: boolean;
  results: BusinessResult[] | null;
  progress: PipelineProgress | null;
}
```

Este objeto **no representa directamente la tabla `ProspectingJob`**.

`results`, `resultsAvailable` y `progress` son información de aplicación/integración asociada temporalmente al Job.

---

# 15. BusinessResult — contrato de integración

`BusinessResult` representa un resultado producido por Prospector Service.

Para mantenerlo alineado con el modelo persistente aprobado, su forma base será:

```typescript
interface BusinessResult {
  name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  source: "google_maps";
  sourceIdentifier: string | null;
  language: string | null;
  metadata: Record<string, unknown> | null;
}
```

**BusinessResult NO es un modelo persistente.**

Es un DTO de integración.

Su responsabilidad es transportar datos entre:

```text
Prospector Service
        ↓
Platform Backend
        ↓
Flutter
```

---

# 16. Mapping BusinessResult → Prospect

Cuando el usuario decide persistir resultados:

```text
BusinessResult
      │
      │ mapping
      ▼
Prospect
```

El mapping conceptual es:

```text
BusinessResult.name
        → Prospect.name

BusinessResult.category
        → Prospect.category

BusinessResult.address
        → Prospect.address

BusinessResult.phone
        → Prospect.phone

BusinessResult.email
        → Prospect.email

BusinessResult.website
        → Prospect.website

BusinessResult.source
        → Prospect.source

BusinessResult.sourceIdentifier
        → Prospect.sourceIdentifier

BusinessResult.language
        → Prospect.language

BusinessResult.metadata
        → Prospect.metadata
```

Los campos:

```text
tenantId
campaignId
status
createdAt
updatedAt
```

son determinados por Platform Backend durante la persistencia.

No son responsabilidad de Prospector Service.

---

# 17. Resultados temporales

Los resultados de un Job completado son temporales.

No existe en el modelo persistente MVP una tabla:

```text
ProspectingResult
```

El flujo es:

```text
Prospector Service
       │
       │ resultados
       ▼
Platform Backend
       │
       │ cache temporal
       ▼
ProspectingJob
       │
       ├── consultar
       ├── persistir
       ├── exportar
       └── descartar
```

La estrategia concreta de cache, TTL y almacenamiento se definirá durante la implementación.

---

# 18. Persistencia de resultados

Cuando el usuario solicita persistir resultados:

```text
BusinessResult
       │
       ▼
duplicate detection
       │
       ▼
Prospect
       │
       ▼
CampaignProspect
```

La identidad de duplicidad definida por el modelo persistente es:

```text
tenantId
campaignId
source
sourceIdentifier
```

correspondiente a:

```prisma
@@unique([tenantId, campaignId, source, sourceIdentifier])
```

### Importante

Debido a que `sourceIdentifier` es nullable y PostgreSQL permite múltiples valores `NULL` en una restricción `UNIQUE`, esta restricción **no garantiza por sí sola la detección universal de duplicados cuando `sourceIdentifier` es NULL**.

La lógica de aplicación deberá manejar ese caso explícitamente.

---

# 19. CampaignProspect

Después de crear o identificar el `Prospect`, Platform crea la relación:

```text
CampaignProspect
```

con:

```text
campaignId
prospectId
status
addedAt
```

La relación no se crea desde Prospector Service.

---

# 20. Exportación

Los resultados persistidos o disponibles para exportación pueden solicitarse mediante:

```text
GET /api/v1/prospecting-jobs/{id}/export?format=csv
GET /api/v1/prospecting-jobs/{id}/export?format=xlsx
```

Formatos MVP:

```text
CSV
XLSX
```

Las respuestas de exportación son binarias y no utilizan el wrapper JSON estándar.

---

# 21. API interna — Platform → Prospector Service

Endpoint:

```text
POST /api/v1/prospecting/jobs
```

Esta API es interna.

Platform autentica ante Service mediante:

```text
X-API-Key
```

El request contiene conceptualmente:

```json
{
  "jobId": "ck...",
  "tenantId": "ck...",
  "query": {
    "keyword": "restaurantes",
    "location": "Tijuana",
    "source": "google_maps",
    "limit": 50
  },
  "callbackUrl": "/api/v1/internal/prospecting-jobs/ck.../events"
}
```

El Service responde:

```json
{
  "success": true,
  "data": {
    "jobId": "ck...",
    "status": "QUEUED",
    "acceptedAt": "2026-09-07T12:00:00Z"
  },
  "meta": {}
}
```

HTTP:

```text
202 Accepted
```

---

# 22. Callback — Prospector Service → Platform

Endpoint:

```text
POST /api/v1/internal/prospecting-jobs/{jobId}/events
```

Platform autentica el callback proveniente de Service mediante credencial interna.

El evento contiene:

```typescript
interface ProspectingJobEvent {
  eventId: string;
  jobId: string;
  sequence: number;
  status:
    | "QUEUED"
    | "RUNNING"
    | "COMPLETED"
    | "FAILED"
    | "CANCELLED";
  progress: PipelineProgress | null;
  timestamp: string;
  results: BusinessResult[] | null;
  error: {
    code: string;
    message: string;
  } | null;
}
```

`eventId` es UUID.

`sequence` permite ordenar eventos y evitar procesamiento duplicado o regresivo.

---

# 23. PipelineProgress

```typescript
interface PipelineProgress {
  source: "google_maps";
  stage: string;
  message: string;
  percentage: number;
}
```

Este objeto es exclusivamente de integración/API.

No corresponde a una columna ni modelo Prisma en el MVP.

---

# 24. Ownership del Job

Platform Backend es propietario del estado persistente de:

```text
ProspectingJob
```

Prospector Service ejecuta el trabajo, pero no es propietario del modelo persistente.

Por lo tanto:

```text
Platform
    │
    ├── crea Job
    ├── persiste Job
    ├── cambia estado
    ├── almacena error
    ├── administra resultados temporales
    └── decide persistencia final
```

Mientras que:

```text
Prospector Service
    │
    ├── recibe ejecución
    ├── ejecuta scraping
    ├── reporta progreso
    ├── entrega resultados
    └── reporta errores
```

---

# 25. Ciclo de vida

Estados válidos:

```text
QUEUED
   │
   ▼
RUNNING
   ├──────────► COMPLETED
   ├──────────► FAILED
   └──────────► CANCELLED
```

Transiciones inválidas:

```text
COMPLETED → RUNNING
FAILED    → RUNNING
CANCELLED → RUNNING
COMPLETED → CANCELLED
FAILED    → CANCELLED
```

Platform es responsable de impedir transiciones inválidas.

---

# 26. Cancelación

Endpoint:

```text
POST /api/v1/prospecting-jobs/{id}/cancel
```

Comportamiento:

### QUEUED

```text
QUEUED → CANCELLED
```

cancelación inmediata.

### RUNNING

Platform solicita cancelación al sistema de ejecución.

El mecanismo físico mediante el cual Engine/Service detiene el scraping queda fuera de este contrato.

### CANCELLED

La operación es idempotente y devuelve:

```text
200 OK
```

### COMPLETED / FAILED

La operación devuelve:

```text
409 Conflict
```

---

# 27. Idempotencia

La creación de Jobs soporta:

```text
Idempotency-Key
```

Mismo:

```text
Idempotency-Key + payload
```

debe producir el mismo Job.

Mismo `Idempotency-Key` con payload diferente:

```text
409 Conflict
```

Entre Platform y Prospector Service, `jobId` funciona como identidad de operación.

No se establece una segunda capa de idempotencia independiente para el MVP.

---

# 28. Autenticación entre componentes

## Flutter → Platform

```text
JWT Bearer
```

Platform autentica al usuario.

---

## Platform → Prospector Service

```text
X-API-Key
```

Service autentica a Platform.

---

## Prospector Service → Platform

Callback interno autenticado.

Platform autentica a Service.

---

## Autorización

Los roles del Platform Backend son:

```text
OWNER
ADMIN
MEMBER
```

Prospector Service no realiza autorización de negocio basada en `tenantId`.

La autorización pertenece a Platform.

---

# 29. Separación explícita de responsabilidades

| Elemento            | Tipo                  | Persistente | Responsable      |
| ------------------- | --------------------- | ----------: | ---------------- |
| Tenant              | Prisma Model          |          Sí | Platform         |
| User                | Prisma Model          |          Sí | Platform         |
| UserTenant          | Prisma Model          |          Sí | Platform         |
| Role                | Prisma Model          |          Sí | Platform         |
| Campaign            | Prisma Model          |          Sí | Platform         |
| Prospect            | Prisma Model          |          Sí | Platform         |
| CampaignProspect    | Prisma Model          |          Sí | Platform         |
| ProspectingJob      | Prisma Model          |          Sí | Platform         |
| BusinessResult      | Integration DTO       |          No | Service/Platform |
| PipelineProgress    | Integration DTO       |          No | Service          |
| JobSummary          | Response DTO          |          No | Platform         |
| JobDetail           | Response DTO          |          No | Platform         |
| ProspectingJobEvent | Integration Event     |          No | Service/Platform |
| ErrorResponse       | API DTO               |          No | API              |
| CSV/XLSX            | Export representation |          No | Platform         |

---

# 30. Regla de evolución

Antes de modificar un modelo o contrato se debe determinar qué capa se está modificando:

### Cambio de API

Ejemplo:

```text
Agregar un campo a BusinessResult
```

No requiere necesariamente modificación de Prisma.

---

### Cambio de integración

Ejemplo:

```text
Agregar progress.stage
```

No requiere modificación de PostgreSQL si es información temporal.

---

### Cambio de persistencia

Ejemplo:

```text
Agregar websiteTitle a Prospect
```

Sí requiere una modificación formal del modelo Prisma y una migración.

No se debe solucionar agregando informalmente el campo únicamente al DTO.

---

# 31. Compatibilidad con Prisma congelado

Este ADR mantiene como fuente de verdad persistente el esquema Prisma aprobado.

En particular:

* No agrega `Permission` como modelo persistente.
* No agrega `ProspectingResult`.
* No agrega campos adicionales a `Prospect`.
* Mantiene `CampaignProspect.status` como `String`.
* Mantiene `User.email` como único global.
* Mantiene `Role` asociado a tenant.
* Mantiene `Prospect.sourceIdentifier` nullable.
* Mantiene la restricción:

```text
(tenantId, campaignId, source, sourceIdentifier)
```

* Mantiene `ProspectingJob.query` como `Json`.
* Mantiene `requestedLimit` como nullable.
* Mantiene los estados establecidos para `ProspectingJob`.

---

# 32. Seguridad diferida a Fase 3 — registro histórico superseded

F4 resolvió: HS256, expiración 8h, sin refresh token ni blacklist, rate limit login 5/60s/IP y contexto JWT snapshot. El listado siguiente conserva la planificación original, no pendientes vigentes.

Quedan para Fase 3:

* expiración de JWT;
* refresh tokens;
* revocación;
* resolución definitiva de tenant;
* autorización granular;
* permisos adicionales;
* rate limiting;
* rotación de API Keys;
* administración de credenciales internas;
* validación avanzada de callbacks;
* protección contra replay;
* políticas de acceso por recurso.

Este ADR establece las interfaces de autenticación, pero no implementa la política completa de seguridad.

---

# 33. Infraestructura diferida a Fase 4

Quedan fuera del alcance de este ADR:

* estrategia definitiva de cache;
* TTL;
* timeout operacional de Jobs;
* retry policy de callbacks;
* queues;
* workers;
* Celery;
* Docker;
* Kubernetes;
* cloud deployment;
* RLS;
* observabilidad avanzada;
* mecanismo físico de cancelación;
* graceful shutdown del Engine;
* escalamiento horizontal.

El transporte conceptual Service → Platform queda definido como **HTTP callback**.

---

# 34. Regla fundamental de arquitectura

La plataforma adopta formalmente la siguiente regla:

```text
API Contract
     ≠
Integration DTO
     ≠
Persistent Model
```

Pueden compartir campos y representar la misma información, pero **no son intercambiables**.

El flujo correcto es:

```text
External/API Request
        ↓
Request DTO
        ↓
Application Logic
        ↓
Persistent Model
        ↓
Database
```

y:

```text
Database
   ↓
Persistent Model
   ↓
Application Mapping
   ↓
Response DTO
   ↓
API Response
```

Para integración:

```text
Prospector Engine
       ↓
Service Integration DTO
       ↓
HTTP Callback
       ↓
Platform Application Mapping
       ↓
Temporary Result
       ↓
Business decision
       ↓
Prospect / CampaignProspect
```

---

# 35. Criterio de cierre

Con este ADR quedan cerrados para Fase 2:

* contratos HTTP;
* convenciones de API;
* wrappers;
* errores;
* paginación;
* endpoints principales;
* contrato Platform ↔ Prospector Service;
* callback Service → Platform;
* Job lifecycle;
* cancelación conceptual;
* resultados temporales;
* persistencia de resultados;
* exportación;
* idempotencia;
* autenticación entre componentes;
* separación API / integración / persistencia;
* compatibilidad con el Prisma congelado.

La implementación concreta de seguridad, infraestructura, ejecución distribuida, workers, cache y mecanismo físico de cancelación queda para las fases correspondientes.

**ADR-002 queda cerrado como contrato de integración y API para el MVP.**

---

# 36. Estado de cierre de Fase 2

**Estado:** CERRADA CON CORRECCIONES MENORES

La auditoría final del Contrato API V1 confirmó la consistencia entre:

* ADR-002;
* ADR-001;
* modelo persistente Prisma;
* Platform API;
* Prospector Service API;
* responsabilidades de cada componente.

Las únicas correcciones realizadas para el cierre fueron:

1. `startedAt` se define como nullable en `ProspectingJobSummary`.
2. `completedAt` se define como nullable en `ProspectingJobSummary`.
3. Se normalizó la descripción de `DELETE /api/v1/users/{id}` para hacer explícita la desactivación mediante `status = INACTIVO` y distinguirla de una eventual eliminación física autorizada.

Estas correcciones no modifican:

* la arquitectura;
* el modelo de dominio;
* el modelo persistente;
* los endpoints;
* el lifecycle del Job;
* los mecanismos de autenticación;
* la integración entre Platform y Prospector Service.

Por lo tanto, el Contrato API V1 queda considerado **cerrado y apto para implementación paralela por Backend, Flutter y Prospector Service**.

### Elementos explícitamente diferidos

Se mantienen diferidos, conforme a las secciones 32 y 33 de este ADR:

* expiración y renovación de JWT;
* revocación de sesiones/tokens;
* rotación de API Keys;
* protección detallada del callback;
* rate limiting;
* RLS;
* estrategia definitiva de cache y TTL;
* retries y políticas de timeout;
* mecanismo físico de cancelación;
* workers/colas;
* observabilidad avanzada;
* infraestructura de despliegue.
