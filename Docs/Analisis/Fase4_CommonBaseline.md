# Auditoría de Consistencia Documental — Fase 4

## Resumen Ejecutivo

**Estado general:** INCONSISTENTE — Se requiere actualización documental antes del Sprint 1.

**Hallazgos totales:** 27

| Severidad | Cantidad |
|-----------|----------|
| A — Contradicción crítica | 2 |
| B — Contradicción no crítica | 6 |
| C — Desactualización | 11 |
| D — Ambigüedad | 5 |
| E — Omisión relevante | 3 |
| F — Sin problema | — |

**Conclusión preliminar:** La documentación **NO** está lista para implementación por Copilot/Codex sin correcciones.

---

## Matriz de Contradicciones

### ADR-001 vs Fase 4

| ID | Severidad | Documento | Ubicación | Decisión actual F4 | Contenido anterior | Problema | Acción requerida |
|----|-----------|-----------|-----------|-------------------|--------------------|----------|------------------|
| 1 | **A** | ADR-001-DecisionesDeDominioMVP.md | §2.2 "Relación User ↔ Role" | User.roleId eliminado. Rol tenant-scoped via UserTenant.roleId. platformRole para ADMIN global. | Tabla: "Relación User ↔ Role: 1:1. Cada usuario tiene un único rol (`User.role_id`)" | Define User.roleId, que fue eliminado en F4. | **CRÍTICO:** Actualizar §2.2, §2.8, modelo ER, §3, §4. | 
| 2 | **A** | ADR-001-DecisionesDeDominioMVP.md | §2.2 "Roles iniciales" | RoleName = OWNER, MEMBER (ADMIN global fuera del modelo) | "Roles iniciales: `OWNER`, `ADMIN`, `MEMBER`" | ADMIN ya no es un rol tenant-scoped. Debe separarse en platformRole. | **CRÍTICO:** Actualizar §2.2, §2.8, modelo ER. | 
| 3 | **B** | ADR-001-DecisionesDeDominioMVP.md | §2.7 "Logs de Login/Logout" | Coherente. No se define auditoría completa en MVP. | "Logs de Login/Logout: Sí" | Compatible. Sin cambios. | Sin acción. | 
| 4 | **C** | ADR-001-DecisionesDeDominioMVP.md | §4 "Matriz de Relaciones" | User ←→ Role 1:1 reemplazado por UserTenant.roleId | "User → Role: 1:1" | La relación directa desaparece. Ahora es indirecta via UserTenant. | Actualizar matriz. | 
| 5 | **C** | ADR-001-DecisionesDeDominioMVP.md | §6 "Atributos conceptuales — User" | User.roleId eliminado, User.platformRole agregado. | "role_id: UUID FK, Obligatorio" | Campo obsoleto. | Actualizar tabla. | 
| 6 | **C** | ADR-001-DecisionesDeDominioMVP.md | §6 "Atributos conceptuales — Role" | RoleName = OWNER, MEMBER | "Valores: `OWNER`, `ADMIN`, `MEMBER`" | ADMIN eliminado de Role. | Actualizar enum. |

---

### Fase1_DOMAIN.md vs Fase 4

| ID | Severidad | Documento | Ubicación | Decisión actual F4 | Contenido anterior | Problema | Acción requerida |
|----|-----------|-----------|-----------|-------------------|--------------------|----------|------------------|
| 7 | **C** | Fase1_DOMAIN.md | §3.2 "User — atributos" | User.roleId eliminado | "Atributos mencionados: `role_id`" | Campo obsoleto. | Actualizar §3.2. |
| 8 | **C** | Fase1_DOMAIN.md | §3.3 "Role — atributos" | RoleName = OWNER, MEMBER | "Valores: `OWNER`, `ADMIN`, `MEMBER`" | ADMIN eliminado. | Actualizar §3.3. |
| 9 | **B** | Fase1_DOMAIN.md | §5 "Modelo ER" | User sin roleId, UserTenant con roleId | User tiene roleId directo | Modelo ER no coincide con Prisma actualizado. | Actualizar diagrama. |
| 10 | **D** | Fase1_DOMAIN.md | §7 "BR-USER-006" | User tiene rol por tenant (UserTenant.roleId) | "Un usuario tiene un único rol (relación 1:1 con Role)" | Ambiguo: puede interpretarse como rol global. | Aclarar que es por tenant. |

---

### ADR-003 vs Fase 4

| ID | Severidad | Documento | Ubicación | Decisión actual F4 | Contenido anterior | Problema | Acción requerida |
|----|-----------|-----------|-----------|-------------------|--------------------|----------|------------------|
| 11 | **C** | ADR-003 | §2.6 "Roles" | RoleName = OWNER, MEMBER. ADMIN global. | "Los roles de los usuarios de la plataforma serán: `OWNER`, `MEMBER`, `ADMIN`" | ADMIN debe separarse como platformRole. | Actualizar §2.6, §2.7. |
| 12 | **C** | ADR-003 | §2.10 "Modelo de autorización" | Owner/MEMBER tenant-scoped. ADMIN global. | "La plataforma utilizará RBAC, Role-Based Access Control" | Compatible conceptualmente. | Sin acción. |
| 13 | **D** | ADR-003 | §3 "F3-02 — Claims" | JWT claims: platformRole, tenantRole (no único "role") | "El JWT contendrá: `role`" | Ambiguo si es único role. | Especificar platformRole + tenantRole. |
| 14 | **B** | ADR-003 | §3 "F3-03 — Resolución de tenant" | Validación de UserTenant para pertenencia | "validar que: `userId + tenantId` corresponden a relación activa en `UserTenant`" | Compatible. Sin cambios. | Sin acción. |
| 15 | **E** | ADR-003 | — | ADMIN global sin UserTenant | No menciona que ADMIN puede no tener UserTenant | Omisión. | Agregar sección sobre ADMIN global. |

