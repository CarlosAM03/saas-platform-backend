
# DEV-ENV-001 — Entorno reproducible de desarrollo, testing, CI y gobernanza del backend

**Proyecto:** Plataforma SaaS de Prospección Automatizada y Gestión de Campañas de Marketing  
**Repositorio:** `CarlosAM03/saas-platform-backend`  
**Componente:** Backend NestJS  
**Baseline remoto auditado:** `main`  
**HEAD remoto auditado:** `af62f313d15a5a5be6b0aeed4ce7652e2dfb77b3`  
**Fecha:** 2026-10-09  
**Estado:** READY FOR IMPLEMENTATION  
**Tipo de trabajo:** Infraestructura de desarrollo / DevOps / Testing / Dependency Hardening / Gobernanza  
**Cambio funcional del producto:** NO AUTORIZADO  

---

# 1. Objetivo

Preparar el backend para que Carlos, Ángel y André puedan desarrollar en paralelo sin depender de una instalación local de Node.js, NestJS, Prisma o PostgreSQL y sin depender de una base compartida para el trabajo cotidiano.

El flujo principal que debe quedar disponible es:

```powershell
git clone <repository>
cd saas-platform-backend
docker compose up --build
```

y debe producir automáticamente:

```text
PostgreSQL 16 local
        ↓
healthcheck DB
        ↓
Prisma migrate deploy
        ↓
seed_dev idempotente
        ↓
NestJS development
        ↓
http://localhost:3000
        ↓
http://localhost:3000/api/docs
```

El único requisito local de infraestructura para ejecutar el backend será:

```text
Git
Docker Engine / Docker Desktop con Docker Compose
```

No deberán instalarse manualmente:

```text
Node.js
npm
Nest CLI
Prisma CLI
PostgreSQL
```

---

# 2. Estado auditado actual

## 2.1 Baseline remoto

El repositorio remoto `main` se encuentra en:

```text
af62f313d15a5a5be6b0aeed4ce7652e2dfb77b3
```

Actualmente contiene:

```text
Dockerfile
.dockerignore
.env.example
package.json
package-lock.json
Prisma/
src/
test/
Docs/
README.md
```

No contiene actualmente:

```text
compose.yml
compose.yaml
docker-compose.yml
.github/workflows/
.github/CODEOWNERS
.npmrc
.nvmrc
Prisma/seed_dev.ts
```

Tampoco existe actualmente un ruleset de protección de `main`.

---

# 3. Estado local previo al sprint

Codex debe considerar que el working tree local contiene cambios deliberados que **no deben descartarse**.

Antes de implementar deberá ejecutar:

```powershell
git status
git diff
git diff --cached
```

y conservar los cambios existentes.

Actualmente se conocen al menos estos cambios locales:

```text
README.md
→ modificado

Docs/Auditorias-Historico/DockerizacionPredeploy.md
→ archivo nuevo

package-lock.json
→ modificado posteriormente por npm audit fix
```

La copia local de `package-lock.json` posterior a:

```powershell
npm audit fix
```

sin `--force` debe tratarse como el candidato de baseline de dependencias para este sprint.

Codex **no debe restaurar el `package-lock.json` desde GitHub**.

No utilizar:

```text
git restore .
git reset --hard
git checkout -- .
git clean
```

ni operaciones equivalentes destructivas.

---

# 4. Estado comprobado antes del sprint

El baseline funcional que no debe degradarse es:

## Unit tests

```text
Test Suites: 3 passed
Tests:       14 passed
```

## E2E baseline

Ejecución confirmada:

```text
Test Suites: 5 passed
Tests:       73 passed
```

El primer fallo observado en `without-prospector.e2e-spec.ts` fue intermitente y posteriormente la suite completa pasó.

Además, el comando utilizado:

```powershell
npm run test:e2e -- --runInBand
```

produce:

```text
npm warn Unknown cli config "--runInBand"
```

por lo que no constituye una interfaz fiable para exigir ejecución serial.

Esta deficiencia será corregida mediante scripts explícitos.

---

# 5. Estado Docker comprobado

El Dockerfile actual fue construido correctamente:

```powershell
docker build -t saas-platform-backend:avance1 .
```

Resultado:

```text
18/18 FINISHED
```

La imagen también inició correctamente con:

```powershell
docker run --rm `
  --env-file .env `
  -p 3000:3000 `
  --name saas-platform-backend-avance1 `
  saas-platform-backend:avance1
```

NestJS alcanzó:

```text
Nest application successfully started
Environment: development
API base: http://localhost:3000/api/v1
Swagger: http://localhost:3000/api/docs
```

Por tanto, **el Dockerfile existente es un baseline funcional y no debe ser reemplazado**.

---

# 6. Preservación del despliegue Render

Render continuará utilizando:

```text
GitHub main
    ↓
Dockerfile
    ↓
runtime image
    ↓
Render Web Service
```

Docker Compose tendrá exclusivamente una función de desarrollo/testing local.

