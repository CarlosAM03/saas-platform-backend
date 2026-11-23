# Auditoría independiente de contrato — SPEC-CP-2026-01

- Fecha: `2026-11-22T20:30:09.8762537-08:00`.
- HEAD inicial y final comprobado: `e2bc9275836b642ac3e2b6086c4c15062b4dcd89`.
- Árbol inicial: `git status --short` sin salida. Única escritura asignada: este archivo nuevo.
- Autoridad: AGENTS, arnés y SPEC ratificado. Skills: `sprint-openapi-parity`, `sprint-evidence`.
- Alcance: lectura de controladores, DTO, servicios, Prisma, YAML, deploymentDocument y evidencia histórica. No se ejecutaron build, suites unitarias/E2E/PG ni Docker: QA trabaja en paralelo.
- **Conclusión: presencia de rutas conforme; paridad semántica FAIL.** Hay un schema imposible para resolver coincidencias y un cambio observable no documentado en el POST previo. No publicar como contrato reconciliado sin resolver/escalar esos hallazgos. Ningún gate se cierra aquí.

## 1. Evidencia actual y límites

Todos los registros siguientes pertenecen al HEAD y fecha indicados arriba; fixture sintético, sin datos reales. Los scripts se enviaron por stdin a Node con PowerShell (`@' ... '@ | node`), sin generar archivos, dist ni modificar tests.

| ID | Gate | Fecha ISO | HEAD | Comando | Dataset/fixture | Esperado | Observado | Resultado | Evidencia | Limitaciones |
|---|---|---|---|---|---|---|---|---|---|---|
| CT-01 | G4 | 2026-11-22T20:30:09-08:00 | e2bc9275836b642ac3e2b6086c4c15062b4dcd89 | `git rev-parse HEAD; git status --short`; lectura de decoradores recursiva | 3 controladores Campaigns/Prospects/Imports | mismo HEAD; inventario completo | HEAD coincide; 25 operaciones | PASS | inventario §2 | No certifica negocio |
| CT-02 | G4 | 2026-11-22T20:30:09-08:00 | e2bc9275836b642ac3e2b6086c4c15062b4dcd89 | Node: extraer decoradores, normalizar `:id` a `{id}`, `assert.deepStrictEqual(actual,declared)` | código y YAML | mismas rutas/métodos | `CODE_YAML_ROUTE_PARITY=true count=25` | PASS | §2 | Sólo presencia |
| CT-03 | G4 | 2026-11-22T20:30:09-08:00 | e2bc9275836b642ac3e2b6086c4c15062b4dcd89 | Node + `ts-node/register/transpile-only`: invocar `deploymentDocument()` y comparar subárbol CP | YAML del HEAD | CP idéntico | `CP_YAML_DEPLOYMENT_IDENTICAL=true`; YAML 34 paths/46 operaciones; deployment 39/51 | PASS | §5, script reproducible | No valida payloads de negocio |
| CT-04 | G4 | 2026-11-22T20:30:09-08:00 | e2bc9275836b642ac3e2b6086c4c15062b4dcd89 | Nest vacío + `SwaggerModule.setup('api/docs',app,doc)` + listener efímero local + fetch + close | documento actual, sin AppModule/DB | JSON/UI 200; CP idéntico | `ISOLATED_SWAGGER_JSON_HTTP=200 UI_HTTP=200 CP_PARITY=true` | PASS | §5 | **Arnés aislado**, no app desplegada ni rutas funcionales |
| CT-05 | G4 | 2026-11-22T20:30:09-08:00 | e2bc9275836b642ac3e2b6086c4c15062b4dcd89 | AJV compila `$ref: '#/components/schemas/ResolveProspectRequest'`; `validateSync(new ResolveProspectRequest(),...)` | `{campaignId:'campaign-synthetic',name:'Prospecto sintetico',resolution:'SKIP'}` | DTO y schema aceptan el mismo request válido | DTO `[]`; AJV false: `additionalProperties`, property `resolution` | FAIL | D01 | Sonda contractual en memoria, no ejecución HTTP de resolve |
| CT-06 | G4 | 2026-11-22T20:30:09-08:00 | e2bc9275836b642ac3e2b6086c4c15062b4dcd89 | `validateSync` para cada enum de YAML en UpdateStage/UpdateEvaluation/CreateActivity | seis etapas, tres evaluaciones, cinco tipos manuales; content sintético | enums documentados aceptados | todos aceptados; tipos también corresponden a DTO/Prisma por inspección | PASS | §3 | No prueba mutaciones/errores HTTP |
| CT-07 | G4 | 2026-11-22T20:30:09-08:00 | e2bc9275836b642ac3e2b6086c4c15062b4dcd89 | GET Swagger de AppModule/servicio desplegado en este HEAD | app real | atribución verificable a HEAD | no ejecutado por este auditor | NOT_RUN | QA paralelo | No atribuir a este HEAD el servicio histórico |
| CT-08 | G4 | 2026-11-22T20:30:09-08:00 | e2bc9275836b642ac3e2b6086c4c15062b4dcd89 | build/E2E/PG funcionales | QA paralelo | evidencia independiente por HEAD | no duplicados | NOT_RUN | entrega de QA pendiente de integración | No convertir presencia en AVAILABLE certificado |

