# Contratos API V1

Este directorio contiene el contrato HTTP V1 de la plataforma. Los YAML son la referencia para generar DTOs, clientes y mocks; no son implementación NestJS ni modelos Prisma.

## Archivos

- `platform-api.v1.yaml`: API pública consumida por Flutter y provista por Platform Backend. Incluye autenticación, tenants, usuarios, campañas, prospectos y Jobs.
- `prospector-service-api.v1.yaml`: API interna entre Platform Backend y Prospector Service. Incluye la aceptación de Jobs y el callback Service -> Platform.
- `API_V1_AUDIT.md`: trazabilidad, contradicciones, decisiones y riesgos identificados al contrastar ADRs, dominio y Prisma.

## Límites

Flutter solo consume Platform API mediante `Authorization: Bearer <JWT>`. Flutter no llama directamente a Prospector Service. Platform es dueño del estado persistente de `ProspectingJob`, de los resultados temporales y de la decisión de persistir o exportar.

Platform llama a Prospector Service con `X-API-Key`. El Service llama al callback interno de Platform con `X-API-Key`. La API Key concreta, su rotación y la política operativa de seguridad quedan postergadas a Fase 3.

## Tenant y persistencia

La arquitectura V1 usa Shared Database + Shared Schema + Tenant ID. El tenant de las operaciones de negocio se resuelve desde el contexto autenticado y no se acepta como parámetro arbitrario de Flutter. `tenantId` aparece en el detalle del Job y en el request interno porque forman parte de contratos ya definidos, no porque el cliente pueda elegir libremente el tenant.

Los recursos API son DTOs. `passwordHash` nunca se expone. `BusinessResult`, `PipelineProgress`, `results`, `progress` y `resultsAvailable` son estructuras de integración, computadas o temporales; no crean una tabla `ProspectingResult`.

## Evolución

La versión se expresa en la ruta (`/api/v1`). Cambios incompatibles deben publicarse bajo `/api/v2`; cambios compatibles pueden añadir propiedades opcionales, estados de metadatos o nuevos endpoints tras actualizar la trazabilidad. Antes de cambiar un DTO, actualizar ADR-002 y este directorio, y comprobar el mapping hacia Prisma.

La V1 evita fijar refresh tokens, expiración o revocación de JWT, rate limiting, rotación de claves, RLS, TTL/cache concreto, reintentos, timeout operativo y mecanismo físico de cancelación. Esos puntos están documentados como postergados y no deben inferirse del YAML.

## Nota de compatibilidad

ADR-002 define la exportación como `GET /api/v1/prospecting-jobs/{id}/export?format=csv|xlsx`; por eso el contrato V1 usa GET aunque algunos listados preliminares hayan mostrado POST. No se añade un alias POST sin una decisión posterior explícita.