Render no deberá depender de:

```text
compose.yml
PostgreSQL Docker local
seed_dev
test-db
```

La incorporación de Compose no sustituye el mecanismo de despliegue existente.

---

# 7. Dockerfile: modificación permitida y restricciones

El Dockerfile actual tiene dos stages:

```text
builder
runtime
```

Puede añadirse un stage:

```text
development
```

para Docker Compose.

Arquitectura objetivo:

```text
development
├── dependencias completas
├── Nest CLI
├── Prisma CLI
├── ts-node
├── Prisma Client
└── start:dev

builder
├── npm ci
├── Prisma Client
└── nest build

runtime
├── dependencias productivas
├── Prisma Client Linux
├── dist/
├── Prisma/
├── Docs/
└── node dist/src/main.js
```

El comportamiento del stage final `runtime` debe permanecer equivalente al que ya fue validado para Render.

No introducir en el Dockerfile:

```text
npm audit fix
npm audit fix --force
npm update
migrate reset
seed_dev automático de producción
```

---

# 8. Docker Compose como interfaz de desarrollo

Crear:

```text
compose.yml
```

como interfaz oficial del entorno local.

El stack predeterminado tendrá tres responsabilidades lógicas:

```text
db
db-init
api
```

---

# 9. Servicio `db`

Utilizar:

```text
postgres:16
```

como PostgreSQL local.

Debe incluir:

```text
database
user
password
healthcheck
named volume
network interna de Compose
```

Las credenciales de este PostgreSQL serán valores exclusivamente locales de desarrollo.

No será necesario pedir al desarrollador que configure manualmente:

```text
DATABASE_URL
POSTGRES_USER
POSTGRES_PASSWORD
POSTGRES_DB
```

para el flujo predeterminado.

Compose suministrará esos valores.

---

# 10. Persistencia local

PostgreSQL utilizará un named volume.

Esto significa:

```powershell
docker compose stop
docker compose start
```

o:

```powershell
docker compose down
docker compose up
```

no deberán eliminar normalmente los datos.

Para destruir deliberadamente el entorno local:

```powershell
docker compose down -v
```

Eliminado el volumen, el siguiente:

```powershell
docker compose up --build
```

deberá reconstruir automáticamente el entorno.

---

# 11. Servicio `db-init`

No debe colocarse la lógica de migración y seed dentro del `CMD` productivo de NestJS.

Crear un servicio one-shot cuya responsabilidad sea:

```text
esperar db healthy
        ↓
prisma migrate deploy
        ↓
seed_dev
        ↓
exit 0
```

El servicio `api` debe depender del éxito de `db-init`.

Esto evita:

```text
race conditions
migraciones concurrentes
seed ejecutándose durante bootstrap de Nest
```

---

# 12. Servicio `api`

Debe:

```text
build target development
```

y ejecutar:

```text
npm run start:dev
```

Debe montar el source code desde el host para permitir hot reload.

Las dependencias instaladas dentro del contenedor no deben ser reemplazadas por un eventual `node_modules` del host.

El diseño deberá funcionar correctamente con Docker Desktop sobre Windows.

Si se requiere una configuración adicional de file watching para que `start:dev` detecte cambios mediante bind mount, puede añadirse, pero solamente después de comprobar que es necesaria.

---

# 13. Healthcheck del backend local

El servicio `api` deberá tener un healthcheck contra:

```text
/api/v1/health/ready
```

Estado esperado:

```json
{
  "status": "ok",
  "database": "up"
}
```

El entorno se considera operativo cuando:

```text
db       healthy
db-init  completed successfully
api      healthy
```

---

# 14. Nuevo seed de desarrollo

Crear:

```text
Prisma/seed_dev.ts
```

No sustituir:

```text
Prisma/seed.ts
```

Los dos tendrán responsabilidades diferentes.

---

# 15. Responsabilidad de `Prisma/seed.ts`

El seed existente continuará representando el bootstrap mínimo.

Actualmente:

```text
crea ADMIN si no existe
valida ADMIN existente
crea OWNER/MEMBER para un tenant existente
no inventa un tenant automáticamente
```

No convertirlo en dataset de demostración.

Puede recibir ajustes exclusivamente si son necesarios para separar configuración runtime de configuración seed.

---

# 16. Responsabilidad de `Prisma/seed_dev.ts`

Será el dataset oficial de:

```text
desarrollo local
integración compartida
demos
```

Debe cubrir todos los modelos actualmente existentes:

```text
Tenant
User
Role
UserTenant
Campaign
Prospect
CampaignProspect
ProspectingJob
```

---

# 17. Dataset mínimo de desarrollo

Crear como mínimo:

```text
2 Tenants

1 ADMIN global

por cada tenant:
  OWNER
  MEMBER
  roles OWNER/MEMBER

5–7 campañas totales

30–50 prospectos

CampaignProspect suficientes para demostrar
asociación de un prospecto con campañas adicionales

ProspectingJobs:
  QUEUED
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
```