## 2. Inventario y matriz de operaciones CP/P4

Código → YAML: 25/25. YAML CP → código: 25/25. Incluye subdirectorio `src/prospects/imports/`; el grep sólo de `src/prospects/*.ts` lo omitiría. Las ocho operaciones baseline fuera de la matriz son GET/POST `/campaigns`, GET/PATCH/DELETE `/campaigns/{id}`, GET `/prospects`, GET/PATCH `/prospects/{id}`. Todas usan prefijo `/api/v1` (`src/main.ts:21`). No hay endpoint CP inventado ni stub CP/503; el script contó `CP_503_OPERATIONS=0`.

**Estado de esta auditoría:** `CONTRACT_ONLY` significa implementado/documentado pero **sin certificación funcional actual de este auditor** (QA paralelo); no significa ruta ausente. El YAML sí publica `AVAILABLE` para las 15 operaciones nuevas/P4 señaladas abajo; no se hereda esa afirmación como prueba actual. POST previo y C6 no tienen `x-contract-status`. No se rebaja ni modifica el YAML en esta tarea.

Rutas abreviadas: `B=/api/v1`, `P=B/campaigns/{campaignId}/prospects/{prospectId}`. Roles `AOM=ADMIN/OWNER/MEMBER`, `AO=ADMIN/OWNER`. Todos requieren JWT y tenant seleccionado, incluido ADMIN; tenant proviene del contexto, nunca del body/query. 401 por autenticación; 403 por rol/contexto; 404 para entidad ausente/ajena cuando se consulta. Servicios realizan scope tenant; esto es inspección, no certificación de aislamiento.