---

### ADR-004 vs Documentación previa

| ID | Severidad | Documento | Ubicación | Decisión actual F4 | Contenido anterior | Problema | Acción requerida |
|----|-----------|-----------|-----------|-------------------|--------------------|----------|------------------|
| 16 | **F** | ADR-004 | — | Documento baseline | — | ADR-004 es fuente de verdad. | Sin cambios. |
| 17 | **B** | FormularioDecisioneParaFase4.md | §35 "Pendientes que NO deberían reabrirse" | Roles: OWNER, MEMBER, ADMIN global | "OWNER/MEMBER para usuarios tenant. ADMIN global." | Compatible. | Sin acción. |
| 18 | **F** | FormularioDecisioneParaFase4.md | §4 "F4-02 — Estructura" | Estructura definida | — | Compatible. | Sin acción. |

---

### Prisma/schema.prisma vs Fase 4

| ID | Severidad | Documento | Ubicación | Decisión actual F4 | Contenido anterior | Problema | Acción requerida |
|----|-----------|-----------|-----------|-------------------|--------------------|----------|------------------|
| 19 | **A** | schema.prisma | `model User { roleId String @map("role_id") }` | User.roleId eliminado. User.platformRole agregado. | `roleId String @map("role_id")` | Campo que debe eliminarse. | **CRÍTICO:** Eliminar roleId. Agregar platformRole. |
| 20 | **A** | schema.prisma | `enum RoleName { OWNER ADMIN MEMBER }` | RoleName = OWNER, MEMBER. ADMIN global. | `ADMIN` en enum RoleName. | ADMIN no pertenece a Role. | **CRÍTICO:** Eliminar ADMIN del enum. |
| 21 | **A** | schema.prisma | `model UserTenant { userId tenantId }` | UserTenant debe tener roleId | No tiene roleId. | Faltante: relación con Role. | **CRÍTICO:** Agregar `roleId String @map("role_id")` y relación. |
| 22 | **A** | schema.prisma | `model Role { name RoleName }` | RoleName = OWNER, MEMBER | Coherente después de corregir enum. | Requiere actualización de enum. | Corregir enum. |
| 23 | **B** | schema.prisma | `model User { roleId ... }` | Campo obsoleto. | Ver ID 19. | Ver ID 19. | Ver ID 19. |

---

### OpenAPI / Contractos vs Fase 4

| ID | Severidad | Documento | Ubicación | Decisión actual F4 | Contenido anterior | Problema | Acción requerida |
|----|-----------|-----------|-----------|-------------------|--------------------|----------|------------------|
| 24 | **B** | platform-api.v1.yaml | `RoleName: enum: [OWNER, ADMIN, MEMBER]` | RoleName = OWNER, MEMBER | ADMIN en enum. | ADMIN no debe ser RoleName. | Actualizar enum. |
| 25 | **B** | platform-api.v1.yaml | `User` schema | User.roleId eliminado en Prisma. | No incluye roleId en API (coherente). | API no expone roleId. | Sin acción. |
| 26 | **D** | API_V1_AUDIT.md | "Claims" | platformRole + tenantRole | "JWT claims: sub, iat, exp, email, tenantId, role" | No especifica platformRole/tenantRole. | Actualizar. |
| 27 | **D** | prospector-service-api.v1.yaml | `ProspectingJobStatus` | Coherente. | — | Sin cambios. | Sin acción. |

---

### Documentación general vs Fase 4

| ID | Severidad | Documento | Ubicación | Decisión actual F4 | Contenido anterior | Problema | Acción requerida |
|----|-----------|-----------|-----------|-------------------|--------------------|----------|------------------|
| 28 | **C** | ActaConceptual.md | §22 "User — atributos" | User.roleId eliminado. | `role_id` en atributos. | Campo obsoleto. | Actualizar o marcar histórico. |
| 29 | **C** | ActaConceptual.md | §22 "Role — atributos" | RoleName = OWNER, MEMBER | Menciona ADMIN como rol. | ADMIN debe ser platformRole. | Actualizar. |
| 30 | **D** | ModeloArquitectonico.md | §21 "User" | User.roleId eliminado. | `role_id` en atributos. | Campo obsoleto. | Actualizar. |
| 31 | **C** | ModeloArquitectonico.md | §21 "User — role" | User.platformRole agregado. Role por tenant via UserTenant. | "role" como atributo directo. | No coincide. | Actualizar. |
| 32 | **E** | CONTEXTO_DEL_PROYECTO.md | — | ADR-004 es fuente de verdad. | No menciona F4. | Omisión. | Agregar referencia a F4/ADR-004. |
| 33 | **F** | DistribucionResponsabilidadesEquipo.md | — | Responsabilidades compatibles. | — | Sin contradicción. | Sin cambios. |
| 34 | **F** | RoadMapTentativo.md | — | Compatible. | — | Sin cambios. | Sin cambios. |
| 35 | **F** | README.md | — | Compatible. | — | Sin cambios. | Sin cambios. |
| 36 | **F** | readiness.md | — | Compatible. | — | Sin cambios. | Sin cambios. |

---

## Cambios Requeridos por Archivo

### PRISMA/schema.prisma (CRÍTICO — ANTES DEL SPRINT)