El dataset deberá permitir demostrar:

```text
login
tenant selection
multi-tenancy
roles
users
campaigns
prospects
pagination
search
cross-tenant isolation
jobs históricos
```

---

# 18. Determinismo del seed

No utilizar Faker ni identificadores aleatorios para los registros centrales.

Usar:

```text
IDs deterministas
slugs deterministas
emails deterministas
sourceIdentifier determinista
```

Los IDs pueden declararse explícitamente aunque Prisma normalmente use `cuid()`.

Esto facilitará:

```text
demos
tests manuales
documentación
debugging
re-seed
```

---

# 19. Idempotencia del seed

Ejecutar:

```powershell
npm run prisma:seed:dev
```

varias veces no debe:

```text
duplicar datos
destruir datos manuales
resetear tablas
crear tenants adicionales
```

Utilizar según corresponda:

```text
upsert
findUnique + create/update
composite unique keys
IDs deterministas
```

No utilizar como comportamiento normal:

```text
TRUNCATE
DROP
deleteMany global
migrate reset
```

---

# 20. Contraseña de usuarios demo

El seed deberá utilizar una variable dedicada como:

```text
DEV_SEED_PASSWORD
```

para las cuentas de demo.

Compose proporcionará automáticamente un valor local de desarrollo.

La contraseña no debe quedar codificada directamente dentro de `seed_dev.ts`.

Para shared-dev podrá proporcionarse otro valor mediante configuración externa.

---

# 21. Clasificación explícita de la base

Introducir:

```text
DATABASE_ENV
```

con valores válidos:

```text
local
shared-dev
production
test
```

No inferir el entorno mediante:

```text
hostname
nombre de proyecto Supabase
IP
PORT
NODE_ENV
```

`NODE_ENV` describe el runtime.

`DATABASE_ENV` describe la criticidad/uso de PostgreSQL.

Son conceptos diferentes.

---

# 22. Restricción de `seed_dev`

`seed_dev.ts` deberá aceptar:

```text
DATABASE_ENV=local
DATABASE_ENV=shared-dev
```

y rechazar:

```text
DATABASE_ENV=production
```

Para `test`, el uso dependerá exclusivamente de pruebas específicas; el CI PostgreSQL no necesita seed_dev salvo que una suite explícitamente lo requiera.

---

# 23. Shared Development / Demo Supabase

La base Supabase ya provisionada para el equipo se clasificará como:

```text
shared-dev
```

Su uso será:

```text
integración frontend/backend
pruebas manuales compartidas
validación previa a demo
datos de demostración
pruebas remotas específicas
```

No será el backend PostgreSQL cotidiano de cada desarrollador.

No será utilizada por GitHub Actions.

---

# 24. Reset de Shared Development

Crear un flujo deliberado, no un comando ambiguo.

Nombre recomendado:

```text
db:reset:shared-dev
```

Debe exigir simultáneamente:

```text
DATABASE_ENV=shared-dev
ALLOW_DATABASE_RESET=true
```

Si cualquiera falta:

```text
ABORT
```

Después del reset:

```text
migrations
↓
seed_dev
```

deberán dejar el entorno compartido nuevamente en estado conocido.

Este comando no deberá poder actuar con:

```text
DATABASE_ENV=production
```

bajo ninguna circunstancia.

---

# 25. No utilizar Supabase para tests automáticos

Ni:

```text
Supabase shared-dev
```

ni ningún entorno remoto persistente será utilizado por:

```text
unit tests
E2E aisladas
PostgreSQL integration tests
CI
```

---

# 26. Auditoría de `jobs.postgres-spec.ts`

La suite existe actualmente y contiene siete pruebas.

La auditoría actual muestra que la suite **no debe eliminarse simplemente por provenir del bloque anterior de Ángel**.

Actualmente contiene pruebas todavía alineadas con el baseline:

```text
ausencia de tabla retirada de idempotencia
503 al intentar iniciar Jobs
auth/tenant/validation del endpoint deshabilitado
lectura de Jobs existentes
aislamiento tenant
callbacks deshabilitados
persist/export deshabilitados
Prospects con PostgreSQL real
```

Por tanto, el objetivo no es borrarla.

Codex deberá revisar cada caso y conservar únicamente las afirmaciones coherentes con el baseline actual.

---

# 27. Funciones que la suite PostgreSQL NO puede afirmar

No deberá probar como implementadas:

```text
idempotencia persistente
ejecución del Prospector
cache de resultados
persistencia automática de resultados Python
export real CSV/XLSX
cancelación física del Prospector
callbacks operativos
retry
timeout operacional
```

Si encuentra afirmaciones contradictorias fuera de la documentación, deberá reportarlas antes de cambiar lógica funcional.

---

# 28. Reclasificación de `jobs.postgres-spec.ts`

La suite no forma parte del baseline:

```text
5 suites
73 E2E
```

Debe clasificarse como:

