# Alcance de ampliación de Campañas y Prospectos — v1 (revisión de reglas)

**Estado:** selección propuesta por el responsable; funcionalidades elegidas, reglas de detalle pendientes de ratificación. **No es spec aprobado, ni autorización para implementar, ni arnés de Codex.**
**Referencia:** `contexto_base_campanas_y_arneses_v0.md` (acuerdos y coordinación inicial).
**Fecha:** 2026-11-19.

## Contexto del producto y restricciones heredadas

SaaS B2B multi-tenant de gestión de campañas comerciales y generación/gestión de prospectos. Las campañas pueden contener prospectos creados manualmente, importados por CSV u obtenidos mediante un servicio externo desacoplado. Prospectos administra registros maestros del tenant; Campañas administra las participaciones y su seguimiento. El mismo prospecto puede participar en varias campañas del mismo tenant, con etapa, evaluación, responsable y seguimiento independientes. La utilidad de un prospecto es decisión manual del usuario; no debe inferirse automáticamente por aparecer en otra campaña.

Ángel implementará backend de Campañas y extensiones internas de Prospectos bajo un arnés que aún se elaborará; André desarrollará frontend. El responsable conserva el trabajo del prospector/integración y el control de reglas de autenticación, autorización y aislamiento de tenants. Ángel podrá tomar decisiones técnicas locales basadas en el código y convenciones reales, documentando su fundamento; no debe modificar límites protegidos por inferencia.

## Funcionalidades seleccionadas por el responsable para revisar

### Campañas (6)
- **C1. Pipeline comercial**: estado/etapa de seguimiento por participación campaña–prospecto.
- **C2. Evaluación manual por campaña**: dictamen contextual de utilidad/viabilidad, separado de etapa comercial; decisión humana.
- **C3. Bitácora de actividades**: registro y consulta de interacciones/notas vinculadas a participación específica.
- **C4. Asignación de responsables**: usuario autorizado del mismo tenant, propio de la participación en cada campaña.
- **C6. Filtros avanzados**: consultas y segmentación de prospectos participantes por campos y estados realmente disponibles.
- **C8. Dashboard de campaña**: métricas agregadas a partir de datos internos existentes de participación, evaluación y seguimiento.

### Prospectos (4)
- **P1. Detección de existentes**: identificar registros maestros ya presentes en el tenant y evitar duplicarlos cuando corresponda; diferenciar coincidencia segura de ambigua.
- **P2. Vista de campañas asociadas**: consultar participaciones permitidas y resumen contextual sin trasladar al prospecto maestro los estados de campaña.
- **P3. Trazabilidad de procedencia**: conservar alta inicial y nuevas apariciones/ingresos, modalidad de ingreso y campaña relacionada donde exista información confiable.
- **P4. Validación de importaciones**: validar y previsualizar CSV, reportar nuevos, existentes y filas con errores o dudas; compatibilidad con importador actual.

### Excluidas del sprint
- C5 tareas y recordatorios; C7 operaciones masivas; C9 priorización; C10 ampliación del ciclo de vida/duplicación; C11 exportación.
- Sin envío automático de correos, IA, integraciones CRM, scraping ni modificaciones del servicio externo de prospección. Sin rediseño de auth/roles/tenants.

## Criterios de aceptación provisionales (NO definitivos)
1. Un mismo prospecto maestro puede estar en campañas A y B del mismo tenant; su etapa, evaluación, responsable y actividades son independientes; no se duplica el maestro al registrar una coincidencia confirmada.
2. No se duplica la relación campaña–prospecto por importaciones repetidas; se presenta un resultado claro y se registra la nueva aparición según política acordada.
3. Ninguna consulta, filtro, vista de campañas relacionadas o importación expone datos de otros tenants; además se aplican reglas de visibilidad entre campañas del mismo tenant según la autorización existente.
4. Una evaluación de utilidad no modifica por sí misma el estado de otra campaña; no existe decisión automática de validez comercial.
5. El historial identifica autor, fecha y campaña; distinguir interacciones reportadas por usuarios de eventos generados por el sistema, conforme se acuerde.
6. Los dashboards cuentan prospectos por participación única dentro de una campaña; no prometen métricas externas (aperturas, impresiones, clics, conversiones) sin eventos/definiciones reales.
7. CSV admite errores parciales y duplicados sin contaminar datos maestros; el comportamiento transaccional y de confirmación se documenta.
8. Las interfaces y contratos existentes deben conservar compatibilidad o elevar una desviación para aprobación.