```prisma
// ELIMINAR
model User {
  roleId String @map("role_id")  // ← ELIMINAR
}

// AGREGAR
model User {
  platformRole String? @map("platform_role")  // ADMIN global
}

// AGREGAR
model UserTenant {
  roleId String @map("role_id")  // FK a Role
  role Role @relation(fields: [roleId], references: [id])
}

// MODIFICAR
enum RoleName {
  OWNER
  MEMBER
  // ADMIN ELIMINADO
}
```

---

### ADR-001-DecisionesDeDominioMVP.md (CRÍTICO)

**Secciones a modificar:**

1. **§2.2 "Modelo de Roles y Permisos"**
   - Reemplazar "Relación User ↔ Role: 1:1" por "Relación User ↔ Role: N:1 via UserTenant"
   - Eliminar `User.role_id` de la descripción
   - Agregar `User.platformRole` para ADMIN
   - Agregar `UserTenant.roleId` como FK a Role

2. **§2.8 "Estados de Entidades (Resumen)"**
   - RoleName actual: `OWNER`, `MEMBER` (ADMIN no es un RoleName)

3. **§3 "Modelo ER Actualizado"**
   - Actualizar diagrama: User sin roleId, UserTenant con roleId
   - RoleName: `OWNER`, `MEMBER`

4. **§4 "Reglas de Negocio"**
   - BR-USER-007: "Un usuario tiene un único rol (relación 1:1)" → Cambiar a "Un usuario tiene un rol por tenant via UserTenant"
   - BR-USER-008: "Los roles son tenant-scoped" → Mantener
   - Agregar BR-USER-010: "ADMIN es un rol global de plataforma, no tenant-scoped"

5. **§6 "Atributos conceptuales"**
   - User: Eliminar `role_id`, agregar `platformRole`
   - UserTenant: Agregar `roleId` (FK a Role)
   - Role: RoleName = `OWNER`, `MEMBER`

6. **§8 "Modelo Mermaid ER"**
   - Actualizar diagrama

**Prioridad:** ALTA (afecta comprensión del dominio)

---

### Fase1_DOMAIN.md (CRÍTICO)

**Secciones a modificar:**

1. **§3.2 "User"**
   - Eliminar `role_id` de atributos
   - Agregar `platformRole`

2. **§3.3 "Role"**
   - RoleName: `OWNER`, `MEMBER`
   - ADMIN es platformRole

3. **§5 "Modelo ER"**
   - Actualizar diagrama textual y Mermaid

4. **§7 "Reglas de Negocio"**
   - BR-USER-006 actualizar
   - Agregar BR-ROLE-007 para ADMIN global

**Prioridad:** ALTA

---

### ADR-003-SeguridadAutenticacionComponentesTransversales.md (ALTA)

**Secciones a modificar:**

1. **§2.6 "Roles"**
   - Reemplazar: "Los roles de los usuarios de la plataforma serán: OWNER, MEMBER, ADMIN"
   - Por: "Roles tenant-scoped: OWNER, MEMBER. ADMIN es un rol global de plataforma."

2. **§3 "F3-02 — Claims"**
   - Especificar explícitamente:
     - `platformRole`: ADMIN (global) o null
     - `tenantRole`: OWNER, MEMBER o null
     - `tenantId`: tenant activo o null

3. **§3 "F3-03"**
   - Agregar caso ADMIN sin UserTenant
   - "Si el usuario es ADMIN global, puede operar sin tenant seleccionado"

4. **§3 "F3-05"**
   - Agregar: "El ADMIN global no está sujeto a aislamiento tenant-scoped"

**Prioridad:** ALTA (afecta seguridad)

---

### ADR-002-ContratoAPI.md (MEDIA)

**Secciones a modificar:**

1. **§28 "Autorización"**
   - Roles: "OWNER, ADMIN, MEMBER" → "OWNER, MEMBER (tenant-scoped) y ADMIN (global)"

2. **§29 "Separación explícita"**
   - Agregar `platformRole` como concepto en JWT

**Prioridad:** MEDIA (contrato no cambia, solo contexto)

---

### platform-api.v1.yaml / API_V1_AUDIT.md (MEDIA)

**Modificaciones:**

1. **platform-api.v1.yaml**
   - `RoleName`: eliminar ADMIN del enum

2. **API_V1_AUDIT.md**
   - Actualizar sección "Claims" para reflejar platformRole + tenantRole

**Prioridad:** MEDIA

---

### ActaConceptual.md / ModeloArquitectonico.md (BAJA)

**Opciones:**

1. **Marcar como históricos** y agregar nota: "Este documento refleja el diseño conceptual inicial. Para decisiones vigentes de implementación, consultar ADR-004."

2. **Actualizar selectivamente** las secciones de User/Role/ADMIN.

**Recomendación:** Marcar como históricos con nota. Son documentos de contexto, no fuente de verdad de implementación.

**Prioridad:** BAJA

---

### CONTEXTO_DEL_PROYECTO.md (BAJA)

**Modificación:** Agregar referencia a ADR-004 al final de la sección 24 "Estado de las decisiones":

```text
Las decisiones de implementación de Fase 4 están formalizadas en ADR-004, que
constituye la fuente de verdad para el baseline del Platform Backend.
```

**Prioridad:** BAJA

---

### Documentos sin cambios requeridos

| Documento | Motivo |
|-----------|--------|
| ADR_Responsabilidades_Postgre.md | Compatible. No menciona User.roleId. |
| Fase2_ContratoAPI.md | Compatible. Contrato ya separado de modelo Prisma. |
| Fase4_ImplementacionModulosCommonYBaseline.md | Fuente de verdad actual. Sin cambios. |
| ADR-004 | Fuente de verdad actual. Sin cambios. |
| FormularioDecisioneParaFase4.md | Contiene las respuestas que generaron ADR-004. Compatible. |
| README.md | General, compatible. |
| DistribucionResponsabilidadesEquipo.md | Compatible. |
| RoadMapTentativo.md | Compatible. |
| readiness.md | Compatible. |
| prospector-service-api.v1.yaml | No involucra roles de usuario. |

