# Coordinación de subagentes (modelo independiente de herramienta)

Ángel puede utilizar una herramienta que soporte subagentes, agentes de contexto aislado o un solo agente secuencial. **El integrador conserva toda responsabilidad**. Este documento no exige instalar ninguna herramienta ni concede herramientas externas.

## Reparto sugerido de tareas

| Rol | Lectura/objetivo | Entrega aislada |
|---|---|---|
| Investigador de baseline | ADRs/schema/tests/PR y riesgos G1 | Inventario y DRIFT, sin código |
| Especialista en datos | Identidad, relación, procedencia, migración y concurrencia | Propuesta de diseño, script de test, evidencia; escritura coordinada |
| Especialista de dominio/API | C1/C2/C3/C4/P1/P4 y contratos | Rutas propuestas y código en archivos acordados |
| Especialista consultas | C6/C8/P2 y escalabilidad | Agregados, tests de conteo y filtros |
| Auditor QA | Independiente de implementación | T01–T31, regresión, riesgos y pruebas PG |
| Relator/handoff | Contratos reales y André | Matrices, runbook y arnés de frontend |

## Instrucción base a cada subagente

> Trabaja bajo SPEC-CP-2026-01 y el arnés `codex/sprint-campanas-prospectos/`. Revisa capítulos aplicables y reglas de autoridad. No tengas acceso para alterar Auth/RBAC/TenantContext/Prospector, PR anteriores, rama base, merge ni producción. No interpretes el nombre de una rama histórica como GO. Entrega análisis/código solo dentro del perímetro asignado y con pruebas/evidencia por SHA; no inventes tests ejecutados ni contratos. Si aparece conflicto de autoridad, reporta `hallazgo + fuente + opciones + impacto` y devuelve el control al integrador.

## Reglas de coordinación

1. **Una sola autoridad para Git/migraciones:** el agente integrador controla rama y commits; no permitir varios subagentes escribiendo simultáneamente `Prisma/schema.prisma`, el mismo migration.sql o controladores compartidos sin reparto explícito.
2. **Fuentes actuales:** cada subagente inspecciona HEAD autorizado, no se guía solo por la auditoría previa.
3. **Revisión independiente:** el auditor QA no puede declarar PASS sin ejecutar; los resultados pasan por integración y registro de SHA.
4. **Puntos de sincronización:** después de G1, de diseño de identidad, antes de API CSV, al terminar esquema/migraciones, antes de Swagger final y handoff.
5. **Conflicto:** no hacer cherry-pick/rebase/checkout destructivo de trabajo de otros subagentes; coordinar mediante el integrador.
6. **Si un solo agente:** simular roles secuencialmente (investigación → propuesta → implementación → revisión) y conservar la misma matriz de evidencia.

No entregar prompt a subagente que permita saltar gates del integrador. Una aceptación de subagente no equivale a aceptación del owner.
