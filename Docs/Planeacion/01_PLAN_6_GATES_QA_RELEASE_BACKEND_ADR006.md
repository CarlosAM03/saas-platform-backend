# PROSPECTOR SaaS — Plan operativo de 6 gates: Backend ADR-006, QA, release y validación

**Identificador:** AV2-BE-ADR006-GATES-2026-10-28  
**Fecha de corte:** 28 de octubre de 2026 (Tijuana)  
**Estado:** plan de trabajo listo para revisión/ejecución; **ningún gate productivo se declara completado mediante este documento**.  
**Autoridad de aprobación, Supabase y despliegue:** owner técnico.  
**Ejecutor delegado:** Codex en Backend, bajo las restricciones de este plan.  
**Trabajo paralelo:** Ángel prepara Flutter de ADR-006 de forma independiente.  
**PR de recepción:** [Backend PR #10](https://github.com/CarlosAM03/saas-platform-backend/pull/10) — `feat/tenant-register` → `main`.  
**Snapshot verificado:** `main@b51b265f1a545fa915f1dd1c57ef2f5858ec6492`, PR HEAD `ca1e7c9d55d4cad73430801140593b58cb7c413b`, Flutter `main@e752f6ca692d2840263cd9e59e0927c56aa129ec`. **Verificar SHA otra vez al iniciar**, pues pueden cambiar.

## 0. Resultado objetivo y alcance

Aprobar mediante evidencia reproducible la **extensión de registro ADMIN → Tenant → primer OWNER → correo con enlace → canje → contraseña → login**, conservando **sin regresiones** el Core V1.0.0 que opera en Vercel/Render/Supabase. Promover primero Backend compatible a `main`/Render con feature flag OFF; comprobarlo en producción; recibir luego el PR Flutter de Ángel; verificar paridad 1:1; habilitar finalmente el flujo extendido solo bajo autorización del owner.

**Cobertura Core a conservar:** login/logout, AuthContext, JWT y selección de tenants; ADMIN/OWNER/MEMBER; Users y SEC-01, campañas, prospectos, importación CSV, dashboard, historial de Jobs, 503 de Jobs no implementados, aislamiento y paginación. **No implementar** pagos, cuotas MEMBER, invitación por correo de MEMBER, vinculación de email existente, Prospector Service ni OAuth como parte del PR ADR-006.

**Fuentes vinculantes:** `Docs/ADRs/ADR-006-TenantRegistration-APROBADO.md`; `Docs/Contracts/platform-api.tenant-registration.approved.yaml`; ADR-003/004; `Docs/Avance2/CORE_V1_VALIDATION.md`; contrato y Swagger *implementado* del Backend `main`; revisión técnica PR #10; `02_REGISTRO_BR_DECISIONES_Y_PENDIENTES.md` de este paquete. **La autorización comercial de un solo OWNER por tenant y OWNER sin facultad de asignar OWNER es decisión expresa del owner**. Nunca cambiar silenciosamente un contrato aprobado: conflicto → documento de decisión y escalamiento.

### Indicadores de gates

`PASS`: evidencia realmente ejecutada y satisfactoria; `FAIL`: ejecución fallida; `BLOCKED`: no puede acreditarse por un impedimento; `NOT RUN`: no ejecutado. No declarar `PASS` sobre simulaciones o reportes de otra revisión. Todo reporte debe indicar entorno, rama, SHA, DB objetivo, fecha, comando y log sanitizado.

| Gate | Objetivo | GO requerido | Salida |
|---|---|---|---|
| **G1** | Corregir PR y QA integral **local** | Código y regresiones locales verificadas | Commit(s) feature, matriz, CI y hallazgos |
| **G2** | Respaldo, restauración y compatibilidad **con datos reales** en copia aislada | Owner certifica respaldo y restaurabilidad | Preflight y ensayo de migración sin tocar producción |
| **G3** | Promover Backend seguro a `main` → Render, flag OFF | Owner aprueba migración productiva y merge | Release/backend compatible, migración aplicada y rastreable |
| **G4** | Smoke Backend desplegado: Core + nueva API controlada | Owner valida regresión productiva | Dictamen Backend listo para integración UI |
| **G5** | Revisar y integrar Flutter de Ángel 1:1 | Owner aprueba PR Flutter y pruebas cruzadas | Dos `main` compatibles y Flutter desplegado |
| **G6** | Habilitación de registro, smoke final y decisión de presentación | GO final owner | Alcance extendido validado o fallback Core V1 |

## 1. Condiciones transversales de seguridad — sin excepciones implícitas

1. **No introducir secretos en chat, instrucciones Codex, código, screenshots, commits, PRs o logs.** Las cadenas de conexión, claves SMTP/API y JWT van en secretos locales/gestor autorizado. No publicar una URL completa que incluya usuario/contraseña.
2. **Codex no accede a la BD productiva antes de G2 y del GO escrito del owner.** El acceso inicial productivo será mediante credenciales **read-only de alcance mínimo**; preferir consultas sobre una copia/restauración cuando baste. El rol productor de migraciones no se instala en un `.env` compartido con aplicación local.
3. **Prohibido ejecutar tests de escritura, `seed`, `prisma migrate`, `prisma db push`, `reset`, SQL DDL/DML o arranque de la API con `DATABASE_URL` apuntando a Supabase producción durante G1/G2.** Nunca confiar en que un comando de pruebas es solo lectura sin inspeccionarlo.
4. **Primero respaldo validado y restauración ensayada** en PostgreSQL 16 aislado. Una copia respaldada sin haber probado su restauración no es suficiente para autorizar migración productiva.
5. Evitar copiar datos productivos a Git, artefactos de CI, Docker images o servicios de terceros. Restauración en equipo/instancia privada autorizada y segura, acceso mínimo, retención limitada; anonimizar lo que corresponda. Eliminar copias y credenciales temporales conforme a plan de retención, sin borrar evidencia de que se verificaron.
6. El Backend actual continúa siendo autoridad para Flutter: el PR conserva las 33 operaciones Core y agrega cinco. Jobs no se habilitan por esta extensión. Los nuevos endpoints de registro/reenvío permanecen `503` sin escrituras cuando flag OFF; recuperar cuentas ya pendientes debe seguir siendo posible.
7. **La rama Flutter de Ángel no se mezcla con Backend.** No fusionar PR #6 experimental (Prospector Service), ni tomar `dev` como base accidental.
8. Render y Vercel despliegan automáticamente desde `main` según la configuración confirmada por el owner. Un merge **es un despliegue potencial**, no una prueba inocua.

## 2. G1 — Checkout del PR, corrección y QA completo en local

**Responsable operativo:** Codex. **No requiere Supabase producción**. **Entrada:** PR #10 y este documento; copia local PostgreSQL de ensayo o base Docker vacía. **Salida:** PR actualizado, sin BR críticos abiertos, resultados locales completos.

### 2.1 Verificación Git y checkout seguro

- Inspeccionar repo, `git status --porcelain=v1`, worktrees, rama actual, `origin`, árbol sin comitear, submódulos (si existen), toolchain Node 20 y `DATABASE_URL` **sin imprimir el valor**.
- `git fetch origin --prune` y verificar `origin/main`, `origin/feat/tenant-register`, merge base y SHA. **No forzar reset** ni eliminar worktrees. Si checkout tiene cambios de Ángel/u otra persona, conservarlos y crear worktree separado.
- Entrar en copia limpia de `feat/tenant-register` con `git switch`/`git worktree` sin sobrescribir nada. Comprobar que parte de `main@b51b265` (o documentar cualquier cambio). No usar `dev`.
- Aplicar correcciones **en rama del PR**, con commits puntuales y sin `push --force`. Antes de cada push, `git fetch`, validar que el remoto no avanzó inesperadamente; si hay divergencia, detener y coordinar en vez de pisar trabajo ajeno.
- **Codex puede preparar commits y realizar un push ordinario únicamente a la rama autorizada**, sin merge, rebase destructivo, configuración productiva ni despliegue.

### 2.2 Reproducir escenario productivo local sin apuntar a producción

- Levantar Backend y PostgreSQL 16 en Docker **aislado**, con migraciones antiguas + nueva migración, un conjunto de datos de prueba representativo y la configuración funcional de Render reproducida sin reutilizar secretos productivos.
- Corroborar `NODE_ENV`, versión Node, CORS, `PORT`, reverse proxy simulado, flag OFF, URLs, timeout, conexión TLS y condiciones de arranque. No asumir que `Dockerfile` aplica migraciones automáticamente: inspeccionar cadena real de despliegue.
- Reproducir regresiones conocidas del Core (incluido error de listado Users ACME, registrado como incidencia **separada**: revisar payload API/membresía/serialización; no atribuir automáticamente al ADR-006). Nunca usar `platformRole = NULL` como prueba de ausencia de membresía: verificar `user_tenants.role_id`.
- Verificar compatibilidad del contrato: 33 operaciones previas; cinco nuevas; login normal mantiene AuthContext; Swagger refleja feature flag y disponibilidad real.

### 2.3 Correcciones obligatorias conforme al registro BR

- **BR-01:** definir el runbook de secuencia migración → deploy Render con auto-deploy; sin escribir migraciones automáticamente en cada inicio del proceso.
- **BR-02:** resolver transporte de envío compatible con el **plan efectivo** de Render; si es Free, SMTP 25/465/587 está bloqueado. Evaluar Brevo HTTPS API sin costos y sin cambio de esquema externo; tests de estados, rechazos, cuota, timeout, no logging.
- **BR-03:** imponer ADMIN-only para asignar OWNER en POST/PATCH, no más de un OWNER por tenant comercial operativo; evitar desactivación global indebida desde OWNER; pruebas negativas, concurrentes y de no-mutatación.
- **BR-04:** verificar IP real y proxy confiable en Render con una política segura, sin confiar indiscriminadamente en `X-Forwarded-For`; tests antiabuso y de no evasión.
- **BR-05 a BR-07:** registrar requisitos provider/mail; reconciliar evidencia QA CI vs local; retirar ambigüedades documentales sin borrar fuentes históricas aprobadas.

### 2.4 Matriz de QA local mínima — ejecutar, no simular

| ID | Escenario | Evidencia obligatoria |
|---|---|---|
| CORE-01 | Login y `/auth/me` ADMIN, OWNER y MEMBER, sesión válida/vencida | HTTP/claims y resultado UI-cliente si aplica |
| CORE-02 | Selección de tenant A→B, rechazo tenant ajeno | HTTP y aislamiento posterior |
| CORE-03 | Users GET/list, POST, PATCH diferencial, creación de MEMBER, duplicados | HTTP, SQL y relectura |
| CORE-04 | SEC-01: identidad compartida/global y actor incorrecto | 403/404 y **cero mutaciones** |
| CORE-05 | Roles: ADMIN asigna primer OWNER; OWNER jamás asigna OWNER | POST/PATCH negativo, SQL y concurrencia |
| CORE-06 | Campañas: CRUD, estados, permisos y persistencia | HTTP, DB, relectura |
| CORE-07 | Prospectos: CRUD, tenantId, asociación campaña y nullable | HTTP, DB, relectura |
| CORE-08 | CSV: preview, CREATE/SKIP/LINK_EXISTING/UPDATE_EXISTING, conflictos | HTTP, SQL/rollback, duplicados |
| CORE-09 | Dashboard y Jobs read-only; mutaciones Jobs 503 | Respuestas reales y disponibilidad |
| CORE-10 | Paginación, ordenamiento, HTTP 400/401/403/404/409/413/429/503 | Matriz de status y payload |
| REG-01 | ADMIN (incluso sin tenant) registra nuevo tenant+OWNER | 201, tenant+roles+UserTenant+onboarding+attempt en BD |
| REG-02 | USER/MEMBER/OWNER no autorizado, self-register, body no permitido | 401/403/400, cero escrituras |
| REG-03 | Email/slug duplicado, normalización case-insensitive, simultaneidad | 409, rollback completo |
| REG-04 | Flag OFF: registro/reenvío 503 sin mutación; recuperación disponible | HTTP y SQL |
| REG-05 | Correo: aceptado, rechazado, timeout, error proveedor, cuota; postcommit | Estados ACCEPTED/FAILED/UNKNOWN y persistencia |
| REG-06 | Link 24h, consumido una vez, generación vieja, reenvío | 401/200 y estado/hash/TTL SQL |
| REG-07 | Canje → desafío máximo 15m, expira antes del link | Token opaco, acción, tiempo de BD |
| REG-08 | Completar contraseña: Unicode, byte 72 máximo, bcrypt, no auto-login | 400/200, nuevo hash, flag false, LOGIN_REQUIRED |
| REG-09 | Protección contra bypass login/JWT/Users con pending=true | 401/403, sin sesión ni cambios de contraseña |
| REG-10 | Doble canje/completado/reenvío y carrera completado↔reenvío | Un solo ganador, estado consistente |
| REG-11 | Límite envío 1/min y 5/h, restart, lease expirado | 429/UNKNOWN, DB persistent |
| REG-12 | Antiabuso IP+credencial y proxied requests | 429 medido sin confiar en encabezado arbitrario |
| REG-13 | OpenAPI y Swagger real vs DTO, cinco rutas y Core | 38 operaciones cuando corresponda; no Swagger ficticio |
| OPS-01 | Cold start, reconexión DB, health/ready, CORS y logs sanitizados | Logs y HTTP, sin secretos |

**G1 exige:** `npm ci`, `npm run prisma:generate`, `npm run build`, `npm run lint:check`, `npm run format:check`, `npm run test:unit:ci`, `npm run test:e2e:ci`, `npm run test:postgres`, Docker build, comprobación `npm audit`, migración sobre base disposable y E2E HTTP real. Reusar `.github/workflows/ci.yml`; CI verde sobre **SHA final** y no sobre un commit anterior. Tests de email real usan buzón/transporte aislado controlado, no proveedor de producción hasta GO.

**Criterio STOP G1:** P0/P1 de seguridad sin resolver, tests fallidos, contrato modificado sin aprobación, OpenAPI/documentación inconsistente, CI fallido, secretos encontrados o cambio fuera de scope. **GO owner a G2** tras entrega de informe técnico.

## 3. G2 — Respaldo verificable y ensayo con datos históricos (Supabase)

**Owner:** administra backup y accesos. **Codex:** prepara diagnósticos, ejecuta *solo* sobre réplica/restauración autorizada; producción, como máximo lectura restringida posterior al GO. Ninguna conexión productiva es necesaria para completar G1.

### 3.1 Respaldo y restauración: condición previa inviolable

1. Identificar proyecto/instancia y tipo de respaldo disponible; registrar fecha UTC, retención, versión PostgreSQL, alcance del respaldo, objetos incluidos (schemas, funciones, triggers, índices, policies, secuencias), control de acceso y expiración.
2. Guardar backup en destino privado cifrado con checksum/identificador; revisar permisos; capturar evidencia sanitizada sin revelar datos de clientes.
3. **Restaurar** a una base aislada y verificar integridad: tablas existentes, conteos por tenant, `users`, `user_tenants`, `roles`, `campaigns`, `prospects`, `prospecting_jobs`, FKs, funciones, extensiones aplicables y `_prisma_migrations`. El respaldo debe ser restaurable, no solo descargable.
4. Catalogar datos vigentes y tomar snapshot lógico con SHA/fecha; valores observados anteriormente (por ejemplo 185/207 prospectos en capturas) son **referencias de UI**, no expectativas rígidas para datos que siguen cambiando.
5. Solo al obtener **GO explícito del owner** se podrá configurar un rol SQL productivo **de solo lectura** para inspección puntual; preferir queries sobre la copia. Nunca poner una credencial de propietario/Supabase service role en el entorno donde Codex lanza la aplicación o tests.

### 3.2 Ensayo de compatibilidad y migración en copia

- Reproducir base histórica con los esquemas y datos existentes; ejecutar `Prisma/audit-email.sql` y detectar colisiones por normalización sin filtrar correos. Si hay colisiones, detener: resolución humana, sin fusionar/cambiar cuentas automáticamente.
- Ensayar `prisma migrate deploy` **solo en la copia**, registrando orden de migraciones y `migration.sql`; no usar `db push` o `migrate dev` contra producción. Asegurar función/index/trigger `canonical_user_email`, `must_change_password=false` para históricos, nuevos modelos y FK; medir locks/tiempo e impacto de la migración.
- Ejecutar Core regresión sobre copia migrada, incluyendo **usuarios preexistentes con roles y membresías múltiples**, campañas/prospectos/CSV y tenant switching. Comparar conteos/registros antes y después; SQL afirmaciones en base aislada.
- Ensayar alta+primer acceso completo, fallos y concurrencia; limpiar exclusivamente fixtures marcados del ensayo. Nunca ejecutar esta suite contra Supabase producción.
- Evaluar tanto **viejo Backend contra esquema ampliado** (breve ventana de migración) como **nuevo Backend contra esquema ampliado**; exigir compatibilidad de los dos para despliegue automático ordenado. Evaluar comportamiento de correos normalizados frente al login antiguo.
- Documentar rollback de **código** y estrategia forward-fix **sin eliminar** tablas, índices, usuarios o registros de onboarding.

**G2 GO:** backup **y restore** satisfactorios, colisiones resueltas o inexistentes, migración y core sobre copia real aprobados, compatibilidad antigua/nueva controlada, plan de release y credenciales segregadas. **No equivale a permiso para migrar producción**: ese es un GO adicional en G3.

## 4. G3 — Preflight, migración productiva autorizada, merge y auto-deploy Render (flag OFF)

**Acciones reservadas al owner o a operador autorizado explícitamente por él.** Preparación documental/diagnóstico por Codex; no ejecuta write sobre producción sin nuevo mandato, incluso si ya recibió un URL de lectura.

1. Confirmar `main` Backend y HEAD PR nuevos, CI de último SHA, plan de rollback, servicio/plan real de Render, estado de Render y persistencia de Supabase. Verificar la ruta actual del deploy (Dockerfile, comandos de build/start, predeploy y migraciones de plataforma).
2. Confirmar backup reciente **con restauración probada**, ausencia de colisiones, ventana para el lock `users` (migración usa `ACCESS EXCLUSIVE`), capacidad de detener/limitar tráfico si fuese necesario y expectativas de disponibilidad.
3. Ejecutar migración productiva de forma **manual/controlada, exactamente una vez mediante `prisma migrate deploy`**, con rol SQL autorizado temporal y desde entorno restringido; validar la tabla `_prisma_migrations`, columnas/índices y continuidad del Core antiguo mientras aún opera.
4. **Solo entonces** el owner fusiona PR #10 a `main`. Auto-deploy de Render inicia; confirmar SHAs, logs, health, ready, CORS y que el nuevo proceso ve el esquema correcto. **Si el despliegue ocurre antes de la migración, detener promoción/tráfico y aplicar plan de contención; no tratarlo como smoke rutinario.**
5. Mantener flag `TENANT_REGISTRATION_ENABLED=false` y probar que altas/reenvíos responden 503 sin escrituras; no habilitar correo real ni crear owners pendientes durante esta fase. La lectura de onboarding y la recuperación de tokens previos debe seguir operativa.
6. Reconocer que la normalización histórica de email modifica datos en SQL: no es una migración puramente de metadatos, aunque preserve IDs, hashes y membresías. Vigilar errores de login y discrepancias antes/después.

**G3 GO:** versión/backend y esquema reconciliados, CI SHA correcto, deployment exitoso, flag OFF confirmado, Core aún accesible; rollback de código seguro documentado. **NO** promover si una migración no fue aplicada. No ejecutar `reset` ni revertir migración destructivamente como respuesta rápida.

## 5. G4 — Smoke productivo de Backend: regresión y onboarding por API

**Dos subniveles distintos:** uno obligatorio sin escrituras, otro funcional con condiciones específicas.

**G4-A obligatorio — Backend flag OFF (sin writes):**
- `/api/v1/health`, readiness, Swagger `/api/docs-json` y versión real; verificar 33 Core + cinco rutas documentadas, con registro/reenvío deshabilitados.
- Login autorizado con cuentas de prueba existentes, `GET /auth/me`, tenant switch, GET Users/Tenants/Campaigns/Prospects/Jobs; verificar 401/403 tenant ajeno, estado y CORS de Vercel; no guardar JWT ni respuestas con PII.
- Registro `POST /tenants/register`: solo probar 503 sin mutación con cuenta ADMIN de ensayo y body sintético **si el owner autoriza esta operación de control**; verificar no aparece tenant nuevo. Nunca enviar payload que pueda convertirse en alta por error de flag.
- Correlacionar el SHA efectivo de Render y fuente CI con logs o deployment metadata. Verificar cero regresiones críticas del Core; el incidente Users ACME debe comprobarse y clasificarse antes del cierre, sin compartir datos.

**G4-B nuevo onboarding API funcional, antes de Flutter — alternativa segura preferida:**
- Ejecutar E2E API→Backend→PostgreSQL más transporte HTTPS sobre **staging/restauración aislada**, con flag ON y buzón de ensayo. Se obtiene evidencia del alta, token, desafío, contraseña y login normal **sin usar el frontend nuevo**. No confundirse con un E2E de UI.
- **Piloto en producción opcional, nunca automático:** si el owner exige ver correo real del Backend desplegado antes de integrar Flutter, dar un GO separado para activar temporalmente el flag, usar únicamente una cuenta ADMIN y tenant de prueba autorizados, comprobar el flujo por API con tokens del buzón de ensayo y volver a OFF. Se crearán registros reales en Supabase; documentar retención/retiro autorizado. La desactivación no revierte lo escrito; nunca exponer credenciales/tokens ni hacer limpieza indiscriminada.
- Si no se autoriza el piloto, **G4-A puede aprobar el Backend compatible** mientras G4-B continúa acreditado en staging; el nuevo flujo no se declara «validado en producción» antes de G6.

**G4 GO:** Core remoto sin regresiones de severidad alta/bloqueante, trazabilidad de SHA, nueva API probada en entorno aislado y estado remoto indicado fielmente. Si falla Users ACME, el cierre global **no** debe declararse 100% estable sin corregirlo o excluir explícita y justificadamente el módulo afectado (presentación restringida).

## 6. G5 — Recepción del frontend de Ángel, paridad 1:1 y promoción Vercel

- Recibir PR Flutter basado en `main` estabilizado; documentar SHA, diff, CI, contratos y controles de seguridad; no fusionar ramas de Service.
- Auditar pantalla administrativa de registro, estatus de onboarding, reenvío, ruta pública `/#/activate?code=...`, limpieza temprana del secreto del fragmento, canje/contraseña sin JWT, login normal, manejo de expiración y accesibilidad/errores.
- Comprobar que Flutter no guarda token en localStorage, analytics, URLs históricas, logs ni capturas; los errores siguen un formato útil y no filtran detalles sensibles.
- Repetir E2E **UI Flutter real → PlatformApi/Dio → NestJS → Prisma → PostgreSQL** en un stack local aislado, seguido de recarga y consulta SQL; casos positivos y negativos y Core sin regresión, incluidos todos los roles.
- Backend versión candidata primero; cliente compatible después. Autorizar y fusionar PR Flutter solo cuando la integración local esté acreditada; verificar auto-deploy a Vercel y SHA real. **Mantener feature flag OFF mientras se prepara la activación**.
- La validación de UI de un onboarding real con flag OFF es imposible; ejecutar los flujos en staging/local con flag ON antes del merge, y el smoke productivo de activación en G6.

**G5 GO:** dos `main` compatibles, cliente Vercel desplegado y verificable; 1:1 con el Backend publicado; E2E integral local aprobado; ADR-006 aún protegido por flag OFF en producción.

## 7. G6 — Activación controlada, smoke de release y decisión de alcance de Avance 2

**Solo con GO expreso del owner, respaldo disponible y preparación operativa completada.**

1. Confirmar remitente/dominio/API de correo (no solamente respuesta de aceptación HTTP), cuota gratuita sin auto-cobro, secretos y URL HTTPS exacta de Flutter; test de envío real con buzón sintético.
2. Cambiar `TENANT_REGISTRATION_ENABLED=true` mediante mecanismo autorizado de Render y registrar timestamp/redeploy, revisar health; confirmar que no se publican secretos en logs.
3. E2E productivo controlado: ADMIN global registra tenant sintético, SMTP/API → buzón autorizado → Flutter `/#/activate` → canje 24h/15min → elección contraseña → login OWNER → selección tenant → permisos y acceso solo a datos propios.
4. Verificar estado onboarding `COMPLETED`, entrega reconocida como `ACCEPTED` (no equivalente a bandeja recibida), User `mustChangePassword=false`, membresía OWNER, aislamiento y que cuentas antiguas siguen funcionando. No hacer consultas destructivas ni exponer tokens en evidencia.
5. Smoke de regresión de Core en Render+Vercel tras habilitar flag: users, campañas, prospectos, import CSV solo si hay datos sintéticos autorizados, dashboard, Jobs y tenant switch. Correlacionar SHAs y estado de Render/Vercel.
6. Con evidencia de QA y aprobación owner, optar: **Escenario A** presentar Core V1.0.0 estable con límites explícitos; **Escenario B** presentar Core + ADR-006 si todos los controles del nuevo flujo y Core cumplen. No anunciar invitación MEMBER ni pago si no se implementaron.
7. Cerrar evidencia de release con checklist y fallos residuales. Reporte final incluye `PASS/FAIL/BLOCKED/NOT RUN` por gate, SHAs, fechas, backup id/sanitizado, cambios DB, resultados de smoke, acciones de reversión.

**G6 GO final:** ningún P0/P1 aplicable abierto, identidad desplegada verificada, E2E producción real satisfactorio, consentimiento owner para estado «estable y funcional». De lo contrario feature OFF y fallback de presentación al Core, sin borrar cuentas pendientes.

## 8. Contención y rollback según momento de falla

| Momento | Estrategia permitida | Prohibición/precaución |
|---|---|---|
| **G1/G2** | Corregir rama o descartar entorno de pruebas; restaurar copia | No restaurar producción para solucionar un laboratorio |
| **G3 pre-merge** | Detener merge; mantener Backend actual sobre esquema migrado **solo si compatibilidad vieja→esquema nuevo está ensayada** | No deshacer índice/columnas sin evaluación ni usar `db push` |
| **G3/G4 postmerge, sin cuentas pendientes** | Feature OFF; redeploy previo solo tras comprobar migraciones y compatibilidad | Desplegar SHA anterior no deshace automáticamente migración SQL |
| **G4/G5 con pendientes creados** | Flag OFF para nuevas altas/reenvíos; mantener canje/completado y hotfix compatible | **No** rollback ciego a Backend sin `mustChangePassword` ni eliminar credenciales |
| **G6 tras activación** | Desactivar nuevas altas, recuperar con release compatible, documentar sesiones/cuentas pendientes, forward-fix | No restaurar una copia anterior de Supabase borrando actividad posterior ni borrar tenant de prueba sin autorización |

**RPO/RTO:** no fijarlos ficticiamente; el owner debe documentar los tiempos verificables de restauración y tolerancia de interrupción según la capacidad real de Supabase y Render.

## 9. Evidencia y handoff exigidos a Codex

- `BASELINE.md`: status/worktrees, rama, PR, SHA, Node/Docker/Prisma, sin secretos.
- `DIFF_AUDIT.md`: mapa de 55 archivos, cambios de Auth/Users/Prisma/OpenAPI/SMTP/guards, BR correlacionados y decisiones.
- `REGRESSION_MATRIX.md`: Core y ADR-006 con método/entorno/SHA/resultado.
- `MIGRATION_PREFLIGHT.md`: SQL read-only, colisiones, plan lock/datos, riesgos, respaldo y restauración con IDs sanitizados.
- `DB_RESTORED_REHEARSAL.md`: pruebas sobre copia real, comparativa pre/post, índices/roles, reproducibilidad.
- `CI_RELEASE.md`: comandos, salidas sanitizadas y checks del HEAD final.
- `BACKEND_RENDER_SMOKE.md`: exclusivo tras autorización del owner, estado remoto real, sin datos personales.
- `QA_HANDOFF.md`: resumen de bloqueantes, deuda, decisiones, versión candidata, GO/NO-GO y rollback.

**Ubicación sugerida:** `codex/backend-adr006/evidencias/` dentro del repo Backend **solo si se autoriza añadir ese directorio**; alternativamente dentro de la carpeta de evidencias ya acordada por el owner. Ningún informe debe fingir ejecución futura. Los archivos de acceso privado, dumps, logs sin sanitizar y credenciales permanecen fuera de Git.

## 10. Prompt operativo breve para activar Codex (uso posterior, sin secretos)

> Estás trabajando en `CarlosAM03/saas-platform-backend` con PR #10 (`feat/tenant-register`). Lee íntegros `01_PLAN_6_GATES_QA_RELEASE_BACKEND_ADR006.md` y `02_REGISTRO_BR_DECISIONES_Y_PENDIENTES.md`, ADR-006, el contrato aprobado, ADR-003/004 y las instrucciones reales del repositorio. Inspecciona Git/worktrees, actualiza `origin`, entra con seguridad en la rama del PR; no pierdas trabajo de nadie. Ejecuta **solo G1** autónomamente: diagnóstico, correcciones BR autorizadas y regresión completa local usando PostgreSQL 16 aislado, pruebas CI y evidencias. **No utilices credenciales de producción, ni escribas a Supabase, ni migres producción, ni fusiones PR, ni despliegues**. Cuando G1 esté documentado, entrega SHA, CI, bloqueos y el plan exacto de G2; espera GO para acceder a los siguientes gates. La información sensible llegará por un canal seguro y con permisos mínimos, nunca por este prompt.

## 11. Criterios globales de aceptación y cierre

- Todas las decisiones **confirmadas** del documento BR respetadas en Backend, no únicamente escondidas por Flutter.
- 33 operaciones del Core conservadas y cinco nuevas auditadas con OpenAPI y HTTP.
- Suite local Core+ADR-006+PostgreSQL completa; escenarios negativos y concurrencia; CI SHA final aprobada.
- Copia/restauración de Supabase verificada y migración ensayada; rollback/forward-fix documentado.
- Autorización humana explícita **por gate productivo**, no por proveer la cadena de conexión ni por abrir PR.
- Ningún secreto, enlace de activación o token JWT en Git, Markdown, logs, mensajes o artefactos.
- Estado **estable** solo cuando QA del entorno afectado lo acredita; los componentes no implementados se anuncian como tales.

**Fin del documento 01.**
