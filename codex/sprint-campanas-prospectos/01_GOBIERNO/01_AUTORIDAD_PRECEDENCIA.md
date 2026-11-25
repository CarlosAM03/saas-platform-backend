# Autoridad y jerarquía normativa de ESTE sprint

## Fuente vinculante

La aprobación explícita del owner abarca **28 decisiones A1–E5 sin excepciones**, incorporadas en el capítulo 12 del **SPEC-CP-2026-01**. El SPEC es la fuente del **qué** funcional y de la delegación para este sprint. Este arnés es **procedimental**: no puede ampliar ni corregir unilateralmente esas decisiones. Su existencia no equivale a autorización de ejecutar G0 ni fusionar PR.

La nueva regla **A1** reemplaza únicamente la simplificación histórica de identidad por campaña de ADR-001: los prospectos maestros son reutilizables en múltiples campañas del mismo tenant. Se mantiene el origen y no se fusionan automáticamente duplicados anteriores. Eso **NO** revoca ADR-004/ADR-003 ni cambia Auth, roles o tenant scoping. La excepción **A2** faculta ampliar Prisma, migraciones, contratos y módulos Campañas/Prospectos de forma justificada; no rediseñar las capas protegidas.

## Precedencia operacional

1. **Owner:** autorización expresamente registrada, vigente y de alcance específico para ejecución, base Git, cambios de negocio/protegidos y liberación.
2. **SPEC ratificado:** reglas A1–E5, INV-01..12, AC y gates.
3. **Normas aplicables del workspace:** `AGENTS.md` y obligaciones de seguridad/instrucción del ejecutor; no obviar ni reinterpretar un conflicto, solicitar decisión del owner.
4. **Autoridades técnicas del HEAD autorizado:** ADR-004, ADR-003, ADR-006, schema/migraciones, contrato OpenAPI implementado y pruebas. Prevalecen en sectores no exceptuados por el SPEC.
5. **Este arnés y sus plantillas:** pasos, registros y calidad; no introducen reglas de negocio.
6. **Histórico:** auditoría, decisiones/planes previos y SHAs anteriores; solo contexto y comparación.

No resolver conflictos cambiando silenciosamente una fuente. Registrar `CONFLICTO_AUTORIDAD` y proponer alternativas acotadas. Si un ADR fue expresamente supersedido en una parte específica, el agente puede elaborar una enmienda derivada **solo de ese punto**, preservar el original y anotar referencias; no reescribir ADR-004 como si fuera obsoleto.

## Límites absolutos sin otro GO

- Prohibido modificar: Auth/JWT, modelo RBAC, TenantContext y Guards, Users/Tenants/onboarding, ProspectorClient/ProspectingJobs/Service/Engine/CLI, infraestructura/configuración productiva, otros repositorios.
- Prohibido: merge, release, deploy, migraciones productivas, acceso o volcado de datos reales, cambios de ramas protegidas, force push, limpieza destructiva, cambios a PR #10/#11.
- Permitido tras G0 específico: commits/push ordinario/PR de rama propia, tests en infraestructura aislada, migraciones **nuevas** compatibles, extensión de contratos y dominio dentro del alcance.
- Si requiere un cambio protegido: detener ese cambio, documentar causa/opciones/riesgos y consultar al owner; continuar trabajo independiente.

**No asumir aprobación por mensaje privado no disponible al agente:** si una autorización existe por otro canal, solicitar evidencia explícita o confirmación al owner antes de aplicarla.
