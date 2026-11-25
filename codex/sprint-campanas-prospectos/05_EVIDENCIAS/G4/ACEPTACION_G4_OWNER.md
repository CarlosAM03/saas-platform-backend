# Aceptación del owner — G4

- Fecha: `2026-11-23` (America/Tijuana, `-08:00`).
- Candidato aceptado: `3b5eec6fa99f846e853794fc8aedff2c4353c269` (rama `feat/sprint-campana-prospector`).
- Estado posterior: **G4 ACEPTADO POR EL OWNER.** G5 autorizado como preparación de handoff; G6 permanece pendiente de la revisión del owner.

## Instrucción del owner (transcrita)

> «Acepto G4 sobre el candidato 3b5eec6 y autorizo iniciar G5 para preparar el handoff contractual de André, sin push, merge, deploy ni migraciones remotas.»

## Alcance de la aceptación

1. Acepta G4 sobre el candidato verificado: build PASS, 178 unitarias, 84 HTTP y 199 PostgreSQL (461 pruebas) sobre árbol limpio de `3b5eec6`; Swagger servido con `CORRECTION` manual y `MASTER_UPDATE` en el enum; arnés íntegro.
2. Autoriza iniciar **G5** limitado a preparar el handoff contractual de André.
3. Mantiene las prohibiciones vigentes: sin `git push`, sin merge, sin deploy y sin migraciones remotas.

## Lo que esta aceptación NO autoriza

- Merge del PR, despliegue, migraciones productivas ni `migrate deploy` remoto.
- Modificar Auth/JWT/RBAC/TenantContext, Users/Tenants, Prospector o infraestructura productiva.
- Declarar `T32` ejecutado: sigue `NOT_RUN` y corresponde al frontend.
- Aprobar el arnés de André para uso: el owner decide cuándo André lo usa y sobre qué base Flutter.
- Cerrar G6 ni declarar terminado el sprint.

## Evidencia de soporte

- `05_EVIDENCIAS/G4/BLOQUE_O4_O5_3B5EEC6.md` (ejecución, pruebas dirigidas, sensibilidad y Swagger servido).
- `05_EVIDENCIAS/G4/CONCLUSION_G4_3B5EEC6.md` (conclusión técnica presentada).
- `05_EVIDENCIAS/G4/MATRIZ_QA.md` y `MATRIZ_COBERTURA_AC.md` (trazabilidad por SHA y por AC).