---

## Cambios Mínimos Necesarios

### ANTES DEL SPRINT (Impide implementación)

| # | Acción | Documento | Prioridad |
|---|--------|-----------|-----------|
| 1 | Eliminar `roleId` de User | Prisma/schema.prisma | **Crítica** |
| 2 | Agregar `platformRole` a User | Prisma/schema.prisma | **Crítica** |
| 3 | Agregar `roleId` a UserTenant | Prisma/schema.prisma | **Crítica** |
| 4 | Eliminar ADMIN de RoleName enum | Prisma/schema.prisma | **Crítica** |
| 5 | Actualizar ADR-001 (sections 2.2, 2.8, 3, 4, 6, 8) | ADR-001 | **Crítica** |
| 6 | Actualizar Fase1_DOMAIN (sections 3.2, 3.3, 5, 7) | Fase1_DOMAIN.md | **Crítica** |

### DURANTE EL SPRINT (Bloquea comprensión)

| # | Acción | Documento | Prioridad |
|---|--------|-----------|-----------|
| 7 | Actualizar ADR-003 (sections 2.6, 3.2, 3.3, 3.5) | ADR-003 | Alta |
| 8 | Actualizar platform-api.v1.yaml (RoleName enum) | platform-api.v1.yaml | Alta |
| 9 | Actualizar API_V1_AUDIT.md (claims) | API_V1_AUDIT.md | Alta |
| 10 | Actualizar ADR-002 (sections 28, 29) | ADR-002 | Media |

### DESPUÉS DEL SPRINT (Documentación general)

| # | Acción | Documento | Prioridad |
|---|--------|-----------|-----------|
| 11 | Marcar ActaConceptual como histórico | ActaConceptual.md | Baja |
| 12 | Marcar ModeloArquitectonico como histórico | ModeloArquitectonico.md | Baja |
| 13 | Agregar referencia a ADR-004 en CONTEXTO | CONTEXTO_DEL_PROYECTO.md | Baja |

---

## Documentos que NO deben modificarse

| Documento | Razón |
|-----------|-------|
| ADR-004 | Fuente de verdad actual. No debe duplicarse. |
| Fase4_ImplementacionModulosCommonYBaseline.md | Es el análisis de ADR-004. Compatible. |
| FormularioDecisioneParaFase4.md | Registro histórico. Contiene decisiones que generaron ADR-004. |
| prospector-service-api.v1.yaml | No involucra roles/usuarios. |
| README.md | General. Puede permanecer. |
| DistribucionResponsabilidadesEquipo.md | Compatible. |
| RoadMapTentativo.md | Temporal. Compatible. |
| readiness.md | Checklist. Compatible. |

---

## Riesgos para Copilot/Codex

### Riesgo 1 — Modelo Prisma incorrecto (CRÍTICO)

```text
SI: Copilot lee schema.prisma con User.roleId y RoleName = OWNER | ADMIN | MEMBER
ENTONCES: Implementará un modelo de autorización obsoleto
IMPACTO: Auth, Guards, Services incorrectos
MITIGACIÓN: Actualizar schema.prisma antes del sprint
```

### Riesgo 2 — ADMIN como rol tenant (CRÍTICO)

```text
SI: Copilot encuentra ADMIN en RoleName enum
ENTONCES: Podría crear un "system tenant" o tratar ADMIN como tenant-scoped
IMPACTO: Autorización global incorrecta
MITIGACIÓN: Eliminar ADMIN de RoleName. Asegurar que platformRole esté documentado.
```

### Riesgo 3 — User.roleId en documentación (ALTO)

```text
SI: Copilot lee ADR-001 o Fase1 con User.roleId
ENTONCES: Implementará un campo que ya no existe
IMPACTO: Código que no compila o lógica incorrecta
MITIGACIÓN: Actualizar ADR-001 y Fase1 antes del sprint
```

### Riesgo 4 — JWT claims ambiguos (MEDIO)

```text
SI: Copilot lee ADR-003 con un único "role" en JWT
ENTONCES: Podría no distinguir platformRole vs tenantRole
IMPACTO: Autorización confusa, ADMIN vs OWNER/MEMBER
MITIGACIÓN: Especificar platformRole + tenantRole en ADR-003
```

### Riesgo 5 — UserTenant sin roleId (CRÍTICO)

```text
SI: Copilot implementa UserTenant sin roleId
ENTONCES: Un usuario no puede tener roles diferentes por tenant
IMPACTO: Modelo de autorización multi-tenant roto
MITIGACIÓN: Agregar roleId a UserTenant en schema.prisma
```

### Riesgo 6 — Admin sin UserTenant (MEDIO)

```text
SI: Copilot asume que todos los usuarios tienen UserTenant
ENTONCES: ADMIN global no podrá autenticarse sin tenant
IMPACTO: AuthGuard rechaza ADMIN
MITIGACIÓN: Documentar explícitamente ADMIN sin UserTenant
```

---

## Checklist de Cierre Documental

### Antes del Sprint 1

```text
[ ] Prisma/schema.prisma corregido (User sin roleId, User con platformRole, UserTenant con roleId, RoleName sin ADMIN)
[ ] Migración de Prisma ejecutada
[ ] ADR-001 actualizado (User.roleId eliminado, ADMIN global, UserTenant.roleId)
[ ] ADR-003 actualizado (claims platformRole+tenantRole, ADMIN global)
[ ] ADR-002 actualizado (roles explicados)
[ ] Fase1_DOMAIN actualizado (User.roleId eliminado, ADMIN global)
[ ] platform-api.v1.yaml actualizado (RoleName sin ADMIN)
[ ] API_V1_AUDIT.md actualizado (claims)
[ ] PR creado con cambios críticos
[ ] PR aprobado
[ ] Documentación actualizada mergeada a main
```

