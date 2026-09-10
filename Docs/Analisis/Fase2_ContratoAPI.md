# Fase 2 — Contrato API V1

> Análisis histórico reconciliado con F4. Las tablas de estados y opciones anteriores describen su fase de elaboración, no el cierre operativo actual. ADR-004 y el registro F4 prevalecen: ADMIN global, OWNER/MEMBER en UserTenant.roleId, JWT snapshot sin consulta de membership por request, AsyncLocalStorage, 11 variables obligatorias. Evidencia actual: Docs/Auditorias/Fase4-Auditoria-Profunda-PostCodex.md. READMEs locales autorizados; AGENTS opcional; plan externo ejecutado.

## Análisis documental exhaustivo basado en las fuentes del proyecto

---

# 1. Resumen Ejecutivo de la Fase 2

La **Fase 2** tiene como objetivo establecer los contratos de comunicación, integración y límites de responsabilidad entre los tres componentes principales del sistema:

- **Flutter** — Cliente de presentación.
- **Platform Backend (NestJS)** — Núcleo de dominio y persistencia.
- **Prospector Service (FastAPI/Python)** — Ejecutor de la capacidad de prospección.

El análisis documental revela que las decisiones de Fase 2 se han formalizado progresivamente, culminando en el **ADR-002**, que actúa como el contrato congelado y definitivo. Este ADR resuelve contradicciones previas y establece una separación explícita entre **API Contract**, **Integration DTO** y **Persistent Model**.

El flujo de comunicación queda definido como:

```text
Flutter
   │
   │ HTTPS / JWT
   ▼
Platform Backend
   │
   │ HTTP / API Key
   ▼
Prospector Service
   │
   │ Internal Python calls
   ▼
Prospector Engine
```

Las decisiones críticas de la Fase 2 — como el ownership del `ProspectingJob`, el protocolo de callback (`Service → Platform`), la estructura de `BusinessResult`, los estados del Job y la paginación — están cerradas y listas para implementación.

---

# 2. Componentes y responsabilidades

| Componente | Responsabilidad | Consume | Expone | Estado |
|------------|-----------------|---------|--------|--------|
| **Flutter** | Interfaz de usuario, gestión de estado de UI, autenticación (capa presentación), navegación, consumo de Platform API | Platform API (HTTP/JWT) | — | **DEFINIDA** |
| **Platform Backend** | Dominio de negocio, autenticación, autorización, multi-tenancy, gestión de usuarios/tenants/campañas/prospectos, propietario del `ProspectingJob`, persistencia (Prisma), coordinación de prospección, gestión de resultados temporales, exportaciones, detección de duplicados | Flutter (HTTP), Prospector Service (HTTP interno) | Platform API (vía NestJS) | **DEFINIDA** |
| **Prospector Service** | Ejecución de scraping, orquestación del Prospector Engine, reporte de progreso, entrega de resultados, notificación de errores, aceptación de solicitudes de ejecución. **NO persiste Jobs ni resultados.** | Platform Backend (HTTP API), Prospector Engine (Python interno) | API interna para Platform, Callbacks hacia Platform | **DEFINIDA** |
| **Prospector Engine** | Extracción técnica: navegación en Google Maps, scraping, enriquecimiento de detail panel, enriquecimiento de websites, normalización, deduplicación (técnica). **No conoce el dominio SaaS.** | Internet (Google Maps, Websites) | `BusinessResult` vía Prospector Service | **DEFINIDA** |

### 2.1. Responsabilidades detalladas

| Área | Responsable | Fuente |
|------|-------------|--------|
| **Autenticación de usuarios** | Platform (JWT) | ADR-002 §28 |
| **Autorización de negocio** | Platform (OWNER/MEMBER tenant-scoped; ADMIN global) | ADR-002 §28 |
| **Tenant resolution** | Platform | ADR-002 §19, Acta §20 |
| **Campañas** | Platform (CRUD completo) | ADR-002 §11.4 |
| **Prospectos** | Platform (CRUD, persistencia, deduplicación) | ADR-002 §11.5 |
| **ProspectingJob (persistencia)** | Platform | ADR-002 §24 |
| **Ejecución de scraping** | Prospector Service / Engine | ADR-002 §21, README_Prospector_Service §3 |
| **Resultados temporales** | Platform (caché, TTL y estrategia en Fase 4) | ADR-002 §17 |
| **Exportación (CSV/XLSX)** | Platform | ADR-002 §20 |
| **Cancelación conceptual del Job** | Platform (endpoint) / Service (notificación diferida) | ADR-002 §26 |
| **Callbacks (Service → Platform)** | Service (envía), Platform (procesa) | ADR-002 §22 |

---

# 3. Fronteras de integración

## 3.1. Flutter → Platform

| Aspecto | Decisión | Estado |
|---------|----------|--------|
| **Protocolo** | HTTPS | **DEFINIDA** |
| **Autenticación** | JWT Bearer | **DEFINIDA** |
| **Formato** | JSON | **DEFINIDA** |
| **Versionado** | URL path: `/api/v1/...` | **DEFINIDA** |
| **Responsabilidad** | Cliente consume API. Platform es autoridad de dominio. | **DEFINIDA** |
| **Restricción** | Flutter nunca se comunica directamente con Prospector Service. | **DEFINIDA** |

## 3.2. Platform → Prospector Service

| Aspecto | Decisión | Estado |
|---------|----------|--------|
| **Protocolo** | HTTP | **DEFINIDA** |
| **Autenticación** | `X-API-Key` | **DEFINIDA** |
| **Endpoint** | `POST /api/v1/prospecting/jobs` | **DEFINIDA** |
| **Request** | `{ jobId, tenantId, query, callbackUrl }` | **DEFINIDA** |
| **Response** | `202 Accepted` con `{ jobId, status, acceptedAt }` | **DEFINIDA** |
| **Responsabilidad** | Platform inicia la operación. Service ejecuta. | **DEFINIDA** |
| **Restricción** | Service **NO** persiste el Job ni los resultados. | **DEFINIDA** |

## 3.3. Prospector Service → Platform (Callback)

| Aspecto | Decisión | Estado |
|---------|----------|--------|
| **Protocolo** | HTTP | **DEFINIDA** |
| **Endpoint** | `POST /api/v1/internal/prospecting-jobs/{jobId}/events` | **DEFINIDA** |
| **Autenticación** | Platform autentica al Service (mecanismo diferido a Fase 3) | **DEFINIDA (contrato) / POSTERGADA (implementación)** |
| **Formato** | JSON con `eventId`, `jobId`, `sequence`, `status`, `timestamp`, `progress`, `results`, `error` | **DEFINIDA** |
| **Responsabilidad** | Service notifica eventos de progreso y finalización. | **DEFINIDA** |
| **Restricción** | Service **NO** envía actualizaciones si el Job ya está en estado terminal. | **DEFINIDA** |

## 3.4. Prospector Service → Engine

| Aspecto | Decisión | Estado |
|---------|----------|--------|
| **Tipo** | Llamada interna en Python | **DEFINIDA** |
| **Autenticación** | No aplica (mismo proceso) | **DEFINIDA** |
| **Responsabilidad** | Service orquesta Engine. Engine extrae y enriquece. | **DEFINIDA** |
| **Restricción** | Engine **NO** conoce el dominio SaaS, ni tenants, ni campañas. | **DEFINIDA** |

---

# 4. Catálogo de contratos API

## 4.1. Platform API (Flutter → Platform)