| Capacidad | Método y ruta | Request real | Response real (bajo `success:true`) | Errores relevantes | Roles | Estado auditor / YAML | Fuente controlador |
|---|---|---|---|---|---|---|---|
| C6 | GET `B/campaigns/{id}/prospects` | page,limit,search,sortBy,sortOrder,category,address,source,stage,evaluation,responsibleId | `data:Prospect[]`, `meta` | 400,401,403,404; YAML omite 400/403 | AOM | CONTRACT_ONLY / sin marca | campaigns.controller.ts:58 |
| C8 | GET `B/campaigns/{id}/dashboard` | id | total,stages,evaluations,responsibility,activity,incorporation | 401,403,404 | AOM | CONTRACT_ONLY / AVAILABLE | campaigns.controller.ts:66 |
| C1/C2/C4 | GET `P/participation` | IDs | CampaignParticipation, responsable incluido | 401,403,404 | AOM | CONTRACT_ONLY / AVAILABLE | campaigns.controller.ts:71 |
| C1 | PATCH `P/stage` | `{stage}` | CampaignParticipation (sin relación responsible cargada) | 400,401,403,404 | AOM | CONTRACT_ONLY / AVAILABLE | campaigns.controller.ts:79 |
| C2 | PATCH `P/evaluation` | `{evaluation,reason?}` | CampaignParticipation (sin relación responsible cargada) | 400,401,403,404 | AOM | CONTRACT_ONLY / AVAILABLE | campaigns.controller.ts:88 |
| C4 | GET `P/responsibles` | IDs | `data:ResponsibleUser[]` | 401,403,404 | AOM | CONTRACT_ONLY / AVAILABLE | campaigns.controller.ts:102 |
| C4 | PUT `P/responsible` | `{responsibleId}` | CampaignParticipation con responsible | 400 (no elegible),401,403,404 | AOM | CONTRACT_ONLY / AVAILABLE | campaigns.controller.ts:110 |
| C4 | DELETE `P/responsible` | sin body | CampaignParticipation con responsible null | 401,403,404 | AOM | CONTRACT_ONLY / AVAILABLE | campaigns.controller.ts:123 |
| C3 | GET `P/activities` | page,limit; además acepta PaginationDto completo | `data:CampaignActivity[]`, `meta`; recordedAt desc,id desc | 400,401,403,404; YAML omite 400 | AOM | CONTRACT_ONLY / AVAILABLE | campaigns.controller.ts:135 |
| C3 | POST `P/activities` | type,content,declaredAt?,correctsId? | 201 CampaignActivity con actor | 400,401,403,404 | AOM | CONTRACT_ONLY / AVAILABLE | campaigns.controller.ts:144 |
| P1/camino previo | POST `B/prospects` | CreateProspectRequest | 201 Prospect nuevo **o reutilizado** | 400,401,403,404,409; YAML omite 409 | AO | CONTRACT_ONLY / sin marca | prospects.controller.ts:22 |
| P1 | POST `B/prospects/match` | CreateProspectRequest | 201 `{strongProspect,candidates,resolutionRequired}` | 400,401,403,404 | AO | CONTRACT_ONLY / AVAILABLE | prospects.controller.ts:28 |
| P1 | POST `B/prospects/resolve` | CreateProspectRequest + resolution,candidateId? | 201 `{action,prospect?}`; SKIP sin prospect | 400,401,403,404,409 | AO | CONTRACT_ONLY / AVAILABLE; schema bloqueante | prospects.controller.ts:34 |
| P2 | GET `B/prospects/{id}/campaigns` | id | `{originCampaignId,campaigns:[{campaign,isOrigin,stage,evaluation,responsible,addedAt}]}` | 401,403,404 | AOM | CONTRACT_ONLY / AVAILABLE | prospects.controller.ts:50 |
| P3 | GET `B/prospects/{id}/provenance` | id; **sin query de paginación** | `data:ProspectProvenanceEvent[]`; recordedAt desc,id desc | 401,403,404 | AOM | CONTRACT_ONLY / AVAILABLE | prospects.controller.ts:55 |
| P4 | POST `B/prospects/import/preview` | multipart campaignId,file | 200 `{previewReference,expiresAt,summary,rows}` | 400,401,403,404,413 | AO | CONTRACT_ONLY / AVAILABLE | imports/prospect-imports.controller.ts:24 |
| P4 | POST `B/prospects/import/confirm` | multipart campaignId,file,previewReference,decisions (texto JSON) | 200 `{summary,rows:[{record,action,prospectId?,errors?}]}` | 400,401,403,404,409,413 | AO | CONTRACT_ONLY / AVAILABLE | imports/prospect-imports.controller.ts:43 |

Los paths de controlador de la tabla son relativos a `src/campaigns/` o `src/prospects/` según corresponda.

## 3. Campos, enums, errores y compatibilidad observados

