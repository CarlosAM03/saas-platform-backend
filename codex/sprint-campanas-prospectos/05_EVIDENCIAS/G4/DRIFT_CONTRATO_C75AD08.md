# G4 — DRIFT contractual pendiente

- Fecha: `2026-11-22T12:33:46-08:00`
- HEAD: `c75ad08c2619e8c32eec6661a3f9ad8b5a38eb3b` con worktree no confirmado
- Método: comparación estática de controladores NestJS contra `Docs/Contracts/platform-api.v1.yaml` y `deploymentDocument()`.
- Resultado: `FAIL` de paridad contractual; no se marca ninguna operación como `AVAILABLE` en Swagger hasta documentarla y verificarla.

## Implementado en controladores, ausente del YAML y Swagger servido

| Área | Operaciones ausentes |
|---|---|
| Participación de campaña | `GET /campaigns/{campaignId}/prospects/{prospectId}/participation`, `PATCH .../stage`, `PATCH .../evaluation` |
| Responsable | `GET .../responsibles`, `PUT .../responsible`, `DELETE .../responsible` |
| Bitácora | `GET .../activities`, `POST .../activities` |
| Dashboard y filtros | `GET /campaigns/{id}/dashboard`; los filtros `category`, `address`, `source`, `stage`, `evaluation`, `responsibleId` de `GET /campaigns/{id}/prospects` |
| Prospecto maestro | `POST /prospects/match`, `POST /prospects/resolve`, `GET /prospects/{id}/campaigns`, `GET /prospects/{id}/provenance` |

## Observaciones

- `deploymentDocument()` carga el YAML base y solo transforma operaciones de Jobs y Tenant Registration; no añade las rutas anteriores.
- Las rutas están protegidas por `@Roles`; las de creación, match y resolve restringen adicionalmente a `ADMIN`/`OWNER`.
- La paridad requiere definir request, response, errores y disponibilidad desde los DTO y servicios reales. No se modifica el YAML en este registro para evitar publicar campos no verificados.
- Este DRIFT mantiene G4 y el handoff G5 bloqueados para cierre, aunque las correcciones de migración ya fueron verificadas.
