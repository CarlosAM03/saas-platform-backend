# Contrato y paridad con Flutter PR11

Fecha: 28/10/2026, America/Tijuana (UTC−07). Ejecutor: Codex, G1 local.
Rama: feat/tenant-register. Baseline: ca1e7c9d55d4cad73430801140593b58cb7c413b.
Implementación: f021f1936d39f3ab3421d300b4d6261a133eb9fb; laboratorio: 3be7e4ed033a79add4183701911936f7a291cd63.
Las corridas previas al commit se hicieron sobre ca1e7c9 + cambios del worktree que quedaron versionados en esos commits; no se atribuyen al baseline intacto. La corrida posterior al commit se identifica en registros-QA.jsonl. Entorno: Docker Linux, Node20.20.2, Prisma5.22.0, PostgreSQL16 desechable. Datos exclusivamente sintéticos; ninguna credencial/URL productiva se utilizó.

Revisión exclusivamente de lectura del Frontend: [PR11](https://github.com/CarlosAM03/saas-platform-client/pull/11), HEAD9c0e556b64f6ca51db3baaf284096adcde480e9b. Se consultaron tenant_registration_api.dart, tenant_registration_models.dart, models.dart, users_api.dart y json_fields.dart en ese SHA. No se modificó Flutter ni se aprobó su PR/UI.

Backend: verify-contract.cjs y tests de composición/HTTP/runtimes. Resultado:33 operaciones Core preservadas, cinco nuevas, referencias locales válidas; requestBody/security/responses de login iguales al Core aprobado. El texto descriptivo del contrato aprobado añade restricciones pending y no se confunde con cambio del wire shape. Hashes de ADR/contrato canónicos idénticos al PR recibido.

| Método/ruta | DTO esperado | Respuesta efectiva | HTTP | Seguridad/flag | Impacto Flutter / recomendación |
| --- | --- | --- | --- | --- | --- |
| POST /api/v1/tenants/register | tenantName,tenantSlug,ownerName,ownerEmail; body cerrado | wrapper data:{tenant,onboarding}; sin secretos |201;400/401/403/409/503 | ADMIN actual, sin tenant;OFF503 | Modelos/API coinciden; preservar tenant aun cuando deliveryStatus falle |
| GET /api/v1/tenants/{id}/onboarding | id;sin body | TenantOnboarding con10 campos,fechas nullable explícitas |200/401/403/404 | ADMIN;disponible OFF | Parser nullableDate coincide; no omitir claves nullable |
| POST /api/v1/tenants/{id}/resend-welcome | Sin body ni destinatario alterno | TenantOnboarding,misma forma |200/400/401/403/404/409/429/503 | ADMIN actual;OFF503 | API Flutter envía POST sin data; manejar límite e intento activo |
| POST /api/v1/auth/redeem-first-access | activationToken | action CHANGE_PASSWORD_REQUIRED,firstAccessToken,expiresAt |200/400/401/429 | Pública,token en body;disponible OFF | DTO/action coincide; mantener secreto solo memoria y limpiar fragmento según ADR |
| POST /api/v1/auth/complete-first-access | firstAccessToken,newPassword | action LOGIN_REQUIRED,sin accessToken |200/400/401/429 | Pública;disponible OFF | Modelos coinciden; dirigir a login habitual |
| POST /api/v1/auth/login | email,password | AuthContext tradicional |200/400/401/429 | Sin sesión si pending | No oneOf; acceso final verificado por HTTP+DB |
| GET /api/v1/users | Paginación/Core | wrapper lista+meta;platformRole ADMIN o null,role actual y tenants scoped |200/400/401/403 | Tenant requerido | User.fromJson admite platformRole=null; ver QF01 |
| POST/PATCH /api/v1/users | DTO Core;roleId opcional/default MEMBER | UserResponse sin alteración de forma |201/200;403/409 | D2–D4 autoridadDB,OWNER solo MEMBER | UI debe restringir OWNER a ADMIN, manejar409 por segundo OWNER y403 tras degradación. No adaptar contrato silenciosamente |
| Jobs Core | DTOs existentes | Consultas reales y mutaciones503 |200/503 y errores de validación | Aislamiento/JWT Core | Mantener disponibilidad histórica; no anunciar Service habilitado |

Estado de paridad revisada: PASS estático y HTTP Backend para las formas inspeccionadas. UI Flutter real, ruta de activación, historial/storage/analytics y E2E navegador quedan NOT RUN en este carril. Un cambio posterior del HEAD Frontend exige repetir la comparación.

Recomendación de coordinación: usar esta matriz en el code review independiente, probar errores de roles nuevos y flagOFF, y revisar QF01 con payload real anonimizado de la copia G2. No cambiar el contrato aprobado para absorber un error de consumidor.