```text
PostgreSQL Integration Suite
```

Puede conservar su nombre físico si renombrarlo no aporta suficiente valor.

Si se renombra, actualizar todos los scripts y documentación.

---

# 29. Causa del fallo PostgreSQL observado

El fallo actual:

```text
Authentication failed against database server at localhost
```

no debe interpretarse como fallo funcional del backend.

La suite requiere una base PostgreSQL real migrada.

Actualmente existe una relación poco clara entre:

```text
JOBS_TEST_DATABASE_URL
test/setup-env.ts
DATABASE_URL fallback localhost
```

Esto deberá corregirse.

---

# 30. Separación del setup PostgreSQL

Crear una configuración de testing específica para PostgreSQL.

Por ejemplo:

```text
test/setup-postgres-env.ts
test/jest-postgres.json
```

o estructura equivalente.

Usar un nombre más general para la variable:

```text
INTEGRATION_TEST_DATABASE_URL
```

en lugar de:

```text
JOBS_TEST_DATABASE_URL
```

porque la suite ya prueba también Prospects y comportamiento transversal.

La configuración PostgreSQL deberá fallar inmediatamente y con mensaje claro si falta:

```text
INTEGRATION_TEST_DATABASE_URL
```

No deberá caer silenciosamente a una base localhost arbitraria.

---

# 31. PostgreSQL de integración local

Compose deberá incluir, mediante profile o servicios explícitos:

```text
test-db
test-postgres
```

`test-db` será:

```text
PostgreSQL 16
efímero
separado de la DB de desarrollo
```

No reutilizar la base `db` donde el desarrollador está trabajando.

Esto evita que las fixtures de integración alteren su entorno manual.

---

# 32. Ejecución local de integración PostgreSQL

La interfaz esperada será equivalente a:

```powershell
docker compose --profile test run --rm test-postgres
```

o un comando igual de claro.

El flujo deberá hacer:

```text
test-db inicia
↓
healthcheck
↓
migrate deploy
↓
PostgreSQL integration suite
↓
contenedores de test desechables
```

---

# 33. Baselines de testing oficiales

Mantener claramente tres niveles.

## Unit

Baseline:

```text
3 suites
14 tests
```

## E2E aislado

Baseline:

```text
5 suites
73 tests
```

## PostgreSQL Integration

Baseline separado:

```text
test/jobs.postgres-spec.ts
```

El número actual de siete pruebas podrá mantenerse o variar después de la auditoría, siempre que Codex documente por qué.

---

# 34. Scripts de Jest corregidos

Agregar comandos explícitos.

Como mínimo:

```json
"test:unit:ci": "jest --runInBand",
"test:e2e:ci": "jest --config ./test/jest-e2e.json --runInBand"
```

No depender de:

```powershell
npm run test -- --runInBand
```

---

# 35. Scripts Prisma

Normalizar como mínimo:

```text
prisma:generate
prisma:migrate:dev
prisma:migrate:deploy
prisma:seed
prisma:seed:dev
```

El flujo automático Docker debe utilizar:

```text
prisma:migrate:deploy
```

no:

```text
prisma migrate dev
```

---

# 36. Scripts de comprobación no mutantes

Actualmente:

```text
npm run lint
```

ejecuta:

```text
eslint ... --fix
```

y:

```text
npm run format
```

ejecuta:

```text
prettier --write
```

Son comandos mutantes y no pueden usarse como gates CI.

Agregar:

```text
lint:check
format:check
```

sin modificación de archivos.

Por ejemplo:

```text
eslint ...
prettier --check ...
```

Mantener `lint` y `format` para uso manual si se desea.

---

# 37. Cobertura de formato

Los nuevos scripts de formato deberán incluir, como mínimo:

```text
src/**/*.ts
test/**/*.ts
Prisma/**/*.ts
```

para que:

```text
seed.ts
seed_dev.ts
```

también estén bajo las mismas reglas.

No debe realizarse un reformat masivo innecesario sin reportarlo.

Si el baseline actual falla `format:check`, Codex puede aplicar una normalización mecánica, pero deberá separar conceptualmente esos cambios de cualquier cambio semántico y reportarlos claramente.

---

# 38. Estado actual de dependencias

`package.json` remoto utiliza rangos semver, por ejemplo:

```json
"@nestjs/common": "^11.0.1",
"@nestjs/core": "^11.0.1",
"@prisma/client": "^5.16.1",
"prisma": "^5.16.1",
"jest": "^30.0.0"
```

Aunque `package-lock.json` fija el árbol utilizado por `npm ci`, el manifiesto directo no está congelado.

---

# 39. Baseline local de dependencias

El `package-lock.json` local posterior a:

```powershell
npm audit fix
```

sin `--force` debe ser la fuente primaria para este sprint.

Codex deberá:

1. inspeccionar su diff;
2. confirmar que no contiene downgrade/breaking change no autorizado;
3. ejecutar `npm ci`;
4. obtener las versiones directas efectivamente instaladas;
5. congelarlas exactamente en `package.json`;
6. actualizar el lockfile sin cambiar innecesariamente el árbol ya validado.

