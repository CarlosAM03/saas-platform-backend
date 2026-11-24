# G2 — Diseño técnico delegado

**ESTADO: COMPLETADO**

- SHA/baseline y fecha: `5e214420394101ae7079f8e844cc759b01cce2a3`, rama `feat/sprint-campana-prospector`, `2026-11-21`.
- Modelos de participación y procedencia: ampliar `CampaignProspect` con estado actual comercial e incrementar tablas separadas de eventos/actividades y procedencia.
- Identidad fuerte/débil: identidad fuerte únicamente para fuente confiable explícita con identificador no vacío; la fuente actual de `google_maps` se tratará como candidata fuerte solo si existe y es única. `manual`/`csv` con `sourceIdentifier=null` jamás son fuertes.
- CSV/manual y compatibilidad HTTP: conservar rutas V1; añadir capacidades aditivas y decisiones explícitas sin cambiar el significado de respuestas existentes.
- Migración legacy: migración nueva aditiva, sin editar `init` ni la migración ADR-006.
- Elegibilidad de responsable: validar `User.status=ACTIVO` y `UserTenant` con el mismo tenant; no reinterpretar platformRole.
- C6/C8: filtros/paginación sobre `CampaignProspect` y agregados con conteo de participaciones distintas.
- Eventos: tablas append-only con actor, timestamps de servidor y claves de participación.
- Controles de seguridad: reutilizar guards, TenantContext, roles y wrappers existentes.
- Diferencias con SPEC: ninguna decisión nueva de negocio; solo representación técnica local y nombres REST.
- Solicitudes al owner: ninguna solicitud obligatoria antes de G3 si se limita G2 a las reglas ya aprobadas.
- Resultado: `G2 COMPLETADO; continuar G3 con implementación acotada en modelos y módulos Campañas/Prospectos`

## Modelo de persistencia seleccionado

### Participación ampliada

Mantener `CampaignProspect` como tabla de participación y agregar campos aditivos:

- `commercialStage` con valores persistidos exactos equivalentes a las seis etapas.
- `evaluation` con `SIN_EVALUAR/APTO/NO_APTO`.
- `evaluationReason` nullable.
- `responsibleUserId` nullable con FK al usuario responsable actual.
- timestamps `updatedAt` y opcional `responsibleUpdatedAt`.

Se conserva el campo histórico `status` sin mapearlo automáticamente a `commercialStage`. La migración inicializa `commercialStage='SIN_GESTIONAR'`, `evaluation='SIN_EVALUAR'` y responsable nulo para relaciones existentes y no genera eventos comerciales retrospectivos.

Alternativa rechazada: convertir `CampaignProspect.status` a etapa. Esto confundiría estados históricos `ACTIVO/INACTIVO` y rompería compatibilidad.

### Historial contextual

Crear una tabla append-only de eventos/actividades por participación, separada de procedencia:

- `campaignId`, `prospectId`, `type`, `actorUserId`, `recordedAt`, `declaredAt?`, `content?`, `previousValue?`, `newValue?`, `reason?`, `correctsActivityId?`.

Los tipos incluyen:

- actividades manuales: nota, llamada, correo, reunión, otra.
- eventos automáticos: asociación, cambio de etapa, evaluación y responsable.

Una corrección crea una entrada nueva que referencia el registro original mediante `correctsActivityId`; no se modifica ni elimina el original.

### Procedencia global

Crear una tabla de apariciones/evidencias confirmadas por prospecto:

- `tenantId`, `prospectId`, `eventType` (`CREATED|LINKED|REAPPEARED|UPDATED`), `source`, `campaignId?`, `actorUserId?`, `occurredAt`, `details?`.

Solo se inserta después de commit exitoso de una operación confirmada. Preview, SKIP, 409 y errores no generan filas. Para registros legacy no verificables se muestra `LEGADO_DESCONOCIDO` sin inventar fechas.

## Identidad fuerte y concurrencia

### Fuente fuerte seleccionada

Para el estado actual:

- Una combinación fuerte es `(tenantId, source='google_maps', sourceIdentifier trim/válido)` que resuelva a exactamente un maestro.
- `source='manual'` y `source='csv'` con `sourceIdentifier=null` son débiles por diseño.
- Nombre, correo, teléfono y dirección producen candidatos débiles; no se reutilizan de forma automática.
- Si una clave fuerte apunta a varios maestros históricos, se devuelve conflicto y nunca se selecciona el primero.

Validación concreta de `sourceIdentifier` queda en una función de dominio compartida. Google Maps no tiene aquí un validador de formato conocido; por tanto G3 debe aceptar solo un identificador no vacío, acotado y canónico, y documentar que no se inventa formato externo. La existencia de otra fuente confiable requiere evidencia/OWNER.

### Protecciones concurrentes

No sustituir ni eliminar el unique legacy existente. Para nuevas identidades fuertes, agregar una clave derivada nullable que represente:

```text
(tenantId, identitySource, identityHash)
```

La clave derivada solo se rellena para fuerte confiable y usa un hash normalizado dentro de un campo separado. Debe ser única con `NULL` permitiendo duplicados históricos. Todo proceso de crear/vincular revalida dentro de transacción serializable y usa locking/constraint compatible.

Si PostgreSQL no permite demostrar una clave segura sin afectar legacy, G3 se detiene en ese bloque y G2 queda documentado como un riesgo de migración. No fusionar registros históricos ni cambiar el unique legacy por conveniencia.

