# Despliegue del Backend — Avance 1

> Documento histórico del release Avance 1. La guía vigente del entorno de desarrollo es [DevelopmentEnvironment.md](../DevelopmentEnvironment.md).

## Plataforma SaaS de Prospección Automatizada y Gestión de Campañas de Marketing

**Componente:** Backend SaaS  
**Repositorio:** `CarlosAM03/saas-platform-backend`  
**Rama auditada:** `release/avance-1`  
**Destino de despliegue:** Render Web Service  
**Base de datos:** Supabase PostgreSQL  
**Contenerización:** Docker  
**Runtime:** Node.js 20 / Debian Bookworm Slim  
**Framework:** NestJS 11  
**ORM:** Prisma  
**Fecha del corte:** 28 de septiembre de 2026

---

## 1. Propósito del documento

Este documento registra el estado técnico, las decisiones, las pruebas y el procedimiento operativo utilizado para preparar y desplegar el backend de la plataforma durante el **Avance 1** del proyecto.

Su propósito es doble:

1. Servir como **runbook de despliegue**, indicando cómo publicar el backend en Render y cómo verificar que el servicio quedó operativo.
2. Servir como **registro histórico del release**, dejando constancia de qué se modificó, qué se validó y qué funcionalidades están realmente disponibles en este corte.

El documento corresponde específicamente a la rama:

```text
release/avance-1
```

y no debe interpretarse como documentación de funcionalidades futuras del Prospector Service o Prospector Engine.

---

# 2. Estado auditado del repositorio

## 2.1 Relación entre ramas

La auditoría del repositorio remoto muestra actualmente:

```text
main
  │
  ├── +6 commits funcionales/hardening presentes en dev
  │
dev
  │
  └── +1 commit específico de despliegue
       │
release/avance-1
```

Respecto a `dev`, `release/avance-1` se encuentra:

```text
ahead:  1 commit
behind: 0 commits
```

Por tanto, la rama de release contiene íntegramente el estado actual de `dev` y agrega exclusivamente el corte utilizado para preparar el despliegue.

Respecto a `main`, la rama de release está:

```text
ahead:  7 commits
behind: 0 commits
```

Esto significa que **`main` todavía no representa el candidato de despliegue actual**. La promoción hacia `main` debe realizarse solamente después de cerrar las validaciones descritas en este documento.

---

## 2.2 Cambios específicos introducidos por `release/avance-1`

La comparación directa:

```text
dev
  ↓
release/avance-1
```

muestra cuatro archivos modificados o agregados:

| Archivo | Estado | Propósito |
|---|---|---|
| `.dockerignore` | Nuevo | Excluir archivos innecesarios y secretos del contexto Docker |
| `Dockerfile` | Nuevo | Construcción productiva multi-stage |
| `src/main.ts` | Modificado | Bind HTTP en `0.0.0.0` |
| `package-lock.json` | Modificado | Cambio de resolución de dependencias detectado durante preparación |

El commit de despliegue creado localmente fue:

```text
af62f31
chore(deploy): containerize backend for avance 1
```

y fue publicado en:

```text
origin/release/avance-1
```

---

# 3. Hallazgo pendiente del audit: `package-lock.json`

Existe una consideración que debe quedar registrada antes de promover el release a `main`.

La rama de release modifica:

```text
package-lock.json
```

sin que exista un cambio equivalente en:

```text
package.json
```

Entre los cambios observados se encuentran resoluciones como:

```text
@nestjs/platform-express
11.2.3 → 11.2.6

multer
2.2.0 → 2.4.0
```

además de modificaciones transitivas asociadas.

Este cambio **no forma parte conceptualmente de la contenerización**.

Por tanto, antes del merge definitivo hacia `main`, debe tomarse una decisión explícita:

```text
A. conservar el nuevo lockfile,
   si se acepta formalmente la nueva resolución de dependencias;

o

B. restaurar package-lock.json desde dev,
   manteniendo el release exclusivamente enfocado en despliegue.
```

Para un release mínimo y controlado, la opción más conservadora es mantener las dependencias del baseline de `dev`, siempre que la reconstrucción Docker y las pruebas continúen pasando después de restaurarlo.

