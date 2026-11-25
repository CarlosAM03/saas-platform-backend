# Comparación con el contrato de André

- Referencia de André: `3b5eec6fa99f846e853794fc8aedff2c4353c269`. JSON versionado: [openapi-served-3b5eec6.json](../../sprint-campanas-prospectos/06_HANDOFF_ANDRE/openapi-served-3b5eec6.json). SHA256 de blob LF `e73bb1e924a1e956d20567768e63861552d9799c51170257b1098f424384e14c`. El checkout Windows CRLF produce otro hash de bytes.
- `git diff 3b5eec6..a68cc4e` sobre código productivo muestra solo formato de controller y DTO. Prisma, YAML, Dockerfile, Compose, package y lockfile coinciden. Cambios reales posteriores del paquete: mapper de responsables y detección de replay CSV dentro de status y esquemas existentes.
- Al cargar JSON y ordenar claves recursivamente (conservando orden de arrays), la referencia y el endpoint real del baseline `a68cc4e` coinciden: `1520369724d778a620541c1f56e312dd6a41a221afdbb3e857030b6c6a7ec14f`. Comparar la misma huella con el smoke del candidato para acreditar rutas y métodos, schemas y enums, roles descritos y seguridad, parámetros, paginación, códigos y envolturas. Registro de tenants deshabilitado, como en el snapshot de referencia.
- Runtime Docker `706cdbf679ec4ac82d89eddfc89fd132fd7575e1`: el smoke de `/api/docs-json` devolvió la misma huella normalizada y los mismos conteos. El documento de referencia enlazado arriba representa el contrato servido del candidato con el flag apagado. La equivalencia se complementa con la tabla de comportamiento HTTP.
- Se compararon los 25 pares método/ruta únicos de [la matriz de André](../../sprint-campanas-prospectos/06_HANDOFF_ANDRE/02_MATRIZ_API_FLUTTER.csv) con el documento servido: 25 presentes. Swagger: 39 rutas, 77 esquemas y 51 operaciones al sumar cinco de ADR-006. Guard en YAML: 33 base + 13 CP = 46, y cinco aprobadas adicionales ADR-006. Esos conteos miden ámbitos distintos.
- El texto general de roles de `03_CONTRATO_IMPLEMENTADO.md` agrupa POST/PATCH bajo ADMIN/OWNER. Para `PATCH /prospects/{id}` la fila específica de la matriz, el controller y el YAML conservan ADMIN/OWNER/MEMBER. André puede usar la fila específica. No se modificó la autoridad vigente.
- El `DELETE /campaigns/{id}` por defecto archiva y devuelve `EmptySuccess`, como el YAML. La fila histórica de la matriz menciona `data: {id}`. El borrado físico exige `permanent=true` y rol global ADMIN; el archivado no depende de ese permiso.
- Los valores de `rows[].action` observados en confirmación CSV son `CREATE`, `LINK_EXISTING`, `UPDATE_EXISTING`, `SKIP` y `REJECTED`, como en el YAML y la aserción PG de AC-P4-07. Algunas descripciones de flujos históricos usan formas en pasado como etiquetas para UI.
- `GET /campaigns` rechaza `sortBy=email` con 400 porque Campaign carece de esa columna, aunque el enum compartido de parámetros lo enumera. Esta diferencia ya existía en `3b5eec6`. La consulta de prospectos sí admite ordenar por email.

## Suplemento para André

| Operación | Comportamiento verificado o corregido | Compatibilidad |
|---|---|---|
| `GET .../prospects/{prospectId}/responsibles` | Cada responsable ya filtrado por membresía activa de ese tenant devuelve `eligible: true`. | Propiedad ya publicada en `ResponsibleUser` y prometida por la matriz. El detalle de participación sigue incluyendo `eligible: false` cuando corresponda. |
| `POST /api/v1/prospects/import/confirm` | Luego de confirmar una reaparición, reutilizar el mismo preview devuelve el 409 de snapshot desactualizado. Un nuevo preview permite confirmar una aparición nueva. | Usar el flujo de 409 y nuevo preview ya documentado. El esquema y los resultados de confirmación exitosa se mantienen. |
| Otras operaciones CP y ADR-006 | OpenAPI versionado, roles, enums, rutas y formatos de request/response existentes. | El artefacto servido de referencia es reutilizable si el hash normalizado del candidato coincide. |

`CORRECTION` integra el conteo manual. `MASTER_UPDATE` permanece documentado en respuesta y el backend reserva su emisión. `MASTER_UPDATED` identifica procedencia maestra.

## Integridad del arnés original

Resultado original en Windows: 26 diferencias de EOL. Procedimiento para reproducir los hashes de origen sin alterar el arnés ni manifiesto versionados:

1. Exportar con `git -c core.autocrlf=false archive --format=zip -o <ruta-temporal>.zip <SHA>` y descomprimir en un directorio local desechable.
2. Dentro de esa exportación, convertir solamente `03_CALIDAD/PLANTILLA_RESULTADOS_T01_T32.csv` a CRLF, sin BOM. El resto se conserva LF.
3. Ejecutar `node <exportación>/codex/sprint-campanas-prospectos/herramientas/verificar-integridad.mjs`. Observado sobre `a68cc4e`: `Checked 27 files; anomalies: 0`.

T32 sigue `NOT_RUN` y corresponde a André.

## Revalidación CP-02 del 24 de noviembre

`1aacee9928a0d526b4c76dfc26cf6a7ed6703c25` sirvió `/api/docs-json` desde el contenedor de runtime, con PostgreSQL 16 desechable y onboarding apagado. SHA256 normalizado `1520369724d778a620541c1f56e312dd6a41a221afdbb3e857030b6c6a7ec14f`, igual a `3b5eec6`. Se verificaron 39 rutas, 77 esquemas y los 25 pares método/ruta de la matriz de André. El diff de `Docs/Contracts/` es vacío.

CP-02 conserva el campo `responsible.eligible` y el error de validación de asignación inelegible. La lectura posterior a una pérdida de elegibilidad sigue mostrando el responsable con `eligible: false` para su reasignación. [Pruebas dirigidas](CP02.md)
