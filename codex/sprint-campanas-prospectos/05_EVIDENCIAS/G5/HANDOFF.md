# G5 — Entrega contractual a André

**ESTADO: HANDOFF PROVISIONAL — NO LISTO_PARA_ANDRE**

- Backend SHA / branch / PR: `f09fbee77e26b9b0cdfa3581883b87218e7a8f7d`, `feat/sprint-campana-prospector`, PR del sprint pendiente
- Contrato servidor JSON/YAML generado vs Swagger observable: código disponible; Swagger/OpenAPI objetivo aún NO_EJECUTADO/NO reconciliado
- Matriz métodos/roles/requests/responses/errores: matriz provisional de este gate basada en controladores reales
- Disponibilidad real por operación: `PROVISIONAL` hasta pruebas HTTP específicas y Swagger
- Cambios de endpoints existentes y compatibilidad: POST manual conserva ruta y agrega match/resolve aditivos; CSV conserva preview/confirm
- Versión Flutter HEAD consultada como lectura: `0fe5d368e11b1da745ccf42ead3892470dcae0be`, solo referencia
- Fixtures sintéticos y scripts de prueba: suites existentes; fixtures sprint específicas pendientes
- Pantallas/client SDK a adaptar: campañas detalle/prospectos, importador CSV y dashboard; no se modificó Flutter
- Desviaciones del SPEC autorizadas: ninguna; rutas/DTO locales documentados como diseño G2
- Arnés André generado: NO — plantilla existente en `06_HANDOFF_ANDRE/` permanece no generada
- Riesgos/pendientes conocidos: G4 específico incompleto, Swagger/OpenAPI, pruebas C1–C8/P1–P4 por AC, migración legacy T28
- Estado: `PROVISIONAL`; no marcar `LISTO_PARA_REVISION` ni entregar arnés final a André
