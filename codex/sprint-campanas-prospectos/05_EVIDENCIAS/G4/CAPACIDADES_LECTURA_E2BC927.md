# G4 — Completar capacidades de lectura C6/P2/P3/C4

- Inicio ISO: `2026-11-22T20:56:01-08:00`.
- HEAD exacto: `e2bc9275836b642ac3e2b6086c4c15062b4dcd89`, rama `feat/sprint-campana-prospector`.
- Alcance: instrucción del owner en conversación «continua trabajando», sobre el bloque pendiente del sprint. No incluye push, merge, deploy, datos reales, cambios protegidos ni aceptación de gates del owner.
- Estado del código previo: correcciones locales sin commit, con 354 pruebas independientes en Node 20 registradas en `VALIDACION_FINAL_WORKTREE_E2BC927.md`. Ese PASS no se atribuye a las extensiones de este bloque.

## Verificación de entrada

| ID | Gate | Fecha ISO | HEAD | Comando | Dataset/fixture | Esperado | Observado | Estado | Evidencia | Limitaciones |
|---|---|---|---|---|---|---|---|---|---|---|
| LECTURA-INTEGRIDAD | G4 | 2026-11-22T20:56:01-08:00 | HEAD exacto arriba + worktree previo | `node codex/sprint-campanas-prospectos/herramientas/verificar-integridad.mjs` | manifiesto original | cero anomalías | 27 archivos, cero anomalías | PASS | salida del integrador al iniciar | verifica integridad, no funcionalidad; manifiesto intacto |
| LECTURA-ATRIBUCION | G4 | 2026-11-22T20:56:01-08:00 | mismo HEAD + configuración de test ampliada | Node: comparar SHA256 con manifiesto QA final anterior | 15 archivos del reporte previo | preservar código previo al nuevo bloque | 14 hashes iguales; solo `test/jest-postgres.json` difiere por registro de las nuevas suites | PASS | salida JSON del integrador | comparación anterior a nuevas ediciones de dominio; los hashes posteriores serán otros |

## Reparto exclusivo

- Implementador campañas: servicio campañas, DTO de filtros y nueva suite `campaigns-read-capabilities.postgres-spec.ts`. Añadir rangos temporales, contexto aditivo de participación y elegibilidad en respuestas, conservando campos maestros y locks/historial previos.
- Implementador prospectos: servicio/controlador prospectos, DTO PATCH e historia y nueva suite `prospect-read-capabilities.postgres-spec.ts`. Completar paginación, resumen con actividad contextual reciente/elegibilidad y contexto de campaña revalidado de PATCH maestro.
- Integrador: registro Jest y evidencia; no schema/migraciones ni módulos protegidos.
- Baseline: conciliación de D06 a partir de autoridades y código local, solo lectura; no sustituye decisiones del owner.

## Diseño local aditivo dentro del SPEC

- C6: `addedFrom/addedTo` filtran incorporación y `activityFrom/activityTo` actividad registrada; instantes ISO con offset, extremos inclusivos, rango invertido 400. AND entre dimensiones; actividades solo de la participación y tenant consultados. No usar fecha declarada por usuario como fecha registrada.
- Lista de campaña: preservar representación maestra y `status`; agregar objeto `participation` separado. Responsable actual incluye `eligible` derivado de usuario activo y membresía del mismo tenant; nunca exponer lista interna de membresías.
- P2/P3: page/limit con orden fijo estable y conteo real. Mantener los campos existentes de P2 y documentar ubicación exacta de metadata; no cambiar silenciosamente la forma pública.
- PATCH maestro: `contextCampaignId` opcional y distinto de campaña de origen. Validar en la transacción que el prospecto participa en esa campaña del tenant. El contexto por sí solo no es un cambio maestro; rechazarlo sin campos actualizables. Nunca aceptar tenant/actor/fecha de auditoría del cliente.

Pruebas de este bloque: **NOT_RUN** al iniciar. Contrato, QA independiente, revisión por severidad y atribución por hashes se sincronizarán después de integrar implementación. G4 permanece abierto y G5 provisional.

## Sincronización de identidad con el owner

Fecha: `2026-11-22T21:03:37-08:00`, herramienta de preguntas de esta conversación. Respuestas explícitas: **«Aceptar política mínima»** y **«Trim y casing exacto»**. Se acepta la señal declarada google_maps por ADMIN/OWNER con identificador no vacío y único en el tenant, sin verificarlo con Google. Comparación autorizada: quitar espacios periféricos y mantener diferencias de mayúsculas/minúsculas. El lowercase previo se sustituirá en código/contrato/pruebas; no se modifica la fuente normativa ni se inventa un formato del proveedor.

La conciliación baseline de solo lectura halló que sourceIdentifier es opaco y que no existe escritor activo protegido insertando prospectos. La hipótesis anterior de una carrera productiva de Prospector no quedó demostrada; se retira como motivo para pedir cambios protegidos. La compatibilidad con claves derivadas previas se tratará como conflicto seguro, nunca reutilización falsa o modificación retrospectiva. Decisión resuelta a nivel diseño, ejecución todavía pendiente.