Este hallazgo **no impidió las pruebas realizadas**: el backend compiló, las suites pasaron y la imagen Docker fue construida y ejecutada correctamente.

---

# 4. Alcance funcional del backend desplegado

El backend actual constituye una plataforma SaaS funcional de gestión.

El corte desplegable incluye:

```text
Auth
Users
Tenants
Campaigns
Prospects persistidos
Health
Tenant Context
RBAC
JWT
Logging
Request ID
Validation
Swagger/OpenAPI
Prisma/PostgreSQL
```

También existen estructuras correspondientes a:

```text
Prospecting Jobs
Prospector Client
```

pero esto **no significa que la integración con Python esté implementada**.

El propio documento OpenAPI generado por el backend declara como disponibles:

- Auth.
- Users.
- Tenants.
- Campaigns.
- Prospects persistidos.
- Health.
- consulta de Jobs previamente persistidos.

Y declara explícitamente como no disponibles:

```text
inicio real de prospección
cancelación operacional
persistencia de resultados
exportación
callbacks operacionales
scraping
cache real de resultados
idempotencia persistente
```

Las operaciones no disponibles están protegidas y responden con:

```text
503
PROSPECTOR_INTEGRATION_PENDING
```

cuando corresponde.

Por tanto, el backend del Avance 1 se describe correctamente como:

> **Plataforma SaaS funcional; capacidad de prospección preparada arquitectónicamente pero todavía no integrada.**

---

# 5. Arquitectura de despliegue del Avance 1

La infraestructura seleccionada es:

```text
                      INTERNET
                          │
                          │ HTTPS
                          ▼
                  ┌────────────────┐
                  │     Vercel     │
                  │  Flutter Web   │
                  └───────┬────────┘
                          │
                          │ HTTPS / REST / JWT
                          ▼
                  ┌────────────────┐
                  │  Render Free   │
                  │                │
                  │ Docker         │
                  │ NestJS 11      │
                  │ Node.js 20     │
                  │ Prisma         │
                  └───────┬────────┘
                          │
                          │ PostgreSQL / TLS
                          ▼
                  ┌────────────────┐
                  │ Supabase Free  │
                  │ PostgreSQL     │
                  └────────────────┘
```

El Prospector Service no forma parte de este despliegue.

---

# 6. Contenerización

## 6.1 Imagen base

La imagen utilizada es:

```dockerfile
node:20-bookworm-slim
```

Se eligió Debian Slim en lugar de Alpine para reducir riesgos relacionados con dependencias nativas utilizadas por:

```text
Prisma
bcrypt
OpenSSL
```

---

## 6.2 Estrategia multi-stage

El Dockerfile actualmente presente en `release/avance-1` es:

```dockerfile
FROM node:20-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run prisma:generate \
    && npm run build

FROM node:20-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY Prisma ./Prisma
RUN npm ci --omit=dev \
    && npm run prisma:generate \
    && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY Docs ./Docs

USER node

CMD ["node", "dist/src/main.js"]
```

La construcción separa:

```text
Builder
├── dependencias completas
├── Prisma Client
└── compilación NestJS

Runtime
├── dependencias productivas
├── Prisma Client generado en Linux
├── dist/
├── Prisma/
├── Docs/
└── ejecución como usuario node
```

---

# 7. Prisma dentro del contenedor

Prisma Client se genera nuevamente dentro del stage Linux:

```dockerfile
RUN npm ci --omit=dev \
    && npm run prisma:generate
```

Esta decisión evita depender de binarios Prisma generados previamente en Windows.

Por tanto:

```text
Windows node_modules
≠
runtime Linux node_modules
```

La imagen final contiene un Prisma Client generado dentro del mismo entorno Debian que posteriormente ejecutará la aplicación.

Esta estrategia fue comprobada mediante construcción y arranque real de la imagen.

---

# 8. Recursos requeridos en runtime

La carpeta:

```text
Docs/
```

debe formar parte de la imagen.

No es solamente documentación estática.

`src/common/openapi/deployment-document.ts` ejecuta en runtime:

```typescript
readFileSync(
  './Docs/Contracts/platform-api.v1.yaml',
  'utf8',
);
```

