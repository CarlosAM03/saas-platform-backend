# G4 — Reconciliación contractual CP

- Fecha histórica inicial: `2026-11-22T12:33:46-08:00`
- HEAD base histórico: `c75ad08c2619e8c32eec6661a3f9ad8b5a38eb3b`
- HEAD actual verificado: `d262f48e9ab6b344c472df60588c2261d377c884`
- Método: comparación controladores NestJS contra `Docs/Contracts/platform-api.v1.yaml`, documento servido por `deploymentDocument()` y aserciones E2E.
- Resultado actual: `PASS PARCIAL` para presencia/paridad de rutas CP; G4 sigue abierto por cobertura funcional T01–T31 completa y rendimiento.

## Operaciones reconciliadas

| Área | Operaciones |
|---|---|
| Participación de campaña | `GET /campaigns/{campaignId}/prospects/{prospectId}/participation`, `PATCH .../stage`, `PATCH .../evaluation` |
| Responsable | `GET .../responsibles`, `PUT .../responsible`, `DELETE .../responsible` |
| Bitácora | `GET .../activities`, `POST .../activities` |
| Dashboard y filtros | `GET /campaigns/{id}/dashboard`; filtros documentados de `GET /campaigns/{id}/prospects` |
| Prospecto maestro | `POST /prospects/match`, `POST /prospects/resolve`, `GET /prospects/{id}/campaigns`, `GET /prospects/{id}/provenance` |

Las operaciones anteriores usan `x-contract-status: AVAILABLE` en el YAML y fueron confirmadas por `test/without-prospector.e2e-spec.ts` en Swagger servido. El test pasó 5/5 y el build posterior pasó.

## Evidencia y límites

- El registro histórico `CONTRACT_ONLY` fue reemplazado por reconciliación verificable; no se añade aquí un PASS integral de G4.
- No se modificaron Auth, JWT, RBAC, TenantContext, Users/Tenants ni Jobs/Prospector.
- La ausencia de datos funcionales de todas las AC/Txx mantiene T01–T31 en ejecución parcial.