- **Etapas**: SIN_GESTIONAR, EN_INVESTIGACION, CONTACTADO, EN_SEGUIMIENTO, OPORTUNIDAD, CERRADO. **Evaluación**: SIN_EVALUAR, APTO, NO_APTO. Correspondencia DTO/YAML/Prisma correcta (`campaign-participation.request.ts:10-29`, YAML:1113-1116, `Prisma/schema.prisma:53-66`). Defaults de participación: SIN_GESTIONAR/SIN_EVALUAR/responsable nulo; status legado independiente (`schema.prisma:220-229`).
- **Participation**: campaignId,prospectId,status,commercialStage,evaluation,evaluationReason,responsibleId,updatedAt,addedAt; responsible opcional según operación. YAML:1198-1211 no obliga a recibir responsible y permite que PATCH no lo incluya. No se observó mismatch de campos requerido en estas respuestas.
- **Evaluación**: reason string hasta 1000; NO_APTO exige trim no vacío en servicio (`campaigns.service.ts:306-315`). YAML lo describe en :440, aunque no codifica la condición en schema. No-op real no crea transición en :326-330; C1 igual en :275.
- **Actividad**: request manual NOTE/CALL/EMAIL/MEETING/OTHER; content no blanco <=5000; correctsId <=128; declaredAt string validado como fecha por servicio. Response agrega ASSOCIATION/STAGE_CHANGE/EVALUATION_CHANGE/RESPONSIBLE_CHANGE/CORRECTION; server recordedAt,actorUserId y valores anteriores/nuevos. Corrección fuerza CORRECTION y valida referencia en la misma participación (`campaigns.service.ts:492-515`). No hay PATCH/DELETE público de bitácora.
- **Responsables**: id,name,email,status; escritura exige usuario ACTIVO y UserTenant del tenant (`campaigns.service.ts:397-409`). Lectura actual no presenta bandera de elegibilidad de la asignación histórica: ver D05.
- **C6**: category/address contienen texto case-insensitive; source exacta; search name/email; AND entre dimensiones; UNASSIGNED => responsibleId null (`campaigns.service.ts:156-239`). Orden por campo permitido y desempate id asc. page default 1, limit 20 máximo 100; sortBy name/email/status/createdAt/updatedAt (default name), sortOrder asc/desc (default asc), `src/common/dto/pagination.dto.ts:4-26`. YAML SortBy es string libre (:934-938); faltan enum/default y semántica AND/textual.
- **Create/match/resolve**: campaignId y name obligatorios; category,address,phone,email,website,language,metadata opcionales nullable; status ACTIVO/INACTIVO; identitySource opcional google_maps, identityIdentifier no blanco; website exige protocolo. resolve añade CREATE/LINK_EXISTING/SKIP, candidateId no blanco <=128; LINK_EXISTING exige candidateId en servicio (:132-135). Ver D01/D02/D06/D07.
- **P2/P3**: respuestas coinciden en nombres/tipos con YAML:1294-1324 y `prospects.service.ts:164-217`; wrapper no queda doblemente anidado porque `ResponseInterceptor` extrae data (:21-26). No confundir esta paridad con cumplimiento de todas las capacidades SPEC: ver D04/D08.
- **Dashboard**: stages y evaluations incluyen todas las claves incluso ceros; responsibility agrupa por userId/SIN_ASIGNAR/NO_ELEGIBLE:userId; activity total/manual/events (correcciones se cuentan en events por implementación); incorporation new/reused/unknownLegacy. `campaigns.service.ts:553-625`, YAML:1263-1272. Falta describir en YAML la definición exacta de manual/events.
- **CSV V1**: headers name/category/address/phone/email/website/language/status; name requerido. 5*1024*1024 bytes, 1000 registros, 2000 caracteres/celda; UTF-8, BOM, coma/punto y coma. preview sin escrituras, referencia firmada de 15 minutos; confirm revalida user/tenant/campaign/file/snapshot; serializable con tres intentos P2034 (`prospect-imports.service.ts:55-108,280-298,398-432`). NEW permite CREATE/SKIP; MATCH LINK_EXISTING/UPDATE_EXISTING/SKIP; INVALID/CONFLICT => REJECTED; decisiones sólo record/action, sin candidateId (:109-155,436-461). YAML lo refleja (:561-667,1494-1554). UPDATE mantiene campos ausentes, LINK no edita maestro; no idempotencia durable. Los tamaños/atomicidad son hallazgos de inspección, no PASS PG de este auditor.
- **Error común real**: `{success:false,error:{code,message,details,timestamp}}`; 400 VALIDATION_ERROR,401 UNAUTHORIZED,403 FORBIDDEN,404 NOT_FOUND,409 CONFLICT,413 PAYLOAD_TOO_LARGE (`src/common/filters/global-exception.filter.ts:62-103`). Validaciones múltiples usan message="Validation failed" y details.messages. No consumir `PROSPECT_MATCH_REQUIRES_DECISION` como error.code actual: se descarta, ver D02.
- **Roles**: herencia AOM en ambos controladores, overrides AO en create/match/resolve e imports; RolesGuard usa override de método antes de clase (`src/common/guards/roles.guard.ts:22-38`). `requireTenantId()` produce 403 sin tenant (:61-65 de tenant-context.service.ts). YAML sólo bearerAuth no expresa los roles de la mayoría de rutas CP: ver D09. No se modificaron estas capas protegidas.

## 4. DRIFT y escalamientos concretos

Referencias SPEC relativas a `codex/sprint-campanas-prospectos/04_REFERENCIAS/SPEC_SPRINT_CAMPANAS_PROSPECTOS_v1.0_OWNER_APROBADO.md`.

