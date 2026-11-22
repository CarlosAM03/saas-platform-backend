# Checkpoints de calidad y definición de terminado (DoD)

Usa los 9 gates G0–G8 del SPEC §10.2. Estado inicial **NO_EJECUTADO** en TODOS; plantillas de evidencias no acreditan éxito. Solo marcar `PASS` si existe prueba/cita real por SHA. Las decisiones de owner no deben autocompletarse.

| Gate | Condición de salida | Responsable |
|---|---|---|
| G0 | GO owner con SHA/base/remoto/branch, PR previos controlados y árbol seguro | Owner |
| G1 | Inventario y contradicciones clasificadas, aislamiento de módulos | Ángel |
| G2 | Diseño local completo, estrategia de compatibilidad/migración y contratos propuestos | Ángel |
| G3 | Diez features implementadas sin tocar sectores protegidos y con unitarias incrementales | Ángel |
| G4 | T01–T31 verificados según ámbito; AC completas; PG real sintético y Swagger | Ángel |
| G5 | Contrato API real + matriz Flutter + arnés André versionado entregado | Ángel |
| G6 | PR backend revisado y decisión explícita del owner | Owner |
| G7 | Flutter integrado y probado por André contra API real + PR | André/Owner |
| G8 | Liberación productiva con GO separado (FUERA del arnés) | Owner |

## Condiciones de rechazo del backend

- Datos de otro tenant en lecturas, filtros, dashboard, matching o importación.
- Se interpreta `Prospect.status` o `CampaignProspect.status` como etapa sin migración/contrato consciente.
- Un `No apto` sin motivo puede persistirse.
- Nueva campaña altera historial/etapa/responsable de otra campaña para el mismo maestro.
- Coincidencia débil autoreutilizada como si fuera fuerte.
- CSV pierde snapshot, atomicidad, reglas de roles o compatibilidad sin GO.
- Migración destruye/duplica maestros legacy sin autorización o se “prueba” solo con mocks.
- Auth/Users/Tenant/Prospector alterados fuera del ámbito.
- Swagger, OpenAPI, code/tests, HEAD y handoff divergen.
- Se declara QA/Flutter/deploy completado sin observación real.

## Verificar DoD por funcionalidad

Cada feature requiere: código y SHA, cumplimiento de todos sus criterios AC, tests apropiados, contrato API comprobable, autorización/tenant, migración si corresponde y evidencia propia. Backend completado no implica frontend completado. No declarar “cierre sprint” antes de G6/G7/G8 del owner.
