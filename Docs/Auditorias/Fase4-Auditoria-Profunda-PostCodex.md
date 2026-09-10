# Auditoría profunda de reconciliación F4 — Platform Backend

Fecha: 2026-09-09. Repositorio: CarlosAM03/saas-platform-backend. Auditoría y correcciones sobre el working tree local; sin commit, push ni cambios remotos.

## 1. Estado final

**F4 NOT FULLY CLOSED.** El baseline local corregido supera las verificaciones técnicas descritas aquí. No se certifica 100%: las correcciones permanecen sin publicar y se encontraron credenciales operativas en documentación histórica que requieren rotación coordinada. Sanitizar archivos no invalida las copias anteriores de esas credenciales.

La declaración anterior de `Fase4-Cierre-Final.md` no era suficiente: al retirar el doble de TenantContext se reprodujeron tres fallos E2E, había YAML con claves duplicadas y lint completo fallaba. Ese reporte quedó identificado como histórico y superseded.

## 2. Alcance auditado

Se contrastaron decisiones, código, contratos, pruebas y comportamiento HTTP con PostgreSQL real. Se revisaron Common, Auth, Users, Prisma, migración, seed, bootstrap, Swagger, cinco módulos preparados, documentación normativa e histórica. Se preservaron los cambios locales preexistentes y el renombrado previo del registro F4.

No se implementaron módulos funcionales F5+, Redis, RLS, refresh tokens, OAuth, colas, microservicios ni infraestructura productiva. No se creó AGENTS/. La API interna de Prospector se revisó como contrato; su integración no forma parte del baseline operativo.

## 3. Flujo real de trabajo

1. Plan externo F4: documento operativo ejecutado por bloques, no autoridad superior al ADR.
2. Copilot en VS Code: implementación inicial del baseline.
3. Carlos + DeepSeek: trabajo manual de PostgreSQL, pruebas, Swagger, arranque y documentación.
4. Dos commits posteriores: configuración/Swagger/migración y ajuste del README en GitHub.
5. Handoff DeepSeek: evidencia intermedia de ese trabajo, anterior a las auditorías posteriores.
6. ChatGPT/GitHub: auditoría del snapshot publicado, conservada en `BaseLine-0-0-1.md`.
7. Codex Desktop: correcciones locales y declaración de cierre anterior.
8. Esta reconciliación: reproducción independiente, correcciones y revalidación.

El orden y la atribución a asistentes proceden del contexto proporcionado por Carlos y de los artefactos; Git confirma cambios y commits, no por sí solo quién utilizó qué asistente.

## 4. Línea temporal de commits

| Estado | Commit | Evidencia e interpretación |
| --- | --- | --- |
| Baseline inicial | `9d17d0f` | `feat: baseline del Platform Backend - Fase 4`; contiene schema y seed, todavía no la migración inicial versionada. |
| Trabajo operativo posterior | `84e531dd6427229b0ddaad310602d96a1cf807e9` | Swagger/main.ts, dependencias, migración inicial y otros ajustes; 8 archivos, 543 adiciones y 103 eliminaciones según Git. Es HEAD y origin/main locales. |
| Ajuste documental publicado | `c4ebc2f3258bdfc4e7523aa638fa0ce5ae3729c0` | `Refactor directory structure in README`; confirmado mediante conector GitHub. Es main remoto consultado. |
| Working tree auditado | Sobre `84e531d`, con cambios locales | Incluye trabajo anterior de Codex, documentos aportados y correcciones de esta auditoría. No equivale al main publicado. |

GitHub compare confirmó que `c4ebc2f` está un commit por delante de `84e531d` y solo cambia README.md. La referencia local origin/main estaba desactualizada. Se verificaron `git log --oneline --decorate --graph --all -n 15`, status y diferencias locales. No se hizo pull sobre el working tree modificado.