| ID | Severidad / clasificación | Hallazgo y fuente exacta | Riesgo, opciones y escalamiento |
|---|---|---|---|
| D01 | **BLOQUEANTE — CONTRACT_DRIFT** | YAML:1280-1287 define ResolveProspectRequest como allOf de CreateProspectRequest cerrado por additionalProperties:false en :1555-1558, pero añade resolution obligatoria fuera de ese objeto. Toda petición con resolution viola el primer miembro; sin resolution viola el segundo. El DTO sí la acepta (`src/prospects/dto/resolve-prospect.request.ts:4-12`). CT-05 lo reprodujo con schema completo. | Contrato resolve insatisfacible para validadores/SDK; presencia de ruta y refs válidos no lo detectan. Integrador debe asignar corrección aditiva de schema (objeto completo cerrado o base extensible reutilizable) y prueba schema↔DTO antes de publicar. No se editó en esta tarea. |
| D02 | **ALTA / bloquea handoff previo — CONTRACT_DRIFT / BREAKING_CHANGE** | YAML:522-526 promete crear con source=manual/sourceIdentifier=null; :535-550 no declara 409. `src/prospects/prospects.service.ts:54-67` ahora reutiliza identidad fuerte o lanza 409 ante candidato débil; :324-325 puede guardar google_maps/ID. El objeto ConflictException lleva code/candidates sin message/details; filtro común :48-74,:90-101 los descarta: salida inferida `code=CONFLICT,message=Internal server error,details={}` incluso en 409. | Cliente anterior que sólo manejaba creación/errores publicados no recibe resolución accionable ni candidatos. SPEC:196,387,486-489 exige transición compatible/documentada, no alta silenciosa anterior ni ruptura oculta. Escalar al integrador/owner mitigación y evidencia de consumidor: mantener request/response compatible, documentar 409 y flujo match→resolve; envolver mensaje/detalles desde dominio sin tocar filtro protegido. No publicar como reconciliado sin decisión. La inferencia de filtro requiere confirmación HTTP QA. |
| D03 | **ALTA — omisión SPEC C6** | SPEC:315 exige fechas relevantes; :470 lista con campos contextuales. `src/campaigns/dto/campaign-prospects.query.ts:4-39` no ofrece fechas. `src/campaigns/campaigns.service.ts:229-239` selecciona sólo Prospect maestro; YAML:391 y :1643-1649 también sólo ProspectPage. | Código/YAML coinciden, pero no cumplen capacidad mínima: lista no trae contexto y no filtra incorporación/actividad. GET participation individual existe, no suple filtro server-side. Integrador: extensión aditiva de contexto/filtro o decisión owner; no reinterpretar status ni sustituir respuesta baseline. |
| D04 | **ALTA — omisión SPEC P3/§6** | SPEC:478,488 exige lectura/listados paginados. `src/prospects/prospects.controller.ts:55-57` no recibe Query; `src/prospects/prospects.service.ts:210-217` findMany sin skip/take y devuelve array; YAML:756-768 sólo id. | Orden estable sí existe, paginación no. Riesgo de volumen/procedencia creciente; ampliar query/meta aditivamente y probar compatibilidad. No inventar soporte actual a page/limit. |
| D05 | **ALTA — C4/C8 elegibilidad incompleta** | SPEC:297-300,308 exige marcar no elegible tras retiro de membresía. GET participation incluye sólo User id/name/email/status (`src/campaigns/campaigns.service.ts:251-255`); dashboard decide NO_ELEGIBLE exclusivamente por User.status (:579-584), no por UserTenant. Lista elegible sí exige membresía (:360-370). YAML:398 promete NO_ELEGIBLE cuando corresponde, pero ResponsibleUser (:1190-1197) sólo informa status del usuario. | Usuario activo que pierde membresía sigue pareciendo asignado elegible en dashboard; antecedentes P2 tampoco explicitan elegibilidad. Preservar historia, calcular elegibilidad por membresía+estado en dominio, definir campo aditivo y tests de retiro. No requiere rediseño RBAC ni edición de Users. |
| D06 | **ALTA — brecha de contrato de identidad / decisión requerida** | SPEC:174 exige justificar fuente confiable y validación del ID. `src/prospects/dto/create-prospect.request.ts:57-64` permite al cliente declarar google_maps + cualquier string no blanco. `src/prospects/prospects.service.ts:220-231` sólo trim/lowercase/hash; create usa esa señal para asociación automática (:54-61). YAML:1597-1602 replica esa validación mínima sin explicar procedencia/confiabilidad. | Etiqueta de fuente declarada no demuestra ID externo válido; lowercasing necesita justificación por fuente. Escalar evidencia de diseño/validación al integrador/owner, sin editar Prospector ni inventar formato externo. No afirmar identidad confiable certificada con sólo enum válido. |
| D07 | **ALTA — P1/P4 resolución incompleta frente a SPEC; compatibilidad a decidir** | SPEC:186,192,385 requiere crear distinto conscientemente frente a candidato débil y registrar decisión. CSV MATCH prohíbe CREATE (`src/prospects/imports/prospect-imports.service.ts:123-132`; YAML:623), conservando comportamiento V1. Alta manual resolve CREATE guarda CREATED/ASSOCIATION pero sin constancia de decisión/candidatos (`src/prospects/prospects.service.ts:153-161,334-350`; Prisma details existe :276 pero no se llena allí). | No afirmar cumplimiento integral P1/P4 por preservar V1. Integrador debe reconciliar opción CSV y registro mínimo de decisión con owner si hay conflicto compatible. Múltiples candidatos CSV rechazados sí están permitidos por SPEC:197 y documentados; **no** son por sí solos un defecto. |
| D08 | **MEDIA — capacidad P2/P3 contextual faltante** | SPEC:395 solicita actividad contextual reciente cuando permitido; P2 devuelve campaign/stage/evaluation/responsible/addedAt sin actividad (`src/prospects/prospects.service.ts:190-199`; YAML:1303-1310). AC-P3-03 (:423) exige contexto B al actualizar desde B, pero PATCH maestro carece de contexto campaña y escribe siempre prospect.campaignId de origen (:450-458). | Antecedentes incompletos; atribuir origen A no equivale a registrar operación desde B. Integrador debe definir representación/contexto aditivo y prueba sin permitir campaña ajena. No afirmar que P2 ya incluye última actividad ni que PATCH puede declarar campaña destino. |
| D09 | **MEDIA — documentación incompleta de validaciones/roles/errores** | YAML:371-393 omite 400/403 en C6; :499-504 omite 400 de paginación; :934-938 permite cualquier sortBy, DTO sólo cinco valores (`src/common/dto/pagination.dto.ts:10-11`). Rutas CP :394-518,:743-768 no describen explícitamente roles AOM/tenant (sólo bearerAuth). 413 CSV :609-610,:666-667 no declara wrapper/schema. | SDK/UI pueden enviar orden inválido o asumir permisos/errores no publicados. Documentar enums/default, AND, orden fijo de actividades, roles/contexto y ErrorResponse 413; no confundir omisión documental con bypass de autorización. No bloquea existencia de las rutas, sí completitud del handoff contractual. |