| # | Endpoint | Método | Consumidor | Proveedor | Tipo | Estado | Fuente |
|---|----------|--------|------------|-----------|------|--------|--------|
| 1 | `/api/v1/auth/login` | POST | Flutter | Platform | Público | **DEFINIDA** | ADR-002 §11.1 |
| 2 | `/api/v1/auth/logout` | POST | Flutter | Platform | Autenticado | **DEFINIDA** | ADR-002 §11.1 |
| 3 | `/api/v1/auth/select-tenant` | POST | Flutter | Platform | Autenticado | **DEFINIDA** | ADR-002 §11.1 |
| 4 | `/api/v1/auth/me` | GET | Flutter | Platform | Autenticado | **DEFINIDA** | ADR-002 §11.1 |
| 5 | `/api/v1/tenants` | GET | Flutter | Platform | Autenticado | **DEFINIDA** | ADR-002 §11.2 |
| 6 | `/api/v1/tenants` | POST | Flutter | Platform | ADMIN | **DEFINIDA** | ADR-002 §11.2 |
| 7 | `/api/v1/tenants/{id}` | GET | Flutter | Platform | Autenticado | **DEFINIDA** | ADR-002 §11.2 |
| 8 | `/api/v1/users` | GET | Flutter | Platform | Autenticado | **DEFINIDA** | ADR-002 §11.3 |
| 9 | `/api/v1/users` | POST | Flutter | Platform | OWNER/ADMIN | **DEFINIDA** | ADR-002 §11.3 |
| 10 | `/api/v1/users/{id}` | GET | Flutter | Platform | Autenticado | **DEFINIDA** | ADR-002 §11.3 |
| 11 | `/api/v1/users/{id}` | PATCH | Flutter | Platform | OWNER/ADMIN | **DEFINIDA** | ADR-002 §11.3 |
| 12 | `/api/v1/users/{id}` | DELETE | Flutter | Platform | ADMIN | **DEFINIDA** | ADR-002 §11.3 |
| 13 | `/api/v1/campaigns` | GET | Flutter | Platform | Autenticado | **DEFINIDA** | ADR-002 §11.4 |
| 14 | `/api/v1/campaigns` | POST | Flutter | Platform | Autenticado | **DEFINIDA** | ADR-002 §11.4 |
| 15 | `/api/v1/campaigns/{id}` | GET | Flutter | Platform | Autenticado | **DEFINIDA** | ADR-002 §11.4 |
| 16 | `/api/v1/campaigns/{id}` | PATCH | Flutter | Platform | Autenticado | **DEFINIDA** | ADR-002 §11.4 |
| 17 | `/api/v1/campaigns/{id}` | DELETE | Flutter | Platform | OWNER/ADMIN/MEMBER* | **DEFINIDA** | ADR-002 §11.4 |
| 18 | `/api/v1/campaigns/{id}/prospects` | GET | Flutter | Platform | Autenticado | **DEFINIDA** | ADR-002 §11.4 |
| 19 | `/api/v1/prospects` | GET | Flutter | Platform | Autenticado | **DEFINIDA** | ADR-002 §11.5 |
| 20 | `/api/v1/prospects/{id}` | GET | Flutter | Platform | Autenticado | **DEFINIDA** | ADR-002 §11.5 |
| 21 | `/api/v1/prospects/{id}` | PATCH | Flutter | Platform | Autenticado | **DEFINIDA** | ADR-002 §11.5 |
| 22 | `/api/v1/prospecting-jobs` | POST | Flutter | Platform | Autenticado | **DEFINIDA** | ADR-002 §11.6 |
| 23 | `/api/v1/prospecting-jobs` | GET | Flutter | Platform | Autenticado | **DEFINIDA** | ADR-002 §11.6 |
| 24 | `/api/v1/prospecting-jobs/{id}` | GET | Flutter | Platform | Autenticado | **DEFINIDA** | ADR-002 §11.6 |
| 25 | `/api/v1/prospecting-jobs/{id}/cancel` | POST | Flutter | Platform | Autenticado | **DEFINIDA** | ADR-002 §11.6 |
| 26 | `/api/v1/prospecting-jobs/{id}/persist` | POST | Flutter | Platform | Autenticado | **DEFINIDA** | ADR-002 §11.6 |
| 27 | `/api/v1/prospecting-jobs/{id}/export` | GET** | Flutter | Platform | Autenticado | **DEFINIDA** | ADR-002 §20 |

> \*DELETE Campaign: OWNER y MEMBER pueden archivar (lógico). Solo ADMIN puede eliminar físicamente (`?permanent=true`).
>
> \*\*Exportación: `GET` según ADR-002 §20. Se documenta GET a pesar de listados preliminares con POST.

## 4.2. Prospector Service API (Platform → Service)

| # | Endpoint | Método | Consumidor | Proveedor | Tipo | Estado | Fuente |
|---|----------|--------|------------|-----------|------|--------|--------|
| 1 | `/api/v1/prospecting/jobs` | POST | Platform | Service | Interno | **DEFINIDA** | ADR-002 §21 |

## 4.3. Callback API (Service → Platform)

| # | Endpoint | Método | Consumidor | Proveedor | Tipo | Estado | Fuente |
|---|----------|--------|------------|-----------|------|--------|--------|
| 1 | `/api/v1/internal/prospecting-jobs/{jobId}/events` | POST | Service | Platform | Interno | **DEFINIDA** | ADR-002 §22 |

---

# 5. Contratos Request / Response

## 5.1. Auth

### Login Request (DEFINIDA)
```json
{
  "email": "string",
  "password": "string"
}
```

### Login Response (DEFINIDA)
```json
{
  "accessToken": "string",
  "user": { ... },
  "tenants": [ ... ],
  "currentTenantId": "string"
}
```

### Select Tenant Request (DEFINIDA)
```json
{
  "tenantId": "string"
}
```

## 5.2. Users

### Create User Request (DEFINIDA)
```json
{
  "name": "string",
  "email": "string",
  "password": "string",
  "roleId": "string"
}
```

### User Response DTO (DEFINIDA)
```json
{
  "id": "string",
  "name": "string",
  "email": "string",
  "role": { "id": "string", "name": "OWNER|MEMBER" },
  "status": "ACTIVO|INACTIVO",
  "createdAt": "2026-09-07T20:30:00Z",
  "updatedAt": "2026-09-07T20:30:00Z"
}
```

> El campo `passwordHash` **nunca** se expone en la API.

## 5.3. Campaigns

### Create Campaign Request (DEFINIDA)
```json
{
  "name": "string",
  "description": "string?",
  "status": "ACTIVA|PAUSADA|COMPLETADA|ARCHIVADA?"
}
```

### Campaign Response DTO (DEFINIDA)
```json
{
  "id": "string",
  "tenantId": "string",
  "createdBy": { "id": "string", "name": "string" },
  "name": "string",
  "description": "string|null",
  "status": "ACTIVA|PAUSADA|COMPLETADA|ARCHIVADA",
  "createdAt": "2026-09-07T20:30:00Z",
  "updatedAt": "2026-09-07T20:30:00Z",
  "prospectCount": 0,
  "metrics": { ... }
}
```

## 5.4. Prospects

### Prospect Response DTO (DEFINIDA)
```json
{
  "id": "string",
  "tenantId": "string",
  "campaignId": "string",
  "name": "string",
  "category": "string|null",
  "address": "string|null",
  "phone": "string|null",
  "email": "string|null",
  "website": "string|null",
  "source": "google_maps",
  "sourceIdentifier": "string|null",
  "language": "string|null",
  "status": "ACTIVO|INACTIVO",
  "metadata": {},
  "createdAt": "2026-09-07T20:30:00Z",
  "updatedAt": "2026-09-07T20:30:00Z",
  "campaigns": [ ... ]  // Opcional en detalle
}
```

