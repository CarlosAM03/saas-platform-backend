# Correcciones contractuales CP autorizadas — HEAD + worktree

- Fecha: `2026-11-22T20:40:19.3655881-08:00`.
- HEAD inicial/final verificado: `e2bc9275836b642ac3e2b6086c4c15062b4dcd89` **+ worktree correctivo no confirmado**. Estos resultados no se atribuyen al árbol limpio del SHA.
- Autorización recibida del integrador en esta sesión: editar exclusivamente `Docs/Contracts/platform-api.v1.yaml`, nuevo `src/common/openapi/cp-document.spec.ts` y esta evidencia nueva. No editar deploymentDocument/tenant-registration ni implementación. No build/HTTP/PG/Docker ni Git de escritura.
- Cambios ajenos concurrentes observados: documentación G3/G4/G5/G6/decisiones, servicio CSV y sus tests unitarios/PG, nuevos tests de revisión/rendimiento. No se editaron ni revirtieron. La lista exacta es mutable por trabajo paralelo; no representa un árbol limpio.
- El integrador informó baseline PostgreSQL 98/98 PASS de source previo. **No ejecutado aquí, no heredado como certificación del worktree correctivo.**

## Cambios realizados

| ID | Archivo / sección | Cambio | Resultado y límites |
|---|---|---|---|
| D01 | YAML `components.schemas.ResolveProspectRequest` | Sustituido allOf imposible con base cerrada por objeto cerrado completo, requerido campaignId/name/resolution. Conserva campos heredados, restricciones y los dos campos de resolución; no abre propiedades arbitrarias. | Sondas positivas/negativas schema↔DTO pasan. No modifica DTO ni lógica de confirmación. |
| D02 | YAML POST `/api/v1/prospects` | Describe creación o reutilización con la misma respuesta Prospect y SuccessResponse; preservación de origen/atributos; fuente real según identidad suministrada; 409 de candidato débil/concurrencia y reconsulta match→resolve; incorpora respuesta 409 estándar. | Corrige documentación, **no resuelve por sí mismo la compatibilidad funcional ni la falta de detalle accionable del error actual**. Explica limitación actual de resolve fuerte; no promete éxito inexistente. |
| D09 | YAML C6/activities y descripciones CP | Roles AOM y tenant seleccionado explícitos, incluso ADMIN; semántica AND/search/texto/source/UNASSIGNED; sortBy permitido y default name local a esas operaciones, sin cambiar SortBy global de otros módulos; defaults page/limit/sortOrder siguen referencias existentes; errores 400/403 faltantes. | Campos contextuales y fechas no implementados no se inventan. Bitácora documenta orden fijo recordedAt desc/id desc y parámetros heredados aceptados que no cambian el listado. |
| D09 | YAML import preview/confirm 413 | Declara content application/json ErrorResponse, sin alterar wrapper ni códigos. | Prueba de schema publicado; no prueba HTTP del parser. |
| RI-06 | YAML confirm CSV | MATCH débil único admite CREATE explícito consciente además de LINK_EXISTING/UPDATE_EXISTING/SKIP. Describe registro de decisión/candidateIds en procedencia dentro de la transacción. | Se inspeccionó código ya corregido por integrador: allowed incluye CREATE y CREATED.details contiene resolution/candidateIds. No se implementó aquí. Se conserva INVALID/CONFLICT REJECTED, sin candidateId, conforme G4-O2. |
| Soporte | Nuevo `cp-document.spec.ts` | 25 pruebas: 4 requests resolve válidos, 13 inválidos, herencia/cierre del schema, POST create wrapper/409, query C6/activities, import413, CSV descripción y composición CP de deploymentDocument en memoria. | No monta HTTP ni DB; no ejecuta suites ajenas. |

No se agregaron endpoints ni valores enum, no se modificaron marcas x-contract-status, respuestas DTO ni módulos protegidos. Las marcas AVAILABLE preexistentes no constituyen una certificación nueva de este auditor. Las correcciones documentales/schema y ampliar CREATE explícito en MATCH son aditivas para requests previos; el cambio conductual previo de POST create sigue bajo **CONTRACT_DRIFT / BREAKING_CHANGE** hasta mitigación y aceptación del integrador/owner.

### Dependencia de validación

Comando de inspección ejecutado: `node -e "console.log(require.resolve('ajv'));console.log(require('ajv/package.json').version)"`.

Observado: `node_modules/ajv/lib/ajv.js`, **AJV 6.15.0** ya disponible transitivamente. No se instaló dependencia ni se modificó package.json/lockfile. La prueba usa `nullable:true` para OpenAPI 3.0 y no muta requests con defaults. La disponibilidad de AJV transitivo depende del lockfile actual; no se declara dependencia directa nueva.

