# G4 — Inicio de validación del candidato

- Fecha: `2026-11-22T20:28:24-08:00`.
- HEAD: `e2bc9275836b642ac3e2b6086c4c15062b4dcd89`.
- Rama: `feat/sprint-campana-prospector`.
- Último cambio de código/pruebas previo: `1aa592490e3c5f40e75b8314155f01f104640740`.
- Alcance autorizado en conversación: commit de agentes y comienzo de validación, revisión y preparación de entrega. No autoriza push, merge, deploy, migraciones remotas ni aceptación del owner.

## Commit de configuración separado

`e2bc927` incorpora 16 archivos de OpenCode: ocho agentes, seis skills, `AGENTS.md` y `opencode.json`. No modifica código funcional, infraestructura productiva ni migraciones. Se preservaron las definiciones locales existentes; no se certifica aquí la eficacia de cada permiso de OpenCode en tiempo de ejecución.

| ID | Gate | Fecha ISO | HEAD | Comando | Dataset/fixture | Esperado | Observado | Estado | Evidencia | Limitaciones |
|---|---|---|---|---|---|---|---|---|---|---|
| INTEGRIDAD-PREVIA | G4 | 2026-11-22T20:28:24-08:00 | `1aa592490e3c5f40e75b8314155f01f104640740` | `node codex/sprint-campanas-prospectos/herramientas/verificar-integridad.mjs` | manifiesto original del arnés | cero anomalías | 27 archivos; cero anomalías | PASS | salida del integrador antes del commit de configuración | comprueba integridad, no funcionalidad; el manifiesto no se modificó |
| CONFIG-JSON | G4 | 2026-11-22T20:28:24-08:00 | `1aa592490e3c5f40e75b8314155f01f104640740` + configuración local luego incorporada en `e2bc927` | `node -e` con `JSON.parse` y `fs.existsSync` de cada entrada de `instructions` | `opencode.json` e instrucciones locales | JSON válido y archivos existentes | JSON e instrucciones OK | PASS | salida del integrador | no valida el esquema completo ni permisos efectivos de OpenCode |
| ARBOL-POST-COMMIT | G4 | 2026-11-22T20:28:24-08:00 | `e2bc9275836b642ac3e2b6086c4c15062b4dcd89` | `git status --short` | checkout del sprint | árbol limpio tras commit | sin salida | PASS | salida del integrador | corresponde al instante anterior a registrar esta evidencia |

## Trabajos asignados

- QA independiente: build, unitarias, HTTP y PostgreSQL 16 desechable; evidencia exclusiva `REGRESION_E2BC927.md`.
- Revisión independiente: dominio, roles/tenant, historial y migraciones; sin escrituras.
- Contratos: auditoría de paridad, evidencia exclusiva `CONTRATO_E2BC927.md`.
- Datos: preparación de medición sintética de rendimiento fuera del checkout hasta sincronizar con QA. No ejecutar dos suites contra la misma base al mismo tiempo.

Estos trabajos están pendientes de resultado en este registro: no se les atribuye PASS. G4 continúa abierto; G5 provisional; G6 pendiente del owner.

## Entorno y atribución

Host observado: Windows, Node `v22.14.0`, npm `10.9.2`; `package.json` declara Node `20.x`. La diferencia se registra como limitación de la validación host, no se cambia configuración para ocultarla. Los resultados de PostgreSQL deben registrar la versión efectiva del contenedor.

Las regresiones históricas de `71ef72d` no se trasladan al HEAD actual. El test agregado en `1aa5924` usa reloj simulado para el TTL: no se describirá como espera real de quince minutos. El SPEC exige conservar TTL/replay; la suficiencia de cobertura se revisa contra sus aserciones, sin inventar un requisito de espera real.
