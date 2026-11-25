# SPEC-CP-2026-01 — Ampliación de gestión de Campañas y Prospectos

**Plataforma:** PROSPECTOR SaaS — plataforma B2B multi-tenant de gestión de campañas de marketing y prospectos  
**Versión:** 1.0.0 — especificación funcional y técnica de resultados  
**Fecha de ratificación del alcance y de las decisiones:** 19 de noviembre de 2026 (America/Tijuana)  
**Autoridad:** Owner técnico y de producto del proyecto  
**Ejecutor delegado backend:** Ángel, personalmente o mediante agentes/subagentes que coordine  
**Ejecutor delegado frontend:** André, personalmente o mediante su agente, a partir del contrato entregado por Ángel  
**Estado del documento:** **ESPECIFICACIÓN APROBADA POR EL OWNER** mediante autorización expresa en la conversación de trabajo. **NO equivale a GO de ejecución Git, merge, migración productiva ni despliegue.**  
**Artefacto posterior:** arnés operativo para backend y, por handoff de Ángel, arnés para frontend. **El ZIP del arnés NO se crea en esta entrega.**

> **Mandato:** desarrollar exactamente C1, C2, C3, C4, C6, C8, P1, P2, P3 y P4. Preservar todas las reglas de Auth/RBAC/TenantContext, la integración/prospección externa y la funcionalidad existente que no resulte expresamente sustituida por esta decisión. Delegar a Ángel el *cómo* local, no el *qué* funcional ni las decisiones de arquitectura protegida.

---

## 0. Resumen ejecutivo y alcance de la autorización

La solución ya gestiona tenants, campañas, prospectos persistidos, alta manual e importación CSV. Este sprint transforma la relación `Campaign`–`Prospect` en una **participación comercial gestionable e independiente**, sin copiar los datos maestros del prospecto cuando aparece en más de una campaña del mismo tenant. La plataforma seguirá funcionando sin Prospector Service.

### 0.1. Resultados obligatorios

1. En cada campaña, un prospecto tiene **etapa comercial**, **evaluación manual**, **responsable** y **bitácora** independientes de sus otras campañas.
2. Se detectan coincidencias antes de crear prospectos desde **alta manual** o **CSV**; se reutilizan inequívocas y se somete a decisión humana lo ambiguo.
3. Se conservan procedencia inicial y nuevas apariciones **confirmadas**, y se puede consultar la relación del prospecto con distintas campañas del tenant.
4. Las listas y el dashboard de cada campaña ofrecen filtros e indicadores calculados en backend, sin inventar métricas de marketing externas.
5. El backend mantiene sus garantías transversales; André recibe contrato, casos y evidencias suficientemente concretos para implementar Flutter sin reinterpretar negocio.

### 0.2. Dentro y fuera

| Módulo | Incluido | Excluido |
|---|---|---|
| Campañas | C1 pipeline; C2 evaluación; C3 bitácora; C4 responsable; C6 filtros; C8 dashboard **por campaña** | C5 tareas/recordatorios; C7 acciones masivas; C9 scoring; C10 ampliación de ciclo de vida; C11 exportación |
| Prospectos | P1 coincidencias/reutilización; P2 campañas asociadas; P3 procedencia; P4 evolución CSV | Fusiones automáticas de duplicados históricos; CRM universal; enriquecimiento externo nuevo |
| Plataforma transversal | Uso de seguridad, permisos, respuestas, validaciones y contexto tenant **existentes** | Rediseño de Auth, JWT, RolesGuard, TenantContext, Users, Tenants, onboarding ADR-006, configuración productiva o red de servicios |
| Prospección externa | Exclusivamente preservar fronteras y dejar el módulo de gestión preparado para integración futura | Cambios a Prospector Service/Engine/CLI, jobs, callbacks, scraping, caché, exportación de resultados del engine o endpoints de integración |

**Regla de no ampliación implícita:** una funcionalidad excluida no pasa a ser requisito por comodidad técnica o visual. Cualquier incorporación se registra como solicitud de cambio para aprobación del owner.

---

## 1. Fuentes reales, instantánea y precedencia normativa

### 1.1. Repositorios examinados (solo lectura)