No se cambió negocio para resolver estos hallazgos. D01 y D02 requieren atención antes de entregar/publicar el contrato como exacto; los demás conservan alcance y prioridad para el integrador. Las omisiones SPEC no se corrigen añadiendo endpoints ficticios a YAML.

## 5. Swagger histórico versus comprobación actual

- `05_EVIDENCIAS/G4/RESULTADOS_D262F48.md:3-17` atribuye explícitamente el HTTP 200 de `/api/docs-json` y `/api/docs`, 39 paths/51 operaciones y suite 5/5 a **d262f48e9ab6b344c472df60588c2261d377c884**, el 2026-11-22T14:19:54-08:00. Es evidencia histórica, no PASS actual e2bc927.
- `MATRIZ_QA.md:82` conserva otra comprobación en **ca2285af1f2dd3881bce4ce4f93ab8c6f3cc29f5 + worktree no confirmado**: YAML 34/46, servido 39/51 y CP changed vacío. Tampoco acredita este HEAD.
- `test/without-prospector.e2e-spec.ts:170-211` comprueba existencia y x-contract-status; :213-231 comprueba resolución de referencias. Ninguna de esas aserciones valida que allOf admita un request ni los payloads completos/roles por cada endpoint. Un PASS de esa prueba no elimina D01/D02.
- En este HEAD se ejecutó **Swagger aislado real por HTTP**, sin DB, con `deploymentDocument()` del source y `SwaggerModule.setup`, no desde dist. El JSON CP completo es idéntico al YAML; por tanto **los defectos del YAML se sirven idénticos**, no desaparecen por servirlos. No es AppModule ni una verificación de despliegue; HTTP de app actual permanece NOT_RUN por este auditor.
- `src/main.ts:45-47` publica directamente deploymentDocument, sin generación desde decorators/DTO. `src/common/openapi/deployment-document.ts:8-18` lee YAML y conserva CP; :46-68 modifica sólo operaciones Jobs a 503; :102-105 añade Tenant Registration. Las cinco operaciones extra 39/51 frente a 34/46 no son endpoints CP inventados.
- URL JSON correcta con setup actual: `/api/docs-json`; `/api/docs/json` de la guía no es la ruta usada por main/test. No se tomó un fallo de esa URL alternativa como fallo de Swagger.