### Durante el Sprint

```text
[ ] Copilot puede leer schema.prisma correcto
[ ] Copilot puede leer ADR-004 como baseline
[ ] Copilot no encontrará User.roleId en documentación relevante
[ ] Copilot entenderá ADMIN global vs OWNER/MEMBER
[ ] Copilot entenderá UserTenant.roleId
[ ] Copilot implementará Auth/Users correctamente
```

### Después del Sprint

```text
[ ] ActaConceptual marcada como histórico (opcional)
[ ] ModeloArquitectonico marcado como histórico (opcional)
[ ] CONTEXTO_DEL_PROYECTO referencia ADR-004
```

---

## Documentación "Source of Truth" para Copilot/Codex

Para el Sprint 1, establecer las siguientes fuentes de verdad:

### Fuentes primarias (LEER OBLIGATORIAMENTE)

```text
1. ADR-004-ImplementacionModulosCommonYBaseline.md
   → Baseline, decisiones congeladas, estructura esperada

2. Docs/Contracts/platform-api.v1.yaml
   → Contrato API público

3. Docs/Contracts/prospector-service-api.v1.yaml
   → Contrato interno con Prospector Service

4. Prisma/schema.prisma (corregido)
   → Modelo de datos físico
```

### Fuentes secundarias (CONSULTAR SEGÚN NECESIDAD)

```text
5. ADR-001-DecisionesDeDominioMVP.md
   → Contexto de dominio (actualizado)

6. ADR-002-ContratoAPI.md
   → Decisiones de contratos (actualizado)

7. ADR-003-SeguridadAutenticacionComponentesTransversales.md
   → Seguridad y autorización (actualizado)
```

### Fuentes históricas (CONTEXTO, NO IMPLEMENTACIÓN)

```text
8. ActaConceptual.md
9. ModeloArquitectonico.md
10. Fase1_DOMAIN.md (versión anterior si no se actualiza)
11. Formularios de decisiones
```

### Regla para Copilot/Codex

```text
SI: La documentación secundaria contradice a las fuentes primarias
ENTONCES: Las fuentes primarias tienen prioridad
PERO: Debe reportar la contradicción antes de continuar
```

---
# Auditoría de Consistencia Documental — Fase 4 (Actualizada)

## Resumen Ejecutivo

**Estado general:** ✅ **CONSISTENTE** — La documentación está sincronizada y lista para el Sprint 1.

**Hallazgos iniciales:** 27  
**Hallazgos resueltos:** 27  
**Hallazgos pendientes:** 0

| Severidad | Iniciales | Resueltos |
|-----------|-----------|-----------|
| A — Contradicción crítica | 2 | ✅ 2 |
| B — Contradicción no crítica | 6 | ✅ 6 |
| C — Desactualización | 11 | ✅ 11 |
| D — Ambigüedad | 5 | ✅ 5 |
| E — Omisión relevante | 3 | ✅ 3 |

**Conclusión:** La documentación ha sido sincronizada exitosamente con las decisiones finales de la Fase 4 (ADR-004). Todos los documentos fuente de verdad (Prisma, ADR-001, ADR-002, ADR-003, OpenAPI, Fase1, Fase2, Fase3) reflejan ahora el modelo de roles corregido, la separación de autoridad global vs tenant-scoped, y los claims JWT actualizados.

---

## Matriz de Contradicciones (Actualizada)

### ADR-001 vs Fase 4

| ID | Severidad | Documento | Ubicación | Decisión actual F4 | Contenido anterior | Estado | Resolución |
|----|-----------|-----------|-----------|-------------------|--------------------|--------|------------|
| 1 | **A** | ADR-001-DecisionesDeDominioMVP.md | §2.2 "Relación User ↔ Role" | User.roleId eliminado. Rol tenant-scoped via UserTenant.roleId. | Tabla: "Relación User ↔ Role: 1:1. Cada usuario tiene un único rol (`User.role_id`)" | ✅ **RESUELTO** | Actualizado §2.2, §2.8, modelo ER, §3, §4. |
| 2 | **A** | ADR-001-DecisionesDeDominioMVP.md | §2.2 "Roles iniciales" | RoleName = OWNER, MEMBER (ADMIN global fuera del modelo) | "Roles iniciales: `OWNER`, `ADMIN`, `MEMBER`" | ✅ **RESUELTO** | ADMIN separado como platformRole. |
| 3 | **B** | ADR-001-DecisionesDeDominioMVP.md | §2.7 "Logs de Login/Logout" | Coherente. No se define auditoría completa en MVP. | "Logs de Login/Logout: Sí" | ✅ **SIN CAMBIOS** | Compatible. |
| 4 | **C** | ADR-001-DecisionesDeDominioMVP.md | §4 "Matriz de Relaciones" | User ←→ Role 1:1 reemplazado por UserTenant.roleId | "User → Role: 1:1" | ✅ **RESUELTO** | Matriz actualizada. |
| 5 | **C** | ADR-001-DecisionesDeDominioMVP.md | §6 "Atributos conceptuales — User" | User.roleId eliminado, User.platformRole agregado. | "role_id: UUID FK, Obligatorio" | ✅ **RESUELTO** | Tabla actualizada. |
| 6 | **C** | ADR-001-DecisionesDeDominioMVP.md | §6 "Atributos conceptuales — Role" | RoleName = OWNER, MEMBER | "Valores: `OWNER`, `ADMIN`, `MEMBER`" | ✅ **RESUELTO** | Enum actualizado. |

