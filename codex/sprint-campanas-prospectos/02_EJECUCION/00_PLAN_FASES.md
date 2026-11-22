# Plan operativo orientado a resultados (G0–G8)

No asigna números obligatorios a tablas, rutas o commits. Cada gate tiene un documento de evidencia. Un gate de revisión no es una puerta para despliegues.

| Gate | Responsable | Trabajo | Salida verificable |
|---|---|---|---|
| G0 | Owner | Cerrar/revisar PR previos, fijar SHA y GO | `05_EVIDENCIAS/G0/AUTORIZACION_BASE_OWNER.md` + preflight |
| G1 | Ángel | Reauditar SHA, contratos, estado de módulo, riesgos | `G1/RECONCILIACION.md`, inventario y drift |
| G2 | Ángel | Diseño interno, migraciones, API, test plan | `G2/DISENO_LOCAL.md`, matriz de decisiones |
| G3 | Ángel | Implementación en rama nueva, pruebas incrementales | `G3/DIARIO_IMPLEMENTACION.md` y código por feature |
| G4 | Ángel | Unit/E2E/PG, migraciones legacy, aislamiento, contrato real | `G4/MATRIZ_QA.md`, reporte por SHA, resultados |
| G5 | Ángel | Handoff, contrato y arnés André generados desde backend | `G5/HANDOFF.md` + arnés frontend entregable |
| G6 | Owner | Revisión PR backend; correcciones/merge/rechazo | `G6/REVISION_OWNER.md` (sin auto-merge) |
| G7 | André | Implementar/validar Flutter usando handoff | Arnés propio + evidencias Flutter/PR |
| G8 | Owner | Release/deploy/migración productiva (aparte) | GO separado; no autorizado aquí |

## Ruta funcional sugerida, no prescriptiva

1. **G1:** verificar invariantes actuales, `CampaignProspect.status`, `Prospect.campaignId`, CSV, contratos y módulos protegidos, revisar branch autorizada.
2. **G2:** priorizar estrategia para identidad fuerte/débil, duplicados históricos, estructura de participación y procedencia, compatibilidad manual y CSV, migration plan, endpoint designs, topología de tests. Registrar qué queda delegado.
3. **G3-A:** hacer consistente persistencia de participaciones (origen, defaults, identidad y asociación), P1 y P4 sin degradar importador.
4. **G3-B:** P3 y C1/C2/C3/C4 con auditoría inmutable por contexto; permitir trabajo paralelo si no colisiona en schema/migraciones.
5. **G3-C:** C6/C8/P2, filtros/agregados/vistas; SDK/handoff se alimentan de API realmente probada.
6. **G4:** reproducir T01–T31, verificar AC y regresión legacy en PostgreSQL sintético, publicación de Swagger y ausencia de servicio externo.
7. **G5:** entregar contrato final con SHA, ejemplos y errores, plan UI, arnés específico de André con T32 como E2E del frontend posteriormente.

## Regla de evidencia

Cada registro debe incluir fecha, SHA, entorno sintético, comando (sin secretos), resultado observado, link al log sin datos privados y alcance. **No registrar PASS antes de ejecutar**. Tests de CI de PR10/11 son contexto, no sirven para cerrar G4.

## Qué hacer si no se puede continuar

Detener únicamente el bloque afectado, registrar razón/archivos/alternativas/riesgo y elevar al owner. Mantener el resto aislado. No “resolver” el bloqueo tomando acceso a producción o cambiando autenticación.