---

# 40. Congelación de versiones

Las dependencias directas de:

```text
dependencies
devDependencies
```

deberán quedar sin:

```text
^
~
*
latest
```

cuando sea posible.

Ejemplo conceptual:

```json
"@nestjs/common": "11.x.y"
```

en lugar de:

```json
"@nestjs/common": "^11.0.1"
```

Codex deberá utilizar las versiones realmente resueltas por el lockfile local, no inventar versiones.

---

# 41. `.npmrc`

Agregar:

```text
.npmrc
```

con:

```text
save-exact=true
```

para que futuras instalaciones directas no reintroduzcan rangos automáticamente.

No agregar credenciales ni registry tokens.

---

# 42. Versión de Node

Node 20 es el runtime oficial.

Debe quedar reflejado de forma coherente mediante:

```text
Dockerfile
package.json engines
.nvmrc
GitHub Actions
```

Configuración recomendada:

```text
Node major: 20
```

No es necesario fijar en este sprint el digest exacto de la imagen Docker.

---

# 43. Estado de seguridad de dependencias

Antes del `npm audit fix`:

```text
21 moderate
```

Después de `npm audit fix` sin force:

```text
21 moderate
```

npm indica que el resto requiere:

```text
npm audit fix --force
```

e incluso propone cambios incompatibles relacionados con Jest/ts-jest.

Eso no está autorizado.

---

# 44. Política de vulnerabilidades

CI deberá bloquear:

```text
critical
high
```

No deberá bloquear automáticamente:

```text
moderate
low
```

El gate será equivalente a:

```powershell
npm audit --audit-level=high
```

También deberá ejecutarse una auditoría de dependencias productivas:

```powershell
npm audit --omit=dev --audit-level=high
```

para diferenciar riesgo runtime de tooling.

---

# 45. Vulnerabilidades moderadas restantes

Las vulnerabilidades moderadas que solo puedan eliminarse mediante:

```text
--force
major upgrade
downgrade incompatible
```

se conservarán temporalmente como deuda técnica documentada.

No realizar manualmente un major upgrade únicamente para conseguir:

```text
0 vulnerabilities
```

durante este sprint.

La prioridad es:

```text
0 critical
0 high
árbol reproducible
baseline funcional intacto
```

---

# 46. Operaciones prohibidas sobre dependencias

Codex no debe ejecutar:

```text
npm audit fix --force
npm update
npm install <package>@latest
```

sin una justificación específica derivada de la auditoría.

CI tampoco ejecutará comandos de modificación de dependencias.

---

# 47. Simplificación de variables runtime

Actualmente `configuration.ts` exige:

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

La auditoría confirma que:

```text
ADMIN_NAME
ADMIN_EMAIL
ADMIN_PASSWORD
```

pertenecen al seed y no son necesarias para que NestJS atienda solicitudes después del bootstrap.

Por tanto, se autoriza retirarlas de:

```text
validateEnvironment()
```

del runtime.

---

# 48. Validación seed-only

`Prisma/seed.ts` ya valida por sí mismo:

```text
ADMIN_NAME
ADMIN_EMAIL
ADMIN_PASSWORD
```

Esa validación debe conservarse allí.

El cambio anterior no elimina las variables del seed.

Solo elimina una dependencia innecesaria del proceso NestJS.

---

# 49. `DATABASE_ENV`

Añadir `DATABASE_ENV` a la configuración donde sea necesario para scripts administrativos.

No es obligatorio que NestJS dependa funcionalmente de esta variable durante cada request.

Su principal consumidor será:

```text
seed_dev
reset scripts
development tooling
```

Evitar acoplar innecesariamente la lógica de aplicación a esta clasificación operacional.

---

# 50. `.env.example`

Reorganizarlo por bloques:

```text
Application runtime

Database

Authentication

CORS

Seed/bootstrap

Development seed

Prospector future integration

Integration testing
```

No incluir valores reales de infraestructura remota.

El quick start Compose local no deberá exigir copiar `.env.example` a `.env`.

---

# 51. Desarrollo local sin `.env`

El siguiente comando debe funcionar después del clone:

```powershell
docker compose up --build
```

sin:

```powershell
Copy-Item .env.example .env
```

Compose proporcionará los valores no sensibles necesarios para local development.

---

# 52. Configuración remota compartida

Para Supabase shared-dev sí puede utilizarse un archivo local ignorado, por ejemplo:

```text
.env.shared-dev
```

El repositorio puede contener:

```text
.env.shared-dev.example
```

sin secretos.

La configuración remota no forma parte del one-command local development.

---

# 53. `.gitignore`

Verificar que ignore:

```text
.env
.env.*
```

manteniendo únicamente ejemplos versionados mediante excepciones explícitas si fueran necesarias.

No introducir secretos al repositorio durante este sprint.

---

