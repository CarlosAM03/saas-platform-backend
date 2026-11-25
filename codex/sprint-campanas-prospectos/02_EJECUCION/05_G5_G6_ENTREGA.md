# G5–G6 — Entrega backend, arnés André y revisión owner

## G5: Ángel entrega

- HEAD del backend, rama/PR, base aprobada, changelog, funciones implementadas vs pendientes.
- Contrato API exacto (métodos/rutas, request/response, errores, roles, ejemplos, paginación, availability) más Swagger servido/archivo OpenAPI comprobados sobre el SHA final.
- Migraciones y runbook de ensayo en DB sintética, índices y riesgos residuales; guía de forward-fix sin tocar producción.
- Matriz AC vs prueba vs estado vs evidencia y fallos aún pendientes; no delegar backend incompleto a UI como si estuviera finalizado.
- Handoff y **arnés nuevo para André**, basado en backend realmente implementado, y prompt reproducible del agente frontend. Puede prepararse artefacto separado para copiar a `<saas-platform-client>/codex/` **después** de aprobación del owner de su uso.

## G6: owner evalúa

- Ámbito: seguridad, compatibilidad, integridad de migración y contratos, tests, evidencia, documentación, PR.
- Decisión: aprobar, solicitar correcciones o rechazar el PR backend. **Nunca realiza el agente merge ni despliegue por el hecho de pasar QA**.

## Frontend

- André conservará arquitectura `UI → Riverpod → repo → lib/platform_api → ApiClient`, permisos/session-scope existentes y UI de importación en producción.
- El arnés definitivo no debe asumir APIs hipotéticas ni cambiar carpetas protegidas sin aprobación precisa del owner.
- Implementar T32 y QA UI→API real cuando exista backend accesible de prueba. PR Flutter sin auto-merge.

**Archivo guía:** `06_HANDOFF_ANDRE/00_CONTRATO_DE_ENTREGA.md`.