Por tanto, eliminar `Docs/` de la imagen provocaría que el backend pudiera compilar pero fallara durante el bootstrap de Swagger.

La imagen también conserva:

```text
Prisma/
```

porque se requiere `schema.prisma` durante la generación del cliente en el stage runtime.

---

# 9. Archivos excluidos del contexto Docker

El `.dockerignore` actual contiene:

```dockerignore
node_modules
dist
coverage
.git
.github
.env
.env.*
!.env.example
*.log
.npmrc
*.pem
*.key
*.p12
*.pfx
```

La intención es impedir principalmente la incorporación accidental de:

```text
.env
credenciales
claves privadas
certificados privados
node_modules de Windows
historial Git
artefactos locales
```

No se excluyen:

```text
Prisma/
Docs/
```

porque son parte del proceso de construcción/runtime.

---

# 10. Configuración HTTP para Render

Antes del release, NestJS utilizaba:

```typescript
await app.listen(port);
```

La rama de despliegue utiliza:

```typescript
await app.listen(port, '0.0.0.0');
```

La aplicación obtiene el puerto mediante:

```typescript
const port = configService.getOrThrow<number>('PORT');
```

Por tanto, no existe un puerto de producción hardcodeado en el código.

Esta configuración coincide con el modelo de Render: un Web Service debe escuchar en `0.0.0.0`, y Render recomienda utilizar el valor de `PORT`; el puerto predeterminado actual para Web Services es `10000`. :chatgpt-content-reference{index="0"}

---

# 11. Variables de entorno obligatorias

El validador del backend exige actualmente:

```text
NODE_ENV
PORT
DATABASE_URL
JWT_SECRET
JWT_EXPIRES_IN
CORS_ORIGINS
ADMIN_NAME
ADMIN_EMAIL
ADMIN_PASSWORD
```

Además:

```text
JWT_EXPIRES_IN
```

debe ser exactamente:

```text
8h
```

según el baseline actual.

---

## 11.1 Variables para Render

La configuración esperada es:

```env
NODE_ENV=production

DATABASE_URL=<SUPABASE_SESSION_POOLER_URL>

JWT_SECRET=<SECRETO_UNICO_DE_PRODUCCION>

JWT_EXPIRES_IN=8h

CORS_ORIGINS=https://<frontend>.vercel.app

ADMIN_NAME=<ADMIN_NAME>
ADMIN_EMAIL=<ADMIN_EMAIL>
ADMIN_PASSWORD=<ADMIN_PASSWORD>
```

### PORT

Render proporciona un valor `PORT` a los Web Services y recomienda que la aplicación escuche en él. El backend ya está preparado para consumirlo. :chatgpt-content-reference{index="1"}

Si fuera necesario configurarlo explícitamente:

```env
PORT=10000
```

es compatible con la infraestructura actual.

---

# 12. Variables de Prospector

No deben habilitarse para este avance:

```text
PROSPECTOR_SERVICE_URL
PROSPECTOR_API_KEY
PLATFORM_CALLBACK_BASE_URL
```

El `.env.example` las conserva comentadas.

Su presencia futura no debe confundirse con disponibilidad funcional de la integración.

---

# 13. Administración de secretos

Nunca deben incorporarse al repositorio ni al Dockerfile:

```text
DATABASE_URL
JWT_SECRET
ADMIN_PASSWORD
credenciales Supabase
API keys
```

Render permite configurar variables de entorno para servicios Docker y las expone al runtime. Los secretos no deben convertirse en `ARG` del Dockerfile ni utilizarse durante el build, porque podrían terminar almacenados en la imagen. :chatgpt-content-reference{index="2"}

El Dockerfile actual no requiere ningún secreto durante la construcción.

---

# 14. Conectividad con Supabase

## 14.1 Hallazgo durante la validación Docker

Inicialmente se utilizó la conexión directa:

```text
db.<project-ref>.supabase.co:5432
```

Desde el contenedor se obtuvo:

```text
Prisma P1001
Can't reach database server
```

El problema no estaba relacionado con:

```text
Prisma Client
Dockerfile
NestJS
password
schema
```

sino con el endpoint de red utilizado.