# 54. GitHub Actions

Crear:

```text
.github/workflows/ci.yml
```

No depender de:

```text
Supabase
Render
Prospector Service
credenciales personales
```

---

# 55. Job `quality`

Debe ejecutar aproximadamente:

```text
checkout
setup Node 20
npm ci
npm run prisma:generate
npm run lint:check
npm run format:check
npm run build
npm run test:unit:ci
npm run test:e2e:ci
npm audit --audit-level=high
npm audit --omit=dev --audit-level=high
```

---

# 56. Job `postgres-integration`

Debe levantar:

```text
PostgreSQL 16 service
```

con credenciales efímeras definidas dentro del workflow.

Después:

```text
npm ci
prisma generate
prisma migrate deploy
test PostgreSQL integration
```

La DB desaparece al terminar GitHub Actions.

---

# 57. Job `docker-build`

Debe ejecutar el mismo Dockerfile que usa Render:

```text
docker build .
```

No necesita publicar la imagen.

Su objetivo es impedir que un PR rompa:

```text
Dockerfile
COPY
Prisma Client
dist
Docs
runtime
```

sin ser detectado.

---

# 58. Nombres estables de checks

Los jobs CI deberán utilizar nombres estables porque posteriormente serán configurados como required status checks de `main`.

Por ejemplo:

```text
quality
postgres-integration
docker-build
```

No renombrarlos arbitrariamente una vez configurada la protección.

---

# 59. No mutar archivos desde CI

CI no deberá ejecutar:

```text
eslint --fix
prettier --write
npm audit fix
npm update
prisma migrate dev
prisma migrate reset
```

CI solamente verifica.

---

# 60. README actual

El README remoto continúa documentando desarrollo mediante:

```text
Node/npm local
PostgreSQL accesible
npm ci
prisma migrate deploy
start:dev
```

Ese ya no será el flujo principal después del sprint.

Debe actualizarse.

---

# 61. README local actualmente modificado

El bloque local agregado manualmente que contiene:

```text
docker run --rm ...
```

no debe convertirse en el quick start principal.

Puede:

```text
eliminarse
```

o conservarse como una breve sección:

```text
Ejecución manual de la imagen
```

después del flujo Compose.

Debe corregirse:

```text
numeración
frase incompleta
sección "El resultado final fue:"
```

No conservar texto incompleto.

---

# 62. Quick start final del README

La primera forma recomendada de ejecución será:

```powershell
docker compose up --build
```

Después mostrar:

```text
API
http://localhost:3000/api/v1

Swagger
http://localhost:3000/api/docs

Readiness
http://localhost:3000/api/v1/health/ready
```

---

# 63. Uso manual del Dockerfile

Puede documentarse como flujo secundario para:

```text
validación de imagen
debugging de runtime
reproducción del comportamiento de Render
```

No como workflow normal de desarrollo.

---

# 64. Documento histórico de Dockerización

El archivo local:

```text
Docs/Auditorias-Historico/DockerizacionPredeploy.md
```

debe incorporarse como evidencia histórica del trabajo realizado para desplegar el backend.

Debe permanecer claramente clasificado como:

```text
histórico
```

y no como guía vigente del entorno de desarrollo.

---

# 65. Nueva guía operacional

Crear:

```text
Docs/DevelopmentEnvironment.md
```

como autoridad del workflow actual.

Debe documentar:

```text
arquitectura local
Compose
PostgreSQL
db-init
seed_dev
persistencia
reset local
shared-dev
reset shared-dev
testing
CI
dependencias
troubleshooting
Git workflow
```

---

# 66. Autoridad documental

Después del sprint:

```text
README.md
→ onboarding rápido

Docs/DevelopmentEnvironment.md
→ operación vigente del entorno

Docs/Auditorias-Historico/
→ contexto histórico

ADRs
→ decisiones arquitectónicas

Contracts
→ contrato API
```

Los documentos históricos no deberán contradecir el README vigente sin que su condición histórica sea evidente.

---

# 67. Alcance funcional congelado

Codex no está autorizado a implementar ni reactivar:

```text
Prospector Service
Prospector Engine
scraping
callbacks operacionales
persist results
export real
cancelación física
idempotencia persistente
cache real
retry
timeout operacional
```

---

# 68. Prospector pendiente

El comportamiento vigente:

```text
PROSPECTOR_INTEGRATION_PENDING
HTTP 503
```

debe preservarse donde actualmente corresponde.

Los tests que lo validan deben seguir pasando.

---

# 69. Importación CSV

El módulo de importación CSV solicitado a Ángel está fuera de DEV-ENV-001.

No debe implementarse aquí.

Este sprint solamente debe entregar la infraestructura para que Ángel pueda desarrollarlo usando:

```text
Compose
PostgreSQL local
seed_dev
CI
```

---

# 70. Flutter

La integración del cliente Flutter está fuera del alcance.

André deberá poder usar:

```text
http://localhost:3000
```

