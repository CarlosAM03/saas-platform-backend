# Auditoría previa al spec — Sprint Campañas / Prospectos
Fecha de referencia: 2026-11-19. Estado: revisión, NO arnés de ejecución ni autorización de código.

## Dirección y secuencia aprobadas
- Carlos es la autoridad de negocio, arquitectura, autenticación/autorización, prospección e integración y controla revisión, aceptación y cierre/merge de PR.
- Ángel: backend NestJS / Prisma / PostgreSQL para ampliación interna de campañas y prospectos, posteriormente genera handoff/arnés frontend con el contrato realmente implementado.
- André: frontend Flutter siguiendo arquitectura y contrato real; puede preparar UI con mocks explícitos pero no asumir APIs nuevas como existentes.
- Cerrar deuda de ramas previas antes del sprint; el owner revisa y cierra PR por su cuenta. No modificar/mergear/desplegar de manera autónoma.
- **Repositorios y ramas actuales para lectura:**
  - Backend `CarlosAM03/saas-platform-backend`, rama `feat/tenant-register`, PR #10 abierto hacia `main`, HEAD `5e214420394101ae7079f8e844cc759b01cce2a3` (observado hoy). https://github.com/CarlosAM03/saas-platform-backend/pull/10
  - Frontend `CarlosAM03/saas-platform-client`, rama `feat/tenant-register`, PR #11 abierto hacia `main`, HEAD `0fe5d368e11b1da745ccf42ead3892470dcae0be` (observado hoy). https://github.com/CarlosAM03/saas-platform-client/pull/11
- PR #10 y #11 reportan CI SUCCESS; no sustituyen revisión humana, pruebas sobre futuros SHAs ni promoción a main. El owner aclaró explícitamente que él cerrará los PR.
- Elegir base del nuevo sprint solo al pasar gate: sobre `main` actualizado tras merge aprobado o sobre el HEAD de PR final validado durante revisión, según autorización explícita del owner. Jamás asumir `dev` como rama más actual.

## Selección de funcionalidades aprobadas para refinamiento
Campañas: C1 pipeline comercial (seis etapas como punto de partida: Sin gestionar, En investigación, Contactado, En seguimiento, Oportunidad, Cerrado); C2 evaluación manual por campaña (Sin evaluar, Apto, No apto, justificación para No apto e historial de cambios); C3 bitácora por campaña; C4 responsable por participación; C6 filtros avanzados; C8 dashboard por campaña.
Prospectos: P1 coincidencia y reutilización; P2 vista de campañas asociadas; P3 procedencia y apariciones; P4 validación/importación CSV evolucionada.
Fuera de alcance: tareas/recordatorios C5, acciones masivas C7, scoring C9, cambios de ciclo de vida C10, exportación C11; prospector service/engine; cambios no aprobados a Auth, RBAC, TenantContext o integraciones.

## Modelo real encontrado (PR backend #10)
- `Prisma/schema.prisma`: `Campaign` con estado `ACTIVA|PAUSADA|COMPLETADA|ARCHIVADA`; `Prospect` con `tenantId`, `campaignId` (origen), source, datos maestros, `status ACTIVO|INACTIVO`; `CampaignProspect(campaignId, prospectId)` con `status String @default("ACTIVO")` y `addedAt`; clave única en Prospect `(tenantId,campaignId,source,sourceIdentifier)`.
- El campo `CampaignProspect.status` existente NO debe confundirse automáticamente con la nueva etapa comercial; verificar usos, migraciones y contratos antes de resignificarlo.
- `CampaignsService.findProspects` retorna prospectos por origen o relación, deduplicados, con búsqueda nombre/email, pero no da estado/owner/evaluación contextual.
- Creación manual de Prospect requiere campaignId y escribe Prospect y CampaignProspect transaccionalmente; la versión examinada NO aplica detección de duplicados al crear manualmente.
- CSV V1 (`src/prospects/imports/`) ya dispone de preview/confirm, clasificaciones NEW/MATCH/INVALID/CONFLICT; acciones CREATE/LINK_EXISTING/UPDATE_EXISTING/SKIP; nombre normalizado como selección de candidatos dentro del tenant; verificación de snapshot firmado 15 min, transacción serializable en confirm; límites CSV 5MB/1000 filas; sin historial durable de importación ni idempotencia durable. En caso de MATCH, la UI puede decidir vincular o actualizar; CONFLICT por varios candidatos requiere corregir y volver a importar. UPDATE_EXISTING afecta datos maestros en todas las campañas.
- `Prospect.campaignId` es origen, no la relación única. P2 y P3 deben contemplar orígenes históricos y asociaciones.
- ADR-001 (histórico) afirma que duplicado por campaña es simplificación deliberada. Nueva decisión aprobada: registro maestro por tenant compartido entre campañas; requiere reconciliación documental explícita sin inventar autoridad o cambiar unilateralmente ADR-004.
- Fuente de revisión: https://github.com/CarlosAM03/saas-platform-backend/blob/feat/tenant-register/Prisma/schema.prisma ; https://github.com/CarlosAM03/saas-platform-backend/blob/feat/tenant-register/src/prospects/imports/README.md ; https://github.com/CarlosAM03/saas-platform-backend/blob/feat/tenant-register/src/prospects/README.md ; https://github.com/CarlosAM03/saas-platform-backend/blob/feat/tenant-register/MODULE-DEVELOPMENT.md