## 5.5. Prospecting Jobs

### Create Job Request (Platform API) (DEFINIDA)
```json
{
  "campaignId": "string",
  "query": {
    "keyword": "string",
    "location": "string",
    "source": "google_maps?",
    "limit": 50?
  }
}
```

### ProspectingJobSummary (Response DTO) (DEFINIDA)
```json
{
  "id": "string",
  "campaignId": "string",
  "status": "QUEUED|RUNNING|COMPLETED|FAILED|CANCELLED",
  "createdAt": "2026-09-07T20:30:00Z",
  "startedAt": "2026-09-07T20:30:00Z|null",
  "completedAt": "2026-09-07T20:30:00Z|null"
}
```

### ProspectingJobDetail (Response DTO) (DEFINIDA)
```json
{
  "id": "string",
  "tenantId": "string",
  "campaignId": "string",
  "requestedBy": { "id": "string", "name": "string" },
  "status": "QUEUED|RUNNING|COMPLETED|FAILED|CANCELLED",
  "query": { "keyword": "...", "location": "...", "source": "google_maps", "limit": 50 },
  "requestedLimit": 50|null,
  "startedAt": "2026-09-07T20:30:00Z|null",
  "completedAt": "2026-09-07T20:30:00Z|null",
  "error": "string|null",
  "createdAt": "2026-09-07T20:30:00Z",
  "updatedAt": "2026-09-07T20:30:00Z",
  "resultsAvailable": true,
  "results": [ ... ] | null,
  "progress": { "source": "google_maps", "stage": "...", "message": "...", "percentage": 65 } | null
}
```

## 5.6. Prospector Service Request (Platform → Service) (DEFINIDA)

```json
{
  "jobId": "cm0j4xqz30001abc123",
  "tenantId": "cm0j4xqz30001abc123",
  "query": {
    "keyword": "restaurantes",
    "location": "Tijuana",
    "source": "google_maps",
    "limit": 50
  },
  "callbackUrl": "https://platform.internal/api/v1/internal/prospecting-jobs/{jobId}/events"
}
```

## 5.7. Service Response (DEFINIDA)

```json
{
  "jobId": "cm0j4xqz30001abc123",
  "status": "QUEUED",
  "acceptedAt": "2026-09-07T20:30:00Z"
}
```
HTTP Status: `202 Accepted`

## 5.8. Callback Event (Service → Platform) (DEFINIDA)

```json
{
  "eventId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "jobId": "cm0j4xqz30001abc123",
  "sequence": 5,
  "status": "RUNNING",
  "progress": {
    "source": "google_maps",
    "stage": "DETAILPANELEXTRACTING",
    "message": "Extrayendo detalles de los negocios",
    "percentage": 65
  },
  "timestamp": "2026-09-07T20:30:00Z",
  "results": null,
  "error": null
}
```

En `COMPLETED`, se incluye `results: BusinessResult[]`, `executionTime`, `totalResults`. En `FAILED`, se incluye `error: { code, message }`.

---

# 6. Contrato estándar de respuestas

| Formato | Definición | Estado |
|---------|------------|--------|
| **Success Wrapper** | `{ "success": true, "data": {}, "meta": {} }` | **DEFINIDA** |
| **Error Wrapper** | `{ "success": false, "error": { "code": "...", "message": "...", "details": {}, "timestamp": "..." } }` | **DEFINIDA** |
| **Paginated Response** | `{ "success": true, "data": [], "meta": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 } }` | **DEFINIDA** |
| **Binary Exports** | No usan wrapper JSON. Content-Type adecuado. | **DEFINIDA** |
| **Aplicación** | Todas las respuestas JSON de Platform API. | **DEFINIDA** |
| **Excepción** | Exportaciones CSV/XLSX. | **DEFINIDA** |

---

# 7. HTTP Status Codes

| Código | Uso | Estado | Fuente |
|--------|-----|--------|--------|
| `200` | OK | **DEFINIDA** | ADR-002 §8 |
| `201` | Created | **DEFINIDA** | ADR-002 §8 |
| `202` | Accepted (operación asíncrona aceptada) | **DEFINIDA** | ADR-002 §8 |
| `400` | Bad Request (validación) | **DEFINIDA** | ADR-002 §8 |
| `401` | Unauthorized | **DEFINIDA** | ADR-002 §8 |
| `403` | Forbidden | **DEFINIDA** | ADR-002 §8 |
| `404` | Not Found | **DEFINIDA** | ADR-002 §8 |
| `409` | Conflict | **DEFINIDA** | ADR-002 §8 |
| `500` | Internal Server Error | **DEFINIDA** | ADR-002 §8 |
| `503` | Service Unavailable | **DEFINIDA** | ADR-002 §8 |

No se definen otros códigos (ej. `504`). ADR-002 solo incluye los listados.

---

# 8. Paginación, filtros y búsqueda

| Aspecto | Decisión | Estado | Fuente |
|---------|----------|--------|--------|
| **Paginación** | `page` (1-based) y `limit` (max 100, default 20) | **DEFINIDA** | ADR-002 §9 |
| **Recursos paginados** | `users`, `campaigns`, `prospects`, `prospecting-jobs` | **DEFINIDA** | ADR-002 §9 |
| **Metadatos** | `{ page, limit, total, totalPages }` | **DEFINIDA** | ADR-002 §9 |
| **Filtros** | Query params, combinación `AND`. Valores inválidos → `400`. | **DEFINIDA** | ADR-002 §10 |
| **Ordenamiento** | `sortBy`, `sortOrder` (`asc`/`desc`) | **DEFINIDA** | ADR-002 §10 |
| **Búsqueda** | `search` (coincidencia simple en campos específicos) | **DEFINIDA** | ADR-002 §10 |
| **Búsqueda avanzada** | No se define en MVP. | **POSTERGADA** | ADR-002 §10 |

---

# 9. ProspectingJob como contrato de integración

| Aspecto | Decisión | Estado | Fuente |
|---------|----------|--------|--------|
| **Creación** | Platform crea el Job. Service solo recibe solicitud. | **DEFINIDA** | ADR-002 §24 |
| **Ownership** | Platform es propietario del estado persistente. | **DEFINIDA** | ADR-002 §24 |
| **Request (Platform API)** | `POST /api/v1/prospecting-jobs` con `campaignId` y `query`. | **DEFINIDA** | ADR-002 §11.6 |
| **Request (Service API)** | `POST /api/v1/prospecting/jobs` con `jobId`, `tenantId`, `query`, `callbackUrl`. | **DEFINIDA** | ADR-002 §21 |
| **Response (Platform API)** | `201` con `ProspectingJobDetail`. | **DEFINIDA** | ADR-002 §11.6 |
| **Response (Service API)** | `202` con `{ jobId, status, acceptedAt }`. | **DEFINIDA** | ADR-002 §21 |
| **Consulta de estado** | `GET /api/v1/prospecting-jobs/{id}`. | **DEFINIDA** | ADR-002 §11.6 |
| **Resultados** | Temporales, en caché de Platform. | **DEFINIDA** | ADR-002 §17 |
| **Persistencia** | `POST /.../persist` → crea `Prospect` y `CampaignProspect`. | **DEFINIDA** | ADR-002 §18 |
| **Exportación** | `GET /.../export?format=csv|xlsx`. | **DEFINIDA** | ADR-002 §20 |
| **Descartes** | Elimina caché, NO modifica estado del Job. | **DEFINIDA** | ADR-002 §17 |
| **Idempotencia** | `Idempotency-Key` en creación. | **DEFINIDA** | ADR-002 §27 |

---

