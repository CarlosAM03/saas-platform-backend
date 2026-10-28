# Compatibilidad y rollback

Fecha: 28/10/2026, America/Tijuana (UTC−07). Ejecutor: Codex, G1 local.
Rama: feat/tenant-register. Baseline: ca1e7c9d55d4cad73430801140593b58cb7c413b.
Implementación: f021f1936d39f3ab3421d300b4d6261a133eb9fb; laboratorio: 3be7e4ed033a79add4183701911936f7a291cd63; ensayos adicionales: 514dca4. Corrida integral final: 5e986cc850dd45e352892bde56d4117cfffebfb3.
Las primeras corridas se hicieron sobre ca1e7c9 + cambios del worktree; el diagnóstico de login se añadió sobre3be7e4e y quedó versionado en514dca4. Las corridas posteriores identifican su SHA en los registros; no se atribuyen al baseline intacto. La corrida posterior al commit se identifica en registros-QA.jsonl. Entorno: Docker Linux, Node20.20.2, Prisma5.22.0, PostgreSQL16 desechable. Datos exclusivamente sintéticos; ninguna credencial/URL productiva se utilizó.

Estado: PASS del ensayo local y del procedimiento condicionado. No es aprobación de rollback productivo.

| Combinación | Comando/evidencia | Esperado y observado | Resultado / límite |
| --- | --- | --- | --- |
| Coreb51b265 + init | rehearsal before, ambos recorridos |33 operaciones,login,consultas,escritura y switch | PASS |
| Coreb51b265 + esquema expandido, sin pending | rehearsal old-after |33 operaciones,credenciales y relaciones conservadas con entrada canónica | PASS condicionado |
| Candidato + expandido | rehearsal candidate y59 PostgreSQL sobre poblada |38 operaciones,Core,flagOFF y onboarding simulado | PASS |
| Core antiguo + cuenta pendiente | Análisis ADR006 y código antiguo | El antiguo ignora mustChangePassword; no puede aprobarse como rollback | BLOCKED por diseño aprobado; no se recomienda |
| Recuperación con pendientes y flagOFF | onboarding-http y tenant-registration.postgres | Canje/complete disponibles; altas/resend503 sin escrituras | PASS |
| Revertir migración o restaurar producción | Fuera de alcance | No ejecutado ni autorizado | NOT RUN |

## Normalización y ventana de compatibilidad

La migración cambia emails históricos a su forma canónica; no es DDL puro. IDs, hashes, membresías y relaciones se conservan. La prueba adicional check-legacy-login.cjs usa otra base g1_case y el runtime original real: el email histórico válido en mayúsculas permite login antes; tras migrate deploy, el mismo input en mayúsculas da401 y su forma canónica minúscula da200. El Core original hace findUnique literal y su LoginRequest no normaliza.

Este resultado es un riesgo real de volver al código antiguo tras normalizar datos; PASS en esa prueba significa que se reprodujo el comportamiento esperado del diagnóstico, no que ambas grafías funcionen. El candidato normaliza login y soporta el correo canónico según ADR006. No se reescribió la migración ni el contrato para ocultar este límite.

Antes del GO G3 el owner debe comprobar en la copia real qué cuentas cambian y si el consumidor remite el email canónico. Si no puede garantizarse, limitar la ventana de código antiguo, mantener el candidato compatible y usar forward-fix; no ofrecer rollback ciego al Core original. No se promete que una forma histórica literal continúe funcionando en un Backend antiguo después de transformar el dato.

## Secuencia segura

Antes de merge: respaldo restaurable real, auditoría, migrate deploy manual, postflight y comprobación del Core que siga en servicio. Mantener flagOFF y no crear cuentas pending durante la ventana. El runtime no migra automáticamente.

Sin pendientes: puede considerarse redeploy anterior solo si G2 acredita esquema y entradas de login canónicas para esa copia. De lo contrario, forward-fix compatible sin deshacer normalización.

Con pendientes: flagOFF bloquea solo nuevas altas/reenvíos. Mantener bloqueo de credenciales y canje/completado. No desplegar b51b265, borrar tablas/usuarios o restaurar un backup que pierda actividad posterior.

Ante fallo de migración: parar promoción, conservar journal y diagnosticar locks/colisiones. Ensayo local mostró rollback atómico del SQL, con posible fila fallida de Prisma. No usar reset, db push ni marcar éxito. [Runbook](../RUNBOOK.md) detalla procedimiento y segregación de comandos locales/productivos.

Residual: G2 con datos reales y G3–G6 NOT RUN; tiempos y comportamiento Supabase reales aún no medidos.
