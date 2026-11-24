# Evidencias: qué guardar y cómo interpretarlas

Este directorio es el registro de ejecución del agente, junto al arnés. Las plantillas contienen **PENDIENTE / NO_EJECUTADO** de forma intencionada. No borrarlas ni convertirlas a PASS sin ejecutar y registrar evidencia.

Rutas de entrega:

- `G0/`: referencia/SHA y autorización específica del owner para iniciar nueva rama; no se infiere de este ZIP.
- `G1/`: diagnóstico baseline, drift, esquema, contrato, compatibilidad.
- `G2/`: decisiones técnicas locales, esquema/API propuestos, migración/test plan, riesgos.
- `G3/`: diario por bloque/commit, diffs, features implementadas.
- `G4/`: matriz AC/T01-T32, resultados de pruebas, logs anonimizados, PostgreSQL sintético, Swagger, regresión.
- `G5/`: handoff contractual a André y manifiesto del nuevo arnés frontend.
- `G6/`: entrega PR y lista de pendientes del owner, sin auto-merge.
- `decisiones/`: log de decisiones locales y solicitudes escaladas.
- `logs/`: logs sintéticos saneados; **no** archivos CSV reales, tokens, JWT ni datos sensibles.

**Registro recomendado:** ID, gate, fecha ISO (zona), HEAD exacto, entorno no sensible, comando, escenario/dataset, esperado, observado, PASS/FAIL/BLOCKED/NOT_RUN, evidencia, limitaciones. Un log previo a un commit no valida automáticamente un commit posterior.

**Evidencia por captura:** sólo pantallas con fixtures sintéticas. No guardar claves, sesiones, mensajes comerciales reales, contactos externos ni datos de Supabase/producción.

**No ejecutar migraciones productivas para evidenciar G4.** El arnés no incorpora ni autoriza credenciales de producción.
