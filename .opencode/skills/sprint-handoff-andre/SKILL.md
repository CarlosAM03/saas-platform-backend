---
name: Sprint Handoff André
description: Cómo construir el arnés frontend para André desde el contrato realmente implementado del sprint CP, no desde el SPEC supuesto.
---

# Handoff para André — sprint CP

Usa español de México y no uses voseo.

## Fuente de verdad

Parte del SHA final del backend y de tres fuentes reales, en este orden:

1. Código: `src/campaigns/`, `src/prospects/` y sus DTO.
2. Contrato servido: `/api/docs` con la app levantada.
3. `Docs/Contracts/platform-api.v1.yaml`.

El SPEC define el *qué*; el contrato real define lo que André puede consumir. Si difieren, registra el DRIFT y no lo resuelvas por tu cuenta.

## Matriz por operación

Para cada endpoint de C1/C2/C3/C4/C6/C8/P1/P2/P3/P4 registra:

```text
feature, method, path, disponibilidad, backend_sha, roles_y_tenant,
request_schema, response_schema, errores, ejemplo_sintetico,
pantalla_consumidora, prueba_referencia, evidencia
```

Usa `CONTRACT_ONLY`, `503` o `AVAILABLE` en `disponibilidad`. Distingue los tres estados con claridad: un endpoint documentado pero no probado **no** es `AVAILABLE`.

## Contenido del arnés nuevo

1. `README.md` autónomo y `PROMPT_ACTIVACION.txt` para instalar en `saas-platform-client/codex/<nombre>/` sin tocar otras evidencias.
2. Contrato con SHA exacto del backend, ejemplos sintéticos y errores.
3. Objetivos visuales por feature y flujos de usuario paso a paso.
4. Reglas Flutter: solo API NestJS, Riverpod, `lib/platform_api` tipada, respeto de sessionScope/tenant.
5. Carpetas protegidas: sin editar `lib/app`, `lib/core/network`, `lib/routes`, `lib/features/auth` sin autorización puntual.
6. Pruebas: widget/state, filtros, roles, aislamiento de sesión, errores 400/409, y T32 contra entorno sintético.
7. Gates: baseline Flutter autorizado por owner, SHA de backend, QA y PR sin auto-merge.

## Cierre

Registra en `05_EVIDENCIAS/G5/HANDOFF.md`: SHA del backend, SHA256 y tamaño del arnés, estructura, comandos y riesgos abiertos. Marca `LISTO_PARA_REVISION` solo cuando el integrador confirme G4 PASS. Nunca lo marques `APROBADO`.
