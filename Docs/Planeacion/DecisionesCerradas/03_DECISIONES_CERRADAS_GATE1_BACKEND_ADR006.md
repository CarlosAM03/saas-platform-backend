# Registro de decisiones cerradas — Gate 1 Backend ADR-006

**Proyecto:** PROSPECTOR SaaS — Segundo Avance  
**Fecha de aprobación:** 28 de octubre de 2026 (America/Tijuana)  
**Estado:** **APROBADO — D1 a D9, alternativa A en todos los casos**  
**Autoridad:** Owner técnico del proyecto  
**Repositorio de ejecución:** `CarlosAM03/saas-platform-backend`  
**Rama objetivo de trabajo:** `feat/tenant-register` — PR Backend #10 hacia `main`  
**Referencia al momento de la decisión:** PR #10, HEAD `ca1e7c9d55d4cad73430801140593b58cb7c413b`; Backend `main` `b51b265f1a545fa915f1dd1c57ef2f5858ec6492`. **Verificar ambos SHA al iniciar; no asumir que siguen vigentes.**  
**Trabajo paralelo:** Flutter PR #11, rama `feat/tenant-register`, revisado por separado; no autoriza cambios Flutter dentro del trabajo Backend.

## 1. Propósito y jerarquía

Este documento formaliza la aprobación expresa del owner de las **nueve recomendaciones A (D1–D9)** formuladas para el **Gate 1 (G1)**. Su finalidad es permitir que Codex continúe el code review, hardening, pruebas y entrega del PR Backend #10 de manera autónoma, mientras el owner prepara por separado el respaldo restaurable de Supabase.

**No sustituye ni modifica** las decisiones D01–D22 de `Docs/ADRs/ADR-006-TenantRegistration-APROBADO.md`, ni el contrato `Docs/Contracts/platform-api.tenant-registration.approved.yaml`. Debe leerse junto con:

1. `01_PLAN_6_GATES_QA_RELEASE_BACKEND_ADR006.md` — criterios, secuencia y gates de integración.
2. `02_REGISTRO_BR_DECISIONES_Y_PENDIENTES.md` — hallazgos BR-01 a BR-07 y sus condiciones de cierre.
3. El ADR-006, contrato aprobado y documentación técnica vigente del Backend.

Los identificadores **D1–D9 de este documento corresponden al cierre de G1** y no deben confundirse con los identificadores D01–D22 del ADR-006. Si aparece un conflicto material con una decisión contractual aprobada o una migración potencialmente incompatible, Codex debe documentarlo y solicitar decisión del owner antes de proceder con ese cambio.

## 2. Registro de preguntas y respuestas aprobadas

### D1 — BR-02: Transporte de correo definitivo

**Decisión:** **APROBADA — Alternativa A.**

**Pregunta:** ¿Qué mecanismo de envío de correo debe utilizar el módulo de activación para funcionar en el hosting objetivo, conservando el contrato ADR-006 y sin generar costos?

**Respuesta definitiva:** Adoptar **Brevo mediante su API HTTPS (puerto 443)** como transporte objetivo, conservando la abstracción `WelcomeMailService`, los endpoints, la semántica de activación y los estados de entrega aprobados. Se puede conservar SMTP únicamente como adaptador de laboratorio si no introduce deuda técnica innecesaria. Codex implementará y probará el adaptador HTTPS con dobles de prueba/mocks, sin claves reales ni envío efectivo durante G1. La conectividad real, cuenta, dominio y remitente se validarán en gates posteriores.

**Aplicación en G1:** Probar aceptación, rechazo, timeout, errores del proveedor y sanitización de respuestas. No modificar el contrato público para acomodar el transporte.

### D2 — BR-03: Unicidad de OWNER por tenant

**Decisión:** **APROBADA — Alternativa A.**

**Pregunta:** ¿Quién puede asignar OWNER y qué garantía debe mantenerse respecto del número de OWNER de cada organización?

**Respuesta definitiva:** El Backend debe garantizar **como máximo un OWNER asignado por tenant comercial**, incluso bajo concurrencia. Solo el **ADMIN global** puede asignar el primer OWNER de un tenant que aún carece de él. Intentar asignar un segundo OWNER debe devolver **HTTP 409**, sin cambios parciales. Un OWNER no puede crear, asignar, degradar ni transferir otro OWNER. **La transferencia de propiedad no forma parte de G1** y requerirá un diseño administrativo posterior. Los tenants históricos sin OWNER se preservan; posibles tenants con múltiples OWNER se reportan sin corrección automática.

**Aplicación en G1:** Autorizar el mecanismo mínimo necesario de integridad transaccional y, si corresponde, restricciones PostgreSQL aditivas compatibles con la migración. Exigir pruebas de `POST /users`, `PATCH /users/{id}`, concurrencia y regresión del Core. No modificar cuentas reales.

