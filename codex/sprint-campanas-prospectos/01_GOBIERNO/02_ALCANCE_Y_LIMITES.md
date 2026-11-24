# Perímetro funcional (sin ampliaciones implícitas)

| ID | Entregable funcional | Invariantes mínimas |
|---|---|---|
| C1 | Pipeline por participación | 6 etapas, default Sin gestionar, reversibilidad, cambio auditado, separación de otros status |
| C2 | Evaluación de viabilidad | Sin evaluar/Apto/No apto, motivo obligatorio para No apto, decisión humana por campaña |
| C3 | Bitácora contextual | Actividades humanas vs eventos automáticos, append-only, correcciones referenciadas |
| C4 | Responsable por participación | Usuario activo y miembro del tenant, permisos actuales, salida de membresía sin borrar historia |
| C6 | Filtros avanzados | Server-side, AND entre dimensiones, paginación, orden estable y conteo correcto |
| C8 | Dashboard de campaña | Agregados reales, no el dashboard global, números coherentes con participantes únicos |
| P1 | Coincidencias y reutilización | Fuerte = fuente confiable + ID válido; débil = revisión; manual y CSV; sin auto-merge |
| P2 | Campañas asociadas al maestro | Origen una vez, resúmenes contextuales y permisos tenant-scoped |
| P3 | Procedencia global | Solo confirmaciones reales, sin previews/omisiones; no retroinventar pasado |
| P4 | CSV V1 ampliado | Preview/confirm y límites/roles/atomicidad/snapshot compatibles |

**Fuera:** C5/C7/C9/C10/C11; scoring, tareas, bulk, export, lead automation, marketing métricas externas, IA; gestión de usuarios o permisos nueva; Jobs, scraping, FastAPI, callbacks, caché, red/despliegue, administración de tenants y Auth.

**Riesgo conocido:** `CampaignProspect.status` histórico `ACTIVO` no representa por sí solo C1; `Prospect.status` = ACTIVO/INACTIVO y `Campaign.status` = ACTIVA/PAUSADA/COMPLETADA/ARCHIVADA. No reinterpretar por coincidencia de nombre.

**Cambios permitidos sin GO adicional:** diseño local razonable, schema/migraciones aditivas, servicios/DTOs y contratos del dominio del sprint, índices/optimización, pruebas y documentos vinculados. Si involucran incompatibilidad pública, borrado de datos, reglas desconocidas o capa protegida, registrar escalamiento.

Para todas las definiciones exactas, ver **SPEC capítulos 2–9**, no este resumen.