| Elemento | Backend | Frontend |
|---|---|---|
| Repositorio | [`CarlosAM03/saas-platform-backend`](https://github.com/CarlosAM03/saas-platform-backend) | [`CarlosAM03/saas-platform-client`](https://github.com/CarlosAM03/saas-platform-client) |
| PR previo por cerrar por owner | [#10](https://github.com/CarlosAM03/saas-platform-backend/pull/10) | [#11](https://github.com/CarlosAM03/saas-platform-client/pull/11) |
| Rama de referencia más actual confirmada | `feat/tenant-register` | `feat/tenant-register` |
| HEAD comprobado al redactar | `5e214420394101ae7079f8e844cc759b01cce2a3` | `0fe5d368e11b1da745ccf42ead3892470dcae0be` |
| Base declarada de PR | `main@b51b265f1a545fa915f1dd1c57ef2f5858ec6492` | `main@e752f6ca692d2840263cd9e59e0927c56aa129ec` |
| Estado comprobado | PR abierto, no fusionado, mergeable | PR abierto, no fusionado, mergeable |
| Checks asociados a HEAD | CI concluida con resultado `success` | CI concluida con resultado `success` |

Estos datos son **evidencia de lectura, no promesa de estado futuro**. Al iniciar el trabajo, el ejecutor debe verificar nuevamente remoto, branch, SHA, PR, CI y árbol de trabajo. Si el owner ya fusionó o corrigió los PR, la base autorizada será la que él indique; **no** esta instantánea obsoleta.

**`dev` no es la referencia autorizada por defecto.** El owner confirmó que las ramas de los PR son las más actuales; él mismo cerrará los trabajos previos, revisará y decidirá la promoción a `main`.

### 1.2. Evidencia de código y documentos vigentes

**Backend, rama `feat/tenant-register`:**

- [`Prisma/schema.prisma`](https://github.com/CarlosAM03/saas-platform-backend/blob/feat/tenant-register/Prisma/schema.prisma): `Campaign`, `Prospect`, `CampaignProspect`, `User`, `UserTenant`, estados y constraints.
- [`src/campaigns/campaigns.service.ts`](https://github.com/CarlosAM03/saas-platform-backend/blob/feat/tenant-register/src/campaigns/campaigns.service.ts) y [`campaigns.controller.ts`](https://github.com/CarlosAM03/saas-platform-backend/blob/feat/tenant-register/src/campaigns/campaigns.controller.ts): CRUD de campañas y listado de prospectos por origen o asociación.
- [`src/prospects/prospects.service.ts`](https://github.com/CarlosAM03/saas-platform-backend/blob/feat/tenant-register/src/prospects/prospects.service.ts): CRUD maestro y alta manual transaccional, sin deduplicación manual preexistente.
- [`src/prospects/imports/README.md`](https://github.com/CarlosAM03/saas-platform-backend/blob/feat/tenant-register/src/prospects/imports/README.md) y [`prospect-imports.service.ts`](https://github.com/CarlosAM03/saas-platform-backend/blob/feat/tenant-register/src/prospects/imports/prospect-imports.service.ts): CSV V1, preview/confirm, matching por nombre, concurrencia y decisiones.
- [`Docs/ADRs/ADR-001-DecisionesDeDominioMVP.md`](https://github.com/CarlosAM03/saas-platform-backend/blob/feat/tenant-register/Docs/ADRs/ADR-001-DecisionesDeDominioMVP.md): definición histórica de identidad incluyendo campaña de origen.
- [`Docs/ADRs/ADR-004-CommonBaseline.md`](https://github.com/CarlosAM03/saas-platform-backend/blob/feat/tenant-register/Docs/ADRs/ADR-004-CommonBaseline.md), [`ADR-003`](https://github.com/CarlosAM03/saas-platform-backend/blob/feat/tenant-register/Docs/ADRs/ADR-003-AuthSecureTransversal.md), [`ADR-006 aprobado`](https://github.com/CarlosAM03/saas-platform-backend/blob/feat/tenant-register/Docs/ADRs/ADR-006-TenantRegistration-APROBADO.md), [`MODULE-DEVELOPMENT.md`](https://github.com/CarlosAM03/saas-platform-backend/blob/feat/tenant-register/MODULE-DEVELOPMENT.md) y [`Docs/Contracts/platform-api.v1.yaml`](https://github.com/CarlosAM03/saas-platform-backend/blob/feat/tenant-register/Docs/Contracts/platform-api.v1.yaml).

**Frontend, rama `feat/tenant-register`:**

- [`FEATURE-DEVELOPMENT.md`](https://github.com/CarlosAM03/saas-platform-client/blob/feat/tenant-register/FEATURE-DEVELOPMENT.md): ownership, arquitectura por feature, cliente tipado y áreas protegidas.
- [`lib/features/campaigns/presentation/campaigns_page.dart`](https://github.com/CarlosAM03/saas-platform-client/blob/feat/tenant-register/lib/features/campaigns/presentation/campaigns_page.dart): detalle de campaña con pestañas **Detalle** y **Prospectos**.
- [`lib/features/prospects/presentation/prospect_import_page.dart`](https://github.com/CarlosAM03/saas-platform-client/blob/feat/tenant-register/lib/features/prospects/presentation/prospect_import_page.dart): preview y confirm CSV, decisiones de usuario y advertencia al modificar datos compartidos.
- [`lib/features/prospects/presentation/prospects_page.dart`](https://github.com/CarlosAM03/saas-platform-client/blob/feat/tenant-register/lib/features/prospects/presentation/prospects_page.dart): vista maestra y acceso a campaña de origen.
- [`lib/features/dashboard/data/dashboard_repository.dart`](https://github.com/CarlosAM03/saas-platform-client/blob/feat/tenant-register/lib/features/dashboard/data/dashboard_repository.dart): dashboard **global del tenant**, no equivalente a C8.
- [`lib/platform_api/`](https://github.com/CarlosAM03/saas-platform-client/tree/feat/tenant-register/lib/platform_api): DTOs y métodos tipados existentes.

### 1.3. Hechos relevantes auditados

- `Prospect.campaignId` señala la **campaña de origen**; no enumera todas las campañas. `CampaignProspect` materializa la relación N:M con PK `(campaignId, prospectId)`, `status String @default("ACTIVO")` y `addedAt`.
- `Prospect.status` es `ACTIVO|INACTIVO`; `Campaign.status` es `ACTIVA|PAUSADA|COMPLETADA|ARCHIVADA`. **Ninguno equivale al pipeline comercial C1**.
- La unicidad histórica de `Prospect` es `(tenantId, campaignId, source, sourceIdentifier)`. **No garantiza identidad única por empresa real en todo el tenant**.
- `CampaignsService.findProspects` consulta tanto registros de origen como asociaciones, pero devuelve campos maestros, no la nueva información contextual.
- CSV V1 dispone de `POST /api/v1/prospects/import/preview` y `/confirm`, acciones `CREATE`, `LINK_EXISTING`, `UPDATE_EXISTING`, `SKIP`, clasificaciones `NEW`, `MATCH`, `INVALID`, `CONFLICT`. Coincidencias por nombre normalizado son **candidatos**, no prueba irrefutable de identidad.
- CSV V1 conserva preview firmado con vigencia de 15 minutos, confirmación serializable, límites, validación y revalidación; **no** tiene historial durable de importación ni idempotencia durable.
- El frontend ya contiene importación CSV operable, listado/detalle/creación de prospectos y dashboard del tenant; el sprint **extiende**, no reconstruye, esos módulos.

### 1.4. Autoridad y precedencia para ESTE sprint

1. **Decisiones expresas actuales del owner contenidas en este SPEC y en sus posteriores correcciones formales**, solamente dentro del alcance autorizado.
2. ADR-004 y demás decisiones transversales vigentes (incluidos ADR-003/ADR-006 y sus precisiones aprobadas), para toda materia **no** sustituida expresamente aquí.
3. Anexos/ADRs de dominio emitidos para este sprint con trazabilidad de la autorización del owner.
4. Prisma/migraciones y contrato OpenAPI reales de la **base Git autorizada**, a reconciliar mediante cambios compatibles y explícitos.
5. Código/tests de esa base, documentación modular y handoffs; material histórico en último término.

**Excepción oficial acotada:** la simplificación de ADR-001 que permite crear registros maestros del mismo negocio por campaña deja de gobernar **nuevas altas y vínculos gestionados por este sprint**. La nueva regla es **un prospecto maestro reutilizable por tenant**, asociado a varias campañas. La fuente/identificador externo es una señal fuerte de identidad cuando resulte confiable; los datos débiles se resuelven con intervención humana. **No** se interpreta esta excepción como autorización para alterar seguridad, JWT, tenant, Jobs ni componentes externos. Ángel debe documentar el cambio en un ADR de dominio complementario o actualización explícita y trazable; no borrar silenciosamente la justificación histórica de ADR-001 ni modificar ADR-004 para eludir controles.

**Sobre el `sourceIdentifier = null` de ADR-001:** la mención histórica a hash de nombre+dirección+teléfono **no se convierte automáticamente en identidad inequívoca** en este sprint; la implementación CSV/manual actual mantiene nulos y usa matching de candidatos. Tratarlo como señal débil y documentar la conciliación de fuentes sin generar equivalencias engañosas.

### 1.5. Matriz de autoridad delegada

| Acción | Ángel / sus agentes | André / su agente | Owner |
|---|---|---|---|
| Definir implementación local Campañas/Prospectos, consultas, servicios, índices, DTO y tests | Decide y documenta | No aplica | Puede revisar |
| Modificar esquema Prisma, migraciones aditivas, contratos de **este sprint** | Autorizado en rama nueva y bajo invariantes | Solo consume contratos | Revisión y aceptación |
| Documentar ADR/decisión de dominio de identidad compartida | Autorizado, referenciando esta aprobación | Consume | Autoridad de la regla |
| Diseñar pantallas, providers, repositorios Flutter dentro de ownership | Define necesidades y handoff | Decide y desarrolla | Revisión |
| Cambiar rutas/core Flutter protegidos, Auth, RBAC, TenantContext, Users/Tenants, Prospector | **No autorizado sin permiso nuevo** | **No autorizado sin permiso nuevo** | Decide |
| Resolver un conflicto nuevo de reglas de negocio o arquitectura protegida | Escala con alternativas, no lo decide solo | Escala | Decide |
| Commit y push ordinarios a rama **nueva autorizada**; abrir PR para revisión | Permitido tras gate de rama, sin alteraciones destructivas | Conforme a su arnés y gate | Supervisa |
| Merge, despliegue, migración sobre datos reales/producción, cambios de PR anteriores | Prohibido por delegación actual | Prohibido por delegación actual | Exclusivo |

El uso de **subagentes** por Ángel es un detalle del ejecutor: las mismas fronteras rigen a cada subagente. La responsabilidad consolidada y las evidencias pertenecen al ejecutor backend. La herramienta exacta no se presupone.

---

## 2. Modelo conceptual y definiciones invariantes

### 2.1. Términos

| Término | Significado normativo |
|---|---|
| **Tenant** | Empresa cliente/organización activa del contexto de sesión; es el perímetro de datos y pertenencia. |
| **Prospecto maestro** | Registro persistido con datos generales de la empresa/contacto; se comparte entre campañas **del mismo tenant**. |
| **Campaña de origen** | Campaña vinculada a la primera incorporación conocida del prospecto. El `Prospect.campaignId` existente se conserva como referencia histórica; no debe reinterpretarse como campaña exclusiva. |
| **Participación** | Asociación única `Campaign`–`Prospect` que contiene la gestión comercial contextual de esa campaña. |
| **Etapa comercial** | Avance operativo de esa participación: C1, independiente de `Prospect.status` y `Campaign.status`. |
| **Evaluación de utilidad** | Juicio **humano** sobre si el prospecto es funcional para una campaña; C2, independiente de etapa. |
| **Responsable** | Usuario activo y miembro elegible del mismo tenant asignado a la participación; no concede permisos nuevos. |
| **Actividad** | Nota o interacción declarada por un usuario; no implica que la plataforma enviara un mensaje. |
| **Evento del sistema** | Registro inmutable de un cambio real de etapa, evaluación, responsable o asociación. |
| **Procedencia/aparición** | Evidencia persistente de ingreso/vínculo/actualización **confirmado**, con fuente y campaña cuando se conozcan; no incluye preview ni omisiones. |
| **Coincidencia inequívoca** | Coincidencia única por una combinación validada de fuente confiable + identificador externo no vacío, dentro del tenant. |
| **Coincidencia ambigua** | Candidatura de identidad inferida de campos débiles o de múltiples registros compatibles; requiere decisión explícita del usuario. |

### 2.2. Invariantes de dominio obligatorias

- **INV-01:** ningún prospecto, asociación, actividad, evaluación, responsable, procedencia, filtro o agregado de otro tenant puede leerse ni modificarse.
- **INV-02:** una campaña y un prospecto asociados deben pertenecer al **mismo tenant**. Validar tanto en consultas como en escrituras y transacciones; incorporar restricciones DB cuando sean compatibles.
- **INV-03:** un prospecto participa como máximo una vez por campaña: PK/invariante equivalente a `(campaignId, prospectId)`; reutilizar asociación no reinicia seguimiento.
- **INV-04:** las campañas comparten *datos maestros* del prospecto dentro del tenant, pero **no** comparten etapa, evaluación, responsable ni historial contextual.
- **INV-05:** la coincidencia de identidad nunca decide automáticamente la **aptitud comercial**.
- **INV-06:** `Prospect.status`, `Campaign.status` y el `CampaignProspect.status` histórico **no se convierten implícitamente** en la nueva etapa comercial; conservar su semántica histórica o migrarla de modo explícito, reversible y probado.
- **INV-07:** ninguna acción de solo lectura o preview genera cambios de base de datos ni procedencias ficticias.
- **INV-08:** la fecha de primera creación, campaña de origen y fuente original no se sobrescriben al vincular a otra campaña; una actualización maestra no altera el historial comercial de otras participaciones.
- **INV-09:** el origen/autor/fecha de eventos nuevos provienen del servidor y del contexto autenticado. No se aceptan por confianza campos de auditoría controlados por cliente.
- **INV-10:** cambios de identidad, importaciones y vinculaciones simultáneas no pueden crear dos maestros cuando una identidad fuerte única ya está confirmada ni duplicar asociaciones. Datos históricos ambiguos se reportan, no se unen automáticamente.
- **INV-11:** el sistema funciona con importación CSV y alta manual sin contacto alguno con Prospector Service.
- **INV-12:** la modificación de información maestra puede verse en todas sus campañas y requiere aviso/confirmación donde la operación la promueva a actualización; `LINK_EXISTING` no actualiza datos maestros.

### 2.3. Estados normativos de la participación

| Dimensión | Valores visibles aprobados | Default | Reglas |
|---|---|---|---|
| Etapa comercial C1 | `Sin gestionar`, `En investigación`, `Contactado`, `En seguimiento`, `Oportunidad`, `Cerrado` | Sin gestionar | Transiciones libres, retroceso y reapertura permitidos; registrar cambio. `Cerrado` **no** significa automáticamente venta ni no aptitud. |
| Evaluación C2 | `Sin evaluar`, `Apto`, `No apto` | Sin evaluar | Cualquier cambio es manual y trazable; seleccionar `No apto` exige motivo no vacío. Puede cambiar de criterio posteriormente. |
| Responsable C4 | Usuario elegible del tenant o sin asignar | Sin asignar | Reasignación trazada; sin reasignación automática. Mantener identidad del responsable histórico que pierda elegibilidad. |

Ángel decide los identificadores de enum/código y representación de DTO, pero debe preservar de forma exacta la correspondencia conceptual y no romper el uso previo de `status`.

### 2.4. Ejemplo de independencia

El prospecto maestro `Transportes ABC` se originó en campaña A y luego se vincula a B. En A puede estar **Contactado / Apto / Responsable X**, con notas de llamadas. En B inicia **Sin gestionar / Sin evaluar / Sin asignar**, con historial vacío salvo evento real de vinculación; cambiar B jamás modifica los campos comerciales de A. Una actualización explícita del teléfono **maestro** sí es visible para ambas campañas, pero no reescribe notas históricas.

---

## 3. Reglas transversales de identidad y vinculación (B1–B7)

### 3.1. Política de identidad (B1)

La detección es **siempre tenant-scoped** y aplica tanto a alta manual como a CSV. El backend diferencia señales fuertes y débiles:

- **Señal fuerte:** par `(fuente confiable, identificador externo válido no vacío)` correspondiente a un único maestro del tenant; puede conducir a reutilización sin revisión de identidad. La lista concreta de fuentes confiables y la validación de sus identificadores deben justificarse con campos y fuentes realmente disponibles; **no** presumir que `source=manual|csv` con `sourceIdentifier=null` satisface la condición.
- **Señales débiles:** nombre normalizado, dominio/web, teléfono, dirección o sus combinaciones. Sirven para **sugerir candidatos**. Nombre idéntico o dominio coincidente aislado **no** es identidad definitiva en este sprint.
- **Colisiones fuertes:** si la misma clave fuerte apunta a varios maestros históricos, el caso es **ambiguo**; nunca escoger arbitrariamente el primero.
- **Sin candidato:** ofrecer crear maestro nuevo, sujeto a revalidación en la confirmación.

No imponer un algoritmo de scoring de identidad ni un matching probabilístico de IA. La normalización de CSV V1 se conserva como mecanismo de búsqueda de candidatos hasta que una modificación explícita y probada la complemente; los campos originales no se sobreescriben al normalizar.

### 3.2. Resolución (B2, B6)

| Situación al evaluar/confirmar | Respuesta funcional | Efecto al confirmar |
|---|---|---|
| Una identidad fuerte confiable y **única** | Indicar prospecto existente, campañas asociadas permitidas y diferencias de datos; la reutilización de identidad no requiere juzgar aptitud | Asociar en campaña destino si aún no está. Nunca actualizar maestro ni valoración por ese hecho. |
| Uno o varios candidatos **débiles/ambiguos** | Mostrar identificadores estables, campos relevantes, origen y campañas autorizadas; solicitar decisión explícita | **Vincular candidato elegido**, **crear distinto conscientemente** o **omitir**. Revalidar que el candidato siga perteneciendo al tenant. |
| Varios maestros bajo misma clave aparentemente fuerte (datos históricos) | Conflicto de identidad; no elección automática | Resolver manualmente o detener la fila para revisión; nunca fusionar automáticamente. |
| Sin candidatos | Indicar que es nuevo | Crear Prospect y participación de origen en una transacción. |
| Prospecto ya relacionado con la campaña | Indicar participación existente | No crear doble vínculo, no reiniciar etapa, evaluación, responsable ni historial. Solo una actualización/actividad explícita puede cambiar información. |
| Cambios concurrentes entre preview y confirm | Presentar conflicto que exige nueva revisión | No usar decisiones sobre instantánea obsoleta ni completar parcialmente de forma insegura. |

Una acción **crear distinto** cuando existen candidatos debe conservar el hecho de que la decisión fue consciente, sin declarar que los registros son inequívocamente entidades diferentes para siempre. No introducir un proceso general de merge como parte del sprint.

### 3.3. Alta manual y CSV (B3)

- Alta manual: incorporar detección/resolución **antes** de confirmar creación. Mantener DTOs, permisos, tenant, validaciones y compatibilidad del camino actual según la estrategia de API escogida por Ángel. No introducir un POST que siga creando silenciosamente maestros frente a coincidencias inequívocas.
- CSV: evolucionar los **mismos** preview/confirm y el modelo de decisiones, usando política compartida. No sustituir el parser ni degradar las garantías existentes. Un `CONFLICT` por varios candidatos debe poder resolverse mediante selección explícita cuando resulte seguro, o mantenerse rechazado con explicación cuando no exista decisión inequívoca; registrar alcance compatible de cambios de contrato.
- La capacidad para invocar estas reglas desde un futuro flujo de resultados externos puede quedar preparada como interfaz interna, **sin editar Jobs, callbacks, Service ni contratos de prospección**.

### 3.4. Actualización de datos maestros compartidos (B4)

- `LINK_EXISTING`: vincula sin editar atributos maestros ni procedencia original.
- `UPDATE_EXISTING`: debe mantenerse como acción **separada**; expone diferencias, advierte efecto sobre otras campañas y exige confirmación. Solo actualizar campos expresamente autorizados/presentes; mantener semántica de **ausente** vs **vacío** de CSV V1.
- Cambios persistidos deben dejar trazabilidad **global** del prospecto y, cuando correspondan a una acción en campaña, referencia al contexto que los originó, sin insertar artificialmente cambios en los pipelines de todas las campañas.
- No otorgar a MEMBER permiso de importación que hoy no tiene; el PATCH maestro preexistente mantiene su permiso actual.

### 3.5. Históricos y procedencias (B5, B7)

- No fusionar, borrar ni renombrar automáticamente prospectos anteriores que parezcan duplicados. Generar diagnóstico y política de compatibilidad/migración verificable con datos sintéticos representativos.
- Registrar procedencia persistente **solo a partir de acciones confirmadas con efecto de creación, vinculación o actualización**, y apariciones nuevas efectivamente confirmadas que deban diferenciarse de una asociación ya existente. **No** registrar preview, `SKIP`, validaciones fallidas ni operaciones revertidas como alta efectiva.
- Conservar origen inicial, primera fecha conocida y nuevas apariciones/operaciones con fuente disponible, campaña asociada, autor/actor cuando exista y timestamp confiable. Un nuevo avistamiento confirmado en una campaña ya vinculada puede constar como **aparición**, pero nunca debe fingir una segunda asociación ni reiniciar estado; evitar crear eventos duplicados por el mismo intento de confirmación.
- Para registros históricos con fuente/fecha no verificables, mostrar **no disponible / legado**. No generar un falso historial retrospectivo.
- Si el modelo de procedencia requiere nueva persistencia, Ángel elige estructura y constraints compatibles; no es un historial general de todas las consultas.

### 3.6. Secuencias de referencia

**Creación manual:** entrar a campaña → ingresar datos → evaluar coincidencias en tenant → presentar resultado y antecedentes autorizados → confirmar crear/vincular/omitir → revalidar entidad/tenant/concurrencia → transacción → respuesta con acción real, id y asociación → consultar ficha.

**CSV:** subir CSV en campaña → preview sin escrituras → clasificar, mostrar posibles coincidencias y diferencias → resolver por fila válida → confirmar con archivo y referencia vigentes → revalidar contra estado actual → transacción de lote → devolver resultados por fila y totales → consultar campaña. Los inválidos/conflictos no deben bloquear la inspección del resto, pero el **commit** del lote mantiene atomicidad ante fallo inesperado según V1.

---

## 4. Especificación funcional: Campañas

### C1 — Pipeline comercial por participación

**Objetivo:** permitir seguimiento comercial distinto de un mismo prospecto en cada campaña.

**Precondiciones:** campaña y prospecto del tenant, participación existente; rol con autorización vigente para operar campañas.

**Comportamiento requerido:**

- Exponer etapa actual por participación y modificarla manualmente entre las seis etapas del §2.3.
- Default `Sin gestionar` para participaciones nuevas; retroceso y reapertura de `Cerrado` permitidos; ningún cambio de etapa envía comunicaciones ni cambia evaluación.
- Registrar evento inmutable de transición con actor, timestamp de servidor, etapa anterior/nueva y contexto de campaña/prospecto.
- Un cambio hacia el mismo valor no debe generar un falso evento de transición.
- Tratar una participación reutilizada/importada como **existente**; nunca reiniciar su estado por asociación repetida.
- La UI podrá representar lista con chips o tablero Kanban, pero **Kanban no es requisito del backend** ni se obliga arquitectura drag-and-drop.

**Criterios de aceptación:**

- **AC-C1-01:** mismo maestro en A/B; cambiar etapa en B deja A intacta.
- **AC-C1-02:** una relación nueva inicia Sin gestionar; relación existente conserva etapa tras LINK_EXISTING.
- **AC-C1-03:** transición `Cerrado → En seguimiento` válida y trazada; no se registra venta automática.
- **AC-C1-04:** evento identifica anterior, nuevo, actor y fecha real; la identidad de tenant es segura.
- **AC-C1-05:** no confundir etapa con `Prospect.status`, `Campaign.status` ni `CampaignProspect.status` legado.

### C2 — Evaluación manual de utilidad por campaña

**Objetivo:** permitir decisión humana de validez de cada oportunidad para la campaña.

**Comportamiento requerido:**

- Valores `Sin evaluar`, `Apto`, `No apto`; default Sin evaluar.
- `No apto` requiere justificación no vacía validada en backend. Motivo opcional en otros cambios.
- Cada modificación registra el valor anterior/nuevo, motivo provisto, actor y timestamp; no se sobreescribe el registro histórico.
- Permitir reevaluación, incluido No apto → Apto y Apto → Sin evaluar.
- No derivar evaluación de identidad detectada, etapa comercial, otras campañas o una regla predictiva.
- No editar datos maestros para representar la evaluación contextual.

**Criterios:**

- **AC-C2-01:** No apto sin motivo = error de validación, sin mutación.
- **AC-C2-02:** Apto en A / No apto en B coexisten sin contaminación.
- **AC-C2-03:** secuencia Sin evaluar → No apto → Apto conserva ambos eventos y motivo inicial.
- **AC-C2-04:** evaluación no cambia etapa ni dispara Jobs/Prospector.

### C3 — Bitácora de actividades y eventos

**Objetivo:** conservar historia útil y verificable del seguimiento por participación.

**Comportamiento requerido:**

- Actividades manuales: **nota/observación, llamada registrada, correo registrado, reunión registrada, otra interacción**.
- Eventos automáticos: incorporación/asociación, cambio de etapa, evaluación y responsable; hechos de actualización maestra se registran principalmente en procedencia global con referencia contextual si corresponde.
- Mostrar autor, fecha y tipo, con contenido limitado a su campaña; distinguir evento automático de declaración manual.
- Registro histórico **inmutable**: corregir mediante nueva entrada referenciada a la anterior, sin modificación destructiva ni eliminación silenciosa.
- El timestamp de registro es del servidor. No falsear el momento real de una llamada: si se ofrece fecha declarada por usuario, distinguirla de `recordedAt`.
- Listado ordenado y paginado con criterio estable, sin filtrar por tenant solo en frontend.
- No enviar emails, SMS, notificaciones ni efectuar llamadas. No registrar secretos ni detalles de contacto innecesarios en logs operativos.

**Criterios:**

- **AC-C3-01:** nota en A no aparece como actividad contextual de B.
- **AC-C3-02:** transición/evaluación/asignación efectiva genera exactamente un evento lógico, no por reintento fallido o no-op.
- **AC-C3-03:** corrección genera nueva entrada y preserva el registro original.
- **AC-C3-04:** actividad manual no afirma que la plataforma haya enviado una comunicación.
- **AC-C3-05:** páginas 1/N muestran orden consistente, permisos y tenant válidos.

### C4 — Asignación y reasignación de responsables

**Objetivo:** identificar quién sigue cada prospecto dentro de una campaña, sin crear administración de usuarios paralela.

**Comportamiento requerido:**

- Permitir asignación, cambio y desasignación por roles que ya pueden operar campañas: `ADMIN`, `OWNER`, `MEMBER` **con tenant seleccionado**. No introducir permisos granulares ni editar roles.
- Responsable elegido: `User` activo, con `UserTenant` elegible del **mismo tenant**; un ADMIN global sin membresía no es automáticamente responsable elegible solo por ser ADMIN.
- Validar elegibilidad en servidor al escribir, no confiar en el selector Flutter.
- Guardar histórico de asignación con responsable anterior/nuevo, actor y fecha; permitir `sin asignar` como valor actual.
- Si un usuario deja de ser elegible, **no** borrar referencias históricas ni reasignar automáticamente: marcar la asignación actual como no elegible/pendiente de reasignación según datos actuales; solicitar intervención humana para la siguiente asignación.
- No modificar Auth, Users o el modelo de membresías para cumplir C4.

**Criterios:**

- **AC-C4-01:** ADMIN/OWNER/MEMBER autorizados en campaña pueden asignar elegible según contexto.
- **AC-C4-02:** intento de asignar usuario ajeno/inactivo/no miembro es rechazado sin fuga de identidad entre tenants.
- **AC-C4-03:** A asigna X y B asigna Y al mismo maestro sin interferencia.
- **AC-C4-04:** retiro de membresía conserva historia y no ejecuta reassignment silencioso.
- **AC-C4-05:** el acceso a la lista de elegibles sigue reglas de seguridad existentes, sin un endpoint de Users global nuevo por comodidad.

### C6 — Filtros avanzados de participantes

**Objetivo:** permitir segmentación *interna* y navegación de grandes listas sin cargar toda la campaña al cliente.

**Campos mínimos:** búsqueda por nombre y, donde exista, email; categoría/sector (`Prospect.category`), ubicación disponible (p. ej., búsqueda textual por `address`, sin inventar ciudad estructurada), fuente persistida, etapa comercial, evaluación, responsable (incluido sin asignar), y fechas relevantes disponibles (incorporación y/o actividad registrada).

**Comportamiento:**

- Filtrado, conteo y paginación en backend sobre **todas** las participaciones de la campaña; nunca aplicar solo a la página cargada.
- Combinación de filtros de diferentes dimensiones con semántica AND; dentro de una misma dimensión multivalor, OR cuando se exponga selección múltiple. Documentar semántica y casos de ausencia/null.
- Permitir orden estable por campos realmente disponibles, con desempate determinista; mantener límites/convenciones `PaginationDto` salvo extensión autorizada.
- Evitar duplicados por joins con actividades/procedencias; una participación aparece una sola vez en resultados.
- Guardar filtros persistentes/vistas favoritas queda **fuera** de este sprint.
- No añadir geocodificación, servicio externo, IA o nuevas reglas de clasificación del sector.

**Criterios:**

- **AC-C6-01:** filtros combinados devuelven total/metadata correctos y página estable.
- **AC-C6-02:** un filtro por etapa B no afecta las mismas empresas de A.
- **AC-C6-03:** búsqueda y agregados no revelan otros tenants ni por conteos.
- **AC-C6-04:** el frontend puede aplicar filtros desde API sin descargar cientos de páginas.

### C8 — Dashboard de campaña

**Objetivo:** dar visibilidad operativa basada solo en eventos y registros internos reales.

**Métricas mínimas (snapshot actual):**

| Métrica | Regla de cálculo / denominador |
|---|---|
| Total de prospectos en campaña | `COUNT(DISTINCT prospectId)` sobre participaciones válidas de **esa** campaña, incluyendo estados maestros mientras su asociación exista; no contar 2 veces por joins. |
| Distribución por etapa | Cantidad de participaciones en cada una de las seis etapas. La suma debe igualar el total. |
| Evaluación | Sin evaluar/Apto/No apto. La suma debe igualar el total. |
| Asignación | Por responsable elegible/histórico identificable y sin asignar; no duplicar participaciones. Identificar no elegibles cuando exista el caso. |
| Actividad | Total de actividades y eventos de seguimiento registrados realmente para la campaña, identificando la definición de conteo; evitar mezclar envíos no realizados. |
| Nuevos y reutilizados | Clasificación **al incorporarse a esa campaña**, basada en procedencia confiable. Un maestro previamente existente vinculado a una campaña es reutilizado. Históricos no determinables deben aparecer como `desconocido/legado`, no adivinarse. |

**Comportamiento:**

- Dashboard propio de campaña, **distinto** del dashboard global del tenant.
- Métricas obtenidas de backend con scope tenant/campaign; consistentemente calculadas ante filtros si se decide exponer filtros en el dashboard, dejando explícito si los valores están filtrados o son totales.
- Estado vacío `0` real sin dividir por cero; no mostrar tasa de conversión ficticia.
- No incluir impresiones, clics, aperturas, leads generados por publicidad, ingresos, ROI, scoring, predicciones o embudos monetarios sin eventos externos definidos.
- No requerir WebSockets ni actualizaciones en tiempo real; refresco/relectura es suficiente.

**Criterios:**

- **AC-C8-01:** dos campañas del mismo tenant muestran totales separados correctamente para un maestro compartido.
- **AC-C8-02:** sumas de distribuciones de etapa y evaluación coinciden con total de participaciones.
- **AC-C8-03:** nuevas/reutilizadas/desconocidas suman total cuando las tres categorías se muestran como partición exhaustiva.
- **AC-C8-04:** dashboard vacío y sin actividades responde valores coherentes, sin NaN ni consultas a Service.
- **AC-C8-05:** count y permisos resueltos en backend, no mediante agregación de la página Flutter.

---

## 5. Especificación funcional: Prospectos

### P1 — Detección de registros existentes y reutilización

**Objetivo:** impedir nuevas duplicaciones evitables en el tenant sin fusionar automáticamente maestros históricos.

**Comportamiento requerido:**

- Política §3 utilizada por **alta manual y CSV**, preferiblemente mediante lógica de dominio compartida sin dependencia de Prospector Service.
- Distinguir identidad fuerte única, candidatos débiles, múltiples candidatos, ausencia de candidato y cambios concurrentes; explicación comprensible para usuario.
- Cuando se reuse maestro, conservar `Prospect.id`, `tenantId`, `campaignId` de origen, `source`, `sourceIdentifier`, datos y estado maestro salvo UPDATE_EXISTING explícito.
- Resolver destino de campaña en tenant y asociación transaccional. Evitar duplicados por confirmaciones simultáneas; revalidar candidato seleccionado en el commit.
- No usar la evaluación comercial de otra campaña para decidir identidad ni descartarlo automáticamente.

**Criterios:**

- **AC-P1-01:** dos campañas del mismo tenant + misma identidad fuerte única => un maestro, dos participaciones independientes.
- **AC-P1-02:** nombre coincidente sin identificador confiable => candidatos/decisión, no identidad automática.
- **AC-P1-03:** varios candidatos existentes => decisión explícita o conflicto; nunca `first()` arbitrario.
- **AC-P1-04:** crear distinto ante candidatos requiere confirmación consciente y se registra decisión pertinente; datos de otros maestros intactos.
- **AC-P1-05:** concurrencia fuerte no duplica asociaciones/maestros nuevos para la misma identidad confiable; ningún resultado cruza tenants.
- **AC-P1-06:** creación manual deja de eludir P1 sin romper contratos vigentes de forma silenciosa.

### P2 — Vista de campañas asociadas y resumen contextual

**Objetivo:** desde un prospecto maestro, consultar las campañas en las que participa dentro del mismo tenant.

**Comportamiento requerido:**

- Mostrar campaña de origen y cada asociación vigente una sola vez, con nombre/id/estado de campaña y, cuando permitido, etapa, evaluación, responsable, incorporación y actividad contextual reciente.
- Reutilizar la misma autoridad de roles y tenant en todas las lecturas; `ADMIN` debe seleccionar tenant para operaciones tenant-scoped.
- Historial/estado de otra campaña es **solo antecedente autorizado**; navegar o leer no modifica su evaluación.
- Consultas paginadas si volumen lo requiere; no convertir origen en una asociación distinta contada dos veces.

**Criterios:**

- **AC-P2-01:** ficha maestra muestra A y B sin duplicados y distingue `origen`.
- **AC-P2-02:** resumen de A no se sobrescribe al cambiar evaluación/etapa de B.
- **AC-P2-03:** respuesta niega u oculta de forma segura cualquier campaña fuera del tenant.
- **AC-P2-04:** listado respeta derechos existentes sin introducir permisos nuevos por campaña.

### P3 — Procedencia global y nuevas apariciones confirmadas

**Objetivo:** conocer cómo y dónde se incorporó el prospecto a la plataforma y qué operaciones posteriores explican su reutilización.

**Comportamiento requerido:**

- Registrar eventos globales verificables de **creación, vinculación/reaparición confirmada y actualización maestra**, con origen `manual|csv|...` según disponibilidad real, fecha de servidor y referencia a campaña origen/destino cuando proceda.
- Evitar sobrescribir `source`, `sourceIdentifier`, `campaignId` de origen y `createdAt` originales al reutilizar.
- Mantener **separado** el historial global de procedencia respecto al comercial C3. Un cambio de etapa de B no aparece como cambio de datos maestros de A.
- No persistir preview, SKIP, rechazo, búsqueda sin confirmación o eventos de scraping sin integración real. No fabricar evidencia retrospectiva sobre datos históricos.
- Mostrar información legada desconocida como desconocida. Conservar actor lógico/usuario cuando la información esté disponible sin depender de cuentas ya activas para leer datos históricos.

**Criterios:**

- **AC-P3-01:** crear en A y vincular en B conserva origen A y agrega aparición confirmada B.
- **AC-P3-02:** preview/omitir/revertir no alteran procedencia durable.
- **AC-P3-03:** actualizar maestro desde B produce trazabilidad global y no altera eventos comerciales de A.
- **AC-P3-04:** los históricos muestran solo fechas/orígenes respaldados en BD.
- **AC-P3-05:** permisos y tenant protegen lectura y escritura de eventos.

### P4 — Evolución de validación/importación CSV V1

**Objetivo:** preservar el flujo seguro existente y hacerlo compatible con la nueva identificación y trazabilidad.

**Baseline preservado salvo extensión justificada y testada:**

- `POST /api/v1/prospects/import/preview` y `/confirm`, ambos ADMIN/OWNER y tenant seleccionado.
- Multipart, CSV UTF-8, encabezados conocidos, validaciones y diferencias de campo; no admitir XLSX por el simple nombre de archivo.
- Límite de **5 MB**, **1000 registros**, **2000 caracteres por celda** y máximo de **5 MB de payload de preview**, según documentación V1.
- Preview **sin escritura**, referencia firmada válida **15 minutos**, mismo archivo en confirm, confirmación explícita por fila; `409` cuando hay cambio relevante desde preview.
- Persistencia en transacción serializable, reintentos controlados ante conflictos serializables, reversión ante fallo inesperado y protección tenant.
- Mantener semántica de `CREATE`, `LINK_EXISTING`, `UPDATE_EXISTING`, `SKIP` y resultados por fila, ampliando su descripción/selección si B2 necesita identificador de candidato explícito.
- Mantener distinción entre **campo ausente** (conservar valor al actualizar) y **campo presente vacío** (limpiar nullable); `UPDATE_EXISTING` debe advertir que actualiza datos compartidos.
- Mantener datos de teléfono como texto, incluidos ceros iniciales, y reporte de inválidos/concurrencia.

**Extensiones requeridas:**

- Candidatos y colisiones según §3; casos ambiguos múltiples resolubles cuando sean seguros, con validación de candidato elegido por el servidor.
- Resultado claro: creado nuevo, reutilizado/vinculado, maestro actualizado, omitido, inválido/conflicto; diferenciar reintento/relación ya existente de relación nueva cuando sea posible.
- Procedencia **solo para operaciones confirmadas** y sin falsos cambios en la bitácora.
- Si se ajusta el contrato para soportar selección de candidato o identidad fuerte, conservar compatibilidad de consumidores anteriores o documentar formalmente la transición aprobada y la prueba Flutter correspondiente.
- No introducir historial durable **general de archivos importados** ni idempotencia durable global por iniciativa propia; solo la persistencia mínima necesaria para P3 y la seguridad de una confirmación. Cualquier incremento sustantivo deberá justificarse y escalarse si equivale a una capacidad nueva.

**Criterios:**

- **AC-P4-01:** preview no cambia tablas; confirma solo con referencia/archivo/contexto válidos.
- **AC-P4-02:** columnas/límites, errores y atomicidad V1 siguen funcionando.
- **AC-P4-03:** LINK_EXISTING preserva maestro; UPDATE_EXISTING explícito informa efecto global y registra cambio.
- **AC-P4-04:** candidatos múltiples no se vinculan silenciosamente; elección explícita se revalida en backend.
- **AC-P4-05:** casos de repetición/concurrencia no duplican asociación ni crean dos maestros para identidad fuerte nueva.
- **AC-P4-06:** permisos MEMBER 403 para importación; tenant ajeno 404/denegación coherente sin filtración.
- **AC-P4-07:** resultado por fila permite a André representar creado/reutilizado/omitido/rechazado de forma fiel.

---

## 6. Contratos API: capacidades mínimas y compatibilidad

**Nota:** los siguientes son **recursos/capacidades contractuales**; no es un diseño obligatorio de nombres de rutas, DTOs ni clases. Ángel escogerá rutas REST, métodos, nombres y representación consistentes con `api/v1`, el OpenAPI y los controladores existentes; documentará el contrato exacto implementado **antes de entregar el handoff**. No inventar endpoints como ya disponibles hasta que existan tests.

### 6.1. Capacidades de lectura/escritura necesarias

| Recurso o capacidad | Operaciones obligatorias | Consumidor |
|---|---|---|
| Participaciones de una campaña | Listar con paginación y filtros + campos contextuales; consultar contexto de participación | Campañas / detalle prospecto |
| Pipeline | Leer etapa y actualizarla con validación/historial | Campañas |
| Evaluación | Leer evaluación, cambiarla con motivo según estado y consultar cambios | Campañas |
| Actividades | Listar historial con paginación; crear actividad manual; registrar correcciones append-only | Campañas |
| Responsable | Leer, asignar/reasignar/desasignar y disponer de selector de elegibles bajo autorización existente | Campañas |
| Dashboard por campaña | Lectura de agregados definida en C8 | Campañas |
| Detección para alta manual | Consultar candidatos/condición y confirmar create/link/skip, revalidando | Prospectos / Campañas |
| Campañas de un prospecto | Lista y resumen contextual tenant-scoped | Prospectos |
| Procedencia global | Lectura ordenada/paginada y escritura interna transaccional por operaciones confirmadas | Prospectos |
| Importación CSV | Evolucionar preview/confirm existentes y resultados por fila | Prospectos / Campañas |

### 6.2. Compatibilidad HTTP obligatoria

- Mantener **ruta base `/api/v1`**, JWT Bearer, tenant seleccionado, wrappers del backend, codificación JSON/multipart, convenciones de errores y validaciones existentes.
- El backend es fuente de verdad de permisos, identidad, evaluación y operaciones. Flutter no duplica deduplicación definitiva ni inventa datos.
- `GET /api/v1/campaigns/{id}/prospects` ya entrega representación de `Prospect` maestro; **no** sustituir su `status` por etapa comercial ni cambiar silenciosamente el tipo esperado. Preferir campos aditivos/contexto claramente nombrado o endpoint adicional; registrar decisión.
- `GET /api/v1/prospects/{id}` y alta/edición actual conservan semántica de origen, datos maestros y permisos, salvo ajuste de alta **expresamente requerido por P1** y compatible/documentado.
- En CSV, mantener operaciones públicas existentes; si se requieren nuevas clasificaciones/decisiones/IDs, versionar/describir en OpenAPI y actualizar SDK Flutter desde contrato comprobado.
- Todos los listados usan paginación, filtros y orden explícitos, resultados deterministas, error normalizado. No permitir scopes tenant controlados desde body/query del cliente.
- Un cambio de comportamiento que un cliente viejo no pueda manejar se marca **`CONTRACT_DRIFT / BREAKING_CHANGE`** y requiere presentación de mitigación al owner **antes** de publicar.
- Actualizar OpenAPI objetivo y Swagger observable para que describan realidad; incluir muestras de request, response, validación, roles, códigos y tipos. No declarar endpoints como disponibles si están en stub/503.

### 6.3. Matriz de permisos mínima (herencia, no nuevo modelo RBAC)

| Acción | ADMIN con tenant seleccionado | OWNER | MEMBER |
|---|---:|---:|---:|
| Leer campañas, participantes, actividad, indicadores, antecedentes permitidos | Sí | Sí | Sí |
| Cambiar etapa/evaluación, registrar actividad, asignar responsable | Sí | Sí | Sí |
| Crear campaña y actualizarla bajo permisos actuales | Según controlador actual | Según controlador actual | Según controlador actual |
| Alta manual de prospectos | Sí | Sí | **No** (403 actual) |
| Preview/confirm CSV | Sí | Sí | **No** (403 actual) |
| PATCH maestro de prospecto | Según permiso actual | Según permiso actual | Según permiso actual |
| Borrar físicamente campaña | Solo ADMIN, según regla actual | No | No |
| Administrar usuarios, roles o tenant | **Sin cambios** | **Sin cambios** | **Sin cambios** |

No inferir que un `ADMIN` global puede omitir la selección de tenant en un recurso tenant-scoped. Si un método nuevo comparte controller `@Roles` hay que verificar el permiso resultante; pruebas reales, no solo UI.

### 6.4. Errores y resolución segura

| Caso | Semántica requerida |
|---|---|
| Falta de autenticación | 401 existente. |
| Rol no autorizado | 403 existente; no revelar datos de otro tenant. |
| Campaña/prospecto ajeno o inexistente | 404 o respuesta de ocultación vigente según contrato; evitar existencia lateral. |
| DTO inválido, motivo ausente, selección imposible | Error de validación 400 compatible con la convención existente. |
| Cambio de datos/colisión de identidad desde preview, doble confirm incompatible | 409 con indicación accionable de reconsultar/reprevisualizar. |
| Archivo inválido/supera límites | Error vigente de parser/413/400 según caso documentado; preservarlo. |
| Error inesperado transaccional | Rollback; no devolver éxito parcial ficticio. |

Las rutas definitivas y códigos de nuevos casos no especificados deben quedar probados y publicados en OpenAPI; **no** asignar códigos arbitrarios fuera del esquema común.

---

## 7. Persistencia, migraciones, datos históricos y concurrencia

### 7.1. Modelo lógico esperado, NO esquema prescriptivo

```text
Tenant
  ├── Campaign (tenantId)
  │     └── CampaignParticipation [CampaignProspect existente, ampliada]
  │           ├── Prospect (tenantId; campaignId de origen inmutable)
  │           ├── commercialStage
  │           ├── evaluation + evaluationReason (según transición)
  │           ├── responsibleUserId? (elegible por membresía)
  │           └── CampaignActivity/Event [histórico contextual]
  └── Prospect
        └── ProspectProvenance/Appearance [histórico global confirmado]
```

No son nombres de tablas obligatorios. Ángel puede usar entidades separadas o una representación equivalente si satisface consultas, garantías, auditoría e integridad. Se recomienda separar un **estado actual** consultable de su **historial de eventos**, sin imponer event sourcing ni outbox.

### 7.2. Requisitos de migración

1. Antes de escribir: inventariar schema y migraciones **del HEAD autorizado**, relaciones y volúmenes representativos de datos, constraints, índices, FKs y dependencias del importador.
2. Diseñar **migraciones aditivas y repetibles**; **no editar la migración `init` ni migraciones históricas**. Datos históricos existentes deben seguir consultables tras migrar.
3. Inicializar participaciones históricas con defaults C1/C2/C4 **sin fabricar interacciones ni cambios históricos**. Si falta una relación de origen pero el registro maestro tiene `campaignId`, restaurar/coherenciar participación mediante una operación explícita, deduplicada y verificada; nunca crear relaciones entre tenants.
4. Conservar el campo de estado histórico de `CampaignProspect` hasta justificar su semántica y consumidores; no mapear `ACTIVO` automáticamente a `Contactado` ni eliminarlo por conveniencia.
5. Preservar `Prospect.id`, tenant, campaña de origen, datos maestros, source/sourceIdentifier originales. Cualquier consolidación de duplicados legados queda diferida.
6. Garantizar unicidad **de nuevos ingresos con identidad fuerte** incluso en concurrencia. La técnica (restricción SQL compatible, llave derivada, transacción, locking o equivalentes) corresponde a Ángel, quien debe demostrar con tests que no rompe registros históricos que ya pudieran colisionar.
7. Garantizar pertenencia común de Campaign/Prospect/Responsible al mismo tenant al persistir; no asumir que FK aisladas bastan.
8. Diseñar un plan forward-fix/rollback **seguro**: no prometer rollback destructivo de una migración con datos nuevos. Documentar preflight, copia de seguridad, ventana compatible y validaciones postmigración.
9. Probar sobre PostgreSQL real desechable con dataset de datos previos (múltiples campañas, duplicados históricos, origen sin asociación explícita, roles inactivos, CSV existente). No usar ni alterar datos productivos para probar.
10. Si la modificación de la identidad requiere cambiar un unique existente o contrato de CSV, documentar el `before/after`, efecto sobre datos legados, riesgos y criterios de aprobación. No imponer un unique tenant-wide ciego si ya hay duplicados históricos.

### 7.3. Consistencia de operaciones

- Crear/vincular/actualizar y registrar procedencia/evento contextual necesario es una **unidad lógica de commit**: no confirmar asociación sin el estado/contexto correspondiente ni dejar evento de éxito si el commit falló.
- La política de matching del preview **se revalida** al confirmar. Concurrencia debe conservar invariantes INV-01 a INV-12.
- No se requiere un servicio de colas, cache o coordinación distribuida nuevo. Si Ángel detecta necesidad, documenta alternativas y escala la alteración de arquitectura.
- El `createdAt/addedAt` registrado en servidor sirve para auditoría y métricas; no confiar en fechas arbitrarias del cliente como fuente histórica.

### 7.4. Riesgos técnicos reconocidos

| Riesgo | Mitigación mínima |
|---|---|
| Legacy unique por campaña admite duplicados reales | Política tenant-wide en la capa de dominio; diagnóstico; migración prudente; protección de altas futuras. |
| `sourceIdentifier=null` permite coincidencias indeterminadas | Clasificar como candidato débil y requerir intervención; no sustituir por hash débil como prueba fuerte. |
| JOIN actividades multiplica filas | Contar `DISTINCT` participaciones o agregados correctamente; tests de conteos. |
| Actualización de maestro compartido modifica todas las vistas | Confirmación informada y bitácora global, preservando contexto de campaña. |
| Inactivación de responsable | Mantener rastro histórico, indicar no elegible y permitir reasignación manual. |
| Cambio de contrato rompe Flutter | Compatibilidad, matrices y pruebas de consumidor; André integra desde contrato real. |
| Duplicados históricos se confunden con identidad fuerte | Nunca consolidar automáticamente; revisión manual y clasificación de ambigüedad. |
| Trabajo paralelo con PR anteriores | Gate de branch exacto, no escrituras hasta GO de referencia owner. |

---

## 8. Requisitos no funcionales, seguridad y operación

- **Seguridad:** todo endpoint exige autenticación salvo excepciones ya existentes, ninguna nueva ruta `@Public()`; roles declarativos existentes y validación tenant en cada query/transaction. No alteraciones del flujo de JWT, cookies, CORS, proxies o middleware de autorización.
- **Privacidad:** no registrar archivos CSV, emails completos, teléfonos, tokens, notas comerciales ni resultados sensibles en logs/CI; evidencias exclusivamente con datos sintéticos o enmascarados. Observabilidad con `requestId`, evento técnico y resultado no sensible.
- **Contrato:** seguir `{ success: true, data, meta? }` / error global y `ValidationPipe` con whitelist, tipado DTO consistente; errores sin filtración lateral.
- **Rendimiento:** búsquedas paginadas y con índices justificados; no ejecutar full scan histórico de todos los prospectos para cada fila en carga grande si la solución no escala. Medir contra dataset sintético cercano a los límites **actuales** CSV, y registrar medición sin inventar SLA.
- **Disponibilidad independiente:** tests con Prospector Service ausente, URL no definida y Jobs en su estado permitido verifican que Campañas/Prospectos siguen trabajando.
- **Integridad:** transacciones, FKs y constraints que no rompan legacy; estabilidad de datos frente a repetición y fallos parciales. No afirmar exactly-once más allá de lo que se demuestre.
- **UI y accesibilidad (handoff):** Flutter debe mostrar estado vacío/carga/error/éxito, confirmaciones para impacto global, errores de conflicto explicables y representación clara de etapa vs aptitud; preservar navegación/sesión/tenant existente.
- **Calidad:** pruebas automatizadas ejecutadas sobre el SHA final. Un resultado de CI de PR #10/#11 es evidencia histórica de baseline, **no** prueba de este sprint.

---

## 9. Matriz de pruebas exigida y fixtures

### 9.1. Dataset mínimo sintético

- **Tenant A** con Campañas A1/A2, OWNER-A, MEMBER-A1, MEMBER-A2 y un usuario inactivo/sin membresía; un prospecto maestro `P-A` originado A1, otra entidad homónima `P-A2` y datos legacy potencialmente duplicados.
- **Tenant B** con Campaña B1 y prospecto distinto con mismo nombre/teléfono que A; el aislamiento debe ser completo.
- CSV con nuevos, coincidencia débil única, múltiples candidatos, identidad fuerte válida, inválidos, encabezados/formato límite, repetidos internos y actualización compartida.
- Actividades manuales y eventos de dos campañas para el mismo maestro; responsable que pierde elegibilidad; combinación de filtros y dashboard con actividad y datos legados.

### 9.2. Pruebas funcionales y de seguridad

| ID test | Escenario | Cobertura |
|---|---|---|
| T01 | Alta manual nuevo sin candidato → maestro + participación inicial | P1, C1, C2, C4 |
| T02 | Crear/vincular mismo maestro en A1/A2 → un ID, dos contextos | P1, P2, C1–C4 |
| T03 | Nombre igual sin fuerte → candidato, no autoreutilización | P1 |
| T04 | Varias coincidencias → selección explícita o rechazo seguro; sin primero arbitrario | P1, P4 |
| T05 | Crear distinto entre candidatos → decisión expresa, datos anteriores intactos | P1 |
| T06 | Identidad fuerte duplicada en dos tenants → independencia total | P1, seguridad |
| T07 | Identidad fuerte repetida concurrentemente en mismo tenant → no dos maestros nuevos | P1, DB |
| T08 | LINK_EXISTING a relación ya presente → no reiniciar contexto, sin doble asociación | P1, C1–C4, P4 |
| T09 | Cambiar etapa en A1 mientras A2 conserva anterior | C1 |
| T10 | Reabrir Cerrado y registrar transición exacta | C1, C3 |
| T11 | No apto sin justificación rechazado; posterior Apto conserva historia | C2, C3 |
| T12 | Nota de llamada/meeting registrada solo como declaración manual en A1 | C3 |
| T13 | Corregir nota preserva original; timestamps/autores del servidor | C3 |
| T14 | Asignar usuario elegible y desasignar; evento histórico | C4 |
| T15 | Usuario ajeno, inactivo o sin membresía no elegible | C4, seguridad |
| T16 | Usuario deja de ser elegible: historial preservado, estado pendiente de reasignación | C4 |
| T17 | Filtros AND/OR, null, paginación y orden estable sobre >1 página | C6 |
| T18 | JOIN con varias actividades no duplica participaciones | C6, C8 |
| T19 | Dashboard por campaña, total y sumas de etapas/evaluaciones exactos | C8 |
| T20 | Dashboard vacío / solo datos legados / responsables sin asignar | C8 |
| T21 | P2 lista origen y asociaciones una vez, sin fuga tenant | P2 |
| T22 | Procedencia nueva A1 + aparición A2, fechas reales | P3 |
| T23 | Preview, SKIP, error de commit: cero procedencia durable | P3, P4 |
| T24 | UPDATE_EXISTING consciente cambia maestro y registra procedencia, no pipeline de otra campaña | P3, P4 |
| T25 | CSV V1 5MB/1000 filas/15 min, parser, referencial y replay 409 preservados | P4, regresión |
| T26 | MEMBER importación denegada; ADMIN/OWNER admitidos con tenant válido | P4, seguridad |
| T27 | Fallo a mitad de confirm/transacción revierte lote, relaciones y eventos | P4, DB |
| T28 | Migrar dataset legacy no pierde registros ni fabrica historial; origen consistente | Migración, P2/P3 |
| T29 | Contratos viejos de consulta/edición y UI existente siguen operando | Compatibilidad |
| T30 | Prospector ausente: manual/CSV/Campañas/Prospectos/dashboard funcionales | Aislamiento de módulos |
| T31 | Permisos 401/403/404 y ataques con ID cruzado en todos los endpoints nuevos | Seguridad transversal |
| T32 | Flutter real contra backend candidato: alta, CSV, seguimiento, filtros y dashboard sin mocks ocultos | Handoff integral |

Las pruebas críticas (identidad/concurrencia, integridad de datos, aislamiento, migración y CSV) **deben ejecutarse en PostgreSQL real de prueba**, no declararse cubiertas solo con doubles de Prisma. Las demás tendrán la combinación más adecuada de unitarias, HTTP/E2E y UI conforme a los repositorios.

### 9.3. Criterio de evidencia de prueba

Cada evidencia registra: objetivo, SHA exacto, configuración/flags no sensibles, comando ejecutado, fecha, dataset sintético, resultado observado, link/ruta del log y limitaciones. Una prueba `NOT RUN` no cuenta como `PASS`; no prometer que el frontend está integrado a partir de tests de backend únicamente.

---

## 10. Estrategia de ejecución, dependencias y gates

### 10.1. Dependencias entre funcionalidades

```text
G0: Owner cierra/revisa PR anteriores y fija base
     ↓
P1 identidad/reutilización ── P4 evolución CSV
     │                          │
     ├── P3 procedencia ────────┤
     │                          │
     └── participación contextual estable
           ├── C1 etapa comercial
           ├── C2 evaluación manual
           ├── C4 responsable
           └── C3 actividades/eventos
                    ↓
               C6 filtros
                    ↓
               C8 dashboard
                    ↓
                 P2 vista intercampañas (también puede desarrollarse en paralelo)
                    ↓
               Contrato real + QA + handoff André
```

El orden es **orientativo**, no obligación de commits ni dependencias de clases. Ángel puede trabajar en paralelo con subagentes cuando la integración no rompa invariantes.

### 10.2. Gates obligatorios

| Gate | Responsable del GO | Evidencia / criterio de salida |
|---|---|---|
| **G0 — Cierre anterior y base** | **Owner** | PR #10/#11 revisados por owner; cierre/merge según decisión exclusiva. Referencia exacta autorizada, `HEAD`, remoto y `git status` limpios o cambios identificados. Si PR en revisión, autorización explícita sobre SHA para comenzar sin modificar PR. |
| **G1 — Reconciliación fuente de verdad** | Ángel (revisión owner ante conflicto) | Inventario del schema, API, documentación, tests y diffs al nuevo SHA; matriz de contradicciones y ADR de dominio, sin tocar sectores protegidos. |
| **G2 — Diseño local acotado** | Ángel bajo reglas aprobadas | Propuesta de persistencia, contratos y migraciones, análisis de riesgos, prueba de compatibilidad planificada. Decisiones nuevas fuera de alcance se escalan antes de escribir el cambio afectado. |
| **G3 — Construcción backend** | Ángel | Implementación de C1/C2/C3/C4/C6/C8/P1/P2/P3/P4 en rama aislada, commits coherentes y tests incrementales. |
| **G4 — QA, integridad y contratos** | Ángel, con aceptación posterior owner | Unitarias, E2E HTTP y PG real de prueba, concurrencia, no regresión, Swagger/OpenAPI coherentes, migración ensayada, evidencia por SHA; Service no requerido. |
| **G5 — Handoff frontend** | Ángel | Contratos reales, ejemplos y matriz de UI/errores; arnés específico de André preparado **a partir del backend final**. Contrato temprano puede ser provisional, claramente etiquetado. |
| **G6 — Revisión backend** | **Owner** | PR backend para revisión, decisión de aceptación, correcciones, merge o rechazo **exclusivamente** del owner. No despliegue sin aprobación separada. |
| **G7 — Integración Flutter** | André, con revisión owner | Frontend sobre referencia autorizada; consume contrato real, tests de estados/tenant/UI, E2E candidato contra backend accesible, evidencia y PR sin auto-merge. |
| **G8 — Liberación y despliegue** | **Owner** | Separada del sprint de desarrollo: seguridad, migración productiva, despliegue, rollback, aceptación y GO explícitos. **No autorizada por este SPEC.** |

**Regla de paralelismo:** André puede elaborar pantallas con mocks explícitos desde un contrato preliminar, pero no declarar paridad ni integrar valores inventados. Una vez entregado el contrato real, debe reconciliar su UI y pruebas.

### 10.3. Condiciones para pausar una operación concreta

- Base Git no coincide con el SHA autorizado, worktree sucio/desconocido, cambios no rastreados relevantes o PR anterior modificado por alguien más.
- Contrato/documentación vigente contradice el owner fuera del ámbito de identidad compartida aprobado aquí.
- Se exige modificar Auth/RBAC/TenantContext/Users/Tenants/Prospector o infraestructura para poder continuar.
- No hay forma segura de migrar sin perder datos, ni forma de preservar convivencia/contratos antiguos.
- Se propone costo/servicio externo, acceso productivo o cambios en despliegue.

El ejecutor informa **hallazgo + evidencia + opciones + impacto + decisión necesaria** y continúa únicamente bloques independientes. No se detiene todo el sprint por un problema local si se puede aislar sin riesgo.

---

## 11. Entrega de backend y especificación del handoff para André

### 11.1. Paquete lógico que debe producir Ángel

Los siguientes son **tipos de evidencia requeridos**, no una estructura de archivos obligatoria hasta diseñar el arnés:

1. **Inventario inicial** de rama, SHAs, estado Git, módulos y contratos; discrepancias con esta auditoría.
2. **Registro de decisiones técnicas** con alternativas, justificación, límites de autorización y cualquier escalamiento al owner.
3. **Mapa de cambios** por funcionalidad C/P, migraciones, cambios API, tests y archivos afectados.
4. **Migraciones + preflight** contra PostgreSQL sintético/histórico y procedimiento de recuperación no destructivo.
5. **OpenAPI/Swagger real** y matriz de contratos antes/después; tablas de operación, roles, request, response, errores, paginación y ejemplos.
6. **Pruebas y resultados por SHA**: logs resumidos, números verificables, fallos conocidos, riesgos residuales, comandos reproducibles.
7. **Evidencia de aislamiento** de datos entre tenants y no dependencia del Prospector Service.
8. **Datos/fixtures sintéticos** mínimos reproducibles, sin credenciales ni datos comerciales reales.
9. **Handoff de backend**, módulos listos, decisiones no resueltas y límites del frontend.
10. **Arnés dirigido a André**, creado al terminar backend: objetivos visuales y de integración, contratos definitivos, pantallas existentes a extender, mocks solo si explícitos, pruebas esperadas y gate de entrega. El arnés de André **no autoriza** cambios en carpetas protegidas del cliente.

### 11.2. Reglas específicas para frontend

- Consumo exclusivo de NestJS Platform API; ninguna llamada Flutter directa al Service/Engine o PostgreSQL.
- Mantener flujo **UI → Riverpod/providers → repositorios de feature → `lib/platform_api` tipada → `ApiClient` existente**.
- Reutilizar pantallas, rutas y providers existentes. El detalle de campaña tiene tabs Detalle/Prospectos y debe extenderse sin navegación paralela innecesaria.
- La creación/edición/importación de prospectos existe; adaptar su UX a las decisiones de P1/P4, especialmente coincidencias múltiples, edición compartida y conflictos.
- C8 debe ser **dashboard de campaña**, no reemplazar el dashboard global del tenant.
- `lib/routes`, `lib/core/network`, `lib/features/auth`, `lib/app` y demás carpetas protegidas por `FEATURE-DEVELOPMENT.md` **no** pueden modificarse unilateralmente. Si una ruta nueva resulta indispensable, André solicita autorización precisa al owner y aporta alternativa sin cambio global.
- UI de actividad permite registrar **hechos declarados**, sin simular envío real de comunicaciones; carga, error, vacío y estado inactivo visibles.
- Handoff define estados de error y recuperación ante 409 de identidad/preview y usuario no elegible; no se aceptan mocks etiquetados como backend operativo.

### 11.3. Separación de agentes

- Ángel puede coordinar subagentes de diagnóstico, persistencia, API, QA y documentación, con instrucciones de no sobrepasar alcance y de reportar hallazgos. El integrador backend responde por coherencia final y SHA.
- André trabaja con un agente único o configuración propia; su arnés se define desde el backend terminado, no desde suposiciones.
- Ningún agente obtiene autoridad directa para cerrar PR previos, aprobar reglas nuevas, ejecutar migraciones productivas, fusionar o desplegar.

---

## 12. Registro de decisiones OWNER A1–E5, ratificadas íntegramente

**Acto de autorización:** el owner expresó que **aprueba íntegramente todas las recomendaciones predeterminadas A1–A5, B1–B7, C1–C7, D1–D4 y E1–E5**, sin excepciones. Esta tabla preserva **28 decisiones** autónomamente; no requiere recuperar el chat para comprenderlas.

| ID | Decisión vigente ratificada | Implementación en SPEC |
|---|---|---|
| A1 | Prospecto maestro reutilizable por tenant sustituye simplificación histórica por campaña de ADR-001. | §1.4, §2, §3 |
| A2 | Ángel puede ampliar Prisma, migraciones, Campañas/Prospectos, OpenAPI y decisiones derivadas del sprint; no Auth/RBAC/TenantContext/Prospector. | §1.5, §7 |
| A3 | Autonomía en diseño local, escalamiento ante regla/arquitectura protegida. | §1.5, §10 |
| A4 | PR #10/#11 actuales como referencias; owner los cierra; nueva rama desde base exacta autorizada. | §1.1, §10 |
| A5 | Commits/push/PR ordinarios en nueva rama autorizada; merge/deploy exclusivos owner. | §1.5, §10 |
| B1 | Reutilización inequívoca por fuente confiable + identificador válido; débiles se revisan. | §3.1 |
| B2 | Ante ambigüedad: vincular candidato explícito, crear distinto confirmado u omitir. | §3.2 |
| B3 | P1 aplica a creación manual y CSV; Servicio externo intacto. | §3.3 |
| B4 | UPDATE_EXISTING explícito, comparación y advertencia; LINK no edita maestro. | §3.4 |
| B5 | Duplicados históricos: no fusiones automáticas; migración conservadora. | §3.5, §7 |
| B6 | Asociación existente no se duplica ni reinicia contexto. | §3.2 |
| B7 | Procedencia durable únicamente por operaciones confirmadas; previews/omisiones sin historial. | §3.5 |
| C1 | Seis etapas con los significados propuestos; `Cerrado` no equivale a venta/No apto. | §2.3, §4.C1 |
| C2 | Transiciones libres, default Sin gestionar, reapertura y bitácora; sin comunicaciones automáticas. | §4.C1 |
| C3 | Evaluación Sin evaluar/Apto/No apto; motivo obligatorio para No apto; historial. | §4.C2 |
| C4 | Actividades manuales y eventos automáticos separados. | §4.C3 |
| C5 | Bitácora inmutable con correcciones por nueva entrada. | §4.C3 |
| C6 | Asignación con permisos actuales de campaña, miembro activo del tenant y preservación histórica. | §4.C4 |
| C7 | Visibilidad entre campañas dentro del mismo tenant según roles existentes; sin permisos granulares nuevos. | §5.P2, §6 |
| D1 | Filtros server-side disponibles; sin vistas guardadas persistentes. | §4.C6 |
| D2 | Dashboard: total, etapas, aptitud, responsables, actividades, nuevos/reutilizados. | §4.C8 |
| D3 | Snapshot real acumulado; sin métricas externas ni predicciones. | §4.C8 |
| D4 | Mantener estados y ciclo de vida actuales de Campaign; no rediseñar. | §2, §4 |
| E1 | Migraciones aditivas, conservadoras y pruebas PG real de prueba. | §7 |
| E2 | Preservar preview/confirm CSV, validación, atomicidad, concurrencia y límites V1. | §5.P4 |
| E3 | Unitarias, HTTP/E2E, PG real, aislamiento, regresión, concurrencia. | §9 |
| E4 | Ángel entrega contrato real y genera arnés específico para André tras backend; preliminares marcados como provisionales. | §11 |
| E5 | Subagentes permitidos para Ángel, evidencia trazable, libertad técnica acotada y no despliegue autónomo. | §1.5, §11 |

Ninguna decisión de esta tabla autoriza reescribir unilateralmente decisiones de Auth/JWT/seguridad transversal, ni modificar PR anteriores. Si el owner emite una corrección posterior, debe conservarse su fecha, texto y alcance, y reconciliar el documento explícitamente.

---

## 13. Definición de terminado (DoD) y aceptación

Una funcionalidad se considera **implementada** solo si:

- Se satisfacen todos sus AC y invariantes; existe código real en el SHA documentado.
- La ruta/contrato de API se documenta, está disponible en Swagger y posee autorización/tenant correctos.
- Se ejecutaron pruebas adecuadas (incluida DB real donde corresponde), con resultados reproducibles; cero regresiones críticas no aceptadas.
- Se migraron o inicializaron registros históricos sin mentir sobre su procedencia.
- La funcionalidad se puede consumir desde Flutter mediante contrato tipado; si el frontend aún no está implementado, se identifica como **backend listo / frontend pendiente**, no se declara E2E completado.
- Evidencias y decisiones quedan en el arnés; los límites/conocidos quedan abiertos con owner informado.

**El sprint backend se entrega a revisión owner** cuando C1/C2/C3/C4/C6/C8/P1/P2/P3/P4 pasan sus AC backend, pruebas G4, documentación y handoff G5. **No** se considera desplegado ni fusionado hasta aprobación separada del owner. El cierre de frontend requiere sus propias pruebas y revisión de PR.

### 13.1. Requisitos de aceptación global

| ID | Gate de aceptación transversal |
|---|---|
| GA-01 | Un maestro tenant-wide reutilizado por identidad confiable en dos campañas sin duplicación ni contaminación de seguimiento. |
| GA-02 | Identidad ambigua resuelta manualmente, sin asociación arbitraria ni fuga de otros tenants. |
| GA-03 | No apto exige motivo, evaluación e historial inmutables por campaña. |
| GA-04 | Alta manual, CSV y lectura de prospectos existentes conservan permisos y compatibilidad intencional. |
| GA-05 | Filtros y métricas de campaña reales, server-side, sin contar prospectos duplicados. |
| GA-06 | Migración probada contra BD legacy sintética, conservando orígenes, relaciones y datos. |
| GA-07 | Auth, RBAC, TenantContext, Jobs/Prospector, onboarding y dashboard global no presentan regresiones. |
| GA-08 | Contratos objetivo, Swagger ejecutado, SDK/handoff y pruebas corresponden a HEAD exacto. |
| GA-09 | No merge, despliegue o migración de datos reales sin GO owner separado. |

### 13.2. Entregables documentales previos al arnés

El presente archivo es el **SPEC consolidado ratificado**. El arnés posterior deberá incorporar este SPEC **sin reinterpretarlo**, el registro de fuentes y documentos de referencia, checklist de gates, instrucciones de arranque del agente, matriz de validación y directorio de evidencias. **Su estructura y comandos de activación se diseñarán en el siguiente trabajo; no forman parte de este SPEC y no se crea ZIP ahora.**

---

## 14. Anexo de trazabilidad funcional

| Feature | Reglas principales | AC | Pruebas principales | Handoff Flutter |
|---|---|---|---|---|
| C1 | C1–C2, INV-03/04/06 | AC-C1-01..05 | T02, T08–10 | Lista de participantes, etapa y cambio con eventos |
| C2 | C3, INV-04/05 | AC-C2-01..04 | T09, T11 | Evaluación/motivo e historial |
| C3 | C4–C5, INV-08/09 | AC-C3-01..05 | T10–13 | Actividades, eventos, corrección |
| C4 | C6, INV-01/02 | AC-C4-01..05 | T14–16 | Elegibles/selector/ausentes |
| C6 | D1, INV-01/03 | AC-C6-01..04 | T17–18 | Filtros/paginación/orden |
| C8 | D2–D3, INV-03 | AC-C8-01..05 | T18–20 | Dashboard específico por campaña |
| P1 | B1–B3/B5/B6, INV-01/10 | AC-P1-01..06 | T01–08 | Matching y confirmación manual |
| P2 | C7, INV-01/04 | AC-P2-01..04 | T02, T21 | Vista campañas del maestro |
| P3 | B7, INV-07/08/09 | AC-P3-01..05 | T22–24 | Historial global vs contextual |
| P4 | B2/B4, E2, INV-07/10 | AC-P4-01..07 | T23–27 | Import preview/confirm evolucionados |

**FIN DEL SPEC — autorizado para documentación y preparación del arnés; ejecución condicionada a gates/GO correspondientes.**
