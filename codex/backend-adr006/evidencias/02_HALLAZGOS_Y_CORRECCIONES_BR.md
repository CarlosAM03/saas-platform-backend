# Hallazgos BR y correcciones verificadas

Fecha: 28/10/2026, America/Tijuana (UTC−07). Ejecutor: Codex, G1 local.
Rama: feat/tenant-register. Baseline: ca1e7c9d55d4cad73430801140593b58cb7c413b.
Implementación: f021f1936d39f3ab3421d300b4d6261a133eb9fb; laboratorio: 3be7e4ed033a79add4183701911936f7a291cd63.
Las corridas previas al commit se hicieron sobre ca1e7c9 + cambios del worktree que quedaron versionados en esos commits; no se atribuyen al baseline intacto. La corrida posterior al commit se identifica en registros-QA.jsonl. Entorno: Docker Linux, Node20.20.2, Prisma5.22.0, PostgreSQL16 desechable. Datos exclusivamente sintéticos; ninguna credencial/URL productiva se utilizó.

Todos los resultados siguientes heredan entorno/fecha/SHA anteriores. Las pruebas corren contra g1_test y, posteriormente, g1_history_3 poblada; ver registros JSON sanitizados.

| ID | Reproducción/causa | Corrección y decisión | Comando y observado | Resultado G1 / residual |
| --- | --- | --- | --- | --- |
| BR-01 | Runtime nuevo requiere columna; Docker no migra en CMD. Riesgo confirmado por diff, no se afirmó caída productiva | Preflight separado, confirmación host/base/TLS/GO, auditoría de colisiones/OWNER, checksums, migrate deploy y postflight. D9 | Invoke-G1.ps1 y rehearsal migrate sobre dos bases; Core viejo/nuevo pasan, hashes conservados; colisión aborta sin DDL parcial | PASS local. Respaldo real/G2 y migración productiva G3 siguen NOT RUN |
| BR-02 | WelcomeMailService original usa SMTP. Las pruebas SMTP pasaban y no verificaban HTTPS | D1: una solicitud HTTPS/443 fija a Brevo con api-key, TLS verificado, sin redirects/retry. Elimina Nodemailer | Unitarias mock fetch: 201/messageId, 4xx, 429, 5xx, red, respuesta inesperada, timeout total15s, config y HTML. HTTP+DB conserva tenant ante errores | PASS local. Cuenta/remitente/conectividad y buzón reales pendientes |
| BR-03 | Imagen original: OWNER POST OWNER dio201; PATCH200; ADMIN segundo OWNER y carreras aceptados; JWT degradado seguía escribiendo; self compartido/último OWNER vulnerables | D2–D4: checks autoritativos en transacción Serializable, locks actor/membresía, predicado OWNER, retry acotado SSI. Protege identidades compartidas/ADMIN/otros OWNER y último OWNER activo | users-authorization: nueve fallos específicos antes; diez positivos/negativos corregidos después, más CRUD/CSV. Conexión independiente verifica datos. POST/PATCH concurrentes: un ganador y409 | PASS. No transferencias ni invitación MEMBER; escritores SQL administrativos no forman parte de API |
| BR-04 | req.ip sin política explícita detrás del ingress | D5: TRUSTED_PROXY_CIDRS, vacío=false; rechaza true/hops/nombres/0-prefix. Política aplicada en bootstrap | proxy-rate-limit: clientes distintos, peer TCP no confiable, prefijos falsificados,429 y restart PostgreSQL. Nginx HTTPS real: XFF sobrescrito, segundo contenedor con cuota propia | PASS local. IP/ingress real Render requiere G4 |
| BR-05 | Proveedor/cuota reales no certificados; estados podían confundirse con entrega | D6: cero gasto, sin tarjeta/fallback/retry; 4xx/429 FAILED,5xx/timeout UNKNOWN,201 válido ACCEPTED; tenant persiste | onboarding-http: proveedor 400/429/503/timeout/respuesta inesperada; un intento persistido, no rollback del alta, ninguna llamada real | PASS política y simulación. Free/cuenta/DNS/recepción NOT RUN |
| BR-06 | Documento de Ángel decía PostgreSQL local no ejecutado; CI posterior sí lo ejecutó | D7: se preserva texto con nota cronológica, run/shas y evidencias propias separadas | Relectura del run40711778812 y tres jobs; matrices locales nuevas | PASS documental; CI final se documenta aparte |
| BR-07 | YAML duplicado y propuestas sustituidas; CSV anterior fuera del módulo | D7: canonical Docs/Contracts, copia ADR intacta e histórica. Propuesta sin autoridad vigente. README SMTP íntegro archivado por SHA; CSV ajeno preservado | git hashes aprobados idénticos; diff de Prisma/ADRs/contratos canónicos vacío; verify-contract33+5 PASS | PASS; ningún contrato cambiado |

Las expectativas históricas de dos pruebas HTTP y dos PostgreSQL sobre promoción OWNER/snapshot se actualizaron porque D2–D4 las sustituyen expresamente. No se cambiaron para ocultar fallos: antes se ejecutó la suite original completa y después se añadieron nueve reproducciones negativas específicas y relecturas de cero mutaciones.

Correo: [API oficial Brevo](https://developers.brevo.com/reference/send-transac-email), consultada28/10. La implementación considera ACCEPTED solo aceptación de procesamiento. Las credenciales SMTP proporcionadas fuera de esta sesión no se solicitaron ni reutilizaron.

Errores de laboratorio corregidos: ruta Jobs mal escrita en primer harness (404), readiness tras restart y fixture expirado que infringía el CHECK15min. Fueron fallos del harness, no defectos atribuidos al PR. Se corrigieron y repitieron recorridos/suites.

Referencias: [Core](03_MATRIZ_REGRESION_CORE.md), [ADR006](04_MATRIZ_QA_ADR006.md), [runbook](../RUNBOOK.md), [QF01](09_QF01_USUARIOS_ACME.md).