## Contratos REST seleccionados

Mantener compatibilidad:

- `GET /api/v1/campaigns/{campaignId}/prospects`: conservar campos maestros y extender con un objeto `participation` aditivo si se confirma por Swagger.
- `POST /api/v1/prospects`: conservar ruta actual. Si no existen candidatos, crear maestro + participación. Si existen candidatos fuertes/débiles, el cliente debe usar resolución explícita; no reutilización silenciosa.
- CSV: conservar preview/confirm y las acciones existentes.

Endpoints aditivos propuestos:

| Capacidad | Ruta | Operación |
|---|---|---|
| Matching manual | `POST /api/v1/prospects/match` | Reconsulta candidatos, sin escritura |
| Resolver alta manual | `POST /api/v1/prospects/create-resolved` | Ejecuta CREATE/LINK/UPDATE/SKIP con candidato explícito |
| Contexto de participación | `GET /api/v1/campaigns/{campaignId}/prospects/{prospectId}/participation` | Lee etapa/evaluación/responsable |
| Cambiar etapa | `PATCH .../stage` | Actualiza etapa y registra evento |
| Cambiar evaluación | `PATCH .../evaluation` | Valida motivo No apto |
| Responsable | `GET/PUT/DELETE .../responsible` | Elegibles actual, asignación/desasignación |
| Actividades | `GET/POST .../activities` | Lista y crea actividades/correcciones |
| Dashboard | `GET /api/v1/campaigns/{campaignId}/dashboard` | Agregados reales |
| Asociaciones del maestro | `GET /api/v1/prospects/{prospectId}/campaigns` | Origen y participaciones |
| Procedencia | `GET /api/v1/prospects/{prospectId}/provenance` | Lista confirmada |

Las rutas definitivas se publican solo después de G3/G4. Ninguna se considera disponible por aparecer en G2.

Las respuestas existentes usan `{ success, data, meta }`; se conservarán. Errores: 400 validación, 404 ocultación tenant, 409 preview/identity/concurrent, 403 rol, 401 JWT.

## CSV y alta manual

El preview seguirá:

1. Parser V1 existente.
2. Clasificación por identidad fuerte única, candidato débil único/múltiple, nuevo o conflicto histórico.
3. Resultado por fila sin escribir.
4. Confirmación revalida candidatos y la selección de candidato por ID.
5. Lote serializable con retry controlado.

Extensión compatible:

- Agregar `candidateId?` a decisiones CSV sin hacer obligatorio para consumidores anteriores en filas NEW/MATCH seguro.
- `LINK_EXISTING` nunca cambia maestro.
- `UPDATE_EXISTING` exige confirmación explícita de impacto compartido.
- `CREATE` solo puede usarse después de confirmar candidato rechazado o ausencia.
- Múltiples candidatos no permiten resolución por el primer elemento.

### Compatibilidad

El frontend anterior que llama preview/confirm sigue recibiendo el mismo campo base. Si el backend amplía la clasificación/decisiones, requiere OpenAPI y matriz Flutter. Cualquier cambio de wire shape que rompa consumidores viejos se clasifica como `BREAKING_CHANGE` y se eleva al owner antes de publicar.

## Migración y backfill

Migración aditiva propuesta:

1. Preflight: contar campañas/prospectos/participaciones huérfanas, duplicados fuertes y cross-tenant inválidos.
2. Añadir columnas de participación con defaults.
3. Crear tabla de actividad/evento y procedencia.
4. Crear índice tenant/campaign/participación.
5. Crear participaciones faltantes para `Prospect.campaignId` solo si Campaign/Prospect tienen el mismo tenant y no existe relación.
6. Inicializar estado comercial y evaluación sin fabricar eventos.
7. Crear procedencia legacy solo para origen verificable conocido; datos no verificables quedan desconocidos.
8. Añadir clave de identidad fuerte solo si el preflight demuestra que no hay colisiones legacy bloqueantes.

No editar migraciones históricas. No ejecutar migración productiva ni `migrate deploy` remoto.

Forward-fix: migración nueva correcciones de backfill; forward-only sin promesa de rollback destructivo.

## Consultas C6/C8

Usar `where` compuesto sobre `CampaignProspect`:

- AND entre dimensiones.
- OR dentro de selección múltiple.
- `responsibleUserId:null` para sin asignar.
- buscar nombre/email/categoría/dirección fuente sobre el Prospect maestro.
- joins hacia actividad solo con EXISTS para evitar multiplicar participaciones.

Orden estable: campos disponibles + `prospectId` como desempate. Paginación 1-based y límites hasta 100.

Dashboard C8 cuenta `campaignProspect` únicos y suma:

- etapa sobre las seis claves;
- evaluación sobre tres claves;
- responsables elegibles/históricos/sin asignar;
- actividad por la definición separada manual+eventos sin mezclar comunicados externos;
- incorporación new/reused/legacy desde procedencia confirmada.

No mostrar tasas ni métricas externas.

## Pruebas G3/G4

G3 necesitará unitarias incrementales; G4 ejecutará T01–T31 más migración y contract parity. T32 queda para André.

Casos críticos adicionales ya derivados del SPEC:

- identidad fuerte repetida concurrente;
- relación existente sin reinicio;
- usuario responsable perdido;
- joins con actividad múltiple;
- preview stale y rollback;
- cross-tenant;
- migración legacy sin fuente histórica falsa.
