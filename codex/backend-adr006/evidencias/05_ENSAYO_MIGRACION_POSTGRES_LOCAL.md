# Ensayo local poblado y reproducibilidad

Fecha: 28/10/2026, America/Tijuana (UTC−07). Ejecutor: Codex, G1 local.
Rama: feat/tenant-register. Baseline: ca1e7c9d55d4cad73430801140593b58cb7c413b.
Implementación: f021f1936d39f3ab3421d300b4d6261a133eb9fb; laboratorio: 3be7e4ed033a79add4183701911936f7a291cd63.
Las corridas previas al commit se hicieron sobre ca1e7c9 + cambios del worktree que quedaron versionados en esos commits; no se atribuyen al baseline intacto. La corrida posterior al commit se identifica en registros-QA.jsonl. Entorno: Docker Linux, Node20.20.2, Prisma5.22.0, PostgreSQL16 desechable. Datos exclusivamente sintéticos; ninguna credencial/URL productiva se utilizó.

Estado del ensayo preparatorio: PASS. G2_REAL_DATA = NOT RUN.

## Recorrido ejecutado

Comando ejecutado desde terminal: ./codex/backend-adr006/lab/Invoke-G1.ps1 -RunId qa1 -HttpsPort 3444. Ejecución completa terminada **21:54:34 UTC /14:54:34 Tijuana**,28/10/2026. Ver registros-laboratorio.jsonl. Esta distinción evita atribuir al reloj local una hora UTC.

El script construyó imágenes Node20, extrajo b51b265 mediante git archive y aplicó init20260909152421_init mediante Prisma Migrate Deploy. Pobló dos tenants, cuatro roles, cinco usuarios y cinco membresías, dos campañas, dos prospectos CSV, dos relaciones campaign_prospects y dos Jobs. Incluye ADMIN global, OWNER/MEMBER, shared A/B, null platformRole, nullable y un email histórico con espacios/mayúsculas.

| Paso | Esperado | Observado | Estado |
| --- | --- | --- | --- |
| Core viejo/esquema original | Login, Users, consultas, escritura y switch A/B | HTTP real,33 operaciones y reader independiente | PASS |
| Snapshot y backup | Conservar hashes/IDs/relaciones | Huellas SHA256 por tabla y pg_dump formato custom dentro del contenedor, sin exportar DB a Git | PASS |
| Auditoría negativa | Detectar emails canónicos coincidentes | Base g1_collision separada; migrate deploy falla y no añade flag/función ni modifica datos | PASS |
| Migración primera vuelta | Esquema expandido y datos conservados | g1_history_1: preflight sin colisiones, dos migraciones terminadas, hashes íntegros | PASS |
| Postflight | Tablas/índice/trigger/defaults/constraints reales | Cinco tablas; índice canónico; dos eventos trigger; defaultfalse/not-null;13 CHECK,7 FK,5 PK,7 UNIQUE en tablas ADR006 | PASS |
| Core viejo/esquema nuevo | Compatibilidad pre-pending | Runtime Core pasa tras restart;33 operaciones | PASS |
| Candidato/esquema nuevo | Core y flagOFF | Runtime candidato pasa,38 operaciones; POST registro503 sin mutación | PASS |
| Restore y segunda vuelta | Reproducir con respaldo local restaurado | pg_restore a g1_history_2, Core antes, migración, integridad y ambos runtimes repetidos | PASS |
| Regresión sobre poblada | Persistencia real y conservación históricos |57 pruebas durante replayqa1; versión final59 repetida sobre g1_history_3 y comprobación de huellas PASS | PASS |
| HTTPS/reverse proxy | TLS verificado, CORS y límites sin confiar headers | Nginx; CA solo proceso; segundo clienteTCP independiente y XFF falso no evita429 | PASS |

Tiempos observados en replayqa1: migración primera vuelta1518ms; segunda1074ms. Un ensayo previo sobre otra restauración observó1297/1832ms. Son tiempos locales del CLI en esta máquina; no son RTO, ventana de locks ni promesa productiva. Se mantuvo una secuencia separada de auditoría/migración/arranque y no se añadieron migraciones a CMD.

## Integridad y fallos

Las huellas comparan todas las columnas históricas, incluido password_hash, timestamps, IDs, estados y relaciones. El comparador omite la nueva columna must_change_password (verificada false) y aplica únicamente la normalización de email aprobada para comparar; por tanto no es una afirmación de que emails históricos permanecieran byte a byte. Los smokes escriben deliberadamente el nombre de un fixture; se toma snapshot antes de cada migración y antes de la suite para que esa escritura no se confunda con pérdida de datos.

El caso de colisión usa la migración original con BEGIN/COMMIT. El journal de Prisma puede registrar el fallo; negocio/esquema permanecen sin cambios parciales. Nunca se marcó éxito ficticio. Bases separadas y tmpfs; no se reutilizaron volúmenes históricos.

Durante construcción del harness se corrigieron una ruta mal escrita de Jobs, la espera de readiness tras restart y un fixture de desafío que no respetaba el CHECK15min. Se reejecutaron los recorridos afectados; no se atribuyen como regresiones del Backend.

## Recursos de revisión

Replayqa1 conserva prospector-g1-qa1-pg, prospector-g1-qa1-tools y proxy HTTPS local3444 activos, etiquetados synthetic. La ejecución manual conserva además prospector-g1-pg con g1_history_2/g1_history_3. Ninguna base contiene ACME real.

Repetición desde raíz: [runbook](../RUNBOOK.md). Para G2 formal: respaldo restaurable certificado del owner, copia privada aislada, auditoría real, verificación de objetos Supabase/versión, permisos segregados y nuevo registro. Nunca usar prepare/seed del laboratorio sobre una copia real. Supabase/Render/Vercel no fueron contactados.