### Reproducción mínima de las sondas (PowerShell, sin escritura)

Desde raíz del repositorio, cuerpo JavaScript enviado por `@' ... '@ | node`:

```javascript
require('ts-node/register/transpile-only');
const fs = require('fs'), yaml = require('js-yaml'), assert = require('assert');
const y = yaml.load(fs.readFileSync('Docs/Contracts/platform-api.v1.yaml', 'utf8'));
const d = require('./src/common/openapi/deployment-document.ts').deploymentDocument();
const cp = x => Object.fromEntries(Object.entries(x.paths)
  .filter(([p]) => /^\/api\/v1\/(campaigns|prospects)(\/|$)/.test(p)));
assert.deepStrictEqual(cp(y), cp(d));
const Ajv = require('ajv');
const v = new Ajv({strict:false,validateFormats:false,allErrors:true}).compile({
  components:y.components, $ref:'#/components/schemas/ResolveProspectRequest'
});
const body = {campaignId:'campaign-synthetic',name:'Prospecto sintetico',resolution:'SKIP'};
console.log('SCHEMA', v(body), v.errors);
const {ResolveProspectRequest} = require('./src/prospects/dto/resolve-prospect.request.ts');
console.log('DTO', require('class-validator').validateSync(
  Object.assign(new ResolveProspectRequest(), body),
  {whitelist:true,forbidNonWhitelisted:true}));
(async () => {
  const {Module} = require('@nestjs/common');
  const {NestFactory} = require('@nestjs/core');
  const {SwaggerModule} = require('@nestjs/swagger');
  class Harness {} Module({})(Harness);
  const app = await NestFactory.create(Harness,{logger:false});
  SwaggerModule.setup('api/docs',app,d);
  await app.listen(0,'127.0.0.1');
  try {
    const base = await app.getUrl();
    const response = await fetch(base+'/api/docs-json');
    const served = await response.json();
    assert.deepStrictEqual(cp(y),cp(served));
    console.log('JSON_HTTP',response.status,'UI_HTTP',(await fetch(base+'/api/docs')).status);
  } finally { await app.close(); }
})().catch(e => { console.error(e.message); process.exitCode=1; });
```

No heredar PASS funcional de otro SHA. Integrar por separado resultados QA actuales y mantener abierto el control de los gates bajo autoridad del integrador/owner.

## 6. Reconciliación solicitada RI-06 / G4-O2 (sin implementación)

Actualización por instrucción del integrador; inspección del mismo HEAD, sin nuevas suites ni modificaciones de contrato/código. Fuente de la ratificación: `05_EVIDENCIAS/decisiones/SOLICITUDES_OWNER.md:6`: **G4-O2 ratifica rechazo seguro de múltiples candidatos CSV**, sin selección candidateId durante este sprint. No ratifica la prohibición de crear distinto ante **un solo candidato débil**. Por tanto, la conciliación de RI-06 está **resuelta a nivel de análisis**, pero corrección y pruebas siguen **NOT_RUN**.

### Resultado contractual

- SPEC §3.2 B2 (:186) permite vincular candidato elegido, crear distinto conscientemente u omitir ante señales débiles; §3.3 (:197) permite mantener rechazado el conflicto múltiple cuando no exista decisión inequívoca. Son casos distintos y compatibles.
- **Extensión propuesta aditiva:** para `classification=MATCH` con exactamente un candidato débil, admitir `action=CREATE` explícito además de LINK_EXISTING/UPDATE_EXISTING/SKIP. No convertir CREATE en default, no actualizar/vincular el candidato anterior y no reinterpretar coincidencia de nombre como identidad fuerte.
- `classification=CONFLICT` con varios candidatos permanece **REJECTED**, sin decisión aplicable y sin candidateId, conforme a G4-O2. También se mantienen INVALID rechazado y NEW CREATE/SKIP. No se habilita CREATE para CONFLICT.
- No hacen falta nuevas rutas, campos multipart, clasificaciones ni valores enum: CREATE ya existe en el request de decisiones y en el response `rows[].action` (YAML:619-623,649,1552), y summary.created ya existe (:1541). El cambio mínimo del contrato es ampliar la descripción de acciones permitidas para MATCH en YAML:623; ninguna descripción se cambió en esta tarea.
- Request futuro de ejemplo: `decisions='[{"record":1,"action":"CREATE"}]'`, **sólo después de preview MATCH débil único y confirmación consciente**. En e2bc927 este ejemplo sobre MATCH devuelve 400 por `src/prospects/imports/prospect-imports.service.ts:123-132`; no se ofrece como disponible actualmente.
- Respuesta futura conserva `{summary,rows}`; fila creada usa `{record,action:'CREATE',prospectId}` y aumenta created. Preserva candidato anterior y su historia, crea maestro y participación nuevos, con defaults C1/C2/C4 y procedencia confirmada. La decisión consciente requiere registro mínimo server-side dentro de la procedencia existente (SPEC:192 y AC-P1-04), no historial general de archivos ni identidad nueva declarada inequívoca.
- Roles AO, tenant contextual, misma referencia/archivo, vigencia, snapshot, validación total de decisiones antes de escribir, transacción serializable, atomicidad, límites y reintentos se conservan. No usar el cambio para omitir revalidación ni aceptar dos candidatos como MATCH. Snapshot actual incluye candidatos (:378); conservar 409 cuando cambien entre preview y confirm.