Supabase utiliza IPv6 para la conexión directa en el plan correspondiente, mientras que Render aparece entre las plataformas para las que la conectividad IPv6 puede no estar disponible. Para backends persistentes en redes IPv4, Supabase recomienda el **Shared Session Pooler**. :chatgpt-content-reference{index="3"}

---

## 14.2 Conexión seleccionada

Para el runtime se utiliza:

```text
Supavisor / Session Pooler
Port 5432
```

con una cadena conceptualmente equivalente a:

```text
postgresql://postgres.<PROJECT_REF>:<PASSWORD>@<POOLER_HOST>:5432/postgres
```

Supabase documenta específicamente este modo para Prisma en despliegues basados en servidor y redes IPv4. :chatgpt-content-reference{index="4"}

Esta misma conexión fue validada satisfactoriamente desde el contenedor Docker local.

---

# 15. Error histórico de configuración de `DATABASE_URL`

Durante la prueba inicial con Session Pooler apareció:

```text
P1003
Database `postgres%20%20` does not exist
```

La causa fue la existencia de espacios adicionales al final del nombre:

```text
/postgres··
```

que fueron interpretados como:

```text
/postgres%20%20
```

La cadena correcta debe terminar exactamente en:

```text
/postgres
```

Este incidente se registra porque puede reproducirse al copiar manualmente variables a Render.

Antes del despliegue se debe revisar que:

```text
DATABASE_URL
```

no contenga:

```text
espacios iniciales/finales
saltos de línea
comillas adicionales
%20 no intencionales
```

---

# 16. Ciclo de vida de la base de datos

La base Supabase utilizada para este avance ya se encuentra:

```text
provisionada
migrada
con schema aplicado
con ADMIN inicial
operativa
```

Por tanto, el arranque del contenedor **no ejecuta migraciones**.

No existe:

```dockerfile
CMD ["sh", "-c", "npx prisma migrate deploy && ..."]
```

El runtime ejecuta solamente:

```text
node dist/src/main.js
```

La decisión arquitectónica es:

```text
Database lifecycle
        ≠
Application lifecycle
```

---

## 16.1 Comandos prohibidos en producción

Nunca utilizar contra la base productiva:

```bash
npx prisma migrate reset
```

ni:

```bash
npm run prisma:seed
```

salvo que exista un procedimiento de aprovisionamiento explícito y autorizado.

Para releases futuros que incluyan migraciones nuevas:

```bash
npx prisma migrate deploy
```

debe ejecutarse como una acción deliberada y controlada.

---

# 17. Estado de las migraciones

El repositorio mantiene el baseline Prisma actual.

Existe además una advertencia documentada por el propio README:

> si un entorno hubiese aplicado previamente `20260925000100_job_idempotency`, debe revisarse su historial antes de desplegar porque la eliminación del archivo de migración no elimina físicamente estructuras existentes.

Para el Avance 1 no debe introducirse ninguna corrección de schema durante el despliegue.

---

# 18. Validaciones previas a Docker

Antes de contenerizar se ejecutaron:

```text
npm ci
npm run prisma:generate
npm run build
```

Resultado:

```text
Prisma generate    OK
NestJS build       OK
```

---

# 19. Pruebas automatizadas

La validación definitiva previa al release obtuvo:

```text
Unit tests
3 suites
14 tests
14 passed
```

y:

```text
E2E
5 suites
73 tests
73 passed
```

Durante una ejecución previa se observó un timeout aislado en:

```text
without-prospector.e2e-spec.ts
```

pero la ejecución serial posterior completó:

```text
5/5 suites
73/73 tests
```

Por tanto, no se identificó una regresión funcional asociada al release.

---

# 20. Suite PostgreSQL específica de Jobs

Existe:

```bash
npm run test:jobs:db
```

Esta prueba necesita:

```text
JOBS_TEST_DATABASE_URL
```

apuntando a una **base PostgreSQL desechable y migrada específicamente para testing**.

No debe utilizarse la base productiva de Supabase para esta suite.

La ausencia de esa variable no constituye una falla del backend productivo.

---

# 21. Construcción Docker validada

Se ejecutó:

```powershell
docker build -t saas-platform-backend:avance1 .
```

Resultado:

```text
19/19 pasos completados
Build FINISHED
```

La imagen fue creada correctamente:

```text
saas-platform-backend:avance1
```

La inspección local mostró aproximadamente:

```text
Disk usage:    592 MB
Content size:  143 MB
```

No se considera necesaria una optimización de tamaño para este avance académico mientras el runtime permanezca funcional y reproducible.

---

# 22. Ejecución del contenedor

Se ejecutó:

```powershell
docker run --rm `
  --env-file .env `
  -p 3000:3000 `
  --name saas-platform-backend-avance1 `
  saas-platform-backend:avance1
```

El resultado final fue:

```text
Nest application successfully started
```

y el backend quedó disponible localmente en:

```text
http://localhost:3000
```

---

# 23. Validación Docker → Supabase

El resultado operativo comprobado fue:

```text
Windows 11
    ↓
Docker Desktop / WSL2
    ↓
Linux container
    ↓
Node.js 20
    ↓
NestJS
    ↓
Prisma Linux
    ↓
Supavisor Session Pooler
    ↓
Supabase PostgreSQL
```

Todos los componentes participaron en la prueba real.

---

# 24. Health checks verificados

Se probaron:

```text
GET /api/v1/health
GET /api/v1/health/live
GET /api/v1/health/ready
```

Los tres devolvieron HTTP `200`.

Resultados:

```text
/health
status = ok

/health/live
status = ok

/health/ready
status   = ok
database = up
```

Por tanto:

```text
NestJS        OK
Docker        OK
Prisma        OK
Supabase      OK
```

El endpoint de readiness es especialmente importante porque ejecuta una comprobación contra PostgreSQL.

---

# 25. Health Check seleccionado para Render

Configurar:

```text
/api/v1/health/ready
```

como:

```text
Health Check Path
```

del Web Service.

Render admite HTTP health checks y considera saludable una respuesta `2xx` o `3xx`. Su documentación recomienda que este endpoint verifique dependencias críticas, incluyendo una consulta sencilla a base de datos. :chatgpt-content-reference{index="5"}

En este proyecto:

```text
200 en /ready
=
NestJS operativo
+
Prisma operativo
+
Supabase accesible
```

por lo que es preferible a utilizar solamente `/health/live`.

---

# 26. Configuración recomendada en Render

Crear:

```text
New
→ Web Service
```

Repositorio:

```text
CarlosAM03/saas-platform-backend
```

Configuración esperada después de promover el release:

```text
Branch:          main
Language:        Docker
Dockerfile:      ./Dockerfile
Compute Plan:    Free
Health Check:    /api/v1/health/ready
```

Render puede construir directamente la imagen a partir del Dockerfile almacenado en el repositorio; no es necesario publicar previamente la imagen en Docker Hub. :chatgpt-content-reference{index="6"}

---

# 27. Rama a desplegar

El modelo de promoción definido para el Avance 1 es:

```text
dev
 ↓
release/avance-1
 ↓
validación
 ↓
main
 ↓
Render
```

No se recomienda configurar permanentemente Render contra:

```text
release/avance-1
```

El servicio productivo académico debe apuntar a:

```text
main
```

una vez aprobado y fusionado el release.

La rama de release debe conservarse temporalmente hasta completar el smoke test productivo.

---

# 28. Tag del corte estable

Una vez integrado y validado en `main`, crear:

```text
avance1-backend-stable
```

Este tag representa:

> la versión conocida estable utilizada para la entrega y exposición del Avance 1.

No crear el tag antes de completar el merge definitivo.

---

# 29. CORS

Actualmente NestJS obtiene:

```text
CORS_ORIGINS
```

y lo divide por comas:

```typescript
configService
  .getOrThrow<string>('CORS_ORIGINS')
  .split(',');
```

Por tanto puede utilizarse:

```env
CORS_ORIGINS=https://frontend.vercel.app
```

o durante una transición:

```env
CORS_ORIGINS=http://localhost:<PORT>,https://frontend.vercel.app
```

Para producción final debe conservarse únicamente el origen realmente necesario.

No utilizar:

```text
*
```