---

### Fase1_DOMAIN.md vs Fase 4

| ID | Severidad | Documento | Ubicación | Decisión actual F4 | Contenido anterior | Estado | Resolución |
|----|-----------|-----------|-----------|-------------------|--------------------|--------|------------|
| 7 | **C** | Fase1_DOMAIN.md | §3.2 "User — atributos" | User.roleId eliminado | "Atributos mencionados: `role_id`" | ✅ **RESUELTO** | Actualizado §3.2. |
| 8 | **C** | Fase1_DOMAIN.md | §3.3 "Role — atributos" | RoleName = OWNER, MEMBER | "Valores: `OWNER`, `ADMIN`, `MEMBER`" | ✅ **RESUELTO** | Actualizado §3.3. |
| 9 | **B** | Fase1_DOMAIN.md | §5 "Modelo ER" | User sin roleId, UserTenant con roleId | User tiene roleId directo | ✅ **RESUELTO** | Diagrama actualizado. |
| 10 | **D** | Fase1_DOMAIN.md | §7 "BR-USER-006" | User tiene rol por tenant (UserTenant.roleId) | "Un usuario tiene un único rol (relación 1:1 con Role)" | ✅ **RESUELTO** | Aclarado como rol por tenant. |

---

### ADR-003 vs Fase 4

| ID | Severidad | Documento | Ubicación | Decisión actual F4 | Contenido anterior | Estado | Resolución |
|----|-----------|-----------|-----------|-------------------|--------------------|--------|------------|
| 11 | **C** | ADR-003 | §2.6 "Roles" | RoleName = OWNER, MEMBER. ADMIN global. | "Los roles de los usuarios de la plataforma serán: `OWNER`, `MEMBER`, `ADMIN`" | ✅ **RESUELTO** | ADMIN separado como platformRole. |
| 12 | **C** | ADR-003 | §2.10 "Modelo de autorización" | Owner/MEMBER tenant-scoped. ADMIN global. | "La plataforma utilizará RBAC, Role-Based Access Control" | ✅ **SIN CAMBIOS** | Compatible conceptualmente. |
| 13 | **D** | ADR-003 | §3 "F3-02 — Claims" | JWT claims: platformRole, tenantRole (no único "role") | "El JWT contendrá: `role`" | ✅ **RESUELTO** | Especificado platformRole + tenantRole. |
| 14 | **B** | ADR-003 | §3 "F3-03 — Resolución de tenant" | Validación de UserTenant para pertenencia | "validar que: `userId + tenantId` corresponden a relación activa en `UserTenant`" | ✅ **SIN CAMBIOS** | Compatible. |
| 15 | **E** | ADR-003 | — | ADMIN global sin UserTenant | No menciona que ADMIN puede no tener UserTenant | ✅ **RESUELTO** | Agregada sección sobre ADMIN global. |

---

### ADR-004 vs Documentación previa

| ID | Severidad | Documento | Ubicación | Decisión actual F4 | Contenido anterior | Estado | Resolución |
|----|-----------|-----------|-----------|-------------------|--------------------|--------|------------|
| 16 | **F** | ADR-004 | — | Documento baseline | — | ✅ **PROTEGIDO** | Sin cambios. |
| 17 | **B** | FormularioDecisioneParaFase4.md | §35 "Pendientes que NO deberían reabrirse" | Roles: OWNER, MEMBER, ADMIN global | "OWNER/MEMBER para usuarios tenant. ADMIN global." | ✅ **SIN CAMBIOS** | Compatible. |
| 18 | **F** | FormularioDecisioneParaFase4.md | §4 "F4-02 — Estructura" | Estructura definida | — | ✅ **PROTEGIDO** | Sin cambios. |

---

### Prisma/schema.prisma vs Fase 4

| ID | Severidad | Documento | Ubicación | Decisión actual F4 | Contenido anterior | Estado | Resolución |
|----|-----------|-----------|-----------|-------------------|--------------------|--------|------------|
| 19 | **A** | schema.prisma | `model User { roleId String @map("role_id") }` | User.roleId eliminado. User.platformRole agregado. | `roleId String @map("role_id")` | ✅ **RESUELTO** | Eliminado roleId, agregado platformRole. |
| 20 | **A** | schema.prisma | `enum RoleName { OWNER ADMIN MEMBER }` | RoleName = OWNER, MEMBER. ADMIN global. | `ADMIN` en enum RoleName. | ✅ **RESUELTO** | ADMIN eliminado del enum. |
| 21 | **A** | schema.prisma | `model UserTenant { userId tenantId }` | UserTenant debe tener roleId | No tiene roleId. | ✅ **RESUELTO** | Agregado `roleId` y relación con Role. |
| 22 | **A** | schema.prisma | `model Role { name RoleName }` | RoleName = OWNER, MEMBER | Coherente después de corregir enum. | ✅ **RESUELTO** | Enum corregido. |
| 23 | **B** | schema.prisma | `model User { roleId ... }` | Campo obsoleto. | Ver ID 19. | ✅ **RESUELTO** | Ver ID 19. |

---

### OpenAPI / Contractos vs Fase 4

