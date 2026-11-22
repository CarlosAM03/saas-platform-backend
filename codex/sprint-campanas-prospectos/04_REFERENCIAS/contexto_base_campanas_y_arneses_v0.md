# Contexto base — ampliación de campañas y prospectos (v0, preselección)

**Estado:** Documento de continuidad y levantamiento de requisitos. **NO es un alcance aprobado, especificación final, instrucción de implementación ni arnés para Codex.**
**Fecha de captura:** 2026-11-19.

## 1. Contexto del producto ya definido por el responsable

- SaaS B2B multi-tenant para gestión de campañas de marketing orientadas a generación y gestión de prospectos.
- Cada empresa es un tenant, con owner y usuarios conforme a las reglas/permisos existentes. El superadministrador administra a nivel plataforma.
- Los módulos Campañas y Prospectos pueden operar internamente sin depender de la ejecución del servicio externo de prospección.
- El servicio externo obtiene datos estructurados de potenciales prospectos desde fuentes públicas; no reemplaza el seguimiento y gestión comercial dentro del producto.
- Las campañas agrupan prospectos. Actualmente permiten crear campañas (p. ej., sector logística), registrar prospectos manualmente, importar CSV y consultar prospectos asociados.
- El módulo Prospectos conserva la gestión maestra de prospectos del tenant; Campañas contiene la gestión contextual de la campaña y la participación de cada prospecto.

## 2. Decisiones de negocio expresamente confirmadas

1. **Un prospecto puede pertenecer a varias campañas del mismo tenant.** No se debe crear un nuevo prospecto maestro al encontrar el mismo prospecto en otra campaña; se reutiliza el existente y se crea/asocia la participación en la campaña correspondiente.
2. **Estado comercial, responsable e historial de seguimiento son independientes por cada par campaña–prospecto.** No se deben sobrescribir los datos de la otra campaña.
3. **La decisión sobre validez/utilidad de un prospecto para una campaña corresponde al usuario.** El sistema presenta comparación, información y trazabilidad; no toma esa decisión automáticamente.
4. El módulo Campañas lleva la gestión comercial contextual. El módulo Prospectos mantiene información maestra y funciones transversales de identificación/consulta.
5. El sprint amplía Campañas y, en menor medida, Prospectos. La integración y arquitectura del servicio de prospección son trabajo reservado al responsable principal.
6. No alterar la arquitectura/reglas protegidas de autenticación y autorización, ni el servicio de prospección, salvo aprobación explícita y documentada/confirmada por el responsable. Que un cambio se haya autorizado por otro canal no se debe presumir; las decisiones reales del proyecto vigentes prevalecen sobre este documento.

## 3. Propuestas candidatas — NO aprobadas

### Campañas

- C1. Pipeline/etapas comerciales por participación del prospecto en la campaña.
- C2. Calificación contextual de utilidad/validez por campaña, separada de la etapa del pipeline (por validar).
- C3. Bitácora manual de actividades (llamadas, correos, reuniones, notas) por campaña–prospecto.
- C4. Asignación de responsables por campaña–prospecto, respetando usuarios y permisos existentes.
- C5. Tareas y recordatorios de seguimiento comercial, vinculados a campaña–prospecto y responsable.
- C6. Vistas, filtros avanzados y segmentación dentro de cada campaña.
- C7. Operaciones masivas sobre asociaciones (asignación, estado, prioridades) con validación de cada registro.
- C8. Indicadores por campaña (altas, estados, contactos, avances, actividades, vencimientos, conversión si se define).
- C9. Priorización de oportunidades mediante criterio manual o reglas simples, sin IA obligatoria.
- C10. Ciclo de vida de campañas (borrador/activa/pausada/cerrada/archivada) y, si se aprueba, duplicación de configuración.
- C11. Exportación CSV/Excel contextual con estados, responsable, actividades resumidas y filtros.

### Prospectos (pocas adiciones)

- P1. Identificación de registros existentes o coincidencias posibles **dentro del tenant** al crear/importar/obtener prospectos, sin fusión automática de coincidencias dudosas.
- P2. Vista transversal de campañas asociadas a un prospecto y resumen de seguimiento/resultado en cada campaña, conforme a permisos vigentes.
- P3. Trazabilidad de procedencia y primeras asociaciones (alta manual, CSV, obtención externa; fechas, campaña inicial, posteriores hallazgos, según datos disponibles).
- P4. Validación/previsualización de importaciones y reporte de colisiones, filas inválidas y asociaciones creadas u omitidas (reutilizando el flujo existente).

## 4. Principios técnicos sugeridos para el futuro arnés, a validar contra repositorios