# 10. Lifecycle del Job

### Estados (DEFINIDA)

```text
QUEUED
RUNNING
COMPLETED
FAILED
CANCELLED
```

### Estados terminales (DEFINIDA)

```text
COMPLETED
FAILED
CANCELLED
```

### Transiciones (DEFINIDA)

| Desde | Hacia |
|-------|-------|
| `QUEUED` | `RUNNING` |
| `QUEUED` | `CANCELLED` |
| `RUNNING` | `COMPLETED` |
| `RUNNING` | `FAILED` |
| `RUNNING` | `CANCELLED` |

### Representación

```text
QUEUED
   ↓
RUNNING
   ├──→ COMPLETED
   ├──→ FAILED
   └──→ CANCELLED
```

**No existen otros estados** (ej. `DISCARDED`, `PAUSED`). La documentación es consistente en este punto.

---

# 11. Eventos y callbacks

| Aspecto | Decisión | Estado | Fuente |
|---------|----------|--------|--------|
| **Endpoint** | `POST /api/v1/internal/prospecting-jobs/{jobId}/events` | **DEFINIDA** | ADR-002 §22 |
| **Autenticación** | Platform autentica a Service (mecanismo diferido a Fase 3) | **DEFINIDA (contrato) / POSTERGADA (impl.)** | ADR-002 §22 |
| **eventId** | UUID, generado por Service. | **DEFINIDA** | ADR-002 §22 |
| **jobId** | Correlación con el Job de Platform. | **DEFINIDA** | ADR-002 §22 |
| **sequence** | Entero incremental por `jobId`. | **DEFINIDA** | ADR-002 §22 |
| **status** | `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED` | **DEFINIDA** | ADR-002 §22 |
| **progress** | Objeto con `source`, `stage`, `message`, `percentage`. | **DEFINIDA** | ADR-002 §14 |
| **timestamp** | ISO 8601 UTC. | **DEFINIDA** | ADR-002 §22 |
| **results** | Solo en `COMPLETED`. `BusinessResult[]`. | **DEFINIDA** | ADR-002 §22 |
| **error** | Solo en `FAILED`. `{ code, message }`. | **DEFINIDA** | ADR-002 §22 |

### Reglas de procesamiento en Platform (DEFINIDA)

- **Duplicados**: Si `eventId` ya procesado, ignorar.
- **Orden**: Si `sequence` ≤ último procesado, ignorar.
- **Estados terminales**: No aceptar eventos que reviertan un estado terminal.
- **Confirmación**: Responder `200 OK` tras aceptar el evento.

---

# 12. BusinessResult

`BusinessResult` es un **DTO de integración**, no una tabla Prisma. (DEFINIDA)

### Campos (DEFINIDA)

| Campo | Tipo | Obligatorio | Estado |
|-------|------|-------------|--------|
| `name` | string | Sí | **DEFINIDA** |
| `category` | string\|null | No | **DEFINIDA** |
| `address` | string\|null | No | **DEFINIDA** |
| `phone` | string\|null | No | **DEFINIDA** |
| `email` | string\|null | No | **DEFINIDA** |
| `website` | string\|null | No | **DEFINIDA** |
| `source` | `"google_maps"` | Sí | **DEFINIDA** |
| `sourceIdentifier` | string\|null | No | **DEFINIDA** |
| `language` | string\|null | No | **DEFINIDA** |
| `metadata` | Record<string, unknown>\|null | No | **DEFINIDA** |

### Nota sobre campos adicionales

En versiones anteriores del ADR se mencionaban `websiteTitle`, `websiteDescription`, `websiteStatus`. El ADR-002 final **los elimina del DTO de persistencia** y los coloca dentro de `metadata` o los trata como información de enriquecimiento temporal, indicando explícitamente que no forman parte del modelo Prisma (`Prospect`). El ADR-002 establece:

> "No se agregan campos persistentes adicionales en este ADR. En particular, los siguientes campos **no forman parte del modelo Prisma aprobado**: `websiteTitle`, `websiteDescription`, `websiteStatus`." (ADR-002 §4.6)

---

# 13. Mapping BusinessResult → Prospect

| BusinessResult | Prospect | Tipo de transformación | Estado |
|----------------|----------|------------------------|--------|
| `name` | `name` | Directo | **DEFINIDA** |
| `category` | `category` | Directo | **DEFINIDA** |
| `address` | `address` | Directo | **DEFINIDA** |
| `phone` | `phone` | Directo | **DEFINIDA** |
| `email` | `email` | Directo | **DEFINIDA** |
| `website` | `website` | Directo | **DEFINIDA** |
| `source` | `source` | Directo | **DEFINIDA** |
| `sourceIdentifier` | `sourceIdentifier` | Directo | **DEFINIDA** |
| `language` | `language` | Directo | **DEFINIDA** |
| `metadata` | `metadata` | Directo | **DEFINIDA** |
| — | `tenantId` | Determinado por Platform | **DEFINIDA** |
| — | `campaignId` | Determinado por Platform | **DEFINIDA** |
| — | `status` | Fijado por Platform | **DEFINIDA** |
| — | `createdAt` | Generado por Platform | **DEFINIDA** |
| — | `updatedAt` | Generado por Platform | **DEFINIDA** |

El mapping está completamente definido en ADR-002 §16.

---

# 14. Resultados temporales

| Aspecto | Decisión | Estado | Fuente |
|---------|----------|--------|--------|
| **Ownership** | Platform | **DEFINIDA** | ADR-002 §17 |
| **Almacenamiento** | Caché temporal en Platform. | **DEFINIDA** | ADR-002 §17 |
| **Estrategia** | No definida en Fase 2 (se define en Fase 4). | **POSTERGADA** | ADR-002 §17 |
| **TTL** | No definido (Fase 4). | **POSTERGADA** | ADR-002 §17 |
| **Consulta** | `GET /prospecting-jobs/{id}` con `resultsAvailable` y `results`. | **DEFINIDA** | ADR-002 §14 |
| **Persistencia** | `POST /.../persist`. | **DEFINIDA** | ADR-002 §18 |
| **Exportación** | `GET /.../export`. | **DEFINIDA** | ADR-002 §20 |
| **Descarte** | Elimina caché. Job permanece `COMPLETED`. | **DEFINIDA** | ADR-002 §17 |

---

# 15. Persistencia de resultados

| Aspecto | Decisión | Estado | Fuente |
|---------|----------|--------|--------|
| **Responsable** | Platform | **DEFINIDA** | ADR-002 §18 |
| **Cuándo** | Cuando el usuario solicita persistir vía endpoint. | **DEFINIDA** | ADR-002 §18 |
| **Deduplicación SaaS** | Platform detecta duplicados con `(tenantId, campaignId, source, sourceIdentifier)`. | **DEFINIDA** | ADR-002 §18 |
| **sourceIdentifier null** | Platform debe manejar lógicamente este caso (restricción UNIQUE de PostgreSQL no garantiza unicidad absoluta con múltiples NULL). | **DEFINIDA** | ADR-002 §18 |
| **Creación** | Se crea `Prospect` (o se identifica existente) y luego `CampaignProspect`. | **DEFINIDA** | ADR-002 §18-19 |
| **Deduplicación del Engine** | Es diferente de la deduplicación del SaaS. La primera es técnica dentro de la extracción; la segunda es de dominio dentro del tenant. | **DEFINIDA** | ADR-002 §18, Contexto §13 |

---

# 16. Exportación

