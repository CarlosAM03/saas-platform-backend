# G4 — Cobertura por AC y sensibilidad de la prueba de instantánea (bloque documental y de pruebas)

- Registro: `2026-11-23` (hora local del equipo, sin zona fijada por paso).
- HEAD exacto de código: `7a63dfbe1d72b695457cf99b830f186af9b3d2bb`, rama `feat/sprint-campana-prospector`.
- Base del trabajo: commit funcional `feat(sprint-cp): complete contextual reads and dashboard snapshot`.
- Alcance autorizado: continuar el bloque pendiente del sprint según instrucción del owner en conversación («retoma el desarrollo»). No incluye push, merge, deploy, datos reales, cambios protegidos ni aceptación de gates.
- Naturaleza del bloque: **solo pruebas y documentación**. No se modificó `src/`, `Prisma/`, migraciones, contrato OpenAPI ni módulos protegidos.

## 1. Hallazgo que motivó el bloque

`test/campaigns-read-capabilities.postgres-spec.ts` verificaba el dashboard concurrente con `expect(result.activity.events).toBeGreaterThanOrEqual(result.total)`. En ese fixture cada participación se crea de forma atómica con exactamente un evento automático y cero actividad manual, de modo que cualquier instantánea coherente debe cumplir **igualdad**, no una cota inferior. Una lectura mixta que viera primero el total de participaciones y después un conteo de actividad posterior habría satisfecho `>=` y la prueba habría quedado verde con el defecto presente.

Además, lanzar 20 lectores y 20 escritores de forma simultánea no garantiza que una escritura ocurra entre las lecturas relevantes: la ejecución verde no demostraba sensibilidad.

## 2. Cambios en pruebas

| Archivo | Cambio | Motivo |
|---|---|---|
| `test/campaigns-read-capabilities.postgres-spec.ts` | Aserciones exactas (`sum(stages)`, `sum(evaluations)`, `sum(responsibility)`, suma de `incorporation`, `activity.manual === 0`, `activity.events === total`, `activity.total === total`) en el caso concurrente de 20/20. | Eliminar la cota inferior insensible al defecto. |
| mismo archivo | Nueva prueba determinista: `keeps one snapshot when a writer commits between the two activity counts`, con proxy sobre `PrismaService` que detiene el primer conteo de actividad hasta que una escritura externa confirma, y libera después. | Forzar el intercalado; una lectura secuencial debe mezclar instantes y una transacción `RepeatableRead` debe mantener una sola instantánea. |
| `test/campaigns-read-capabilities.postgres-spec.ts` | `AC-C2-02`, `AC-C4-03`, `AC-C8-01`, `AC-C3-04`: cuatro pruebas nuevas de criterios sin cobertura. | Cerrar huecos detectados en la matriz de contraste. |
| mismo archivo | `AC-C2-01`, `AC-C4-02`, `AC-C8-04`: snapshot sin mutación tras el rechazo, rechazo por inactividad/sin membresía y dashboard vacío sin `NaN`. | Cerrar parciales con aserciones solo indirectas. |
| `test/prospect-read-capabilities.postgres-spec.ts` | `AC-P2-02`: mutar etapa y evaluación en B y comparar el resumen de A antes/después. | Cerrar el hueco de C7/P2. |

No se agregaron dependencias, utilidades compartidas ni cambios de producción.

## 3. Reproducción roja controlada (demostración de sensibilidad)

Procedimiento: se sustituyó temporalmente el cuerpo transaccional de `CampaignsService.dashboard` por lecturas secuenciales (`const tx = this.prisma` sin `$transaction`), se ejecutó **solo** la prueba determinista y después se restauró el archivo con `git checkout -- src/campaigns/campaigns.service.ts` (verificado: sin diferencias posteriores en `src/campaigns`).

| ID | Gate | Comando | Esperado con implementación secuencial | Observado | Estado |
|---|---|---|---|---|---|
| G4-SNAP-RED | G4 | `docker compose --profile test run --build --rm test-postgres sh -c "npm run test:postgres -- --testPathPatterns=campaigns-read-capabilities -t 'keeps one snapshot'"` | La prueba falla con `events = 3` frente a `total = 2` | `expect(received).toBe(expected)` — `Expected: 2`, `Received: 3`, en `assertOneSnapshot` (`result.activity.events`) | PASS de sensibilidad (la prueba detecta el defecto) |

