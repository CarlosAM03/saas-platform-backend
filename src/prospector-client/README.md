# Prospector Client Module

## Proposito

Encapsular la comunicacion Platform Backend -> Prospector Service. No contiene el motor de prospeccion ni logica de dominio de Jobs.

## Contrato relacionado

- `POST /api/v1/prospecting/jobs` en `prospector-service-api.v1.yaml`.
- Callbacks internos de eventos hacia Platform Backend.

## Dependencias

- `@nestjs/config` para `PROSPECTOR_SERVICE_URL` y `PROSPECTOR_API_KEY`.
- `ProspectingJobsModule` como consumidor del cliente.
- DTOs de integracion definidos por el contrato OpenAPI.
- Pino para logging de requests externos sin exponer API keys.

## Reglas

Enviar `X-API-Key` solo al servicio interno. No exponer este cliente directamente a Flutter. No persistir Jobs ni resultados en este modulo. Los timeouts, reintentos y cancelacion fisica deben respetar decisiones posteriores y no inventarse aqui.

La implementacion funcional queda fuera del baseline F4. Consultar `MODULE-DEVELOPMENT.md`.