| Aspecto | Decisión | Estado | Fuente |
|---------|----------|--------|--------|
| **Responsable** | Platform | **DEFINIDA** | ADR-002 §20 |
| **Endpoint** | `GET /api/v1/prospecting-jobs/{id}/export` | **DEFINIDA** | ADR-002 §20 |
| **Formatos** | `csv`, `xlsx` | **DEFINIDA** | ADR-002 §20 |
| **Content-Type** | Binario. No usa wrapper JSON. | **DEFINIDA** | ADR-002 §20 |
| **Datos** | Los resultados temporales del Job. | **DEFINIDA** | ADR-002 §20 |

---

# 17. Autenticación

| Flujo | Mecanismo | Responsable | Estado | Fuente |
|-------|-----------|-------------|--------|--------|
| **Flutter → Platform** | JWT Bearer | Platform autentica a Flutter | **DEFINIDA** | ADR-002 §28 |
| **Platform → Service** | `X-API-Key` | Service autentica a Platform | **DEFINIDA** | ADR-002 §28 |
| **Service → Platform (callback)** | Interno, Platform autentica a Service | Platform | **DEFINIDA (contrato) / POSTERGADA (mecanismo)** | ADR-002 §28 |
| **Expiración JWT** | No definida en Fase 2. | — | **POSTERGADA** | ADR-002 §32 |
| **Refresh Token** | No definido en Fase 2. | — | **POSTERGADA** | ADR-002 §32 |
| **Revocación** | No definida en Fase 2. | — | **POSTERGADA** | ADR-002 §32 |
| **Rotación de API Key** | No definida en Fase 2. | — | **POSTERGADA** | ADR-002 §32 |

---

# 18. Autorización

| Aspecto | Decisión | Estado | Fuente |
|---------|----------|--------|--------|
| **Dónde ocurre** | Platform Backend | **DEFINIDA** | ADR-002 §28 |
| **Componente que decide** | Platform (Guards, Services) | **DEFINIDA** | ADR-002 §28 |
| **Roles** | `OWNER`, `ADMIN`, `MEMBER` | **DEFINIDA** | ADR-002 §28 |
| **Tenant context** | Se deriva del token autenticado. | **DEFINIDA** | ADR-002 §28 |
| **Prospector Service** | No realiza autorización de negocio basada en `tenantId`. | **DEFINIDA** | ADR-002 §28 |

---

# 19. Multi-tenancy en los contratos

| Aspecto | Decisión | Estado | Fuente |
|---------|----------|--------|--------|
| **Origen de `tenantId`** | Se deriva del token JWT en Platform. | **DEFINIDA** | ADR-002 §19, Acta §20 |
| **Cliente envía `tenantId`** | No. Se prohíbe explícitamente. | **DEFINIDA** | ADR-002 §19 |
| **Resolución** | Platform lo resuelve mediante Guards/IsolationStrategy. | **DEFINIDA** | ADR-002 §19 |
| **Validez de pertenencia** | Platform valida que el usuario pertenezca al tenant de la operación. | **DEFINIDA** | ADR-002 §19 |
| **Platform → Service** | `tenantId` se envía para trazabilidad, pero Service **NO autoriza** basado en él. | **DEFINIDA** | ADR-002 §28 |

---

# 20. Idempotencia

| Mecanismo | Propósito | Frontera | Generado por | Valida | Estado | Fuente |
|-----------|-----------|----------|--------------|--------|--------|--------|
| **`Idempotency-Key`** | Evitar duplicación de creación de Jobs desde Flutter/Platform API. | Flutter → Platform | Cliente | Platform | **DEFINIDA** | ADR-002 §27 |
| **`jobId`** | Identidad única de operación entre Platform y Service. | Platform → Service | Platform | Service | **DEFINIDA** | ADR-002 §27 |
| **`eventId`** | Identidad de evento para evitar duplicados en callback. | Service → Platform | Service | Platform | **DEFINIDA** | ADR-002 §22 |
| **`sequence`** | Orden lógico de eventos por Job. | Service → Platform | Service | Platform | **DEFINIDA** | ADR-002 §22 |

---

# 21. Manejo de errores

| Situación | Código HTTP | Error Code | Responsable | Estado | Fuente |
|-----------|-------------|------------|-------------|--------|--------|
| Validación de entrada | `400` | `VALIDATION_ERROR` | Platform | **DEFINIDA** | ADR-002 §11.2 |
| Credenciales inválidas | `401` | `AUTHENTICATION_ERROR` | Platform | **DEFINIDA** | ADR-002 §11.2 |
| Sin permisos | `403` | `AUTHORIZATION_ERROR` | Platform | **DEFINIDA** | ADR-002 §11.2 |
| Recurso inexistente | `404` | `NOT_FOUND` | Platform | **DEFINIDA** | ADR-002 §11.2 |
| Conflicto (email, idempotencia) | `409` | `CONFLICT` | Platform | **DEFINIDA** | ADR-002 §11.2 |
| Error interno | `500` | `INTERNAL_ERROR` | Platform | **DEFINIDA** | ADR-002 §11.2 |
| Service no disponible | `503` | `SERVICE_UNAVAILABLE` | Platform | **DEFINIDA** | ADR-002 §11.2 |
| Error de scraping | Evento `FAILED` | `error.code` en evento | Service | **DEFINIDA** | ADR-002 §22 |
| Job fallido | Evento `FAILED` | `error.code` + `error.message` | Service | **DEFINIDA** | ADR-002 §22 |
| Cancelación de Job terminal | `409` | `CONFLICT` o `BUSINESS_RULE_ERROR` | Platform | **DEFINIDA** | ADR-002 §26 |
| Error persistente en Prisma | `String` | Se almacena en `ProspectingJob.error` | Platform | **DEFINIDA** | ADR-002 §10 |

**Nota:** El `error` en `ProspectingJob` (Prisma) es `String`. No es un objeto estructurado en persistencia. La estructura detallada (`code`, `message`) existe únicamente en el evento de callback (Service → Platform).

---

# 22. Contradicciones documentales

| # | Contradicción | Fuente A | Fuente B | Resolución | Estado |
|---|---------------|----------|----------|------------|--------|
| 1 | **Versionado** | ModeloArquitectonico §59: "estrategia de versionamiento será definida" (concepto abierto). | ADR-002 §7: Versionado por URL `/api/v1/...`. | ADR-002 resuelve. | **RESUELTA** |
| 2 | **Source** | ActaConceptual y README_Prospector_Service usan `google_maps` (minúsculas). | ADR-002 inicial sugería `GOOGLE_MAPS`. | ADR-002 final normaliza a `google_maps`. | **RESUELTA** |
| 3 | **Progress** | ADR-002 inicial usaba `progress: { progress: 65 }`. | ADR-002 final usa `percentage`. | ADR-002 final corrige. | **RESUELTA** |
| 4 | **Paginación de Jobs** | ADR-002 inicial decía "No se establece paginación obligatoria para ProspectingJob". | ADR-002 final lo incluye en recursos paginados. | ADR-002 final corrige. | **RESUELTA** |
| 5 | **Estado DISCARDED** | ActaConceptual no lo menciona. | Algunas propuestas tempranas lo sugerían. | ADR-002 final lo excluye explícitamente. | **RESUELTA** |
| 6 | **Prospect fields** | ActaConceptual §22 menciona `language` en Prospect. | ADR-001 no incluye `language` en la tabla de atributos, aunque ADR-002 sí lo incluye en el DTO y Prisma lo tiene como `String?`. | El esquema Prisma actual incluye `language`. Coherente. | **RESUELTA** |
| 7 | **Business fields** | README_Prospector_Engine §13 incluye `websiteTitle`, `websiteDescription`, `websiteStatus` en Business. | ADR-002 §4.6 los excluye del modelo Prisma `Prospect`. | Son campos de enriquecimiento temporal, no persistentes en MVP. | **RESUELTA** |
| 8 | **Permisos (Permission)** | ActaConceptual §22 menciona Permission como entidad. | ADR-001 decide no implementarlo como tabla en MVP. | ADR-001 resuelve. | **RESUELTA** |
| 9 | **Autenticación de callback** | ADR-002 previo decía "Service autentica a Platform". | ADR-002 final dice "Platform autentica a Service". | ADR-002 final corrige. | **RESUELTA** |