para evitar abrir innecesariamente la API a cualquier origen de navegador.

---

# 30. NODE_ENV

La prueba Docker local se realizó utilizando el `.env` de desarrollo, por lo que el backend informó:

```text
Environment: development
```

Esto era esperado durante la validación local.

En Render debe definirse:

```env
NODE_ENV=production
```

El Dockerfile ya contiene:

```dockerfile
ENV NODE_ENV=production
```

pero la configuración explícita del servicio debe ser coherente con ese valor.

---

# 31. Swagger

Swagger debe permanecer accesible en:

```text
/api/docs
```

y el documento JSON en:

```text
/api/docs-json
```

Durante el smoke test productivo debe comprobarse que:

```text
https://<service>.onrender.com/api/docs
```

carga correctamente.

Esto verifica indirectamente que:

```text
Docs/Contracts/platform-api.v1.yaml
```

está presente en el runtime.

---

# 32. Smoke test productivo

Después del primer deploy en Render ejecutar, en este orden:

```text
1. GET /api/v1/health
2. GET /api/v1/health/live
3. GET /api/v1/health/ready
4. GET /api/docs
5. POST /api/v1/auth/login
6. GET /api/v1/auth/me
7. GET /api/v1/tenants
8. seleccionar tenant
9. GET /api/v1/users
10. GET /api/v1/campaigns
```

El smoke test debe comprobar:

```text
HTTP
JWT
Prisma
Supabase
tenant context
RBAC
CORS
Swagger
```

No necesita demostrar Prospector.

---

# 33. Criterios de aceptación productiva

El backend se considera desplegado satisfactoriamente cuando:

```text
[ ] Render construye Dockerfile sin errores
[ ] el contenedor arranca
[ ] Render detecta correctamente el puerto
[ ] /health responde 200
[ ] /health/live responde 200
[ ] /health/ready responde 200
[ ] database=up
[ ] Swagger carga
[ ] login funciona
[ ] auth/me funciona
[ ] tenants funciona
[ ] operación tenant-aware funciona
[ ] CORS acepta únicamente frontend autorizado
[ ] no aparecen errores Prisma
[ ] Prospector pendiente permanece protegido
```

---

# 34. Limitaciones de Render Free

El servicio se despliega como entorno académico y de demostración, no como infraestructura empresarial.

Render indica actualmente que sus Web Services gratuitos pueden entrar en reposo después de **15 minutos sin tráfico**, reactivándose con la siguiente petición. :chatgpt-content-reference{index="7"}

Por tanto, antes de una exposición:

```text
5–10 minutos antes
        ↓
abrir backend
        ↓
consultar /health/ready
        ↓
realizar login
        ↓
mantener servicio caliente
```

No debe utilizarse el cold start durante una exposición como prueba de rendimiento del backend.

---

# 35. Auto-deploy

Render puede redesplegar automáticamente cuando se realizan pushes a la rama vinculada. :chatgpt-content-reference{index="8"}

Para este proyecto se recomienda:

```text
Render
→ branch main
→ auto-deploy habilitado
```

una vez estabilizado el flujo.

Sin embargo, durante el Avance 1 debe evitarse hacer pushes experimentales a `main`.

El flujo recomendado permanece:

```text
feature/dev
   ↓
release
   ↓
validación
   ↓
main
   ↓
auto-deploy
```

---

# 36. Rollback

El rollback debe basarse en Git, no en modificaciones manuales dentro de Render.

Si una versión posterior presenta una regresión:

```text
identificar último tag estable
        ↓
crear corrección/revert en Git
        ↓
promover nuevamente a main
        ↓
Render redeploy
```

Para este corte, el tag previsto es:

```text
avance1-backend-stable
```

No utilizar cambios manuales dentro del contenedor porque las instancias son artefactos efímeros.

---

# 37. No realizar estas acciones durante deploy

No ejecutar:

```text
prisma migrate reset
```

No ejecutar automáticamente:

```text
prisma migrate dev
```

No ejecutar seed automáticamente.

No hardcodear:

```text
DATABASE_URL
JWT_SECRET
ADMIN_PASSWORD
```

No introducir `.env` en Docker.

No habilitar Prospector.

