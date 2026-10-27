# Preauditoría integral de PROSPECTOR SaaS — 27 de octubre de 2026

Dictamen del núcleo: **APTO PARA AUDITORÍA FINAL**, con las limitaciones operativas de producción indicadas en [readiness](RELEASE_READINESS_MVP_2026-10-27.md). El dictamen cubre el código y los flujos probados; no constituye aprobación del PR ni autorización de despliegue.

Estos tres informes globales se versionan canónicamente en la carpeta de auditorías existente del Backend para que puedan revisarse en el PR. El índice de `DocumentacionGlobal/00-Docs/Analisis` apunta a esta autoridad; no mantiene copias. No se borra documentación histórica. Los SHA de código, checks y corte de evidencia están en [Evidencia_Cierre_MVP_2026-10-27.json](Evidencia_Cierre_MVP_2026-10-27.json). Un commit posterior que sólo publique informes no debe confundirse con un cambio funcional.

## Inventario y publicación

| Componente | Rama | SHA de implementación auditada | Publicación |
|---|---|---|---|
| Engine | main | 70f6081688db5c5bc5ea612f5fabd5724aab0b20 | Sin cambios |
| Service | feat/fastapi-service-foundation | 69c54a15601d238638610d0a5c08af46e3da7f14 | Árbol src idéntico a main 566bbbe67a59a0fda307ea7d8c5f6bf46fd93aab; sin cambios |
| Backend | feat/prospector-service-mvp-integration | 42b96fefd73cc11b42ecde4df6d5f42393328bfc | [Draft #6 → dev](https://github.com/CarlosAM03/saas-platform-backend/pull/6) |
| Flutter Foundation | fix/f5-foundation | 095e899ace31acf17d97bbe945c118c1a5d88682 | [Draft #7 → dev](https://github.com/CarlosAM03/saas-platform-client/pull/7) |
| Flutter paridad | feat/flutter-prospector-mvp-parity | 97ad02a621007e4139e5207511ecca2376754ed8 | [Draft #8 → Foundation](https://github.com/CarlosAM03/saas-platform-client/pull/8); destino final dev |

Se inventariaron remotos, ancestros, worktrees, estado y PR antes de corregir. Las ramas iniciales 91470dc/3d0fca4 se publicaron primero. Los pushes son normales. No hubo force-push, reset destructivo, aprobación propia, merge a dev/main, release definitivo ni despliegue manual. La integración de Foundation dentro de la rama de paridad sólo une ramas de trabajo. Los previews automáticos asociados por el proveedor a pushes no equivalen a promoción productiva autorizada.

**Corrección histórica:** Backend main `3a3309398458ab333d7b00f16e9c2df6a09ef734` ya contiene CSV V1 y tiene el mismo árbol que dev `967044e2dc7d10ea91d7d78a86e1ea6fe2accd1a`. Flutter dev permanece en `c7dee664cbdda85d38d896ce3103d8fc6319f0af`; no recibe estos cambios durante esta ejecución. El PR antiguo Flutter #6 dev→main no sustituye las revisiones #7/#8 y no se debe promover con su descripción histórica sin actualizar.

## P0 encontrados y corregidos

| Hallazgo reproducible | Riesgo | Corrección y evidencia |
|---|---|---|
| JWT anterior seguía autorizando membresía revocada, rol degradado, tenant suspendido o ADMIN revocado | Operaciones con privilegios ya retirados | JwtStrategy comprueba autoridad vigente en PostgreSQL en cada petición. Contexto cambiado → 401. Casos HTTP/PG antes rojos, después aprobados |
| OWNER podía cambiar identidad global de otro usuario compartido y contraseña de un ADMIN asociado | Afectar identidad de B o tomar un ADMIN global | Protección transaccional Serializable; 403 GLOBAL_IDENTITY_PROTECTED. Los roles locales del usuario compartido se editan sin cambiar B |
| Diálogo raíz conservaba confirmación/búsqueda de A después de cambiar contexto o logout | Información anterior visible en sesión nueva | showSessionDialog oculta contenido al observar el nuevo scope y elimina su ruta sin confirmar. Tres pruebas antes fallaban; después pasan |

La política anterior de roles en snapshot de JWT hasta su renovación queda **sustituida explícitamente por este hardening**, según la prioridad P0 del propietario. HS256 y expiración de 8h se conservan. Seleccionar B no revoca por sí solo todos los JWT legítimos de A: un token A aún vigente sólo opera sobre A. Flutter usa revisión de sesión/contexto para descartar respuestas anteriores, invalidar providers y vaciar pantallas/formularios/archivos CSV. Logout/expiración cierran diálogos y eliminan acceso al estado anterior.

Resultado: **cero fugas conocidas reproducibles en los flujos auditados después de las correcciones**. No se afirma ausencia matemática de vulnerabilidades ni aislamiento mediante RLS: Shared DB/Shared Schema se protege en la capa de aplicación con TenantId y autorización efectiva.

## Cobertura de aislamiento

| Superficie real | Control y prueba negativa |
|---|---|
| Auth/tenant | Firma, expiración, usuario activo, rol vigente, tenant activo, selección autorizada; ADMIN global sin tenant no opera recursos locales |
| Users/roles | Membresía del tenant activo en consultas y conteos; recurso/rol ajeno 404; identidad global protegida; respuesta sólo expone membresía del contexto |
| Campaigns | Creación con tenant del contexto; GET/PATCH/archivo/eliminación permanente contractual ajenos 404; MEMBER según permisos existentes |
| Prospects | TenantId en consulta/creación/edición y relaciones; campaña ajena rechazada; no se inventa DELETE de prospecto |
| CSV | Campaña validada, preview/confirm firmados ligados a usuario/tenant/campaña/bytes exactos; MEMBER sin permiso; cruce 404 o referencia manipulada 400; replay 409 |
| Dashboard | Agrega listados paginados reales del contexto y totales del servidor; 601 en A y cero en B en la integración núcleo |
| Jobs/snapshots | TenantId en lista/detalle/snapshot; campaña válida; idempotencia, capacidad y cuota en PostgreSQL; recurso ajeno 404 |
| Callback interno | Credencial obligatoria, jobId ruta/body y registro PG comprobados, recibos/eventos ordenados, colisiones y regresiones rechazadas; callback tardío de A tras seleccionar B sólo modifica A |
| Flutter | Providers y páginas ligados a usuario/tenant/contexto; requests tardíos descartados; CSV seleccionado/preview/decisiones y búsqueda/confirmación desaparecen al cambiar sesión; rutas y permisos fallan cerrados |

Se usan fixtures independientes con OWNER/MEMBER, campaña, prospecto y Job de A/B, además de identidad compartida y ADMIN. Se inspeccionaron rutas, guards, servicios y filtros Prisma, no sólo TenantContextService. Ver suites `core-isolation`, `jobs`, `prospect-imports`, `prospector-mvp` de PostgreSQL; pruebas HTTP `platform` y pruebas Flutter de auth, tenants, core_flows, CSV, dashboard, Jobs y session_dialog.

## Pruebas y checks

| Evidencia | Resultado y alcance |
|---|---|
| Backend unitarios | 68 aprobados |
| Backend HTTP | 77 aprobados; adaptadores de infraestructura según la suite |
| Backend PostgreSQL real | 46 aprobados; incluye FastAPI real con EnginePort controlado, callbacks, concurrencia, replay, cuotas y A/B |
| Backend lint/formato/typecheck/build | Aprobados |
| npm audit | 0 vulnerabilidades después de actualizar dependencias transitivas; CI conserva sus gates |
| Flutter Foundation | 255 aprobados, build_runner/analyze aprobados |
| Flutter paridad | 267 aprobados; dos integraciones explícitas omitidas en la ejecución general, contabilizadas aparte |
| Flutter → núcleo sin Service | 1 integración explícita aprobada: entrypoint compilado NODE_ENV=production, cwd sin .env, PG real, cero credenciales Service, cero llamadas fetch salientes |
| Flutter → Service controlado | 1 integración explícita aprobada: Nest→FastAPI→EnginePort controlado→callback→PG→cliente |
| Flutter build_runner/analyze/Web release | Aprobados; advertencia de fuente Cupertino ausente no bloquea compilación |
| CI Backend 42b96fe | [40481064364 aprobado](https://github.com/CarlosAM03/saas-platform-backend/actions/runs/40481064364), quality/PG/Docker |
| CI Foundation 095e899 | [40480231249 aprobado](https://github.com/CarlosAM03/saas-platform-client/actions/runs/40480231249), tests/Web/compose/imagen productiva/smoke SPA |
| CI paridad | SHA y runs finales en JSON de evidencia; no hereda checks de Foundation |
| Docker local | No disponible; no se declara ejecutado |
| Contenedor Backend en ejecución | Build remoto aprobado; arranque/smoke del contenedor Backend no ejecutado localmente; el arranque validado del núcleo usa el mismo entrypoint compilado |
| Engine/Service propios | Evidencia previa del mismo código: Engine 247 aprobados y un E2E público deseleccionado; Service 94 y ruff aprobados. No se cuentan como rerun de esta jornada |

Los primeros CI se conservan: Backend falló por avisos de dependencias y se corrigió; las dos integraciones Flutter nuevas fallaron por generación de modelos ausente en checkout limpio y se agregó build_runner. No se desactivaron checks ni se renombraron fallos como aprobados.

## CSV y confidencialidad

Se inspeccionaron los seis XLSX autorizados de `DocsProspectorCLI/exports`, hoja `Businesses`, columnas Name/Category/Address/Phone/Email/Website/Language. Todos los valores poblados son texto; no hay fórmulas ni columna status. XLSX es OOXML; la salida candidata es CSV UTF-8 con coma y encabezados contractuales en minúscula, sin inventar campos ni modificar valores comerciales.

| Consulta histórica | Filas originales | Compatibles individualmente | Inválidas por nombre normalizado repetido |
|---|---:|---:|---:|
| Consultoría de software Tijuana | 89 | 85 | 4 |
| Desarrollo de software Tijuana | 99 | 95 | 4 |
| Empresa de software Tijuana | 87 | 87 | 0 |
| Software consulting company San Diego | 58 | 58 | 0 |
| Software development company San Diego | 100 | 98 | 2 |
| Software engineering company San Diego | 53 | 53 | 0 |
| **Conjunto combinado (reclasificado)** | **486** | **422** | **64** |

Las 64 son **filas marcadas por repetición**, no 64 grupos ni una autorización para descartarlas. Combinar consultas aumenta las coincidencias; por eso no se suman las compatibilidades individuales. Hay 0 filas vacías y 0 advertencias de fórmulas/tipos. El parser Backend no encontró otros errores de email/URL en estas candidatas. Archivo combinado: 76,636 bytes, por debajo de 5 MiB/1,000 registros. Elegibles sintácticamente: 422; requieren revisión: 64; elegibilidad definitiva y coincidencias en un tenant real **no evaluadas**.

Procedimiento reproducible: `python tools/prepare_cli_csv.py <xlsx autorizados> --output-dir .tmp/datra-review` (requiere openpyxl para lectura). El programa verifica hashes originales antes/después, conserva cada fila, escribe candidatos privados, manifiesto y ledger de archivo/fila/razón. Después se aplicó el parser CSV real del Backend en modo de lectura. Los contactos, candidatos, manifests con rutas privadas y diagnósticos por fila quedan en `.tmp` ignorado; no se publican en GitHub/assets/logs/CI. No se importaron contactos reales ni se ejecutó UPDATE_EXISTING real.

Demostración pública: `Docs/examples/prospects-demo-600.csv`, totalmente sintético. Preview 600 NEW, confirm 600 CREATE, persistencia PG, dashboard 601 con un manual, replay 409, B en cero. Esto valida tamaño y flujo; no convierte automáticamente los 486 reales en 600 ni garantiza su importabilidad.

## Arquitectura, contrato y límites

Engine→Service→Backend→Flutter conserva sus autoridades. Contrato público `Docs/Contracts/platform-api.v1.yaml` 1.1.0; capabilities `prospector-mvp-v1`. Contrato interno histórico sin modificaciones.

| Estado externo | Backend/Flutter |
|---|---|
| Deshabilitado | PROSPECTOR_INTEGRATION_PENDING; núcleo disponible; generación bloqueada |
| Habilitado sin política completa | PROSPECTOR_POLICY_NOT_CONFIGURED |
| Configurado inaccesible | PROSPECTOR_SERVICE_UNAVAILABLE |
| Verificación cliente fallida | PROSPECTOR_VERIFICATION_FAILED; falla cerrado |
| Disponible y autorizado | create=true, reason=null; política se revalida al crear |
| Capacidad ocupada | PROSPECTOR_CAPACITY_EXHAUSTED |
| Cuota agotada | TENANT_QUOTA_EXHAUSTED / GLOBAL_QUOTA_EXHAUSTED |

Sin Service: health depende sólo de PG; Auth, tenants, Users, campañas, prospectos, CSV, dashboard y lectura de Jobs funcionan; crear devuelve 503 sin reservar Job ni invocar Service. Callback sin credencial permanece denegado. La UI comunica que la generación automática todavía no está disponible y ofrece campañas/CSV.

Engine extrae/normaliza Google Maps, verifica identidades, registra incidencias/resultados parciales y limita 1–100 por búsqueda. El CLI portátil es su antecedente; los XLSX históricos no prueban extracción del Engine actual en SaaS. El navegador/entorno sigue siendo requisito. Service implementa FastAPI, admisión interna, cola/worker, Engine fuera del event loop y callbacks. Su registro es en memoria, capacidad acotada: sin recuperación durable, outbox, cancelación/exportación HTTP ni consulta HTTP de resultados. La integración HTTP está validada en entorno controlado; no hay despliegue externo ni extracción pública productiva certificados en esta ejecución.

## Matriz de entrega

V = VALIDADO en entorno controlado; I = IMPLEMENTADO; D = DESHABILITADO; P = PENDIENTE de validación/despliegue; N/A = NO APLICA. OPERATIVO en producción requiere smoke autenticado de la revisión servida; ninguna celda se marca operativa sólo por existir código.

| Funcionalidad | Engine | Service | Backend | Flutter | Producción inicial propuesta |
|---|---|---|---|---|---|
| Autenticación | N/A | N/A | V | V | P |
| Multi-tenancy | N/A | N/A | V | V | P |
| Usuarios | N/A | N/A | V | V | P |
| Campañas | N/A | N/A | V | V | P |
| Prospectos manuales | N/A | N/A | V | V | P |
| Importación CSV | N/A | N/A | V | V | P |
| Dashboard | N/A | N/A | V, listados | V, agrega listados | P |
| Búsqueda Google Maps | I/V previa | V controlado | V integración | V integración | D |
| Creación de Jobs | N/A | V controlado | V condicional | V condicional | D |
| Consulta de Jobs | N/A | Sin GET público | V | V | P; lectura existente |
| Resultados temporales | V previa | V callback | V, TTL1h | V | D para nuevas búsquedas |
| Cancelación HTTP | N/A al contrato SaaS | No implementado | D,503 | D | D |
| Exportación HTTP | N/A al contrato SaaS | No implementado | D,503 | D | D |
| Persistencia de scraping | N/A | N/A | D,503 | D | D |

Tenants: seleccionar/listar/consultar y crear según contrato; no se agregan PATCH/DELETE inexistentes. Users: crear/editar/listar/consultar y desactivar con ADMIN; DELETE de desactivación sólo ADMIN; PATCH conserva status según contrato para identidades locales y protege identidades compartidas/ADMIN. Campaigns: crear/editar/listar/detalle/archivo; borrado permanente sólo ADMIN y con restricciones relacionales. Prospects: crear manual/editar/listar/detalle/relaciones; sin DELETE nuevo. OAuth, registro público, facturación, nuevas fuentes, distribución y recuperación durable quedan fuera de alcance.

## Hallazgos pendientes

- P0 corregidos: revocación de autoridad, identidad global y diálogos. No se aceptan excepciones de aislamiento por horario.
- P1 funcional del núcleo: sin fallo contractual conocido en las pruebas; auditoría humana de los PR pendiente.
- P2 productivo: frontend público declarado 404, deployments inmutables protegidos por login Vercel, CORS sin autorización para orígenes comprobados, SHA Backend servido no verificable por health, secretos/ADMIN/backups/cuotas/costos sin acceso de control. No modificar esos recursos ni desplegar sin autorización posterior.
- P3 externo: credenciales, HTTPS, callbacks, cuotas, capacidad, navegador y E2E de extracción real pendientes antes de habilitar generación; no bloquea el núcleo con PROSPECTOR_ENABLED=false.

Secuencia y contingencia: [readiness](RELEASE_READINESS_MVP_2026-10-27.md). Presentación y guion: [segundo avance](Segundo_Avance_Prospector_SaaS_2026-10-27.md).


### Ensayo visual complementario

Web release real en loopback, Backend compilado production y PG aislado: login, selección A, campaña, archivo sintético, preview600 NEW, confirm600 CREATE, dashboard600; selección B con totales0; generación deshabilitada e historial accesible; logout y nuevo login correctos. Esta ejecución no contiene el manual de la integración automatizada (que espera601). Capturas en `Evidencias_2026-10-27`; no muestran credenciales ni datos DATRA. El build de ensayo usa API loopback y no se debe desplegar como artefacto productivo.