**No existen contradicciones abiertas en Fase 2.** Todas han sido resueltas por ADR-001 o ADR-002.

---

# 23. Decisiones DEFINIDAS

| ID | Decisión | Fuente | Estado |
|----|----------|--------|--------|
| D-001 | Platform Backend es propietario de `ProspectingJob` | ADR-002 §24 | **DEFINIDA** |
| D-002 | Flutter no se comunica directamente con Prospector Service | ADR-002 §3 | **DEFINIDA** |
| D-003 | Platform genera `jobId` (cuid) | ADR-002 §8 | **DEFINIDA** |
| D-004 | `jobId` es la única identidad de la operación entre Platform y Service | ADR-002 §4 | **DEFINIDA** |
| D-005 | Prospector Service NO persiste Jobs ni resultados | ADR-002 §24 | **DEFINIDA** |
| D-006 | La prospección es asíncrona desde perspectiva de Flutter/Platform | ADR-002 §1 | **DEFINIDA** |
| D-007 | El patrón de notificación Service → Platform es HTTP callback | ADR-002 §1 | **DEFINIDA** |
| D-008 | Endpoint de callback: `POST /api/v1/internal/prospecting-jobs/{jobId}/events` | ADR-002 §22 | **DEFINIDA** |
| D-009 | Estados: `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED` | ADR-002 §10 | **DEFINIDA** |
| D-010 | Estados terminales: `COMPLETED`, `FAILED`, `CANCELLED` | ADR-002 §10 | **DEFINIDA** |
| D-011 | Transiciones: `QUEUED→RUNNING`, `QUEUED→CANCELLED`, `RUNNING→COMPLETED/FAILED/CANCELLED` | ADR-002 §10 | **DEFINIDA** |
| D-012 | `completedAt` = momento de estado terminal | ADR-002 §10 | **DEFINIDA** |
| D-013 | Progress: `{ source, stage, message, percentage }` | ADR-002 §14 | **DEFINIDA** |
| D-014 | `percentage` entero 0-100 | ADR-002 §14 | **DEFINIDA** |
| D-015 | Source: `"google_maps"` (minúsculas) | ADR-002 §15 | **DEFINIDA** |
| D-016 | Callback contiene: `eventId`, `jobId`, `sequence`, `status`, `timestamp` | ADR-002 §22 | **DEFINIDA** |
| D-017 | `eventId` = UUID | ADR-002 §22 | **DEFINIDA** |
| D-018 | `sequence` = entero incremental por Job | ADR-002 §22 | **DEFINIDA** |
| D-019 | Platform ignora eventos duplicados y secuencia menor/igual | ADR-002 §22 | **DEFINIDA** |
| D-020 | Callback no revierte estado terminal | ADR-002 §22 | **DEFINIDA** |
| D-021 | Resultados temporales = responsabilidad de Platform | ADR-002 §17 | **DEFINIDA** |
| D-022 | No existe `ProspectingResult` permanente para MVP | ADR-002 §17 | **DEFINIDA** |
| D-023 | Descartar resultados NO cambia estado del Job | ADR-002 §17 | **DEFINIDA** |
| D-024 | Platform soporta `Idempotency-Key` en creación de Jobs | ADR-002 §27 | **DEFINIDA** |
| D-025 | Misma key + mismo payload → mismo Job | ADR-002 §27 | **DEFINIDA** |
| D-026 | Misma key + payload diferente → `409 CONFLICT` | ADR-002 §27 | **DEFINIDA** |
| D-027 | Platform → Service: `jobId` es la identidad (no otra capa) | ADR-002 §27 | **DEFINIDA** |
| D-028 | Cancelación: `POST /api/v1/prospecting-jobs/{id}/cancel` | ADR-002 §26 | **DEFINIDA** |
| D-029 | Cancelación reglas: QUEUED→CANCELLED, RUNNING→solicitud, CANCELLED→200, COMPLETED/FAILED→409 | ADR-002 §26 | **DEFINIDA** |
| D-030 | Si Platform no inicia el Service, Job → `FAILED` | ADR-002 §25 | **DEFINIDA** |
| D-031 | Response wrapper: `{ success, data, meta }` | ADR-002 §6 | **DEFINIDA** |
| D-032 | Error response: `{ success, error: { code, message, details, timestamp } }` | ADR-002 §7 | **DEFINIDA** |
| D-033 | Recursos paginados: `users`, `campaigns`, `prospects`, `prospecting-jobs` | ADR-002 §9 | **DEFINIDA** |
| D-034 | `page` = 1-based, `limit` max 100 | ADR-002 §9 | **DEFINIDA** |
| D-035 | Versionado: `/api/v1/...` para Platform y Service | ADR-002 §7 | **DEFINIDA** |
| D-036 | Flutter → Platform = JWT | ADR-002 §28 | **DEFINIDA** |
| D-037 | Platform → Service = `X-API-Key` | ADR-002 §28 | **DEFINIDA** |
| D-038 | Platform autentica callback de Service | ADR-002 §28 | **DEFINIDA** |
| D-039 | Service NO autoriza basado en `tenantId` | ADR-002 §28 | **DEFINIDA** |

**Total de decisiones DEFINIDAS en Fase 2: 39.**

---

# 24. Decisiones INFERIDAS

| ID | Decisión | Evidencia | Razonamiento | Confianza |
|----|----------|-----------|--------------|-----------|
| I-001 | Platform crea el Job en la base de datos antes de llamar al Service | ADR-002 §24: "Platform es propietario del estado persistente"; ADR-002 §21: el request a Service contiene `jobId` | Para tener un `jobId` que enviar al Service, debe existir en DB. | **Alta** |
| I-002 | El callback endpoint de Platform es interno y no está documentado en OpenAPI pública | ADR-002 §22: es interno; no aparece en la lista de endpoints de Platform API | Flutter no debe consumirlo. Solo Service lo usa. | **Alta** |
| I-003 | `resultsAvailable: boolean` permite distinguir `null` (no disponible) de `[]` (sin resultados) | ADR-002 §14: detalle del Job incluye `resultsAvailable` y `results` nullable | Es la única forma de diferenciar "aún no llegaron" de "no hay datos". | **Alta** |
| I-004 | `requestedBy` en el Job Detail es el nombre del usuario que creó el Job | ADR-002 §14: `requestedBy: { id, name }` | Coherente con el campo `requestedBy` en Prisma. | **Alta** |
| I-005 | Los datos de exportación provienen de los resultados temporales en caché | ADR-002 §20: exportación de resultados del Job. No hay persistencia de resultados. | Coherente con el flujo de resultados temporales. | **Alta** |

---

# 25. Decisiones ABIERTAS / POSTERGADAS

