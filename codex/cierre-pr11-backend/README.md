# Cierre técnico autónomo — Backend PR #11

**Paquete:** CP-G6-CLOSE v1.0.0 · 23 de noviembre de 2026 (Tijuana)

**Objetivo:** dejar el PR #11 técnicamente listo para revisión y decisión de merge del owner, no aprobarlo ni fusionarlo. Un único agente integrador Codex ejecuta auditoría, correcciones acotadas, regresión, publicación y handoff. No depende de los agentes de Flutter, Engine o Service.

## Instalación

1. Extraer la carpeta `cierre-pr11-backend` dentro de `saas-platform-backend/codex/` (sin sobrescribir otros arneses).
2. Abrir una sesión Codex dedicada al backend; pegar `00_PROMPT_ACTIVACION.txt`.
3. Mantener la sesión en el backend. El agente no debe acceder ni modificar los repositorios hermanos; usar un worktree local separado si el directorio de trabajo está ocupado.
4. Al terminar, revisar `codex/cierre-pr11-backend/evidencias/HANDOFF_FINAL.md`, la matriz de commits, hallazgos, registros de pruebas y el SHA publicado en GitHub.

## Documentos de ejecución

- `01_GOBIERNO_Y_BASELINE.md`: autoridad, límites y control Git.
- `02_PLAN_DE_CIERRE.md`: gates, trabajo autónomo, criterios de avance.
- `03_QA_Y_AUDITORIA.md`: pruebas dirigidas, seguridad, migración, rendimiento, contrato.
- `04_PUBLICACION_Y_HANDOFF.md`: push, CI remoto, decisión del owner y promoción posterior.
- `plantillas/`: formatos mínimos de evidencia, sin resultados ficticios.

## Resultado esperado

`READY_FOR_OWNER_REVIEW` solo cuando todas las condiciones técnicas obligatorias hayan pasado y el CI remoto del SHA final esté verde. Si hay riesgos bloqueantes o evidencia inaccesible, `BLOCKED` o `PENDING_REMOTE_CI`, con instrucciones concretas y evidencias conservadas. G6 sigue siendo decisión exclusiva del owner; G7/T32 y G8 no pertenecen a este paquete.
