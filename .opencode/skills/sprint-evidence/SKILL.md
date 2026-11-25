---
name: Sprint Evidence
description: Cómo registrar evidencia del sprint CP por SHA. Formato de tabla, estados PASS/FAIL/BLOCKED/NOT_RUN y redacción de datos sensibles.
---

# Evidencia — sprint CP

Usa español de México y no uses voseo. Aplica esto a todo registro en `codex/sprint-campanas-prospectos/05_EVIDENCIAS/`.

## Estados

| Estado | Cuándo |
|---|---|
| `PASS` | Comando ejecutado en el SHA citado y resultado conforme al esperado |
| `FAIL` | Ejecutado y con resultado distinto al esperado |
| `BLOCKED` | No se puede ejecutar por un bloqueo externo o decisión pendiente |
| `NOT_RUN` | No se ejecutó. **Nunca** se convierte en `PASS` |

Un `PASS` registrado sin evidencia de ejecución es un defecto de proceso: corregilo y avisá.

## Formato de fila

```text
ID | gate | fecha ISO | HEAD | comando | dataset/fixture | esperado | observado | estado | evidencia | limitaciones
```

Ejemplo:

```text
T31 | G4 | 2026-11-22T20:10:00-06:00 | c75ad08c... | docker compose --profile test run --build --rm test-postgres | tenant A/B homónimos | 404 en lectura cruzada | 404 | PASS | test/.../a11n-spec.ts | no cubre CSV
```

## Dónde se registra

- QA: `05_EVIDENCIAS/G4/MATRIZ_QA.md`
- Cobertura por AC: copia de `03_CALIDAD/MATRIZ_AC_Y_TESTS.md`, sin falsear el original
- Decisiones: `05_EVIDENCIAS/decisiones/LOG_DECISIONES.md`
- Escalamientos: `05_EVIDENCIAS/decisiones/SOLICITUDES_OWNER.md`
- Handoff: `05_EVIDENCIAS/G5/HANDOFF.md`

## Redacción

Nunca escribas en evidencias: JWT, tokens, enlaces de activación, API keys, contraseñas, correos de destinatarios reales, nombres de contactos reales, CSV con datos reales o volcados de `docker inspect`. Los logs adjuntados van anonimizados. Los datasets siempre sintéticos.
