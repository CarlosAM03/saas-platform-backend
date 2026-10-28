# PROSPECTOR SaaS — Registro de hallazgos BR y decisiones de integración Backend ADR-006

**Identificador:** AV2-BE-ADR006-BR-2026-10-28  
**Corte:** 28 de octubre de 2026, Tijuana.  
**Base revisada:** [`saas-platform-backend` PR #10](https://github.com/CarlosAM03/saas-platform-backend/pull/10), `feat/tenant-register@ca1e7c9d55d4cad73430801140593b58cb7c413b`, frente a `main@b51b265f1a545fa915f1dd1c57ef2f5858ec6492`.  
**CI conocido del PR:** `quality`, `postgres-integration`, `docker-build` aprobados para el SHA revisado. No implica validación de Supabase productivo ni E2E Flutter.  
**Estado del documento:** decisiones **confirmadas** separadas de **recomendaciones técnicas pendientes de aprobación**. No declarar corregido un BR hasta reproducir, probar y revisar su commit.  
**Documento compañero:** [01_PLAN_6_GATES_QA_RELEASE_BACKEND_ADR006.md](./01_PLAN_6_GATES_QA_RELEASE_BACKEND_ADR006.md).

## 1. Convenciones de decisión y severidad

- `CERRADA — PRODUCTO`: mandato explícito del owner/ADR aprobado. La **regla** está decidida, aunque el código todavía no la aplique.
- `CERRADA — PROCEDIMIENTO`: instrucción expresa del owner para este sprint, como respaldo previo y QA local antes de producción.
- `PROPUESTA — NO APROBADA`: criterio técnico recomendado por auditoría, pendiente de confirmación. Codex puede investigar/prototipar dentro del PR, pero no alterar contratos, pagos, arquitectura ni producción como si estuviera autorizado.
- `PENDIENTE — EVIDENCIA`: falta comprobar entorno, desplegado, datos o comportamiento en ejecución.
- `RESUELTO — VERIFICADO`: solo tras corrección en SHA concreto, pruebas y revisión documentada.

**Severidad:** P0 = bloquea promoción por riesgo de indisponibilidad o seguridad; P1 = bloquea declaración de funcionalidad extendida/aceptación del módulo; P2 = deuda documental/operativa sin riesgo bloqueante inmediato. **Que CI esté verde no convierte un P0 en resuelto.**

| ID | Severidad | Hallazgo / naturaleza | Política y decisión | Estado a la fecha | Gate |
|---|---|---|---|---|---|
| **BR-01** | P0 | Migración Prisma vs Render auto-deploy | Respaldo+restore y secuencia controlada antes de merge: **procedimiento cerrado** | Implementación productiva pendiente | G1/G2/G3 |
| **BR-02** | P0 condicional | SMTP 587 no compatible con Render Free | Sin costo y email funcional: **producto cerrado**; transporte HTTPS: **propuesta técnica** | Plan Render y transporte compatibles por validar | G1/G4/G6 |
| **BR-03** | P0 | Privilegios OWNER, unicidad por tenant y baja global | ADMIN asigna OWNER, OWNER crea MEMBER, único OWNER: **producto cerrado** | Enforcement Backend pendiente | G1/G2 |
| **BR-04** | P1 | Rate limit por `req.ip` detrás de proxy | No evasión/no bloqueo grupal: requisito de seguridad; política proxy exacta **pendiente** | IP real Render no verificada | G1/G4 |
| **BR-05** | P1 | Cuenta/remitente/cupo y correo real | Cero gasto, dominio/remitente validados: **producto cerrado**; proveedor exacto **pendiente** | E2E de entrega real pendiente | G1/G4/G6 |
| **BR-06** | P2 | Handoff local desfasado vs CI PostgreSQL | Conservar cronología, conciliar evidencias: **procedimiento propuesto** | Documento por actualizar | G1 |
| **BR-07** | P2 | Contratos/ADRs duplicados y archivo extra | Autoridad ADR-006 aprobado: **cerrada**; limpieza concreta **pendiente** | Estructura documental a reconciliar | G1 |

**Nota:** El incidente **QF-01 — Usuarios ACME: «la respuesta del servidor no coincide con el formato esperado»** es anterior a ADR-006 y **no se imputa al PR #10**. Es un bloqueo de aceptación del Core hasta reproducir/explicar su causa. Se documenta por separado en §10.

## 2. BR-01 — Secuencia segura de migración con despliegue automático

**Severidad P0 · Impacto:** indisponibilidad del login/Core si la API nueva se ejecuta contra un esquema sin `must_change_password`, o bloqueo/mutación inesperada de usuarios históricos.  
**Evidencia en código:** `Prisma/migrations/20261027000100_tenant_registration/migration.sql` agrega `users.must_change_password`, función/trigger e índice de email canónico y tablas nuevas; `AuthService`/`JwtStrategy` consumen nueva columna; `Dockerfile` termina en `node dist/src/main.js` y no aplica `prisma migrate deploy`. **No se conoce desde GitHub si Render define comando externo de predeploy**.

**DECISIONES CERRADAS:**
1. El owner realiza/autoriza **respaldo previo en Supabase** y comprueba que existe una restauración utilizable antes de exponer el Backend nuevo.
2. Codex primero reproduce el escenario y QA local; después ensaya migración y regresión sobre una **copia de base con registros reales**.
3. Una conexión local a la base productiva **no autoriza escrituras**. Inicialmente: SQL de solo lectura con rol restringido y GO explícito; credenciales de migración productiva aisladas de Codex/testing.
4. `main` de Backend activa auto-deploy en Render. **No hacer merge hasta migración/preflight/producto aprobado**.
5. El rollback no puede eliminar usuarios/registros creados después del backup ni omitir `mustChangePassword` cuando existan pendientes.

**DECISIONES/VERIFICACIONES PENDIENTES:**
- Tipo y prueba de restauración de backup (Supabase backup gestionado/PITR/dump autorizado), ID/checksum y retención. **No asumir disponible un mecanismo que no se haya comprobado**.
- Mecanismo exacto de migración en Render/Supabase, operador, horario, cuánto tiempo toma el lock exclusivo de `users` y cómo se limita tráfico.
- Compatibilidad probada **Backend viejo → esquema migrado** y **Backend nuevo → esquema migrado**; validar normalización de correos históricos también frente al login de código anterior en la ventana entre migración y deploy.
- Política de credenciales efímeras del operador productivo y verificación de `_prisma_migrations`.

**CORRECCIÓN/QA EXIGIDOS:** `Prisma/audit-email.sql` en copia, colisiones case-insensitive, copia/restauración, ensayo `migrate deploy`, conteos e invariantes antes/después, smoke de Core sobre copia, verificación de esquema nuevo y procedimientos para errores de lock. **STOP** ante colisiones no resueltas o copia no restaurable. **Aceptación BR-01:** pruebas G2 aprobadas y ejecución G3 autorizada/documentada.

## 3. BR-02 — Transporte transaccional compatible con Render

**Severidad P0 si Render Free (de otro modo revisar compatibilidad real).**  
**Evidencia en PR:** `src/tenant-registration/welcome-mail.service.ts` usa `nodemailer` y SMTP configurable (`smtp-relay.brevo.com`, puerto 587, STARTTLS en `.env.example`); las pruebas actuales simulan transporte, no un envío real desde Render.  
**Verificación externa:** [Limitaciones de Render Free](https://render.com/docs/free) prohíben egress puertos SMTP 25/465/587; [API HTTPS transaccional Brevo](https://developers.brevo.com/docs/send-a-transactional-email) ofrece `POST https://api.brevo.com/v3/smtp/email` (requiere API key y remitente verificado). No confirma que la cuenta del proyecto esté aprobada ni que el plan/servicio se haya contratado.

**DECISIONES CERRADAS:** proveedor sin cargos automáticos, no pagar sin autorización, enlace opaco, envío después de commit, 15s de timeout, status ACCEPTED/FAILED/UNKNOWN, recuperación manual/reenvío ADMIN, no exponer token ni cuerpo de correo. La aplicación debe operar en el tier real de Render.

**PROPUESTA TÉCNICA PENDIENTE DE APROBACIÓN:** conservar interfaz `WelcomeMailService` y adoptar adaptador HTTP API de Brevo por TLS/443 si Render es Free, sin cambiar endpoints ni esquemas aprobados. Las claves API no se reutilizan como credenciales SMTP y se almacenan en secret manager. Si Render no es Free, evaluar SMTP/HTTPS según pruebas y costos; elegir el transporte por evidencia, no por suposición.

**VERIFICACIONES PENDIENTES:** plan efectivo del servicio Render, opción de API/restricción económica, cuenta y remitente habilitados, tasas/cuota y comportamiento ante errores HTTP/429/5xx, timeout, respuestas aceptadas vs entregadas, certificado TLS y egress HTTPS real. **No asumir que un `202`/`201` del proveedor demuestra bandeja recibida.**

**CORRECCIÓN/QA:** tests por status, redaction de errores, política de cuota cero gasto, simulación de interrupción tras commit, transportes locales mock, un envío controlado real en G6. **Aceptación:** transport compatible en el plan real, pruebas y entrega de email controlado acreditadas.

## 4. BR-03 — Administración OWNER/MEMBER y unicidad

**Severidad P0 · origen de riesgo:** `src/users/users.service.ts` usa `roleId` del DTO en `create` y `update`, validando que exista en el tenant pero sin restringir OWNER para actor OWNER. `Prisma/schema.prisma` usa `Role @@unique([tenantId,name])`, que solo evita roles duplicados en catálogo: **no asegura una única asignación OWNER en `user_tenants`**.

**DECISIONES CERRADAS POR EL OWNER — aplicar de forma obligatoria:**
1. `ADMIN` global es superusuario de plataforma: puede registrar tenant+primer OWNER y administrar asignaciones OWNER bajo reglas del negocio.
2. **Cada tenant comercial operativo tiene exactamente un OWNER**. Los tenants técnicos heredados sin OWNER no deben regularizarse automáticamente mediante este PR; requieren intervención específica. No convertir `POST /tenants` heredado en alta comercial implícita.
3. Un `OWNER` es administrador de su negocio y solo puede **crear/administrar MEMBER**. No debe poder otorgar o transferir OWNER por POST, PATCH ni rutas indirectas.
4. `MEMBER` no administra tenants ni crea usuarios. El Backend impone la autoridad; una selección oculta en Flutter no es control de seguridad.
5. Un `User` global puede tener múltiples membresías y distintos roles por tenant; conservar `UserTenant` y el aislamiento. La vinculación pública de una identidad ya existente es otro trabajo.
6. La **creación convencional de MEMBER** ya disponible en Core debe continuar; **onboarding email de MEMBER** está deseado a futuro, **fuera de ADR-006** salvo contrato adicional aprobado.

**PENDIENTE DE DEFINICIÓN TÉCNICA / AUTORIZACIÓN:**
- Mecanismo que asegure la unicidad bajo carreras (transacción + lock, índice/constraint compatible con esquema o owner-reference explícito), con pruebas reales PostgreSQL; evitar provocar múltiples OWNER o dejar un tenant comercial sin OWNER.
- Flujo de transferencia/reasignación por ADMIN, si se decide incluirlo ahora o diferirlo; no introducir silenciosamente un endpoint nuevo. Restricción negativa debe cubrir degradación del último OWNER.
- Para `PATCH /users`, determinar separación entre estado **global de identidad** y pertenencia local del tenant: bajo SEC-01, OWNER no debería desactivar globalmente una identidad con uso en otros tenants. La política de autorización global ADMIN-only es recomendación de la auditoría, pero la operación exacta requiere cerrar semántica/contrato; no desactivar cuentas ajenas para demostrar un test.
- Tratamiento de tenants existentes con cero OWNER y cuentas actuales si se descubre más de un OWNER histórico: auditoría e intervención humana, no reparación automática.

**CORRECCIÓN/QA:** tests `OWNER POST roleId=OWNER → 403`, `OWNER PATCH roleId=OWNER → 403`, `MEMBER POST/PATCH → 403`, `ADMIN crea un primer OWNER`, `segundo OWNER rechazado`, carrera simultánea con dos solicitudes, rol no perteneciente al tenant, OWNER desactiva identidad compartida → denegación sin mutación. Probar que `POST /users` sin roleId sigue creando MEMBER; `UserTenant` no se duplica y el aislamiento Core continúa intacto. **Aceptación:** enforcement en servicio y PostgreSQL sobre SHA final; política de bajas globales resuelta.

## 5. BR-04 — Identidad IP para antiabuso detrás del proxy

**Severidad P1.**  
**Evidencia:** `src/tenant-registration/activation-rate-limit.guard.ts` usa `req.ip`; `src/main.ts` no define explícitamente `trust proxy`. `ActivationRateLimitService` persiste buckets por IP/credencial. Lo que devuelve `req.ip` en Render **aún no está verificado**.

**REQUISITO CONFIRMADO POR ADR-006:** canje y completado deben tener limitación antiabuso persistente y concurrente; proteger la seguridad sin tratar encabezados inyectados por cliente como verdad.

**PENDIENTE:** configuración de red/proxy específico de Render, trust proxy mínimo seguro, pruebas contra `X-Forwarded-For` falsificado y concurrencia desde diferentes clientes. **No habilitar `trust proxy = true` ciegamente**. Revisar si el rate limit de login actual en memoria requiere deuda separada, sin extender el alcance unilateralmente.

**CORRECCIÓN/QA:** registro temporal solo de metadatos anónimos/sanitizados de la IP resuelta, ensayos de múltiples IPs (sin pruebas de carga sobre producción), cabeceras falsas, rechazo 429 y persistencia tras restart. **Aceptación:** IP confiable y cuotas verificadas en entorno representativo, sin fuga de identificadores sensibles.

## 6. BR-05 — Proveedor real, dominio y cuotas del onboarding

**Severidad P1 para declaración productiva.**  
**Evidencia:** `welcome-mail.service.spec.ts` prueba SMTP simulado (aceptado/rechazo/timeout/HTML); el PR no acredita credenciales, dominio, remitente ni buzon real. `DeliveryService` persiste intento y generación, pero no existe aún E2E real de correo desde Render.

**DECISIONES CERRADAS:** sin facturación automática ni costo, TLS/HTTPS, remitente verificado, SPF/DKIM/DMARC según proveedor, buzón de prueba, 1 envío/min y 5/h por onboarding incluyendo inicial, sin reintentos automáticos por reinicio, `UNKNOWN` para incertidumbre. Activación mediante el propio destinatario; no se envían contraseñas.

**PENDIENTE:** cuenta/proveedor definitivo, cuota visible y control de consumo, estado remitente, DNS validado, política de respuestas y monitoreo, disponibilidad de correo antes de abrir flujo a ADMIN, verificación de recepción en G6, riesgo de retrasos y cola a cuota agotada. Para Brevo Free, la documentación pública menciona 300 envíos/día, pero **se debe verificar la cuenta y sus términos vigentes**: [Brevo Free](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan).

**CORRECCIÓN/QA:** prueba mock con red, timeout/429/5xx, un envío real autorizado a buzón controlado, no logs de token, documentar reenvío manual y cuenta pending. **Aceptación:** evidencia de entrega para prueba controlada y no-cost real, sin usar información de clientes.

## 7. BR-06 — Handoff de QA desactualizado respecto al CI

**Severidad P2 documental.**  
**Evidencia:** `Docs/Avance2/TENANT_REGISTRATION_VALIDATION.md` refleja que en la máquina de Ángel Docker Engine no estaba disponible y que pruebas PostgreSQL no corrieron allí; en el PR `ca1e7c9`, GitHub Actions ejecutó `postgres-integration` exitoso con PostgreSQL 16. La evidencia CI no equivale a migración/backup de Supabase ni a pruebas local UI→DB.

**DECISIÓN PROCEDIMENTAL PROPUESTA:** anexar la ejecución CI posterior con SHA, run ID, suites, resultados y límites; **preservar el relato histórico** de pruebas que inicialmente no fueron posibles. No presentar «test PostgreSQL local de Ángel PASS» si su máquina no los ejecutó.

**PENDIENTE:** actualizar archivo, cotejar resultado de G1/G2 de Codex y agregar informe de ejecución realmente reproducida en el nuevo entorno. **Aceptación:** documento factual, trazabilidad entre pruebas locales, CI, staging y producción.

## 8. BR-07 — Consolidación documental y control de alcance

**Severidad P2 documental.**  
**Evidencia:** PR #10 contiene `Docs/ADRs/ADR-006-TenantRegistration-APROBADO.md`, copia aprobada en `Docs/ADRs/platform-api.tenant-registration.approved.yaml`, otra en `Docs/Contracts/platform-api.tenant-registration.approved.yaml`, propuesta sustituida, ADR histórico y `Docs/examples/update-prospect.csv` ajeno al módulo.

**DECISIÓN CERRADA:** el **ADR-006 aprobado** y su **OpenAPI aprobado** son la autoridad; la propuesta temporal/contraseñas por correo y `oneOf` en login **no** son arquitectura vigente. Conservar las 33 operaciones Core y cinco nuevas, sin alterar `/auth/login` y sin migrar el contrato Jobs de forma inadvertida.

**PENDIENTE:** escoger y documentar ubicación canónica única para cada artefacto, mantener historial referenciado si es necesario, evitar ambigüedad de `Docs/Contracts/README.md` y analizar la eliminación/movimiento del CSV agregado no relacionado; no borrar documentación aprobada sin revisión. **Aceptación:** todas las referencias internas resuelven, no hay duplicado confundible con la autoridad y `git diff --check` sin ruido.

## 9. Registro maestro de decisiones para el owner

| ID de decisión | Tema | Decisión constatada o propuesta | Clasificación | Siguiente validación |
|---|---|---|---|---|
| BE-D01 | Autoridad del release | Owner aprueba merge, migración prod, flag y deploy; Codex hace QA en rama | **CERRADA — PROCEDIMIENTO** | G1/3/6 |
| BE-D02 | Respaldo Supabase | Owner realiza respaldo y exige prueba de restauración antes de conectar/migrar | **CERRADA — PROCEDIMIENTO** | G2 |
| BE-D03 | Acceso DB | Credencial remota solo lectura para diagnosticar; tests/write en copia aislada | **CERRADA como límite seguro de este plan**, acceso concreto pendiente | G2 |
| BE-D04 | Unicidad OWNER | Uno por tenant comercial, ADMIN exclusivo para crearlo/asignarlo | **CERRADA — PRODUCTO** | BR-03 |
| BE-D05 | OWNER y MEMBER | OWNER solo crea/administra MEMBER; MEMBER sin poder de administración | **CERRADA — PRODUCTO** | BR-03 |
| BE-D06 | Core Users heredado | Mantener creación MEMBER con contraseña sin romper contrato V1 | **CERRADA — COMPATIBILIDAD** | G1 |
| BE-D07 | Multi-membership | `UserTenant` soporta pertenencia múltiple; vinculación pública fuera del PR | **CERRADA — ALCANCE** | G1 y post-avance |
| BE-D08 | Primera activación | Link 24 h, challenge 15 min, nueva contraseña, LOGIN_REQUIRED; no password enviada | **CERRADA — ADR-006** | G1/6 |
| BE-D09 | Feature flag | OFF por defecto; canje/complete disponibles para pendientes; ON solo GO owner | **CERRADA — ADR-006** | G3/6 |
| BE-D10 | Correo sin gasto | Proveedor sin facturación automática; cuota/estado verificables | **CERRADA — ADR-006** | G1/5/6 |
| BE-D11 | Transporte HTTP Brevo | Adaptador HTTPS API recomendado si Render Free; no cambio del contrato público | **PROPUESTA — NO APROBADA** | Confirmar plan Render y proveedor |
| BE-D12 | Proxy seguro | Necesario comprobar IP real y cerrar trust proxy configurado | **PENDIENTE — DISEÑO/PRUEBAS** | G1/4 |
| BE-D13 | Desactivación global | OWNER no debe afectar identidades compartidas; semántica global/local exacta | **PENDIENTE — CONTRATO/DOMINIO**, con SEC-01 cerrado | BR-03 |
| BE-D14 | Transferencia OWNER | Operación ADMIN atómica propuesta; sin endpoint nuevo en este PR sin ADR | **PROPUESTA — DIFERIDA** | Post-avance o decisión explícita |
| BE-D15 | Invitación MEMBER por email | Deseada para producto; no forma parte del contrato actual de cinco endpoints | **CERRADA — FUERA DEL PR** | Nuevo ADR/contrato posterior |
| BE-D16 | Datos antiguos | Tenant técnico sin OWNER no se convierte por migración | **CERRADA — ADR-006** | G2 |
| BE-D17 | Migración real | Inspección de Render, audit email, backup/restauración, ensayo, GO para aplicar | **CERRADA — PROCEDIMIENTO; ejecución PENDIENTE** | G2/3 |
| BE-D18 | Auto-deploy | Ambos `main` publican; nunca fusionar para probar hipótesis | **CERRADA — OPERACIÓN** | G3/5 |
| BE-D19 | Piloto API en prod G4 | Solo con aprobación separada; staging por defecto | **PROPUESTA — NO APROBADA** | G4 |
| BE-D20 | Selección presentación | Solo Core V1 si ADR-006 no supera QA; ampliar únicamente con G6 completo | **CERRADA — CRITERIO** | G6 |

**Principio de resolución:** la columna «CERRADA» es una decisión **de negocio/procedimiento**, no estado técnico `RESUELTO`. Un hallazgo BR permanece abierto hasta que el PR efectivamente implementa y se verifica su corrección.

## 10. Incidencia transversal anterior a PR #10: QF-01 — Usuarios ACME

**Origen:** capturas de Vercel realizadas después de integrar Flutter Core PR #10. En ACME, Users mostró «La respuesta del servidor no coincide con el formato esperado»; en Empresa B, el listado mostró un usuario. Otras capturas verifican campañas, prospectos, dashboard, selección tenants, Jobs y perfil; la creación de usuarios se observó persistiendo en Supabase. **No se ha identificado la causa exacta**.

**Importante:** `users.platform_role = NULL` **es esperado** para identidades no ADMIN. La asignación OWNER/MEMBER está en `user_tenants.role_id` y `roles`, no en una columna `users.role_id`. En Flutter el `User.role` sí admite `null`; un registro con JSON distinto en otros campos o relación mal formada podría romper la deserialización de una página, pero eso es hipótesis, no causa demostrada.

**Diagnóstico obligatorio — sin mostrar datos sensibles:**
1. Seleccionar tenant ACME y reproducir la solicitud `GET /api/v1/users` usando cuenta autorizada y compararla con Empresa B (status, sobre `{success,data,meta}`, página/tamaño, tipos, timestamps, `role`, `tenants`, `platformRole`). Nunca imprimir respuesta con PII sin sanitizar.
2. Verificar en copia o con SQL read-only autorizado `users`, `user_tenants`, `roles`, coincidencia de tenant/role y cardinalidad por usuario; comprobar que una membresía no apunta a un role de tenant distinto. No asumir `roleId` null porque `platformRole` es null.
3. Si falla un registro específico, añadir fixture regresivo Flutter/NestJS, corregir en la capa propietaria y repetir listado en los dos tenants y tras cambiar A→B.
4. Cualquier corrección de datos productivos necesita propuesta de reparación, backup/restauración y GO separado; no actualizar roles a ciegas.

**Estatus:** pendiente de reproducción/causa. **Prioridad para aceptación:** alta si se pretende presentar el módulo Users como completamente funcional.

## 11. Registro de ejecución de BR para Codex

Cada BR que se cierre deberá dejar una ficha `BR-XX` con: archivo/línea/commit, prueba de reproducción (antes), causa, decisión owner aplicada, diff mínimo, pruebas negativas/positivas/concurrencia, CI final, QA sobre copia, resultado observado, riesgo residual, link al PR y estado final `RESUELTO — VERIFICADO` o `ABIERTO/BLOCKED`.

**No permitir a Codex atribuirse la ejecución de G2–G6 por completar G1**. El propietario aprueba por etapas y controla los secretos. Ningún token ni cadena de conexión se incluye en evidencias publicables.

## 12. Referencias

- [PR Backend #10](https://github.com/CarlosAM03/saas-platform-backend/pull/10).
- [Prisma migration ADR-006](https://github.com/CarlosAM03/saas-platform-backend/blob/ca1e7c9d55d4cad73430801140593b58cb7c413b/Prisma/migrations/20261027000100_tenant_registration/migration.sql).
- [UsersService en la rama revisada](https://github.com/CarlosAM03/saas-platform-backend/blob/ca1e7c9d55d4cad73430801140593b58cb7c413b/src/users/users.service.ts).
- [CI del PR — GitHub Actions](https://github.com/CarlosAM03/saas-platform-backend/actions/runs/40711778812).
- [Render Free: restricciones SMTP](https://render.com/docs/free).
- [Render: Deploy automático de Web Services](https://render.com/docs/web-services).
- [Brevo: API de correo transaccional](https://developers.brevo.com/docs/send-a-transactional-email).
- [Brevo: límites Free](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan).
- ADR-006, OpenAPI y normativa Backend en el repositorio; documento de auditoría y QA del Avance 2 preparado previamente.

**Fin del documento 02.**