## Reglas pendientes de decisión del responsable

**R1. Identificación de coincidencias.** Definir campos disponibles, normalización, precedencia, manejo de colisiones y decisión entre coincidencia confirmada / probable / no encontrada. Propuesta: confirmación automática solo para clave inequívoca; coincidencias dudosas requieren resolución del usuario; siempre por tenant.

**R2. Momento de intervención humana.** Clarificar que la decisión manual mencionada corresponde a utilidad comercial C2 y, si hay identidad ambigua, también a resolución P1; una coincidencia inequívoca puede reutilizarse sin evaluación comercial.

**R3. Catálogo de pipeline C1.** Confirmar etapas y transiciones, estado inicial y si existe cierre/reapertura. Propuesta inicial: Sin gestionar, En investigación, Contactado, En seguimiento, Oportunidad, Cerrado. Revisar si esos términos reflejan el negocio.

**R4. Evaluación C2.** Confirmar valores y justificación. Propuesta: Sin evaluar, Apto, No apto, con motivo obligatorio para No apto; conservar cambios de decisión.

**R5. Bitácora C3.** Definir tipos de evento, quién puede modificar/borrar, visibilidad y distinción entre nota humana y evento del sistema. Propuesta: creación con autor y sello de tiempo, correcciones trazables, sin simular envío de mensajes.

**R6. Responsable C4 y acceso P2.** Qué usuarios de un tenant pueden asignarse/ver campañas ajenas; cómo se maneja desactivación/reasignación; no inventar roles o permisos.

**R7. Origen y reapariciones P3.** Nivel de registro por alta, importación y obtención; tratamiento de datos históricos incompletos (no fabricar fechas/orígenes); entradas repetidas en la misma campaña.

**R8. CSV P4.** Campos identificadores realmente disponibles, formato, resultado de previsualización, confirmación, repetidos dentro del mismo archivo, filas inválidas, procesamiento parcial y límites de volumen. Propuesta: prevalidar antes de confirmar y devolver conteos y errores por fila.

**R9. Indicadores C8 y filtros C6.** Campos y métricas mínimas; denominadores, definiciones de contacto/conversión y si se deben incluir series temporales. Propuesta: total de participaciones distintas, desglose por etapa y evaluación, responsables y última actividad; omitir conversión hasta definirla.

## Reglas para futuros arneses y colaboración

- El arnés de backend de Ángel solo se construirá después de cerrar este alcance y revisar convenciones/documentos del repositorio. Debe fijar resultados, criterios y restricciones, dando libertad para diseñar la solución local.
- Ángel debe trabajar sobre campañas y prospectos internos; no alterar servicio externo de prospección, auth, reglas del tenant o permisos sin aprobación explícita. Diferencias descubiertas en repo deben documentarse y escalarse.
- El arnés deberá conservar evidencias de pruebas, migraciones, decisiones, contratos API reales, problemas y límites en el propio directorio de trabajo correspondiente.
- André puede crear UI con mocks a partir de un contrato preliminar; el arnés definitivo de frontend lo producirá Ángel con base en el backend real, para que André lo integre.
- La carpeta Codex, su layout y el comando/prompt de activación solo se fijarán tras verificar la estructura real de los repositorios. ZIP aún no creado.

## Estado de la revisión

**Seleccionado:** C1, C2, C3, C4, C6, C8, P1, P2, P3, P4. **Pendiente:** reglas R1–R9 y aprobación expresa para especificar/implementar. Ninguna implementación solicitada todavía.