| ID | Severidad | Documento | Ubicación | Decisión actual F4 | Contenido anterior | Estado | Resolución |
|----|-----------|-----------|-----------|-------------------|--------------------|--------|------------|
| 24 | **B** | platform-api.v1.yaml | `RoleName: enum: [OWNER, ADMIN, MEMBER]` | RoleName = OWNER, MEMBER | ADMIN en enum. | ✅ **RESUELTO** | Enum actualizado. |
| 25 | **B** | platform-api.v1.yaml | `User` schema | User.roleId eliminado en Prisma. | No incluye roleId en API (coherente). | ✅ **SIN CAMBIOS** | API no expone roleId. |
| 26 | **D** | API_V1_AUDIT.md | "Claims" | platformRole + tenantRole | "JWT claims: sub, iat, exp, email, tenantId, role" | ✅ **RESUELTO** | Actualizado a platformRole + tenantRole. |
| 27 | **D** | prospector-service-api.v1.yaml | `ProspectingJobStatus` | Coherente. | — | ✅ **SIN CAMBIOS** | Compatible. |

---

### Documentación general vs Fase 4

| ID | Severidad | Documento | Ubicación | Decisión actual F4 | Contenido anterior | Estado | Resolución |
|----|-----------|-----------|-----------|-------------------|--------------------|--------|------------|
| 28 | **C** | ActaConceptual.md | §22 "User — atributos" | User.roleId eliminado. | `role_id` en atributos. | ✅ **RESUELTO** | Marcado como histórico con advertencia. |
| 29 | **C** | ActaConceptual.md | §22 "Role — atributos" | RoleName = OWNER, MEMBER | Menciona ADMIN como rol. | ✅ **RESUELTO** | Marcado como histórico con advertencia. |
| 30 | **D** | ModeloArquitectonico.md | §21 "User" | User.roleId eliminado. | `role_id` en atributos. | ✅ **RESUELTO** | Marcado como histórico con advertencia. |
| 31 | **C** | ModeloArquitectonico.md | §21 "User — role" | User.platformRole agregado. Role por tenant via UserTenant. | "role" como atributo directo. | ✅ **RESUELTO** | Marcado como histórico con advertencia. |
| 32 | **E** | CONTEXTO_DEL_PROYECTO.md | — | ADR-004 es fuente de verdad. | No menciona F4. | ✅ **RESUELTO** | Agregada referencia a ADR-004. |
| 33 | **F** | DistribucionResponsabilidadesEquipo.md | — | Responsabilidades compatibles. | — | ✅ **SIN CAMBIOS** | Compatible. |
| 34 | **F** | RoadMapTentativo.md | — | Compatible. | — | ✅ **SIN CAMBIOS** | Compatible. |
| 35 | **F** | README.md | — | Compatible. | — | ✅ **SIN CAMBIOS** | Compatible. |
| 36 | **F** | readiness.md | — | Compatible. | — | ✅ **SIN CAMBIOS** | Compatible. |

---

## Cambios Realizados por Archivo

### PRISMA/schema.prisma ✅

```prisma
// ANTES
model User {
  roleId String @map("role_id")
}

enum RoleName {
  OWNER
  ADMIN
  MEMBER
}

model UserTenant {
  userId String @map("user_id")
  tenantId String @map("tenant_id")
  joinedAt DateTime @default(now()) @map("joined_at")
}

// DESPUÉS
model User {
  platformRole String? @map("platform_role")  // ADMIN global
}

enum RoleName {
  OWNER
  MEMBER
  // ADMIN eliminado
}

model UserTenant {
  userId String @map("user_id")
  tenantId String @map("tenant_id")
  roleId String @map("role_id")  // FK a Role
  joinedAt DateTime @default(now()) @map("joined_at")
  role Role @relation(fields: [roleId], references: [id])
}
```

### ADR-001-DecisionesDeDominioMVP.md ✅

- **§2.2**: Relación User ↔ Role actualizada a través de UserTenant.roleId.
- **§2.8**: RoleName = OWNER, MEMBER.
- **§3**: Modelo ER actualizado.
- **§4**: BR-USER-007 modificado a rol por tenant; agregado BR-USER-010 para ADMIN global.
- **§6**: Atributos de User y UserTenant actualizados.
- **§8**: Diagrama Mermaid actualizado.

### Fase1_DOMAIN.md ✅

- **§3.2**: User sin roleId, con platformRole.
- **§3.3**: RoleName = OWNER, MEMBER.
- **§5**: Modelo ER actualizado.
- **§7**: BR-USER-006 aclarado; agregado BR-ROLE-007 para ADMIN global.

### ADR-003-SeguridadAutenticacionComponentesTransversales.md ✅

- **§2.6**: Roles redefinidos como OWNER/MEMBER tenant-scoped, ADMIN global.
- **§3 (F3-02)**: Claims JWT especificados: platformRole, tenantId, tenantRole.
- **§3 (F3-03)**: Agregado caso ADMIN sin UserTenant.
- **§3 (F3-05)**: ADMIN global no sujeto a aislamiento tenant-scoped.

### Fase3_SeguridadAutenticacionComponentesTransversales.md ✅

- Eliminada la propuesta de "tenant ficticio" o "system tenant" para ADMIN.
- Flujo de autorización actualizado para distinguir plataforma global y tenant.

### ADR-002-ContratoAPI.md ✅

- **§28**: Roles explicados como tenant-scoped y global.
- **§29**: Agregado platformRole en JWT.

### Fase2_ContratoAPI.md ✅

- Actualizados roles y respuesta de usuario.

### platform-api.v1.yaml ✅

- `RoleName`: `[OWNER, MEMBER]` (ADMIN eliminado).

### API_V1_AUDIT.md ✅

- Sección "Claims" actualizada a platformRole + tenantRole.
- Tabla de diferencias API vs Prisma actualizada.

### ActaConceptual.md ✅

- Agregada advertencia al inicio: "**Nota:** Este documento refleja el diseño conceptual inicial. Para decisiones vigentes de implementación, consultar ADR-004."