## Evidencia de ejecución

| ID | Gate | Fecha ISO | HEAD | Comando | Dataset/fixture | Esperado | Observado | Estado | Evidencia | Limitaciones |
|---|---|---|---|---|---|---|---|---|---|---|
| CP-CORR-01 | G4 | 2026-11-22T20:40:19-08:00 | e2bc9275836b642ac3e2b6086c4c15062b4dcd89 + worktree | `npm run test:unit:ci -- --runTestsByPath src/common/openapi/cp-document.spec.ts` | requests sintéticos, campaign-synthetic/prospect-synthetic y dominio example.test; YAML actual | sólo archivo nuevo, schema válido/DTO congruente en casos positivos/negativos | Jest ejecutó únicamente cp-document.spec.ts; **1 suite, 25/25 PASS**, 1.139 s | PASS | src/common/openapi/cp-document.spec.ts | No acredita business rules en servicios ni equivalencia exhaustiva de todo class-validator frente a JSON Schema |
| CP-CORR-02 | G4 | 2026-11-22T20:40:19-08:00 | e2bc9275836b642ac3e2b6086c4c15062b4dcd89 + worktree | misma ejecución, caso composición deploymentDocument | documento source + YAML | CP completo idéntico al publicado en memoria | igualdad de subárbol CP PASS | PASS | caso final del archivo nuevo | No Swagger servido/HTTP ni app desplegada |
| CP-CORR-03 | G4 | 2026-11-22T20:40:19-08:00 | e2bc9275836b642ac3e2b6086c4c15062b4dcd89 + worktree | build/HTTP/E2E/PG/Docker | coordinación integrador | no duplicar QA | no ejecutados aquí | NOT_RUN | instrucción del integrador | Requiere integración y nueva evidencia por estado exacto del árbol |

La sonda negativa exige que AJV **y** DTO rechacen: resolution ausente/inválida; campaignId/name ausentes o inválidos; status APTO; candidateId blanco o demasiado largo; identitySource inválida; identityIdentifier blanco; tenantId y recordedAt extra. Las positivas cubren CREATE/SKIP/LINK_EXISTING y campos heredados, incluidos nullable, metadata y campos de identidad existentes. No se considera la aceptación sintáctica de identityIdentifier una validación de confiabilidad externa: **D06 sigue pendiente**.

## Identificación reproducible de los dos artefactos probados

SHA-256 leídos con `Get-FileHash ... -Algorithm SHA256` tras la ejecución:

| Archivo | SHA-256 |
|---|---|
| `Docs/Contracts/platform-api.v1.yaml` | `6C3DDB6D301428C71B80593495C8E6478ADF90311B3439CCCFBB9AFA5A2DAB35` |
| `src/common/openapi/cp-document.spec.ts` | `D0600B848476BEB6BD759E241A676BAB07EFB37845A41B79D26027F25D08C5FC` |

## Pendientes que no se declaran resueltos

1. **D02 funcional/compatibilidad:** publicación del 409 no repara que el filtro descarte candidates/code de dominio ni demuestra manejo por consumidores previos. No se cambió el filtro protegido ni el servicio. La descripción actual no garantiza details accionables.
2. **D06 identidad/canonicalización:** fuente confiable, identificador válido y normalización continúan bajo revisión; no cambió la política ni se presume resuelta por tests sintácticos.
3. **RI-01/RI-03/RI-05:** identidad legacy, resolve fuerte y clasificación histórica de incorporación requieren bloque correctivo con pruebas. La documentación no se adelanta a una implementación futura.
4. **D03/D04/D08:** filtros de fechas/contexto en listado, paginación de procedencia y antecedentes/contexto reciente siguen pendientes; no se agregaron campos/query sin implementación. Procedencia dice expresamente que no ofrece paginación aún.
5. **D05/RI-04 y RI-02:** elegibilidad por membresía e historial concurrente no se certifican aquí. Dashboard documenta el criterio de estado actual, no garantiza membresía calculada inexistente.
6. RI-06 está documentado según el worktree ya implementado por integrador, pero su certificación PG/HTTP y la constancia mínima de decisión manual RI-07 siguen responsabilidad del bloque correctivo/QA, no de esta suite contractual.
7. Revisar contrato de nuevo tras cualquier corrección de servicios: la descripción de la limitación resolve fuerte y la del dashboard deben seguir al código real. No conservar advertencias obsoletas cuando esas correcciones estén implementadas y probadas.

No se publica ni se aprueba merge/deploy/handoff. Ningún gate se marca cerrado.
