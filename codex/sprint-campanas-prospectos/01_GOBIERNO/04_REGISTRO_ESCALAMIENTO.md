# Registro de decisiones, desviaciones y escalamiento

Todos los hallazgos se registran en `05_EVIDENCIAS/decisiones/LOG_DECISIONES.md` y, si requieren autorización, en `05_EVIDENCIAS/decisiones/SOLICITUDES_OWNER.md`.

**Autonomía local:** Ángel puede escoger tablas auxiliares, enums/strings, organización de services, endpoints concretos, transacciones, índices y pruebas, **si** cumplen SPEC, baselines vigentes y compatibilidad; documenta alternativa y fundamento. No requiere aprobación previa de cada nombre de columna.

**Escalar antes de modificar:** cambios Auth/RBAC/TenantContext/Users/Tenants/Prospector; ruptura pública HTTP no mitigada; alteraciones de reglas de negocio; riesgos de pérdida/fusión de datos; acceso productivo; cambio de rama base o de reglas aprobadas; importadores rediseñados que degradan garantías; nuevas dependencias de pago/infra externa.

**Formato mínimo:** `ID`, `GATE`, `hallazgo`, `fuente/archivo/SHA`, `regla afectada`, `impacto`, `opciones`, `recomendación`, `decisión owner`, `fecha/canal`, `estado`, `cambio/PR asociado`.

**Clasificaciones:** `DECISION_TECNICA_LOCAL`, `ADR_DRIFT`, `CONTRACT_DRIFT`, `BREAKING_CHANGE`, `RIESGO_DATOS`, `CAMBIO_ALCANCE`, `CAMBIO_PROTEGIDO`, `BLOQUEO_G0`.

**Política de bloqueos:** pausar solo la operación que depende de la decisión; continuar fases independientes si no afecta integridad. Nunca simular aprobación por completar un formulario.