como backend local una vez ejecute Compose.

No modificar código Flutter desde este repositorio.

---

# 71. Rama de trabajo

Codex no deberá desarrollar directamente sobre `main`.

Después de comprobar el estado local, crear una rama:

```text
chore/dev-env-001
```

o nombre equivalente.

Los cambios locales existentes deberán viajar a esa rama.

---

# 72. Commits y push

En la ejecución inicial de Codex:

```text
NO COMMIT
NO PUSH
NO MERGE
NO TAG
```

Codex deberá dejar el working tree preparado para revisión humana.

Carlos decidirá posteriormente cómo separar los commits.

---

# 73. Gobierno del repositorio

Después de que DEV-ENV-001 haya sido validado y fusionado, se protegerá:

```text
main
```

Actualmente no existe ruleset.

---

# 74. CODEOWNERS

Se autoriza crear:

```text
.github/CODEOWNERS
```

con Carlos como responsable global:

```text
* @CarlosAM03
```

Esto documenta ownership del repositorio.

La efectividad de revisión obligatoria dependerá del ruleset configurado posteriormente.

---

# 75. Ruleset final para `main`

Después de obtener una ejecución verde del nuevo CI, configurar:

```text
Target:
main

Require pull request:
ON

Required status checks:
quality
postgres-integration
docker-build

Restrict updates:
ON

Restrict deletions:
ON

Block force pushes:
ON
```

El bypass/update autorizado quedará reservado al administrador del repositorio.

Objetivo:

```text
Ángel / André:
branch
push branch
open PR

Carlos:
review
merge/update main
```

---

# 76. Scope real del control de PR

El mecanismo debe impedir que otros colaboradores:

```text
hagan push directo a main
mergeen cambios hacia main
```

No es necesario intentar impedir que el autor cierre su propio PR sin merge, porque eso no modifica `main`.

---

# 77. Protección después del CI

El ruleset no debe activarse antes de que:

```text
quality
postgres-integration
docker-build
```

existan y hayan corrido correctamente al menos una vez.

---

# 78. Portabilidad desde estado limpio

La prueba crítica del sprint deberá ejecutarse con:

```text
sin node_modules
sin .env
sin PostgreSQL instalado
sin volumen Docker previo
```

Requisito:

```powershell
docker compose up --build
```

debe dejar el backend operativo.

---

# 79. Reconstrucción limpia

Posteriormente:

```powershell
docker compose down -v
docker compose up --build
```

debe volver a producir exactamente un entorno funcional con dataset conocido.

---

# 80. Hot reload

Modificar un archivo TypeScript del backend desde el host debe provocar recompilación/reinicio de Nest dentro del contenedor de desarrollo.

Esto forma parte de la aceptación porque Compose no debe servir únicamente para ejecutar: debe servir para desarrollar.

---

# 81. Persistencia manual

Después de:

```powershell
docker compose down
docker compose up
```

los cambios manuales realizados sobre PostgreSQL local deben conservarse mientras no se elimine el volumen.

---

# 82. Idempotencia de inicialización

Reiniciar el stack no debe duplicar:

```text
tenants
users
roles
campaigns
prospects
jobs
```

creados por `seed_dev`.

---

# 83. Validación mínima local

Antes de cerrar DEV-ENV-001 ejecutar:

```text
npm ci
npm run prisma:generate
npm run lint:check
npm run format:check
npm run build
npm run test:unit:ci
npm run test:e2e:ci
npm audit --audit-level=high
npm audit --omit=dev --audit-level=high
```

---

# 84. Baseline mínimo esperado

No se acepta regresión respecto de:

```text
Unit:
14 / 14

E2E:
73 / 73
```

Si cambia el número de pruebas, Codex debe explicar exactamente:

```text
qué test cambió
por qué
si fue añadido
si fue retirado
qué requisito lo justifica
```

---

# 85. PostgreSQL Integration

Todas las pruebas que permanezcan dentro de la suite PostgreSQL después de la auditoría deberán quedar verdes contra:

```text
PostgreSQL efímero
```

No basta con omitir la suite del CI.

---

# 86. Docker productivo

Ejecutar:

```powershell
docker build -t saas-platform-backend:dev-env-validation .
```

Debe completar correctamente.

---

# 87. Smoke del runtime productivo

Después de construir la imagen final, ejecutar una prueba de arranque contra una DB compatible cuando sea viable.

Como mínimo debe comprobarse que el stage runtime conserva:

```text
node dist/src/main.js
Docs/
Prisma Client
0.0.0.0
PORT
```

---

# 88. Docker Compose validation

Validar:

```powershell
docker compose config
```

antes del `up`.

No deben existir errores de sintaxis ni variables obligatorias faltantes para local.

---

# 89. Compose health

Después:

```powershell
docker compose ps
```

debe mostrar:

```text
db       healthy
api      healthy
```

y `db-init` debe haber terminado correctamente.

---

# 90. Swagger local

Comprobar:

```text
http://localhost:3000/api/docs
```

---

# 91. Readiness local

Comprobar:

```text
GET /api/v1/health/ready
```

con:

```text
status=ok
database=up
```

---

# 92. Dataset de desarrollo

Comprobar mediante Prisma/API que existen registros seed para:

```text
Tenant
User
Role
UserTenant
Campaign
Prospect
CampaignProspect
ProspectingJob
```

---

# 93. Aislamiento multi-tenant del dataset

El seed debe permitir comprobar manualmente que:

```text
OWNER Tenant A
```

no puede acceder a información exclusiva de:

```text
Tenant B
```

y viceversa.

---

# 94. Prueba del seed repetido

Ejecutar `seed_dev` una segunda vez.

El número de registros deterministas no debe duplicarse.

---

# 95. Test PostgreSQL local Docker

Ejecutar la interfaz Docker creada para integration tests.

Debe utilizar:

```text
test-db
```

y no:

```text
db
shared-dev
production
```

---

# 96. Seguridad del CI

El workflow deberá ejecutarse únicamente con valores locales/efímeros.

No crear GitHub Secrets para:

```text
Supabase shared-dev
Supabase production
Render
```

para este pipeline.

No son necesarios.

---

# 97. Seguridad del build

No incorporar:

```text
.env
.env.shared-dev
credenciales
JWT reales
passwords reales
```

al Docker build context.

Revisar `.dockerignore` después de introducir nuevos archivos de entorno.

---

# 98. `.dockerignore`

Conservar como mínimo:

```text
node_modules
dist
coverage
.git
.github
.env
.env.*
*.log
```

Los archivos `.example` necesarios pueden mantenerse mediante excepciones.

---

# 99. Resultado esperado de dependencias

Al final:

```text
package.json
→ versiones directas exactas

package-lock.json
→ árbol validado posterior al audit fix seguro

npm ci
→ reproducible

npm audit full
→ moderate conocidos permitidos

npm audit --audit-level=high
→ PASS

npm audit --omit=dev --audit-level=high
→ PASS
```

---

# 100. Criterio de cierre

DEV-ENV-001 queda cerrado únicamente cuando se cumplan simultáneamente:

```text
Dockerfile productivo preservado
Docker Compose operativo
PostgreSQL local automático
migraciones automáticas
seed_dev idempotente
todos los modelos con datos
hot reload funcional
unit baseline verde
E2E baseline verde
PostgreSQL integration verde
CI verde
Docker build verde
0 high
0 critical
README actualizado
DevelopmentEnvironment documentado
DockerizacionPredeploy incorporado como histórico
package versions congeladas
CODEOWNERS creado
ruleset de main listo para configuración
```

La configuración administrativa del ruleset se realiza después de integrar y comprobar el CI.

---

# 101. Resultado arquitectónico final

```text
                         GitHub
                           │
                      protected main
                           │
              ┌────────────┴────────────┐
              │                         │
           CI/CD                    DEVELOPMENT
              │                         │
      PostgreSQL efímero          Docker Compose
      Unit / E2E / DB             ┌─────┴─────┐
      Docker build                │           │
                                NestJS    PostgreSQL
                                  │         local
                                  │
                                  └──── hot reload

                 SHARED INTEGRATION / DEMO
                           │
                      Supabase DEV

                       PRODUCTION
                           │
                 GitHub main → Render
                           │
                      Dockerfile
                           │
                      Supabase PROD
```

---

# 102. Archivos previstos

Como resultado normal del sprint se espera crear o modificar aproximadamente:

```text
Dockerfile
compose.yml

package.json
package-lock.json
.npmrc
.nvmrc

.env.example
.env.shared-dev.example     [si resulta útil]

Prisma/seed_dev.ts
Prisma/seed.ts              [solo si separación seed/runtime lo requiere]

src/common/config/configuration.ts
src/common/config/configuration.spec.ts

test/setup-env.ts
test/setup-postgres-env.ts  [probable]
test/jest-postgres.json     [probable]
test/jobs.postgres-spec.ts

.github/workflows/ci.yml
.github/CODEOWNERS

README.md
Docs/DevelopmentEnvironment.md
Docs/Auditorias-Historico/DockerizacionPredeploy.md
```

No todos son obligatorios si Codex encuentra una solución más simple que cumpla exactamente los requisitos.

---

# 103. Restricciones de implementación para Codex

Codex debe priorizar:

```text
mínimo cambio semántico
máxima reproducibilidad
separación dev/prod
Docker-only onboarding
scripts explícitos
tests aislados
documentación coherente
```

No debe aprovechar este sprint para realizar refactors generales.

No modificar lógica de dominio salvo que sea estrictamente necesario para cumplir un requisito de infraestructura ya aprobado.

Si encuentra una contradicción funcional no cubierta por esta especificación:

```text
NO decidir automáticamente
NO implementar una interpretación nueva
REPORTARLA
```

y continuar con los puntos que no dependan de esa decisión.

---