## Frontend real encontrado (PR #11)
- Flutter con `lib/features/campaigns/{data,presentation,state,widgets}`, `lib/features/prospects/{data,presentation,state}`, `lib/features/dashboard`, `lib/platform_api/` tipada, Riverpod y GoRouter.
- Detalle de campaña muestra pestañas Detalle/Prospectos; no pipeline ni bitácora ni dashboard por campaña.
- Importación CSV UI ya presenta decisiones y advertencia de UPDATE de prospectos compartidos; no reconstruir desde cero.
- Dashboard actual es global del tenant (campañas/prospectos/jobs), no C8 por campaña.
- `FEATURE-DEVELOPMENT.md` exige backend como autoridad de reglas de negocio y limita áreas protegidas del frontend.
- Fuentes: https://github.com/CarlosAM03/saas-platform-client/blob/feat/tenant-register/FEATURE-DEVELOPMENT.md ; https://github.com/CarlosAM03/saas-platform-client/blob/feat/tenant-register/lib/features/campaigns/presentation/campaigns_page.dart ; https://github.com/CarlosAM03/saas-platform-client/blob/feat/tenant-register/lib/features/prospects/presentation/prospect_import_page.dart

## Reglas que requieren cierre antes del spec
1. **Identidad inequívoca:** definir señales suficientes y la precedencia (sourceIdentifier válido + fuente / dominio / otras combinaciones), manejo de campos vacíos/cambios, casos homónimos y casos ambiguos. No asumir que normalizar nombre prueba identidad. Preservar decisiones de CSV V1 hasta reemplazo formal.
2. **P1 transversal:** acordar alcance específico sobre creación manual, CSV y futuros ingresos externos SIN tocar Service; definir cómo se reusa prospecto y no duplica por tenant.
3. **Duplicados históricos:** política de datos preexistentes en campañas distintas, reconciliación manual o diferida; prohibir fusiones automáticas y pérdidas de asociaciones, procedencias e historiales.
4. **Pipeline:** seis etapas provisionales; etapa inicial, cambios libres o transiciones restringidas, significado de Cerrado (no equivale necesariamente a venta); distinguir Prospect.status ACTIVO/INACTIVO, Campaign.status y CampaignProspect.status.
5. **Evaluación:** Sin evaluar/Apto/No apto; motivo obligatorio al seleccionar No apto, historial de actor/hora/motivo y cambios; sin reescritura de valoración en otras campañas.
6. **Bitácora:** eventos automáticos de cambios vs actividad manual de contacto; política de correcciones/eliminación, conservación y privacidad de datos; no ejecutar comunicación externa.
7. **Responsable:** elegibilidad de UserTenant actual activo, política al desactivar/remover usuario, quién asigna/reasigna según RBAC actual; preservar nombre/ID histórico cuando proceda, sin rediseño Auth.
8. **P2/P3:** visibilidad intercampañas según roles actuales; diferencia entre origen, asociación, aparición detectada pero no asociada, y actualización del dato maestro; qué eventos se pueden reconstruir del pasado y cuáles no.
9. **P4 importación:** continuidad de preview firmado, límites, validaciones, atomicidad, 409 de cambios concurrentes, permiso ADMIN/OWNER, alerta por UPDATE_EXISTING; si se agrega historial durable/import IDs implica decisión y migración; no representar previsualización como persistencia.
10. **C6 filtros:** campos, semántica AND/OR, paginación/orden server side, índices y performance sobre todo el conjunto, nunca solo la página cargada.
11. **C8 dashboard:** definición exacta de denominador por prospecto único en campaña, estados, cambios en el tiempo, reparto por responsable, aptitud; no estimar conversiones monetarias o email open/click sin eventos reales.
12. **Migraciones y contratos:** diseñar extensión segura de CampaignProspect y bitácora/eventos; backfill de relaciones de origen; preservar datos y FK; versionar OpenAPI/Swagger, mantener compatibilidad HTTP y DTOs; pruebas PG reales y multi-tenant, permisos y concurrencia.
13. **Seguridad y autoridad:** revisión de jerarquía de ADRs y derechos de cambio; ADR-004/ADR-003/ADR-006 y autorización vigente, sin modificaciones implícitas por agente.
14. **Entrega a André:** contrato real, matrices request/response/error/roles, seeds sintéticos y plan de pruebas, handoff/arnés frontend generado por Ángel tras implementar backend; sin crear supuestas operaciones antes del backend.
15. **Release gate y trabajo previo:** owner cierra PR10/11, define ref final, confirma SHA y checks; nueva rama aislada para el sprint desde referencia autorizada, y evidencia del estado inicial; no merge/deploy/push destructivo autónomo.

## Reglas operativas para el futuro arnés
- Antes de escribir: comprobar remoto, ref actual, HEAD, git status, cambios no trackeados, documentación vigente, contratos/Swagger y evidencia de deuda de rama. Si entorno cambia respecto a esta auditoría, reauditar.
- Dar libertad a Ángel para diseño interno de campañas/prospectos, pero exigir decisiones trazables, criterios verificables, migraciones conservadoras, compatibilidad y tests. Escalar decisiones fuera de alcance o conflicto de autoridad al owner.
- Mantener todo el trabajo del prospector/service/integración/Auth fuera del sprint. No bloquear el código por carencia de Service.
- Guardar QA, decisiones, evidencias, contratos, cambios y handoff dentro de la carpeta de arnés; distinguir resultados observados de expectativas.
- Este documento es informativo: no modifica repositorios ni autoriza merge, despliegue o cambios de producción.