Nota metodológica: una primera versión de la compuerta bloqueaba el **segundo** conteo (actividad manual, cuyo valor es 0 antes y después de la escritura) y la prueba pasó con la implementación defectuosa. Se corrigió la compuerta para bloquear el **primer** conteo de actividad, posterior a la lectura de participaciones, y se repitió la reproducción roja hasta obtener el fallo por la aserción correcta. Este intento fallido se registra porque demuestra el riesgo real de una prueba verde no representativa.

## 4. Ejecución verde con la implementación vigente

Comando único dentro del contenedor Node 20 sobre PostgreSQL 16 desechable:

```text
npm run build && npm run test:unit:ci && npm run test:e2e:ci && npm run prisma:migrate:deploy && npm run test:postgres
```

| ID | Gate | Comando interno | Dataset | Esperado | Observado | Estado |
|---|---|---|---|---|---|---|
| BUILD-CP-AC | G4 | `npm run build` | árbol del HEAD + worktree de pruebas | compila | `nest build` código 0 | PASS |
| UNIT-CP-AC | G4 | `npm run test:unit:ci` | fixtures unitarios sintéticos | verde | 12 suites, 177/177 | PASS |
| HTTP-CP-AC | G4 | `npm run test:e2e:ci` | HTTP con dobles en memoria | verde | 7 suites, 84/84 | PASS |
| MIG-CP-AC | G4 | `npm run prisma:migrate:deploy` | PG16 desechable | sin pendientes | 4 migraciones, ninguna pendiente | PASS |
| PG-CP-AC | G4 | `npm run test:postgres` | PG16 desechable, fixtures sintéticos | verde | 15 suites, 184/184 | PASS |
| LINT-CP-AC | G4 | `npx eslint` y `npx prettier --check` sobre los dos archivos de prueba modificados | — | código 0 | ambos código 0 | PASS |

Total funcional del bloque: **445 pruebas** (177 + 84 + 184) en 34 suites. Las 4 pruebas de rendimiento no se incluyen ni se repitieron en este bloque.

## 5. Efecto sobre la matriz de contraste

`MATRIZ_COBERTURA_AC.md` pasa de 29 `CUBIERTO` / 16 `CUBIERTO_PARCIAL` / 5 `NO_CUBIERTO` a **37 `CUBIERTO` / 13 `CUBIERTO_PARCIAL` / 0 `NO_CUBIERTO`**. Los ocho criterios cerrados son `AC-C2-02`, `AC-C3-04`, `AC-C4-03`, `AC-C8-01` y `AC-P2-02` (huecos) más `AC-C2-01`, `AC-C4-02` y `AC-C8-04` (parciales con aserciones solo indirectas).

Los 13 criterios parciales conservan su brecha declarada; destacan por impacto: `AC-C4-01` (caminos positivos con `MEMBER`/`ADMIN`), `AC-C8-04` se cerró pero `AC-P4-03` (aviso de efecto global de `UPDATE_EXISTING`) y `AC-P4-07` (resultados por fila de vinculado/omitido) siguen abiertos en su parte de contrato.

### Verificación posterior al commit

Tras crear los commits `a5055b5` (pruebas) y `d42be1c` (documentación), se repitió la cadena completa sobre el árbol consolidado en `d42be1c27be192f0bca8ab36aabaacedc1c00518`: build código 0, 177 unitarias, 84 HTTP, 181 PostgreSQL y 4 migraciones sin pendientes. Posteriormente se añadieron las tres pruebas de parciales y se ejecutó la cadena final: build código 0, 177 unitarias, 84 HTTP, **184 PostgreSQL**, total **445**. Las cifras de la tabla anterior corresponden a esa última corrida.

## 6. Limitaciones y riesgos residuales

1. La prueba determinista usa un `Proxy` sobre `PrismaService`; verifica el contrato de `dashboard()` a nivel de servicio, no el comportamiento bajo latencia de red ni reintentos de Prisma.
2. La prueba concurrente de 20/20 sigue dependiendo del entrelazado del sistema; su valor es de humo, no de demostración. La garantía de instantánea la aporta la prueba determinista.
3. `T32` sigue `NOT_RUN` y corresponde al frontend; nada de este bloque lo modifica.
4. La regresión verde no acredita por sí sola los AC parciales ni sustituye la aceptación del owner.
5. G4 no se marca cerrado en este documento; la conclusión técnica se propone en `CONCLUSION_G4_7A63DFB.md` y la decisión es del owner.