No modificar schema durante la publicación.

No cambiar dependencias para resolver problemas de infraestructura sin diagnosticar primero la causa.

No desplegar `dev` como entorno productivo académico.

---

# 38. Estado del release al cierre de la fase Docker

El backend ha cumplido:

```text
Compilación              ✅
Prisma Client            ✅
Unit tests 14/14         ✅
E2E 73/73                ✅
Dockerfile               ✅
.dockerignore            ✅
Docker build             ✅
Runtime Linux            ✅
NestJS container         ✅
Prisma container         ✅
Supabase connectivity    ✅
Health                   ✅
Liveness                 ✅
Readiness                ✅
Database up              ✅
Release branch remota    ✅
```

Pendiente:

```text
resolver decisión package-lock
        ↓
merge release → main
        ↓
tag
        ↓
Render
        ↓
smoke test público
```

---

# 39. Estado de disponibilidad funcional

Después del deploy, la plataforma podrá demostrar:

```text
Autenticación            Disponible
JWT                      Disponible
Tenants                  Disponible
Users                    Disponible
Campaigns                Disponible
Prospects persistidos    Disponible
Aislamiento tenant       Disponible
Health                   Disponible
Swagger                  Disponible
Supabase                 Disponible
Jobs lectura             Disponible según estado persistido

Prospección real         Pendiente
Scraping                 Pendiente
Prospector Service       Pendiente
Prospector Engine        Pendiente
Callbacks                Pendiente
Persist results          Pendiente
Export                   Pendiente
Cancelación operacional  Pendiente
```

Esta distinción debe conservarse tanto en la exposición como en documentación posterior.

---

# 40. Próximo procedimiento operativo

Antes de desplegar en Render:

```text
1. Resolver package-lock.json.
2. Revalidar build/tests si se modifica.
3. Confirmar release limpio.
4. Merge release/avance-1 → main.
5. Push main.
6. Crear tag avance1-backend-stable.
7. Crear Render Web Service.
8. Seleccionar Docker.
9. Configurar variables.
10. Usar Session Pooler de Supabase.
11. Configurar /api/v1/health/ready.
12. Ejecutar primer deploy.
13. Revisar logs.
14. Ejecutar smoke test.
15. Registrar URL pública.
```

---

# 41. Línea base resultante

Cuando se complete el procedimiento, la línea base del backend para el Avance 1 será:

```text
GitHub main
     │
     │ Docker build
     ▼
Render Web Service
     │
     │ Node.js 20
     │ NestJS 11
     │ Prisma
     ▼
Supabase Session Pooler
     │
     ▼
PostgreSQL
```

La publicación representa un **entorno productivo académico reproducible**, construido a partir de código versionado, configuración externa y un contenedor validado previamente de forma local.

---

## 42. Registro histórico resumido

Durante la preparación del release se presentaron tres incidencias principales.

Primero, Docker no estaba instalado en la estación Windows 11. Se instaló Docker Desktop mediante `winget`, se habilitó `VirtualMachinePlatform`, se confirmó WSL 2 y se validó Docker Engine.

Segundo, la conexión directa a Supabase desde Docker produjo:

```text
P1001
Can't reach database server
```

La causa se resolvió utilizando Supavisor Session Pooler sobre IPv4, decisión que además es compatible con Render. Supabase documenta al Session Pooler `:5432` como opción apropiada para backends persistentes en redes IPv4. :chatgpt-content-reference{index="9"}

Tercero, una cadena `DATABASE_URL` contenía espacios finales y Prisma interpretó el nombre como:

```text
postgres%20%20
```

produciendo `P1003`. Al corregir la URL a `/postgres`, el contenedor inició correctamente.

La prueba final obtuvo:

```text
Nest application successfully started

/api/v1/health       → 200
/api/v1/health/live  → 200
/api/v1/health/ready → 200
database             → up
```

Con esto quedó validada la ruta:

```text
Host Windows
→ Docker / WSL2
→ Linux
→ Node 20
→ NestJS
→ Prisma
→ Supabase Session Pooler
→ PostgreSQL
```

y la fase de **contenerización y validación local del backend para el Avance 1 queda técnicamente cerrada**.

---
