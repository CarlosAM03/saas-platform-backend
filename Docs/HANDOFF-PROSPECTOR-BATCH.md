# Handoff de integración y producción de Prospector

La generación permanece deshabilitada. El contrato público está en
[platform-api.prospecting-batch.v1.yaml](Contracts/platform-api.prospecting-batch.v1.yaml).
La [ratificación INT-001 a INT-007](ADRs/ADR-INT-BATCH-001.md) rige la revisión,
la incorporación y la liquidación de resultados. El contrato privado batch v1
del Service y el pin de Engine permanecen vigentes.

## Referencias de entrega

| Componente | Revisión consolidada | Trabajo siguiente |
| --- | --- | --- |
| Engine | `61ca0f0c881c2281b24ed48c0ece21c3aad8a964`, [PR #1](https://github.com/CarlosAM03/prospector-engine/pull/1) | CI acreditado 8/8. El Service conserva el pin probado `68aca39b42a21ae8c0b54b6e6ca93840fdad27e5`. |
| Service | `6a6c3d01e10fd6b6a401518bcd5a76bf20bd4ecb`, [PR #3](https://github.com/CarlosAM03/prospector-service/pull/3) sobre la base `bf150e4d4eeff80de83208446eb540d880e30048` | [CI de main 9/9](https://github.com/CarlosAM03/prospector-service/actions/runs/45730341899). Aislamiento del bridge y sonda de egress en el [PR #4](https://github.com/CarlosAM03/prospector-service/pull/4). |
| Backend | main `afe49e53a787625b50df0b9d27850f82cf52bfae`, dev `f231c8d820fe89849f74b10bde279a9fd53108ad` | CI acreditado 3/3 para main. Integración en el [Draft PR #13](https://github.com/CarlosAM03/saas-platform-backend/pull/13). |
| Flutter | main `e752f6ca692d2840263cd9e59e0927c56aa129ec`, dev `2fdba28bf394d8a103b4f61deba98cd37061b2cd` | [PR #11](https://github.com/CarlosAM03/saas-platform-client/pull/11) y [PR #12](https://github.com/CarlosAM03/saas-platform-client/pull/12) esperan Backend compatible. Integración en el [Draft PR #14](https://github.com/CarlosAM03/saas-platform-client/pull/14). |

Los PR experimentales [Backend #6](https://github.com/CarlosAM03/saas-platform-backend/pull/6)
y [Flutter #8](https://github.com/CarlosAM03/saas-platform-client/pull/8) se conservan
para revisión del propietario. El flujo vigente usa batch v1 y confirmación humana.
La aceptación independiente de [Flutter UI/UX #13](https://github.com/CarlosAM03/saas-platform-client/pull/13)
sigue pendiente.

## Variables por proveedor

| Destino | Configuración |
| --- | --- |
| Vercel | `API_BASE_URL` conserva el origen público de Render. `PROSPECTOR_BATCH_ENABLED=false` al compilar. |
| Render | Mantener el entorno de producción vigente, incluidos `NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGINS`, `TRUSTED_PROXY_CIDRS` y la configuración de registro. |
| Adaptador NestJS | `PROSPECTOR_BATCH_ENABLED=false`, `PROSPECTOR_BATCH_SERVICE_ORIGIN` HTTPS, `PROSPECTOR_BATCH_SOLUTION_ID`, `PROSPECTOR_BATCH_ASSERTION_ISSUER`, `PROSPECTOR_BATCH_ASSERTION_AUDIENCE` y `PROSPECTOR_BATCH_TIMEOUT_MS`. |
| Secretos privados | Render usa `PROSPECTOR_BATCH_API_KEY`, `PROSPECTOR_BATCH_ASSERTION_KEY` y `PROSPECTOR_BATCH_CALLBACK_KEY`. Service monta sus valores correspondientes y una clave HMAC de SQLite independiente. `JWT_SECRET` permanece en Render. |
| Supabase | Verificar conexión PostgreSQL con TLS, usuario de ejecución, permisos, historial de Prisma y respaldo restaurable. Verificar acceso del usuario de ejecución a las tablas privadas en el ensayo de migración, con Data API excluida. |
| VM y Nginx | Usar el [runbook del Service](https://github.com/CarlosAM03/prospector-service/pull/3) para imagen fijada, TLS, IP de salida de Render, reglas de entrada y salida, seccomp, volúmenes y recuperación. |

## Orden operativo

1. Verificar respaldo restaurable de Supabase y estado de las migraciones
   antes de promover Flutter. En la última consulta a producción únicamente
   constaba `20260909152421_init`. Supabase tenía 1 de las 3 tablas CP
   esperadas y 0 de las 4 tablas batch. La secuencia histórica de CP incluye una
   corrección que elimina filas derivadas de procedencia. El propietario
   valida el alcance de filas afectadas y ensaya sobre una restauración
   aislada antes de autorizar el procedimiento compatible.
2. En Render, confirmar el servicio, la base Supabase conectada, el comando de
   pre-deploy y el SHA activo. El 25 de noviembre readiness respondió 200 y
   el OpenAPI servido contenía las 25 operaciones CP del handoff con definiciones
   iguales, 39 rutas y 77 esquemas. Verificar migraciones, CORS y comportamiento
   autenticado con una cuenta sintética sobre la revisión que vaya a servir Flutter.
3. Con ese Backend disponible, integrar Flutter #11 con merge commit.
   Retargetear #12 a main, revisar diff y CI y fusionar con merge commit.
   Incorporar la historia documental exclusiva de dev según el handoff CT-03,
   verificar los 147 cambios documentales y avanzar dev por fast-forward.
   Comprobar el SHA servido por Vercel.
4. Llevar los Draft PR de batch a revisión después de validar PostgreSQL
   local, regresión, fixtures del Service y CI. Ensayar la candidatura de
   Service en Linux con el preflight obligatorio y las reglas de red. Los
   accesos de Render a GCP y los callbacks autenticados a Render deben
   verificarse desde sus orígenes efectivos. Ningún secreto llega a Flutter.
5. Con aprobación de los componentes y del entorno, ejecutar batch sintético
   con una cuenta de prueba. Comprobar una admisión, recuperación de estados,
   callback autenticado, revisión humana, persistencia PostgreSQL, ACK
   posterior al commit y purga separada. Mantener la generación deshabilitada
   hasta la aceptación del propietario.

## Rollback y resultados inciertos

- Vercel y Render vuelven a su última revisión de aplicación comprobada,
  con el flag deshabilitado. Retener las migraciones aditivas compatibles.
  Cualquier restauración de datos requiere su propio procedimiento aprobado.
- Service detiene nuevas admisiones y conserva SQLite y su clave HMAC.
  Si falta evidencia de cleanup, preservar la cuarentena y recuperar mediante
  reinicio controlado de la VM. Reconciliar los estados con Platform. La pérdida
  de un snapshot se registra y nunca desencadena una nueva consulta.
- Con respuesta incierta de admisión se conserva el mismo identificador y
  clave idempotente y se reconcilian los estados. La confirmación comercial
  durable se conserva aunque falle ACK. La purga se solicita por separado.

## Recibo del laboratorio

- **PASS** — Las siete migraciones de la rama se aplicaron a PostgreSQL 16
  desechable. La última activa RLS en las cuatro tablas batch y revoca el
  acceso para los roles de Data API presentes.
- **PASS** — La suite `prospecting-batch.postgres-spec.ts` pasó 4/4 con NestJS
  y PostgreSQL locales. Acredita roles y aislamiento, replay y correlación,
  callbacks duplicados o fuera de orden, revisión parcial, rechazo de
  colisiones, incorporación transaccional, procedencia y preservación del
  estado comercial. Comprueba el rechazo de un snapshot expirado, que el
  commit sobrevive un error de ACK y un reinicio de NestJS con un cliente
  Prisma nuevo, y que el replay recupera ACK y purga.
- **PASS** — Una de esas cuatro pruebas usó el Service FastAPI real por
  HTTPS con CA sintética local y su Engine de fixture. Capturó los callbacks
  producidos por el Service y los reenvió a NestJS en orden inverso. Validó
  reconciliación, snapshot, exportación, persistencia, ACK y purga.
- **PASS** — El cliente Flutter acreditó dos pruebas del contrato HTTP.
  El build de Vercel conserva el indicador de generación deshabilitado por
  defecto. Dos pruebas de widgets cubren la denegación de MEMBER antes de HTTP
  y la reconciliación y revisión de un resultado parcial por OWNER. [CI Flutter 3/3](https://github.com/CarlosAM03/saas-platform-client/actions/runs/45730814431)
- **PASS** — Los tres jobs de Backend para el código de integración cubren
  calidad, regresión PostgreSQL y build de contenedor.
  [CI del código de integración](https://github.com/CarlosAM03/saas-platform-backend/actions/runs/45730251263)
- **PASS** — CI de Service con seccomp SEC-003 y sandbox en Chromium
  sintético, una lane, cinco consultas y cinco snapshots. El perfil por
  defecto de Docker falló en el mismo ensayo. El SBOM y la revisión
  residual conservan cuatro hallazgos críticos del escáner. [Recibo de seguridad](https://github.com/CarlosAM03/prospector-service/actions/runs/45729655246/artifacts/15075544388)
- **PASS** — Vercel producción figura `READY` en
  `e752f6ca692d2840263cd9e59e0927c56aa129ec`.
  [Despliegue observado](https://vercel.com/carlos-armentas-projects/saas-platform-client-web/81xLKLTjGfat1mnPmMvfbpA7Rims)
- **NOT_RUN** — Ruta directa de callbacks Render–GCP, reinicio de procesos de
  producción, prueba live de Google Maps y concurrencia física de 25 workers.
- **BLOCKED** — Publicación productiva coordinada hasta verificar migraciones
  CP y SHA activo en Render. La aceptación productiva permanece pendiente.

La aceptación productiva continúa pendiente de migraciones, verificación de los
proveedores, preflight de red y sandbox en GCP y recorrido integral autorizado.