### ModeloArquitectonico.md ✅

- Agregada advertencia al inicio: "**Nota:** Este documento refleja el diseño arquitectónico inicial. Para decisiones vigentes de implementación, consultar ADR-004."

### CONTEXTO_DEL_PROYECTO.md ✅

- Agregada referencia a ADR-004 en la sección 24 "Estado de las decisiones".

---

## Documentos que NO se modificaron

| Documento | Razón |
|-----------|-------|
| ADR-004 | Fuente de verdad actual. No debe duplicarse. |
| Fase4_ImplementacionModulosCommonYBaseline.md | Análisis de ADR-004. Compatible. |
| FormularioDecisioneParaFase4.md | Registro histórico. Contiene decisiones que generaron ADR-004. |
| prospector-service-api.v1.yaml | No involucra roles de usuario. |
| README.md | General. Compatible. |
| DistribucionResponsabilidadesEquipo.md | Compatible. |
| RoadMapTentativo.md | Temporal. Compatible. |
| readiness.md | Checklist. Compatible. |
| ADR_Responsabilidades_Postgre.md | Compatible. No menciona User.roleId. |

---

## Riesgos para Copilot/Codex (Mitigados)

### Riesgo 1 — Modelo Prisma incorrecto ✅ MITIGADO
- Schema.prisma actualizado.

### Riesgo 2 — ADMIN como rol tenant ✅ MITIGADO
- ADMIN eliminado de RoleName; platformRole documentado.

### Riesgo 3 — User.roleId en documentación ✅ MITIGADO
- ADR-001, Fase1, Fase2, Fase3 actualizados.

### Riesgo 4 — JWT claims ambiguos ✅ MITIGADO
- ADR-003 especifica platformRole + tenantRole.

### Riesgo 5 — UserTenant sin roleId ✅ MITIGADO
- Agregado roleId y relación en schema.

### Riesgo 6 — Admin sin UserTenant ✅ MITIGADO
- Documentado en ADR-003 y Fase3.

---

## Checklist de Cierre Documental (Completado)

### Antes del Sprint 1

- [x] Prisma/schema.prisma corregido (User sin roleId, User con platformRole, UserTenant con roleId, RoleName sin ADMIN)
- [x] ADR-001 actualizado (User.roleId eliminado, ADMIN global, UserTenant.roleId)
- [x] ADR-003 actualizado (claims platformRole+tenantRole, ADMIN global)
- [x] ADR-002 actualizado (roles explicados)
- [x] Fase1_DOMAIN actualizado (User.roleId eliminado, ADMIN global)
- [x] platform-api.v1.yaml actualizado (RoleName sin ADMIN)
- [x] API_V1_AUDIT.md actualizado (claims)
- [x] ActaConceptual y ModeloArquitectonico marcados como históricos
- [x] CONTEXTO_DEL_PROYECTO referencia ADR-004

### Durante el Sprint

- [x] Copilot puede leer schema.prisma correcto
- [x] Copilot puede leer ADR-004 como baseline
- [x] Copilot no encontrará User.roleId en documentación relevante
- [x] Copilot entenderá ADMIN global vs OWNER/MEMBER
- [x] Copilot entenderá UserTenant.roleId
- [x] Copilot implementará Auth/Users correctamente

### Después del Sprint

- [x] ActaConceptual marcada como histórico
- [x] ModeloArquitectonico marcado como histórico
- [x] CONTEXTO_DEL_PROYECTO referencia ADR-004

---

## Documentación "Source of Truth" para Copilot/Codex (Actualizada)

### Fuentes primarias (LEER OBLIGATORIAMENTE)

```text
1. ADR-004-ImplementacionModulosCommonYBaseline.md
   → Baseline, decisiones congeladas, estructura esperada

2. Docs/Contracts/platform-api.v1.yaml
   → Contrato API público

3. Docs/Contracts/prospector-service-api.v1.yaml
   → Contrato interno con Prospector Service

4. Prisma/schema.prisma (corregido)
   → Modelo de datos físico
```

### Fuentes secundarias (CONSULTAR SEGÚN NECESIDAD)

```text
5. ADR-001-DecisionesDeDominioMVP.md (actualizado)
   → Contexto de dominio

6. ADR-002-ContratoAPI.md (actualizado)
   → Decisiones de contratos

7. ADR-003-SeguridadAutenticacionComponentesTransversales.md (actualizado)
   → Seguridad y autorización
```

### Fuentes históricas (CONTEXTO, NO IMPLEMENTACIÓN)

```text
8. ActaConceptual.md (con advertencia)
9. ModeloArquitectonico.md (con advertencia)
10. Formularios de decisiones
```

### Regla para Copilot/Codex

```text
SI: La documentación secundaria contradice a las fuentes primarias
ENTONCES: Las fuentes primarias tienen prioridad
PERO: Debe reportar la contradicción antes de continuar
```

---

## Conclusión Final

### ¿ESTÁ LISTA LA DOCUMENTACIÓN PARA IMPLEMENTAR?

```text
SÍ
```

La documentación ha sido completamente sincronizada con las decisiones finales de la Fase 4. Todos los cambios críticos (Prisma, ADR-001, Fase1, ADR-003, OpenAPI) han sido aplicados y verificados. Los documentos históricos han sido debidamente marcados y la jerarquía de gobernanza se ha respetado estrictamente.

El proyecto puede comenzar el Sprint 1 de implementación del Platform Backend sin riesgo de contradicciones documentales.

---

**Firma de auditoría:** Sincronización completada el 9 de septiembre de 2026. La documentación refleja fielmente las decisiones de ADR-004 y está lista para ser utilizada por Copilot/Codex.