- Modelo lógico: Prospect (maestro tenant) ↔ Campaign (tenant) mediante una participación CampaignProspect que almacene contexto comercial por campaña. Esto es una propuesta de organización lógica, **no nombres obligatorios de entidades/tablas**.
- Evitar crear varias asociaciones para el mismo par campaña–prospecto; soportar reingreso/reobtención sin duplicar ni perder procedencia.
- Establecer coincidencias por identificadores verificables y reglas de normalización auditables, diferenciando coincidencia confiable de posible coincidencia. Los criterios exactos de deduplicación quedan pendientes de decisión y revisión de los campos reales.
- Mantener tenant scoping y autorización mediante mecanismos ya existentes. No modificar auth, roles, tenant provisioning ni prospector por conveniencia de este sprint.
- Proteger compatibilidad de endpoints existentes y flujos CSV/manual; introducir migraciones, pruebas y contratos API según estándares del repositorio.
- El agente debe **inspeccionar primero el proyecto y su documentación**, aplicar convenciones existentes, proponer decisiones de diseño locales, documentarlas y pedir aprobación cuando cambien reglas de negocio o límites protegidos. No imponer una estructura imaginada.
- Evidencia dentro del arnés: pruebas ejecutadas, resultados, decisiones, cambios API, migraciones, limitaciones y riesgos conocidos.

## 5. Coordinación de personas y agentes

- **Responsable principal:** decide finalmente las funcionalidades y reglas de negocio; trabaja en servicio externo de prospección e integración; controla arquitectura del prospector y reglas críticas de auth.
- **Ángel:** ejecuta el bloque de backend de Campañas y pequeñas extensiones de Prospectos con ayuda de Codex/otro agente, **solo tras aprobación del alcance**. Tiene autonomía dentro de estándares, límites y requisitos; no recibe recetas excesivamente prescriptivas de implementación.
- **André:** desarrolla frontend. Puede probar visualmente flujos con mocks antes de la integración, pero el contrato final debe corresponder al backend real. Puede proponer funcionalidades, pero no añadir al alcance definitivo sin la decisión del responsable.
- **Cadena prevista:** responsable + asistente definen candidatos → responsable elige alcance → se crea un ZIP de arnés principal de backend para Ángel → Ángel implementa y conserva evidencia/decisiones/contratos → Ángel prepara un **segundo arnés de frontend** para André basado en lo que realmente quedó implementado → André realiza frontend e integra → el responsable trabaja en paralelo sobre el prospector/integración.
- Conviene publicar un contrato API preliminar temprano para que André pueda crear UI con mocks mientras Ángel sigue construyendo. El arnés definitivo de André lo prepara Ángel al terminar su bloque, reflejando divergencias justificadas del diseño inicial.

## 6. Formato previsto del arnés (futuro, no generado aún)

- Entrega en archivo ZIP; contenido copiable a la carpeta correspondiente de Codex en repositorios backend/frontend según se confirme el layout real.
- Debe incluir contexto, objetivos, funcionalidades seleccionadas, restricciones explícitas, criterios de aceptación verificables, límites de módulos, referencias a estándares del repositorio, estrategia y evidencia de pruebas, decisiones y riesgos, instrucciones de arranque mediante prompt.
- El arnés principal será principalmente backend; entregará contrato y guía de transferencia al frontend. El arnés de frontend será responsabilidad de Ángel tras concluir el backend.
- No se fijarán nombres de rutas, tablas o convenciones sin inspección del repositorio.

## 7. Pendientes de definición por el responsable

- Selección final de funcionalidades C1–C11 y P1–P4; fase MVP vs opcionales.
- Qué criterios identifican un prospecto existente (dominio, sitio, teléfono, RFC, nombre normalizado, dirección, identificación externa), y qué hacer en coincidencias ambiguas.
- Distinción formal entre etapa comercial y calificación de validez para esa campaña.
- Qué usuarios pueden ver información/resúmenes de otras campañas del mismo tenant según permisos existentes.
- Si se requiere historial de modificaciones inmutable o bitácora editable, y reglas de visibilidad de notas.
- Campos concretos del CSV y compatibilidad con el flujo actual; semántica ante filas repetidas y reobtenciones.
- Estados, métricas y definición de conversión comercial.
- Qué comportamiento se permite al cerrar/archivar campañas y al eliminar/desasociar prospectos.
- Verificación de estándares, estructura real de los repositorios y carpeta de Codex antes de construir el ZIP.

## 8. Regla de interpretación

- Las decisiones del apartado 2 son contexto aprobado. **Todo el apartado 3 y las opciones abiertas del 4–7 son propuestas a evaluar, nunca reglas confirmadas.**
- Este archivo está diseñado para recuperar el hilo de trabajo si se abre otro chat. No representa el documento de especificación ni el ZIP definitivo.
