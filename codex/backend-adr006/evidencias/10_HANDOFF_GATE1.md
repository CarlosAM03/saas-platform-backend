# Handoff Gate1 Backend ADR-006

Fecha: 28/10/2026, America/Tijuana (UTC−07). Ejecutor: Codex, G1 local.
Rama: feat/tenant-register. Baseline: ca1e7c9d55d4cad73430801140593b58cb7c413b.
Implementación: f021f1936d39f3ab3421d300b4d6261a133eb9fb; laboratorio: 3be7e4ed033a79add4183701911936f7a291cd63.
Las corridas previas al commit se hicieron sobre ca1e7c9 + cambios del worktree que quedaron versionados en esos commits; no se atribuyen al baseline intacto. La corrida posterior al commit se identifica en registros-QA.jsonl. Entorno: Docker Linux, Node20.20.2, Prisma5.22.0, PostgreSQL16 desechable. Datos exclusivamente sintéticos; ninguna credencial/URL productiva se utilizó.

Dictamen del alcance técnico local: **G1 PASS**, sujeto a comprobar nuevamente los tres jobs del HEAD documental final en PR10 antes de la entrega. El registro final de SHA/run se conserva en [PR10](https://github.com/CarlosAM03/saas-platform-backend/pull/10) y en el cierre del chat; no se extrapola CI de3be7e4e a otro HEAD.

| Gate / alcance | Resultado |
| --- | --- |
| G1 Backend, hardening y QA local | PASS: código, persistencia, seguridad, contrato y procedimiento ejecutados |
| Ensayo local preparatorio G2 con datos sintéticos | PASS: Core poblado, colisiones, dos vueltas,restore,integridad y TLS |
| G2_REAL_DATA | NOT RUN: sin copia real de Supabase ni autorización de ejecución G2 |
| G3–G6 | NOT RUN: sin merge, despliegue, correo real ni habilitación productiva |

## Cambios entregados

Brevo HTTPS/443 mediante WelcomeMailService, configuración validada, timeout15s, sin retries/fallback/gasto ni exposición de errores. Tests de provider/mocks/estados reales en PostgreSQL conservan tenant y OWNER.

Users revalida privilegios actuales dentro de transacción, impide asignaciones OWNER desde OWNER, garantiza un solo OWNER por tenant mediante SSI y protege último OWNER e identidades compartidas. JWT general/AuthContext permanecen sin rediseño.

Proxies confiables explícitos y límites persistentes verificados con peers TCP distintos, headers falsos, restart y proxy Nginx HTTPS real. La IP real Render queda pendienteG4.

Runbook y harness PowerShell completan migración poblada y repetible, sin migrate en arranque ni conexión remota. Autoridades aprobadas, schema y migraciones permanecen intactos. Historia de Ángel preservada.

## Verificación

Baseline intacto:90 unitarias,84HTTP,35PG. Final versionado:113 unitarias +84HTTP +59PG =256 pruebas PASS, además de tipos/build/lint/formato/Prisma/contrato/audits y runtime Docker. No se adjudican correcciones a pruebas que ya pasaban: BR03 tuvo nueve reproducciones FAIL contra el original antes de corregir.

Los ocho conjuntos PostgreSQL también pasan sobre una base histórica sintética restaurada y migrada; hashes posteriores confirman conservación de las ocho tablas Core. Correo exclusivamente simulado, sin claves reales ni envíos.

CI3be7e4e: quality,postgres-integration,docker-build SUCCESS; consultar [08](08_RESULTADOS_CI.md) y la comprobación externa del último HEAD documental. Checkout de entrega feat/tenant-register, commits organizados y push ordinario. La entrega no autoriza merge.

## Límites para la revisión del owner

1. QF01 histórico sigue sin causa demostrada: fixtures válidas no reproducen el error y Flutter admite platformRole=null. G2 necesita copia/payload privado para completar diagnóstico; no afirmar Users productivo100% resuelto.
2. Rollback al Core original está condicionado también por emails normalizados: se verificó que input histórico en mayúsculas cambia a401 en ese código antiguo, aunque la forma canónica funciona. Con pendientes, jamás volver a código que ignore mustChangePassword. Preferir forward-fix si no se acredita la compatibilidad en copia real.
3. Proveedor/cuenta/remitente/DNS/cuota efectiva y recepción requieren G4–G6. Local ACCEPTED no demuestra entrega.
4. Node20 fue requisito del gate y se utilizó; el host sigue en Node22. Ocho LOW transitivas de tooling permanecen documentadas; producción audit0.
5. Flutter PR11 se inspeccionó de lectura en9c0e556; no se modificó, aprobó ni integró UI. Las diferencias de permisos403/409 deben revisarse en su carril.

## Repetición y siguiente paso

Desde VS Code en la raíz Backend:

~~~powershell
./codex/backend-adr006/lab/Invoke-G1.ps1 -RunId revision-owner -HttpsPort 3445
~~~

Elegir RunId/puerto/subnet libres. PostgreSQLtmpfs y proxy quedan activos para revisión; no hay cleanup automático. El script no usa volúmenes previos, secretos ni bases productivas.

El owner puede revisar [BR](02_HALLAZGOS_Y_CORRECCIONES_BR.md), [Core](03_MATRIZ_REGRESION_CORE.md), [ADR006](04_MATRIZ_QA_ADR006.md), [ensayo](05_ENSAYO_MIGRACION_POSTGRES_LOCAL.md), [rollback](06_COMPATIBILIDAD_Y_ROLLBACK.md), [paridad](07_CONTRATO_Y_PARIDAD_FLUTTER.md), [CI](08_RESULTADOS_CI.md) y [QF01](09_QF01_USUARIOS_ACME.md). El [runbook](../RUNBOOK.md) prepara requisitos de respaldo/restore y comandos segregados para la futura operación autorizada.

GO propuesto: revisión técnica de PR10 y preparación de G2 con copia real certificada y restaurable. No ejecutar merge ni G3 antes de ese gate y del GO del owner.