### D3 — BR-03: Modificación y desactivación de identidades

**Decisión:** **APROBADA — Alternativa A.**

**Pregunta:** ¿Hasta dónde llega la autoridad de OWNER para modificar o desactivar usuarios sin perjudicar identidades globales compartidas?

**Respuesta definitiva:** Mantener la administración convencional de MEMBER compatible con el Core 1.0.0: OWNER puede modificar o desactivar a un **MEMBER perteneciente exclusivamente a su tenant**, por las operaciones existentes y dentro de sus permisos. OWNER **no** puede modificar globalmente una identidad compartida entre tenants, **aunque sea la suya propia**; tampoco puede modificar o desactivar a otro OWNER o al ADMIN global. ADMIN conserva la administración global, sujeta a la regla de no dejar sin OWNER a un tenant comercial operativo.

**Aplicación en G1:** Fortalecer las comprobaciones en Backend, incluido el camino de `PATCH /users/{id}` y cualquier otra operación equivalente. Conservar SEC-01. No crear `UserTenant.status` ni endpoints de suspensión local nuevos.

### D4 — BR-03: JWT vigente frente a cambios de rol

**Decisión:** **APROBADA — Alternativa A.**

**Pregunta:** ¿Cómo impedir que un JWT emitido antes de una degradación de rol conserve privilegios de administración sin rediseñar la autenticación del Core?

**Respuesta definitiva:** Conservar el **JWT actual de ocho horas y su contrato de claims**, pero añadir una **comprobación puntual y autoritativa de rol/membresía actual en PostgreSQL** al ejecutar operaciones sensibles de administración de usuarios. Las operaciones normales permanecen bajo el modelo JWT ya aprobado. No introducir refresh tokens, revocación general de sesiones ni revalidación en todas las solicitudes.

**Aplicación en G1:** Añadir pruebas de JWT previo a degradación, membresía cambiada y acceso no autorizado, sin modificar el `AuthContext` público. Documentar el alcance exacto de la comprobación localizada.

### D5 — BR-04: Proxy confiable y rate limiting

**Decisión:** **APROBADA — Alternativa A.**

**Pregunta:** ¿Cómo identificar correctamente la IP cliente para límites antiabuso detrás de Render, evitando confiar en cabeceras falsificables?

**Respuesta definitiva:** Codex podrá definir una **configuración explícita y limitada de proxies confiables**, comprobando su funcionamiento mediante pruebas locales de clientes diferenciados y de cabeceras manipuladas. Deben conservarse los límites persistentes de canje y completado aprobados en ADR-006. **No se autoriza `trust proxy=true` indiscriminadamente.** La IP efectiva observada en Render debe acreditarse durante **G4**, no declararse verificada por una simulación local.

**Aplicación en G1:** Pruebas de separación entre clientes, encabezados falsificados y comportamiento de 429; documentar supuestos que requieren confirmación de infraestructura.

### D6 — BR-05: Proveedor gratuito y fallos de entrega

**Decisión:** **APROBADA — Alternativa A.**

**Pregunta:** ¿Cuál es la política económica y de recuperación ante errores del proveedor de correo?

**Respuesta definitiva:** **Cero gasto estricto**: sin contratar planes, registrar tarjeta ni habilitar fallback de pago. Codex probará cuota agotada, rechazo, **HTTP 429**, errores **5xx** y timeout. Un fallo del proveedor **no elimina el tenant ni el OWNER ya creados**; tampoco dispara reintentos automáticos. La aceptación HTTP indica que el proveedor aceptó procesar el mensaje, **no** que llegó al buzón. Cuenta, remitente, dominio, cuota real y recepción se verificarán en gates posteriores. **No entregar todavía claves reales a Codex.**

**Aplicación en G1:** Conservar estados `PENDING`, `SENDING`, `ACCEPTED`, `FAILED` y `UNKNOWN`; probar persistencia de estados, lease, reenvío manual y condiciones de cuota sin tráfico al proveedor real.

### D7 — BR-06 y BR-07: Autoridades documentales y evidencias

**Decisión:** **APROBADA — Alternativa A.**

**Pregunta:** ¿Qué documentos constituyen la fuente contractual definitiva y cómo debe manejar Codex duplicados, propuestas históricas y resultados de QA?

**Respuesta definitiva:** Las fuentes canónicas son:

- `Docs/ADRs/ADR-006-TenantRegistration-APROBADO.md`.
- `Docs/Contracts/platform-api.tenant-registration.approved.yaml`.

Codex **no modificará el contenido de estos documentos aprobados**. Sí puede corregir referencias, declarar explícitamente históricas las propuestas sustituidas, reconciliar documentación operativa y retirar cambios ajenos al alcance del PR cuando se demuestre que no eliminan trabajo de otra persona ni rompen referencias. La evidencia previa de Ángel debe conservarse y completarse con resultados reales locales y de CI, identificados por SHA.