| ID | Decisión | Impacto | Prioridad | Estado | Fuente |
|----|----------|---------|-----------|--------|--------|
| P-001 | Estrategia de caché para resultados temporales (en memoria, Redis) | Resultados se pierden al reiniciar Platform | **POSTERGADA (Fase 4)** | ADR-002 §17 |
| P-002 | TTL de resultados temporales | Duración de disponibilidad de resultados | **POSTERGADA (Fase 4)** | ADR-002 §17 |
| P-003 | Timeout operativo para ejecución de Jobs | Límite de tiempo de ejecución | **POSTERGADA (Fase 4)** | ADR-002 §18 |
| P-004 | Mecanismo físico de cancelación (abort HTTP, DELETE, cola) | Cómo detener Service/Engine | **POSTERGADA (Fase 4)** | ADR-002 §26 |
| P-005 | Política de reintentos para callbacks fallidos | Resiliencia del callback | **POSTERGADA (Fase 4)** | ADR-002 §22 |
| P-006 | Mecanismo concreto de autenticación de callback (API Key, IP, mTLS) | Seguridad del callback | **POSTERGADA (Fase 3)** | ADR-002 §28 |
| P-007 | Expiración y refresh de JWT | Gestión de sesión de usuario | **POSTERGADA (Fase 3)** | ADR-002 §32 |
| P-008 | Rotación de API Key (Platform ↔ Service) | Seguridad de integración | **POSTERGADA (Fase 3)** | ADR-002 §32 |
| P-009 | Rate limiting | Protección contra abusos | **POSTERGADA (Fase 3)** | ADR-002 §32 |
| P-010 | Implementación de exportación CSV/XLSX (detalles de columnas) | Formato concreto del archivo | **POSTERGADA (Fase 4)** | ADR-002 §20 |
| P-011 | RLS en PostgreSQL | Protección extra multi-tenant | **POSTERGADA (Fase 4)** | ADR-002 §33 |

**No hay decisiones ABIERTAS sin postergar. Todas están resueltas o explícitamente postergadas.**

---

# 26. Propuestas técnicas

| ID | Propuesta | Razonamiento | Impacto | Estado |
|----|-----------|--------------|---------|--------|
| PR-001 | Usar `cuid()` para IDs en lugar de UUID v4 | Heredado de Prisma. Decisión de implementación técnica. | Bajo | **PROPUESTA (aceptada en Prisma)** |
| PR-002 | Usar `Idempotency-Key` en header (no en body) | Práctica común en APIs REST. | Bajo | **PROPUESTA (adoptada en ADR-002)** |
| PR-003 | En caso de fallo de callback, Platform reintente manualmente | No definido, pero lógico. | Medio | **PROPUESTA** |
| PR-004 | Serializar `error` de Prisma como `"CODE: message"` | ADR-002 §10: no se define parsing formal. | Bajo | **PROPUESTA** |

---

# 27. Matriz de trazabilidad

| Decisión | Contrato | Componente | Persistencia | Fuente |
|----------|----------|------------|--------------|--------|
| Platform dueño del Job | `ProspectingJob` | Platform | `ProspectingJob` (Prisma) | ADR-002 §24 |
| JWT para Flutter | Header `Authorization` | Platform | — | ADR-002 §28 |
| API Key para Service | Header `X-API-Key` | Service | — | ADR-002 §28 |
| Callback con `eventId`/`sequence` | Evento JSON | Service → Platform | — | ADR-002 §22 |
| Estados de Job | Campo `status` | Platform | `ProspectingJob.status` | ADR-002 §10 |
| `query` como JSON | Campo `query` | Platform | `ProspectingJob.query` | ADR-002 §4.8 |
| `BusinessResult` | DTO | Service → Platform | Temporal (caché) | ADR-002 §15 |
| `sourceIdentifier` | Campo en `BusinessResult` y `Prospect` | Platform | `Prospect.sourceIdentifier` | ADR-002 §18 |
| `tenantId` en Service | Campo en request | Platform → Service | No persistido por Service | ADR-002 §21 |

---

# 28. Matriz API Contract vs Persistent Model

| Concepto | API / DTO | Persistencia Prisma | ¿Mismo objeto? | Mapping |
|----------|-----------|---------------------|----------------|---------|
| User | `User` (DTO) | `User` (Prisma) | **NO** (passwordHash oculto) | Sí, excluyendo hash |
| Campaign | `Campaign` (DTO) | `Campaign` (Prisma) | **NO** (incluye métricas calculadas) | Sí, con campos adicionales de UI |
| Prospect | `Prospect` (DTO) | `Prospect` (Prisma) | **NO** (incluye `campaigns` en detalle) | Sí, con joins |
| ProspectingJob | `ProspectingJobSummary/Detail` | `ProspectingJob` (Prisma) | **NO** (incluye `results`, `progress`, `requestedBy` objeto) | Sí, con relaciones y caché |
| BusinessResult | `BusinessResult` (DTO) | — | **NO** (no es persistente) | Temporal, mapping a `Prospect` |
| PipelineProgress | `PipelineProgress` (DTO) | — | **NO** (no es persistente) | Solo integración |
| ProspectingJobEvent | `ProspectingJobEvent` (DTO) | — | **NO** (no es persistente) | Solo callback |
| ErrorResponse | `ErrorResponse` (DTO) | `ProspectingJob.error` (String) | **NO** (estructurado vs string) | Mapeo a string en persistencia |

---

# 29. Modelo de integración completo

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                               FLUTTER                                      │
│                                                                             │
│  - Presentación                                                             │
│  - Navegación                                                               │
│  - Estado de UI                                                             │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    │ HTTPS + JWT (Bearer)
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PLATFORM BACKEND (NestJS)                        │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          PLATFORM API                               │   │
│  │                                                                     │   │
│  │  /auth/login, /auth/me, /tenants, /users, /campaigns, /prospects   │   │
│  │  /prospecting-jobs (CRUD + cancel + persist + export)              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          DOMAIN & PERSISTENCE                       │   │
│  │                                                                     │   │
│  │  Tenant, User, UserTenant, Role, Campaign, Prospect,              │   │
│  │  CampaignProspect, ProspectingJob (Prisma + PostgreSQL)            │   │
│  │                                                                     │   │
│  │  - Propietario del Job                                              │   │
│  │  - Gestor de resultados temporales (caché)                         │   │
│  │  - Detección de duplicados                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    INTEGRATION CLIENT (Service Adapter)              │   │
│  │                                                                     │   │
│  │  - Llama a Prospector Service con jobId, tenantId, query, callback  │   │
│  │  - Recibe callbacks y actualiza Job/resultados                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    │ HTTP + X-API-Key
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROSPECTOR SERVICE (FastAPI/Python)                 │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    INTERNAL API (Platform → Service)                 │   │
│  │                                                                     │   │
│  │  POST /api/v1/prospecting/jobs                                      │   │
│  │  Request: { jobId, tenantId, query, callbackUrl }                  │   │
│  │  Response: 202 Accepted { jobId, status, acceptedAt }              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      ORCHESTRATOR / EXECUTOR                        │   │
│  │                                                                     │   │
│  │  - Valida request                                                    │   │
│  │  - Inicia el Engine                                                  │   │
│  │  - Escucha eventos de progreso                                       │   │
│  │  - Construye eventos (eventId, sequence)                            │   │
│  │  - Envía callbacks a Platform                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          CALLBACK CLIENT                            │   │
│  │                                                                     │   │
│  │  POST /api/v1/internal/prospecting-jobs/{jobId}/events             │   │
│  │  Payload: { eventId, jobId, sequence, status, progress, results? } │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    │ Python internal calls
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PROSPECTOR ENGINE (Python)                         │
│                                                                             │
│  - Google Maps navigation                                                    │
│  - Result loading / scrolling                                               │
│  - Business extraction                                                      │
│  - Detail panel enrichment                                                  │
│  - Website enrichment                                                       │
│  - Normalization                                                            │
│  - Deduplication (técnica)                                                  │
│                                                                             │
│  Output: BusinessResult[]                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Información que cruza cada frontera