Referencias remotas: [commit operativo](https://github.com/CarlosAM03/saas-platform-backend/commit/84e531dd6427229b0ddaad310602d96a1cf807e9), [commit documental](https://github.com/CarlosAM03/saas-platform-backend/commit/c4ebc2f3258bdfc4e7523aa638fa0ce5ae3729c0).

## 5. Fuentes revisadas

Jerarquía aplicada: ADR-004 → registro F4 → Prisma/migraciones alineados → OpenAPI/Swagger alineados → código/tests alineados → documentación anterior reconciliada → planes/handoffs/auditorías históricas.

Fuentes principales: `Docs/ADRs/ADR-001-DecisionesDeDominioMVP.md`, ADR-002, ADR-003, ADR-004; `Docs/DocsTeam/FormularioDeDecisiones/FormularioDecisionesFase4.md`; los cuatro análisis F1–F4; ambos YAML de Contracts, su README y API_V1_AUDIT; README raíz y MODULE-DEVELOPMENT; los cinco READMEs de módulos; `PlanDeImplementacionFase4.md`, `HandoffDeepSeekFase4.md`, `BaseLine-0-0-1.md` y `Fase4-Cierre-Final.md`.

Implementación: `src/common/**`, `src/auth/**`, `src/users/**`, módulos raíz/Prisma/preparados, `Prisma/schema.prisma`, migración SQL y migration_lock, seed, package.json, configuración de tests/lint y suites de test. Se comprobó `.env` únicamente para ejecutar operaciones locales sin copiar sus valores. `.env` no está versionado.

## 6. Plan F4 vs implementación

El plan está disponible ahora en `Docs/Auditorias/PlanDeImplementacionFase4.md`. Clasificación: **external execution artifact / executed / not required inside repo for F4 closure**. Sus prompts conservan intención histórica; precisiones finales del ADR prevalecen.

| Bloque | Solicitado por el plan | Implementado y ubicación | Evidencia | Estado | Observación |
| --- | --- | --- | --- | --- | --- |
| 1 Bootstrap/config | Nest, scripts, env, prefijo, seguridad | main.ts, AppModule, common/config, package.json | Build, arranque real, CORS/Helmet, 12 pruebas de config | RESOLVED local | El prompt enumeraba 3 críticas; ADR exige las 11. Se validan las 11 y JWT 8h. |
| 2 Prisma/modelo | Singleton, modelo F4, seed | src/prisma; Prisma/schema.prisma, migrations, seed.ts | validate/generate/status, drift vacío, checksum, seed doble | RESOLVED local | ADMIN sin tenant; no se crea tenant ficticio. |
| 3 Common | Contexto, guards, wrappers, logging | common/context, guards, filters, interceptors | E2E real ALS, concurrencia, requestId en errores | RESOLVED local | Middleware abre alcance; solo AuthGuard establece contexto autenticado. |
| 4 Auth | Login, logout, me, selección, JWT | auth/controller/service/strategy/dto | HTTP ADMIN/tenant, 200, HS256/8h, snapshot | RESOLVED local | me no renueva JWT; mantiene contrato devolviendo el token presentado. |
| 5 Users | CRUD, roles, membership, default MEMBER | users/controller/service/dto/services | CRUD PostgreSQL y E2E, 403/404, soft delete | RESOLVED local | roleId opcional/default MEMBER está expresamente en bloque 5; no se inventó para justificar un bug. |
| 6 Módulos vacíos | Cinco módulos registrados | tenants, campaigns, prospects, prospecting-jobs, prospector-client; AppModule | Inspección de archivos y arranque | RESOLVED | READMEs locales conservados por excepción. |
| 7 Health | Públicos, readiness DB | HealthController → HealthService → PrismaService | Tres endpoints 200; SELECT 1 real | RESOLVED local | Prospector externo no condiciona readiness F4. |
| 8 Pruebas | Auth, roles, aislamiento, rate limit | test/platform.e2e-spec.ts, tenant-context, unitarios y scripts locales | 13 unitarios y 17 E2E aprobados | RESOLVED local | Fake Prisma permitido; AsyncLocalStorage no se sustituye. |
| 9 Documentación | README, guía, handoff | README, MODULE-DEVELOPMENT, ADRs, registro, auditorías | Enlaces, jerarquía, trazabilidad temporal | RESOLVED local | Publicación y rotación quedan pendientes operativos. |

## 7. Handoff DeepSeek vs estado actual

| Punto del handoff DeepSeek | Estado reportado por DeepSeek | Estado actual verificado | Resultado | Evidencia |
| --- | --- | --- | --- | --- |
| /auth/me | 500 | 200 con ADMIN y tenant; multi-tenant sin selección también permitido | RESOLVED | HTTP real y E2E; contexto por request. |
| /users | 500 | 200 con tenant válido; 403 explícito para ADMIN sin selección | RESOLVED | HTTP PostgreSQL; ya no falla con 500 por contexto ausente. |
| E2E body.data | Fallaban | Wrapper aplicado; 17 tests pasan con ALS real | RESOLVED | Suite platform y tenant-context. |
| Login 201 | 201 | 200 | RESOLVED | HttpCode y HTTP real. |
| Logout 201 | 201 | 200 y data {} | RESOLVED | HTTP + aserción exacta de EmptySuccess. |
| LegacyRouteConverter | Warning por /api/v1/* | Ausente en arranques capturados | RESOLVED | Rutas middleware nombradas `{*path}`; logs comprobados. |
| Swagger /api/docs | Disponible | 200, YAML cargado y servidor relativo | RESOLVED | Ambas modalidades de arranque y análisis del YAML. |
| DB local | Existía | PostgreSQL accesible | RESOLVED | Readiness y consultas Prisma reales. |
| Migración | Aplicada | Una migración finalizada, checksum coincidente y sin drift | RESOLVED | status, diff datasource/schema, script DB. |
| Seed ADMIN | Ejecutado | ADMIN activo, coste 12, cero memberships, repetición sin cambios | RESOLVED | Snapshot antes/después y hash sin cambios. |
| Authorization/JWT en logs | Contexto aportado reporta exposición previa | Tokens/headers sensibles no aparecen en captura actual | RESOLVED | Serializer excluye req/res; checks de secretos y tokens emitidos. |

El handoff también contenía credenciales literales y recomendaciones de omitir pruebas; quedó sanitizado e identificado como histórico. No se adoptó su calificación de 500 como “no bloqueante”.

## 8. ADR-004 vs repo

| Tema ADR-004 | Decisión F4 | Código | Contrato | Docs | Tests | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| Jerarquía | F4 gobierna | Correcciones conformes | OpenAPI reconciliado | §4 corregida | Trazabilidad de esta auditoría | Alineado local |
| Config | 11 variables requeridas | Validación al cargar ConfigModule | No expone secretos | §11 y README | Cada variable ausente/blank; puerto y 8h | Alineado local |
| Roles | ADMIN global, OWNER/MEMBER tenant | Strategy/guards/services | AuthUser + RoleName | ADR001/002/003/004 | ADMIN sin membership y CRUD por tenant | Alineado local |
| Modelo | User.platformRole, UserTenant.roleId | Prisma vigente | DTOs separados | Registro consolidado | DB/migración/seed | Alineado |
| Snapshot | No UserTenant por request | Usuario activo + JWT validado | HS256/8h | F3 superseded | Cambio de rol no altera token anterior | Alineado local |
| Contexto | ALS aislado por request | Scope middleware; AuthGuard una escritura | tenant actual nullable | Guía actualizada | 20 requests concurrentes | Alineado local |
| Tenant isolation | WHERE tenant autenticado | Users + RoleService | Datos tenant-scoped | Guía | Acceso cruzado 404; memberships limitadas | Alineado local |
| Wrappers | success/data, meta opcional; error string | Interceptor/filter | Claves duplicadas eliminadas, EmptySuccess | Contracts README | HTTP validado contra esquemas relevantes | Alineado local |
| Seguridad | bcrypt12, 5/60/IP, Helmet/CORS | Implementado | Auth documentado | Credenciales sanitizadas | Login/rate limit/headers/hash | Rotación pendiente |
| Acceso Prisma | Services, no Controllers | Health separado en Service | Sin cambio funcional | §13 | Readiness + build | Alineado local |
| Alcance | Esqueletos F5+ | Cinco módulos registrados | Contratos objetivo diferenciados | Excepciones explícitas | Bootstrap | Alineado |

## 9. Registro F4 vs repo

El formulario conserva respuestas históricas y estados parciales. Se agregó una consolidación vigente que los identifica como superseded por las decisiones cerradas del ADR; no se convirtieron en nuevas preguntas humanas. Se documentaron @nestjs/config, 11 variables, ALS, aislamiento explícito, modelo de roles, snapshot, Swagger y las tres excepciones autorizadas.

La precisión roleId/default MEMBER tiene evidencia del plan ejecutado y ahora está consolidada en ADR-004 §45 y registro. ADMIN puede operar globalmente en Auth sin tenant; Users administra datos del tenant seleccionado y responde 403 si falta esa selección. No se creó un listado global de usuarios ni se relajó el filtro tenant para evitar el 500.

## 10. OpenAPI/Swagger vs comportamiento real

Los paths incluyen `/api/v1`; Swagger usa servidor `/` para respetar el puerto/origen actual. La validación local compara respuestas con los esquemas relevantes: required, type, allOf, enum, pattern y EmptySuccess. No se presenta este chequeo como certificación exhaustiva de todo OpenAPI ni como implementación de los endpoints futuros.

| Endpoint | OpenAPI | Swagger | Código | Resultado local | Estado |
| --- | --- | --- | --- | --- | --- |
| GET health/live/ready | 200; ready 503 si DB no disponible | YAML compartido | Públicos; DB vía Service | Los tres 200 con PostgreSQL | Conforme |
| POST auth/login | 200/400/401/429 | YAML compartido | HS256/8h, 5/60/IP | 200 válido; 401 inválido; 429 en E2E | Conforme |
| POST auth/logout | 200 EmptySuccess/401 | YAML compartido | Stateless, data {} | 200 exacto | Conforme |
| POST auth/select-tenant | 200/400/401/403/404 | YAML compartido | Membership activa o ADMIN | 200 válido; 403 ajeno; 404 inexistente ADMIN | Conforme |
| GET auth/me | 200/401 | AuthUser/AuthTenant separados | No reemite token | 200 ADMIN/tenant; 401 sin token | Conforme |
| GET users | 200 paginado/400/401/403 | Filtros documentados | Tenant explícito, search/sort/page/limit | 200 con filtros; 401 inválido; 403 sin selección | Conforme |
| POST users | 201/400/401/403/409 | Default MEMBER documentado | Alta transaccional + bcrypt12 | 201 con MEMBER; 400 inválido; 403 por rol en E2E | Conforme |
| GET users/{id} | 200/401/404 | YAML compartido | Filtra tenant | 200 propio; 404 ajeno | Conforme |
| PATCH users/{id} | 200/400/401/403/404/409 | Campos opcionales, no null | Rechaza cuerpo vacío/null inválido | 200 actualización | Conforme |
| DELETE users/{id} | 200 EmptySuccess/401/403/404 | Solo desactivación | ADMIN + status INACTIVO | 200; OWNER 403; registro conservado | Conforme |
| GET /api/docs | UI fuera del prefijo API | HTML Swagger | Carga YAML estático | 200 en ambos modos | Conforme |
| Tenants/Campaigns/Prospects/Jobs | Objetivo F5+ | Aviso de alcance en contrato | Solo módulos preparados | No se declara implementación | Fuera de F4 |

Correcciones principales: duplicados data/meta, nullable currentTenantId, AuthUser/AuthTenant distintos de User/Tenant completos, Health, 403 de selección y listado, rate-limit 429, EmptySuccess y soft delete. Ambos YAML parsean y todas sus referencias internas resuelven (Platform 242; Prospector 33 al momento de la comprobación).

## 11. Prisma/migración/seed

La carpeta versionada es `Prisma/`. package.json ahora declara `prisma.schema = Prisma/schema.prisma` y seed usa la misma capitalización, evitando depender de Windows case-insensitive.

`prisma validate` y `generate` completaron; cliente generado 5.22.0. `migrate status` confirma una migración aplicada. `migrate diff --from-schema-datasource Prisma/schema.prisma --to-schema-datamodel Prisma/schema.prisma --exit-code` devuelve “No difference detected”. El intento inicial de diff desde migrations pidió shadow DB; se sustituyó por comparación con la DB real y verificación de checksum, sin crear ni resetear bases.

`scripts/f4-database-validation.cjs` ejecutó seed dos veces y verificó:

| Invariante | Antes | Después |
| --- | --- | --- |
| Usuarios | 1 | 1 |
| Tenants | 0 | 0 |
| Roles | 0 | 0 |
| Memberships | 0 | 0 |
| ADMIN | Activo/global | Activo/global |
| Hash | bcrypt coste 12 | Mismo hash, coste 12 |

La única migración está finalizada, no revertida; checksum SHA-256 del SQL coincide con `_prisma_migrations`. Schema y SQL tienen RoleName OWNER/MEMBER, UserTenant.roleId FK y User.platformRole; no User.roleId ni system tenant. El seed ahora rechaza un registro preexistente que no sea ADMIN activo, en lugar de informar engañosamente que ya hay un administrador.

Fixtures HTTP: dos tenants, roles y usuarios únicos por ejecución; usuario adicional creado mediante la API. Se retiraron por IDs exactos. No se incorporaron al seed ni se eliminaron datos originales.

## 12. Tests/build/lint/start/start:dev

| Verificación | Resultado |
| --- | --- |
| npm test -- --runInBand | 2 suites, 13 tests aprobados |
| npm run test:e2e -- --runInBand --silent | 3 suites, 17 tests aprobados |
| npm run lint | Aprobado sobre src/apps/libs/test; sin desactivar reglas para ocultar problemas |
| npm run build | Aprobado |
| Format | Prettier ejecutado sobre src/test; comprobación posterior |
| Prisma validate/generate/status | Aprobados; schema/cliente/DB coherentes |
| Seed repetido | Aprobado con snapshots e invariantes |
| start | Arranque nuevo, HTTP real y cierre del proceso de prueba |
| start:dev | Modo watch, HTTP real y cierre del proceso de prueba |
| OpenAPI | Ambos YAML parseados, refs locales resueltas; respuestas críticas contrastadas |

El npm del PATH tenía un shim roto. Se ejecutaron los scripts reales con `node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" ...`. El harness local invoca los mismos comandos Nest de start/start:dev en puertos 31341/31342 para evitar interferir con 3000. No se probó despliegue productivo.

Iteraciones: (1) retirar fake TenantContext reprodujo 3 fallos de 12; (2) scope ALS real restauró 12/12; (3) pruebas adicionales llegaron a 17/17, incluyendo concurrencia, snapshot, ADMIN, multi-tenant, EmptySuccess y spoofing de IP; (4) lint detectó tipado inseguro en fake Prisma y respuestas HTTP, corregido sin silenciar reglas; (5) build detectó import type requerido, corregido; (6) HTTP real en ambos modos verificó contratos y logs.

En las primeras ejecuciones, el sandbox impidió terminar procesos hijo. Se identificaron los listeners de prueba y se cerraron con permiso de ejecución elevado; las pasadas finales comprueban que el puerto esté libre para no reutilizar un servidor anterior. No se terminó un servidor ajeno a la validación.

## 13. Seguridad/logging

JWT limita explícitamente firma/verificación a HS256 y valida forma/coherencia de claims; el estado activo se consulta por identidad sin reconstruir membership. me no extiende la sesión. ADMIN conserva tenantRole null incluso al seleccionar tenant. PasswordService utiliza bcrypt coste 12; DTOs exigen longitud 10, letra, número y carácter especial con Unicode.

Rate limiting usa req.ip sin confiar en X-Forwarded-For arbitrario; cinco intentos por 60s en memoria. No hay Redis ni bloqueo de cuenta. CORS se configura por env; Helmet se verifica por headers. Los serializers excluyen req/res y los logs operativos usan plantillas de ruta, evitando cuerpos, headers y query strings. Capturas verificadas contra valores sensibles locales y tokens generados, sin guardar esos secretos en el informe.

El requestId existe antes de guards; errores 401/403 tienen header. ResponseInterceptor emite data {} para resultados vacíos. El filtro devuelve message string y oculta mensajes internos 5xx. No se habilitó doble logging automático de requests; se mantienen eventos de seguridad y finalización/rechazo con propósitos distintos.

**Pendiente operativo de seguridad:** handoff/plan contenían una contraseña ADMIN que coincidía con el entorno local y una credencial PostgreSQL literal en el handoff. Se sanitizaron los documentos y el ejemplo administrativo. No se copian valores. Es necesaria rotación coordinada y revisión de copias compartidas; no se cambiaron contraseñas ni `.env` silenciosamente.

## 14. Documentación

Se corrigió la jerarquía interna ADR-004, las excepciones y la distinción entre decisiones cerradas y software comprobado. ADR-001 dejó de ordenar reconstruir el rol en el Guard; ADR-002 quitó ADMIN de RoleName; ADR-003 reconcilió membership por request/revocación inmediata con snapshot F4. Contracts dejó de presentar expiración/refresh/rate limit como indefinidos.

El registro F4 conserva su historial con consolidación vigente; análisis F1–F4 e informes previos están identificados por su etapa. El plan externo tiene rutas reconciliadas y ejemplos sanitizados. README refleja src/ frente a Prisma/, Swagger y guía enlazada desde raíz. MODULE-DEVELOPMENT documenta scope ALS y pruebas con contexto real. Se conservaron los cinco READMEs locales.

Los textos históricos pueden mencionar errores, 90%, opciones descartadas y antiguas decisiones únicamente como evidencia de su fase. No constituyen estado operativo vigente.

## 15. Excepciones autorizadas

- Cinco READMEs locales conservados: tenants, campaigns, prospects, prospecting-jobs y prospector-client.
- AGENTS/ no es obligatorio ni se creó como requisito artificial.
- Plan externo reconocido como ejecutado; su presencia versionada no condiciona cierre.

## 16. Hallazgos

| ID | Hallazgo | Severidad | Tipo | Estado | Acción |
| --- | --- | --- | --- | --- | --- |
| F4-R01 | ALS enterWith posterior a await no propagaba contexto al resto del pipeline | P0 | Runtime/aislamiento | RESOLVED local | Scope middleware y escritura única en AuthGuard. |
| F4-R02 | E2E sustituía ALS por estado mutable y ocultaba 500 | P1 | Tests | RESOLVED local | ALS real, concurrencia y regresiones. |
| F4-R03 | YAML con data/meta duplicados y proyecciones Auth incorrectas | P1 | Contrato | RESOLVED local | Esquemas corregidos y validados. |
| F4-R04 | ADMIN sin selección producía 500 en Users | P1 | Runtime | RESOLVED local | 403 explícito; selección previa documentada. |
| F4-R05 | me renovaba token y rechazaba usuarios sin selección | P1 | Auth | RESOLVED local | Auth-only; retorna token presentado. |
| F4-R06 | Firma/verificación no restringidas explícitamente a HS256 | P1 | Seguridad | RESOLVED local | Algoritmo/claims/lifetime explícitos. |
| F4-R07 | X-Forwarded-For permitía variar contador de rate limit | P1 | Seguridad | RESOLVED local | req.ip y prueba de evasión. |
| F4-R08 | Listado podía exponer memberships de otro tenant; filtros ignorados/rechazados | P1 | Datos/API | RESOLVED local | Proyección limitada, search/sort/paginación DTO. |
| F4-R09 | RequestId ausente en rechazo de guards; riesgo de datos sensibles en logs | P1 | Logging | RESOLVED local | Middleware, serializers y plantillas de ruta. |
| F4-R10 | Lint completo fallaba por tipado inseguro en tests | P1 | Calidad | RESOLVED local | Fake tipado y límite HTTP tipado; no reglas silenciadas. |
| F4-R11 | Jerarquía y decisiones históricas aún contradictorias | P2 | Docs | RESOLVED local | Reconciliación F4 y marcas temporales. |
| F4-R12 | Reporte previo certificaba más de lo demostrado | P1 | Auditoría | RESOLVED | Superseded; resultados reproducidos aquí. |
| F4-R13 | Credenciales operativas en handoff/plan | P1 | Seguridad operacional | SANITIZED / ROTATION PENDING | Carlos debe coordinar rotación y revisar copias. |
| F4-R14 | GitHub no contiene las correcciones locales | P1 | Entrega | PENDING PUBLICATION | Integrar commit remoto documental y publicar cambios revisados. |
| F4-R15 | Capitalización Prisma/ dependía de Windows | P2 | Portabilidad | RESOLVED local | package.json schema explícito y seed con ruta correcta. |
| F4-R16 | HealthController accedía a Prisma directamente | P2 | Convenciones | RESOLVED local | HealthService encapsula readiness. |
| F4-R17 | Seed aceptaba cualquier cuenta preexistente como ADMIN | P1 | Bootstrap | RESOLVED local | Comprueba ADMIN activo; no eleva permisos silenciosamente. |

## 17. Correcciones aplicadas

Implementadas y revisadas en Common, Auth, Users, Health, DTOs, seed, package.json, contrato Platform, pruebas, README/guía y documentos de gobierno/históricos. Se añadieron `request-context.middleware.ts`, `health.service.ts`, `configuration.spec.ts` y scripts reproducibles `f4-local-validation.cjs` / `f4-database-validation.cjs`.

Se mantuvieron las correcciones anteriores que sí respondían a F4 (por ejemplo HttpCode 200), y se corrigieron defectos que persistían o introducidos por aquella intervención. No se modificaron schema ni migración para justificar comportamiento; no hubo reset de DB ni borrado físico por Users API.

## 18. Pendientes reales

1. **Rotación coordinada de credenciales expuestas.** Afecta PostgreSQL, `.env` y acceso ADMIN. Requiere definir/proteger nuevos valores y coordinar consumidores; sanitizar documentación no prueba revocación. Esta auditoría no cambia accesos del usuario ni afirma que las copias previas hayan desaparecido.
2. **Publicación del working tree reconciliado.** GitHub main sigue en c4ebc2f; las correcciones locales no están allí. No se hizo commit/push. Al publicar, incorporar conscientemente el único commit remoto adicional y preservar los documentos aportados por Carlos.

No se presentan como pendientes F4: AGENTS, versionado obligatorio del plan externo, eliminación de READMEs, Redis/RLS/refresh tokens ni integración funcional Prospector. Las limitaciones iniciales de herramientas locales se resolvieron mediante comandos equivalentes y permisos de limpieza; PostgreSQL y los endpoints sí se verificaron.

## 19. Apéndice — Cierre de Fase 4 como línea base

Posterior a la auditoría profunda, las correcciones fueron publicadas y consolidadas en la rama `dev`, utilizada como rama formal de integración previa a `main`.

Con este estado, la Fase 4 puede considerarse cerrada como **línea base técnica y documental del Platform Backend**.

Este cierre no significa que exista todavía un entorno productivo definitivo ni que las credenciales actuales deban considerarse valores finales. Las credenciales locales y de desarrollo deberán rotarse antes de cualquier despliegue productivo o entorno real compartido.

El cierre de Fase 4 significa que el backend cuenta con una base suficiente, alineada y verificable para continuar con el desarrollo funcional e integración del sistema.

La línea base incluye:

* estructura NestJS modular;
* configuración transversal;
* Prisma y PostgreSQL;
* migración inicial;
* seed administrativo;
* Common Module;
* Auth Module;
* Users Module;
* Health checks;
* Tenant Context con AsyncLocalStorage;
* guards de autenticación y autorización;
* response/error wrappers;
* logging con redacción de datos sensibles;
* contrato OpenAPI/Swagger;
* pruebas unitarias, E2E y scripts de validación;
* documentación normativa reconciliada con ADR-004 y registro F4.

A partir de este punto, Ángel puede comenzar trabajo sobre el frontend Flutter y la integración contra el Platform Backend, tomando como referencia:

* `README.md`;
* `MODULE-DEVELOPMENT.md`;
* `Docs/ADRs/ADR-004-CommonBaseline.md`;
* `Docs/DocsTeam/FormularioDeDecisiones/FormularioDecisionesFase4.md`;
* `Docs/Contracts/platform-api.v1.yaml`;
* Swagger en `/api/docs`;
* los endpoints implementados de Auth, Users y Health.


## 20. Veredicto actualizado

**F4 CLOSED AS BASELINE / READY FOR FUNCTIONAL DEVELOPMENT**

La Fase 4 queda cerrada como baseline técnico y documental. Las credenciales locales utilizadas durante desarrollo no se consideran valores productivos ni definitivos; deberán rotarse antes de cualquier entorno compartido, staging o producción.