**Aplicación en G1:** Actualizar runbooks, matrices BR, resultados de PostgreSQL y handoff; no convertir `BLOCKED` o `NOT RUN` en `PASS`.

### D8 — QF-01: Error de listado de Usuarios en ACME

**Decisión:** **APROBADA — Alternativa A.**

**Pregunta:** ¿Debe investigarse durante G1 el error de formato observado en el listado Usuarios del tenant ACME, aunque sea anterior al PR ADR-006?

**Respuesta definitiva:** **Sí.** Codex debe investigar y reproducir el problema con datos **sintéticos en PostgreSQL local**, comprobando el JSON de respuesta, las relaciones `User`, `UserTenant` y `Role`, y el contrato de deserialización de Flutter. Si demuestra que la causa está en Backend y puede corregirse sin alterar el contrato, incorporará la corrección y una prueba de regresión en el mismo PR. Si es del Frontend, lo documentará para el code review del PR Flutter #11, sin modificar ese repositorio. Cualquier diagnóstico que requiera registros históricos reales de ACME se reserva para G2, tras restaurar una copia aislada.

**Aplicación en G1:** No equiparar `User.platformRole = NULL` con un `roleId` nulo: son conceptos distintos. No tocar producción ni corregir manualmente los registros.

### D9 — Autonomía, rama y entrega de Codex

**Decisión:** **APROBADA — Alternativa A.**

**Pregunta:** ¿Qué trabajos puede ejecutar Codex por sí mismo durante G1 y cuál es el límite de su autoridad?

**Respuesta definitiva:** Codex puede inspeccionar y **actualizar de forma segura** el checkout del Backend, trabajar sobre `feat/tenant-register`, modificar el código Backend y sus migraciones **aditivas y locales** dentro del alcance, pruebas, dependencias estrictamente justificadas, configuración de laboratorio y documentación; ejecutar QA con PostgreSQL 16 **desechable**, realizar commits organizados, push ordinario y actualizar el **PR #10**, dejando evidencia sanitizada en `codex/backend-adr006/evidencias/`.

Debe completar las verificaciones de G1 y entregar un handoff que distinga `PASS`, `FAIL`, `BLOCKED` y `NOT RUN`. **No está autorizado** a ejecutar G2–G6; modificar Supabase productivo, acceder con credenciales de producción, hacer migraciones remotas, fusionar PRs, desplegar, hacer force push ni sobrescribir trabajo de Ángel. Si existen cambios locales de otra persona, primero debe protegerlos y pedir decisión ante conflictos materiales.

**Aplicación en G1:** El PR debe terminar preparado para revisión, no fusionado. El owner conserva la aprobación de cualquier promoción a `main`.

## 3. Condiciones operativas ya fijadas (no son decisiones nuevas)

- **BR-01:** documentar y probar con PostgreSQL local la secuencia de preflight, migración y arranque. **No ejecutar la migración en Supabase durante G1.** La auditoría de datos reales, la copia restaurada y la autorización para operar la base productiva corresponden a G2/G3.
- **Gates de CI:** `quality`, `postgres-integration` y `docker-build` deben quedar aprobados en el **nuevo HEAD** del PR; cada resultado debe poder asociarse al SHA correspondiente.
- **Regresión del Core:** Auth, Tenants, Users, Campaigns, Prospects, importación CSV, Jobs de consulta/503, aislamiento multi-tenant, SEC-01 y contrato anterior, además de ADR-006. No usar mocks como sustituto de PostgreSQL real para acreditar persistencia.
- **ADR-006:** se conserva el flujo ADMIN → tenant + primer OWNER → enlace de 24 h → desafío de hasta 15 min → contraseña propia → login habitual, con la feature flag desactivada por defecto.
- **Trabajo paralelo:** el PR Backend #10 y el PR Flutter #11 avanzan por carriles independientes. Cualquier propuesta que cambie rutas, DTO, estados, códigos HTTP o semántica contractual aprobada requiere decisión expresa del owner antes de alterar consumidores.
- **Fuera de G1:** invitación de MEMBER por correo, vinculación pública de usuarios existentes a nuevos tenants, planes, cupos, pagos, Prospector Service, cambios destructivos sobre datos y QA productivo.

## 4. Criterio de cierre documental

La aprobación D1–D9 **autoriza implementación y pruebas**, pero no equivale a haber completado G1. Para reportar G1 como cerrado, Codex debe entregar commits, PR actualizado, evidencias de suites realmente ejecutadas, matriz BR-01 a BR-07, diagnóstico QF-01 y resultados por entorno y SHA; además debe señalar de forma expresa lo que permanece sujeto a G2–G6.

**Declaración de aprobación:** El owner técnico confirma: **«Apruebo todas las recomendaciones; D1–D9 quedan aprobadas con la alternativa A»**. No hay excepciones comunicadas a estas nueve decisiones.