### Compatibilidad y orden de entrega

**Clasificación propuesta: ADITIVA, no BREAKING_CHANGE**, siempre que sólo amplíe una acción explícita aceptada y mantenga las decisiones/respuestas previas. Los clientes anteriores siguen enviando LINK/UPDATE/SKIP sin cambios. El cliente nuevo debe habilitar CREATE para MATCH **después** del backend corregido: contra e2bc927 falla con 400; no hay negociación de capacidades publicada. No afirmar disponibilidad sólo por el enum global CREATE ni actualizar Swagger anticipadamente. Si se exigiera un campo nuevo obligatorio para consumidores existentes, se reclasificaría como BREAKING_CHANGE y se escalaría antes de publicar.

### Pruebas mínimas para el bloque correctivo posterior a QA (todas NOT_RUN aquí)

1. Preview MATCH débil único → CREATE explícito: un nuevo ID/participación; candidato original intacto; origen independiente; registro de decisión consciente; counts/result compatibles.
2. Misma fixture con LINK/UPDATE/SKIP conserva la semántica previa, incluidos avisos y atributos compartidos.
3. CONFLICT múltiple sigue REJECTED sin escrituras ni selección candidateId; suministrar decisión para CONFLICT sigue rechazado conforme al validador existente.
4. Cambio de candidato/snapshot antes de confirmar → 409 y cero efectos; error inesperado revierte todo el lote.
5. MEMBER 403, entidad ajena 404, tenant/contexto y referencia cruzados denegados; no defaults implícitos de CREATE ni eventos por preview/SKIP.
6. Schema/Swagger servido y descripción de MATCH deben coincidir con la corrección real; repetir sonda D01 y validar errores D02 en el bloque asignado, sin heredar PASS actual.

### Otros hallazgos del reviewer recibidos (no son G4 aprobado)

Se leyó `G4/REVISION_INDEPENDIENTE_E2BC927.md:13-19`; conserva reproducciones NOT_RUN. Coinciden estáticamente estos impactos contractuales adicionales:

| Hallazgo | Fuente implementación | Reconciliación necesaria, sin publicar todavía |
|---|---|---|
| RI-03: resolve fuerte rechazado | `src/prospects/prospects.service.ts:113-116,136-143` excluye strongProspect de candidates y resolve sólo busca allí | El contrato match expone strongProspect pero LINK_EXISTING de resolve no acepta su ID; hoy no prometer esa secuencia como exitosa. Corregir revalidación del fuerte tenant-scoped antes de completar flujo match→resolve; no suprimir candidates ni alterar shape. |
| RI-01: claves legacy ignoradas | `src/prospects/prospects.service.ts:94-101` sólo consulta identitySource/identityHash | Identidad confiable histórica con claves derivadas nulas no está cubierta por la promesa de reutilización. Reconciliar lookup/colisiones sin auto-merge ni backfill inventado; declarar 409 accionable si ambigua, con prueba antes de actualizar garantías. |
| RI-05: incorporación histórica inferida incorrectamente | `src/campaigns/campaigns.service.ts:537-544,586-595` usa primer evento global, aunque sea posterior | Campo incorporation y sus tres nombres no cambian; corregir cálculo para no convertir unknownLegacy en reused por una actualización posterior sin evidencia de incorporación. No fabricar procedencia retrospectiva. Es distinto de D05/RI-04 (elegibilidad por membresía). |

Ninguno se da por corregido. La clasificación de disponibilidad sigue pendiente de integración QA y correcciones; no se aprueba G4 ni el handoff.
