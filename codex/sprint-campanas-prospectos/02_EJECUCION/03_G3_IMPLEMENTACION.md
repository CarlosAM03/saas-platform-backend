# G3 — Implementación y disciplina del agente

**Entrada:** G0/G1/G2 completados; rama propia autorizada y segura.  
**Salidas:** código real, migraciones nuevas, tests incrementales, docs, diario de cambios.

- Trabajar exclusivamente dentro del dominio Campañas/Prospectos, sus tests, Prisma/migraciones y contratos/documentos relacionados. Leer módulos transversales sin reescribirlos.
- Mantener compilación y reglas actuales de validación, exception filter, wrapper, Pino, Swagger y TenantContext.
- Coordinar modificaciones de `schema.prisma` y migraciones con un único responsable de integración si se usan subagentes. Nada de migraciones competidoras o varias versiones del mismo recurso.
- Ejecutar y registrar pruebas incrementales sobre un entorno de prueba antes de cerrar bloques; no informar 'funcional' cuando solo compila.
- Asegurar que preview/omisión/no-op no generen auditaría falsa; confirmaciones y transiciones efectivas generan eventos atómicos.
- Revisar `git diff` por módulos prohibidos antes de cada commit; si hay archivos ajenos detener y documentar. No usar `git reset --hard` ni `git clean` para corregir workspace.
- Documentar contratos preliminares como **NO IMPLEMENTADOS/PROVISIONALES** hasta que Swagger y tests reales comprueben su disponibilidad.
- Cuando una pantalla Flutter requiera campos o filtros, primero especificar API, no inyectar reglas comerciales en el cliente.

**Condición de salida:** cada feature tiene código, AC verificables, test(s) y trazabilidad. La clasificación de avances puede ser `NO_INICIADO`, `EN_PROGRESO`, `LISTO_PARA_QA`, `BLOQUEADO`, `VALIDADO`; `VALIDADO` solo tras G4.
