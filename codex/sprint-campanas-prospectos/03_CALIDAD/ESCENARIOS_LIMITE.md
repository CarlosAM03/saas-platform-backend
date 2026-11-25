# Escenarios negativos y de borde que NO deben perderse

1. Usuario cambia de tenant durante una operación; no se responde con datos/cache de tenant anterior.
2. `ADMIN` sin tenant seleccionado no obtiene recursos tenant-scoped.
3. `MEMBER` puede gestionar actividad comercial según permisos existentes pero no ejecutar alta manual ni CSV preview/confirm.
4. Nombre homónimo en dos tenants, mismo teléfono o dominio: no cruza límites.
5. Dos maestros legacy con misma fuente+identificador: conflicto manual, **no** selección arbitraria.
6. `sourceIdentifier=null` (manual/CSV) jamás se trata como clave fuerte por sí solo.
7. Import preview firmado anterior a cambios concurrentes: confirm vuelve a validar, devuelve conflicto o acción segura; no crea eventos falsos.
8. Confirmación CSV falla después de N registros: rollback de nuevos maestros, asociaciones, eventos y actualizaciones.
9. Relación existente reimportada: no resetea seguimiento, ni cuenta doble en dashboard.
10. Valor sin cambiar en C1/C2/C4: no crear transición falsa.
11. Inactivar un responsable: conservar actor/eventos y marcar no elegible para futuras asignaciones.
12. Registros legacy de campaña origen sin `CampaignProspect`: resolver compatibilidad/backfill sin atribuir fecha falsa a actividad comercial.
13. Filtros de 2 dimensiones AND; dentro de selección múltiple OR; `null`/sin asignar; orden determinista.
14. JOIN con 3 actividades por participación: conteos de prospectos siguen en uno, no en tres.
15. Estado `Cerrado` reabierto; evaluación No apto independiente del pipeline.
16. Notas comerciales y CSV sintéticos no imprimen secretos/datos privados en logs.
17. Prospector Service apagado: todo el módulo de gestión manual y CSV sigue funcional.
18. CSV V1: límite 5 MB, 1000 registros, 2000 chars/celda, 15 min TTL, 413, utf-8, semicolon y saltos válidos.
19. Se modifica un maestro compartido mediante UPDATE_EXISTING: otras campañas ven datos maestros nuevos, no cambios de estado contextual.
20. Retrocesos/nota corregida preservan eventos inmutables y timestamp del servidor.

La lista complementa y NO sustituye SPEC §9 (T01–T32).