| Frontera | Información que cruza |
|----------|------------------------|
| **Flutter → Platform** | Credenciales, DTOs de recursos (Campaign, Prospect, Job), query params (paginación, filtros), acciones (cancel, persist, export) |
| **Platform → Flutter** | JWT, DTOs de recursos, errores estructurados, archivos binarios (exportación) |
| **Platform → Service** | `jobId`, `tenantId`, `query`, `callbackUrl` |
| **Service → Platform** | Callbacks con `eventId`, `sequence`, `status`, `progress`, `results` (BusinessResult), `error` |
| **Service → Engine** | `SearchQuery` (keyword, location, source, limit) |
| **Engine → Service** | `BusinessResult[]` con datos enriquecidos |

---

# 30. Checklist de decisiones de Fase 2

### Decisiones CRÍTICAS

| # | Pregunta | Respuesta | Fuente | Estado |
|---|----------|-----------|--------|--------|
| C-01 | ¿Quién crea el Job? | Platform | ADR-002 §24 | **DEFINIDA** |
| C-02 | ¿Quién es propietario del Job? | Platform | ADR-002 §24 | **DEFINIDA** |
| C-03 | ¿Flutter habla directamente con Service? | No | ADR-002 §3 | **DEFINIDA** |
| C-04 | ¿Qué protocolo usan Platform y Service? | HTTP | ADR-002 §21 | **DEFINIDA** |
| C-05 | ¿Cómo se reportan resultados? | Callback Service → Platform | ADR-002 §22 | **DEFINIDA** |
| C-06 | ¿Cómo se reporta progreso? | Callback con `progress` | ADR-002 §22 | **DEFINIDA** |
| C-07 | ¿Cómo se reportan errores de ejecución? | Callback `FAILED` con `error` | ADR-002 §22 | **DEFINIDA** |
| C-08 | ¿Cómo se cancela? | `POST /.../cancel` en Platform | ADR-002 §26 | **DEFINIDA** |
| C-09 | ¿Dónde se almacenan temporalmente los resultados? | Caché en Platform | ADR-002 §17 | **DEFINIDA** |
| C-10 | ¿Qué objeto se persiste como Prospect? | Platform mapea `BusinessResult` → `Prospect` | ADR-002 §18 | **DEFINIDA** |

### Decisiones IMPORTANTES

| # | Pregunta | Respuesta | Fuente | Estado |
|---|----------|-----------|--------|--------|
| I-01 | ¿Cuál es el wrapper de respuesta? | `{ success, data, meta }` | ADR-002 §6 | **DEFINIDA** |
| I-02 | ¿Cuál es el wrapper de error? | `{ success, error: { code, message, details, timestamp } }` | ADR-002 §7 | **DEFINIDA** |
| I-03 | ¿Cómo se pagina? | `page` (1-based) + `limit` (max 100) | ADR-002 §9 | **DEFINIDA** |
| I-04 | ¿Qué recursos están paginados? | `users`, `campaigns`, `prospects`, `prospecting-jobs` | ADR-002 §9 | **DEFINIDA** |
| I-05 | ¿Cómo se autentica Flutter? | JWT Bearer | ADR-002 §28 | **DEFINIDA** |
| I-06 | ¿Cómo se autentica Platform → Service? | `X-API-Key` | ADR-002 §28 | **DEFINIDA** |
| I-07 | ¿Cómo se maneja idempotencia? | `Idempotency-Key` para creación | ADR-002 §27 | **DEFINIDA** |
| I-08 | ¿Qué contiene un evento de callback? | `eventId`, `jobId`, `sequence`, `status`, `timestamp`, `progress`, `results`, `error` | ADR-002 §22 | **DEFINIDA** |
| I-09 | ¿Qué contiene `BusinessResult`? | 10 campos (name a metadata) | ADR-002 §15 | **DEFINIDA** |

### Decisiones POSTERGABLES

| # | Pregunta | Estado |
|---|----------|--------|
| P-01 | ¿Estrategia de caché? | POSTERGADA (Fase 4) |
| P-02 | ¿TTL de resultados? | POSTERGADA (Fase 4) |
| P-03 | ¿Timeout de Jobs? | POSTERGADA (Fase 4) |
| P-04 | ¿Mecanismo físico de cancelación? | POSTERGADA (Fase 4) |
| P-05 | ¿Retry de callbacks? | POSTERGADA (Fase 4) |
| P-06 | ¿Autenticación concreta de callback? | POSTERGADA (Fase 3) |
| P-07 | ¿JWT expiration/refresh? | POSTERGADA (Fase 3) |
| P-08 | ¿API Key rotation? | POSTERGADA (Fase 3) |

---

# 31. Estado final de la Fase 2

### Resumen por categoría

| Categoría | DEFINIDA | INFERIDA | ABIERTA | POSTERGADA | PROPUESTA | CONTRADICTORIA |
|-----------|----------|----------|---------|------------|-----------|----------------|
| **Contratos API** | 27 endpoints | 0 | 0 | 0 | 0 | 0 |
| **DTOs / Estructuras** | 12 | 0 | 0 | 0 | 0 | 0 |
| **Eventos / Callbacks** | 1 (definido) | 0 | 0 | 0 | 0 | 0 |
| **Reglas de integración** | 15 | 5 | 0 | 0 | 0 | 0 |
| **Seguridad (contractual)** | 3 | 0 | 0 | 5 | 0 | 0 |
| **Infraestructura** | 0 | 0 | 0 | 6 | 0 | 0 |
| **Total** | **58** | **5** | **0** | **11** | **4** | **0** |

### Nivel de confianza general

> **ALTO**

- Las decisiones fundamentales (ownership, callbacks, estados, mapping) están **formalizadas en ADR-002**.
- No existen contradicciones abiertas entre fuentes.
- Las decisiones postergadas están **claramente delimitadas** para Fase 3 (Seguridad) y Fase 4 (Infraestructura).
- Los contratos son **suficientemente específicos** para iniciar implementación en paralelo de Flutter, Platform Backend y Prospector Service.

### Justificación

- **ADR-002** es el documento de mayor autoridad y resuelve activamente las ambigüedades de documentos previos.
- La separación entre `API Contract`, `Integration DTO` y `Persistent Model` está explícitamente declarada y aplicada.
- El modelo Prisma congelado es coherente con los DTOs de API, distinguiendo claramente qué es persistente (`Prospect`, `ProspectingJob`) y qué es temporal (`BusinessResult`, `PipelineProgress`).
- Los flujos de creación, ejecución, cancelación, persistencia y exportación de Jobs están completamente especificados.

---

# 32. Conclusiones finales

1. **La Fase 2 está documentalmente cerrada.** Todos los contratos requeridos para que Flutter, Platform Backend y Prospector Service implementen en paralelo están definidos.

2. **No hay decisiones abiertas que bloqueen la implementación.** Las decisiones postergadas pertenecen a Fase 3 o Fase 4 y no afectan la capacidad de escribir código funcional.

3. **La separación de capas es sólida.** La documentación distingue claramente entre lo que es persistente (Prisma), lo que es de integración (BusinessResult, eventos) y lo que es API pública (DTOs).

4. **El ADR-002 es la fuente de verdad definitiva.** Cualquier contradicción con documentos anteriores ha sido resuelta explícitamente en él.

5. **El equipo puede comenzar la implementación** de los tres componentes utilizando este análisis como guía de los contratos y responsabilidades.

---

**FASE 2 — CERRADA DOCUMENTALMENTE**

*Análisis basado exclusivamente en las fuentes documentales del proyecto. Fecha: 7 de septiembre de 2026.*
