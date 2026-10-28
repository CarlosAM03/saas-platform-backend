# QA ADR-006

Fecha: 28/10/2026, America/Tijuana (UTC−07). Ejecutor: Codex, G1 local.
Rama: feat/tenant-register. Baseline: ca1e7c9d55d4cad73430801140593b58cb7c413b.
Implementación: f021f1936d39f3ab3421d300b4d6261a133eb9fb; laboratorio: 3be7e4ed033a79add4183701911936f7a291cd63.
Las corridas previas al commit se hicieron sobre ca1e7c9 + cambios del worktree que quedaron versionados en esos commits; no se atribuyen al baseline intacto. La corrida posterior al commit se identifica en registros-QA.jsonl. Entorno: Docker Linux, Node20.20.2, Prisma5.22.0, PostgreSQL16 desechable. Datos exclusivamente sintéticos; ninguna credencial/URL productiva se utilizó.

Comandos: unitarias, test:e2e:ci, test:postgres y qa.cjs. Suites clave: activation.service.spec, delivery.service.spec, welcome-mail.service.spec, tenant-registration.postgres, onboarding-http.postgres, tenant-registration-migration.postgres, proxy-rate-limit.postgres. Base g1_test y copia histórica sintética migrada g1_history_3. No hubo tráfico a Brevo.

| ID | Esperado | Observado / evidencia específica | Resultado |
| --- | --- | --- | --- |
| REG-01 | ADMIN sin tenant crea tenant+primer OWNER atómicos | HTTP real201; dos roles, membresía, flag, enlace hash y attempt persistidos; reader independiente | PASS |
| REG-02 | OWNER/MEMBER/self-register/DTO extra denegados | HTTP401/403/400; alta no muta; ADMIN previo a degradación también403 | PASS |
| REG-03 | Colisión slug/email normalizado, carreras, sin parciales | PostgreSQL concurrente mismo slug/correo: un ganador; fallo tardío inyectado revierte inserts reales | PASS |
| REG-04 | OFF bloquea solo registro/reenvío sin writes | HTTP503 y conteos idénticos; canje/completado con OFF siguen operativos | PASS |
| REG-05 | Fallos externos no deshacen alta; estados correctos y sin secretos | Mock HTTP201/400/429/503, timeout/AbortError y201 inesperado. Tenant/OWNER/attempt persistidos; un solo fetch | PASS |
| REG-06 | Link24h, único, generación anterior revocada | TTL/constraints y hash; canje concurrente un ganador; expirado401 sin consumo; reenvío invalida generación | PASS |
| REG-07 | Challenge≤15min y≤link, único, expiraciónDB | Tests unitarios frontera; HTTP/SQL TTL; challenge vencido401, usuario y consumo intactos | PASS |
| REG-08 | Password Unicode≥10, letra/número/especial,≤72bytes, bcrypt12, sin auto-login | Unitarias fronteras; HTTP>72bytes400 sin consumir; completa LOGIN_REQUIRED, hash verificado y login normal200 | PASS |
| REG-09 | No bypass pending por JWT/login/Users | HTTP login401, JWT pendiente me401, ADMIN seleccionado PATCH credenciales403 | PASS |
| REG-10 | Doble canje/completado/reenvío; carrera complete↔resend | PostgreSQL serialización, un ganador y estado consistente | PASS |
| REG-11 | Un envío/min y cinco/h incl. inicial, lease60s, restart, manual | PostgreSQL intentos persistidos;429, lease UNKNOWN, respuesta tardía no pisa generación nueva | PASS |
| REG-12 | Canje/complete limitados por IP y credencial persistidos | SQL atomicidad/restart; HTTP direct/proxy429; HTTPS segundo cliente independiente | PASS |
| REG-13 | Cinco operaciones aprobadas, Core/login preservados | YAML referencias válidas; verify-contract33→38; Swagger servido por runtimes33/38; mocks no sustituyen persistencia | PASS |

113 unitarias y84 HTTP en corrida final;59 PostgreSQL. Se distinguen: pruebas anteriores de Ángel/ca1e7c9, baseline Codex intacto y regresión específica nueva. Las unitarias de timeout usan reloj simulado para comprobar el límite exacto15s; el caso HTTP/DB de timeout simula el aborto de transporte y acredita conservación transaccional. No se afirma envío o recepción real.

La aceptación real de correo, remitente/dominio, plan efectivo gratuito y cuenta requieren gates posteriores. No se introdujeron pagos, reintentos automáticos, recuperación pública ni invitaciones MEMBER.
