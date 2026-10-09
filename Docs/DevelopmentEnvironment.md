# Entorno de desarrollo del backend

Esta es la guía operacional vigente para DEV-ENV-001. El [README](../README.md) contiene el inicio rápido; `Auditorias-Historico/` conserva evidencias de releases anteriores.

## Arquitectura y arranque

Con Git y Docker Compose, desde un clon limpio:

```powershell
docker compose up --build
```

No se requiere Node, npm, Prisma, PostgreSQL ni `.env` en el host. `db` ejecuta PostgreSQL 16 con el volumen `dev-postgres`. `db-init` espera el healthcheck, ejecuta `prisma migrate deploy` y el seed de desarrollo, y termina en cero. `api` espera ese resultado, usa el target `development` del Dockerfile y ejecuta `npm run start:dev` en el puerto 3000. Sólo `src/`, `Prisma/` y `Docs/` se montan desde el host: `node_modules` permanece dentro de la imagen. El bind mount de `src/` permite hot reload.

- API: http://localhost:3000/api/v1
- Swagger: http://localhost:3000/api/docs
- Readiness: http://localhost:3000/api/v1/health/ready

`docker compose ps` debe mostrar `db` y `api` healthy; `db-init` debe terminar satisfactoriamente. `Docs/Contracts/platform-api.v1.yaml` es necesario para Swagger.

El Dockerfile conserva `runtime` como etapa final para Render. Compose usa `development` sólo en local. Render construye el Dockerfile directamente y no utiliza Compose, PostgreSQL local ni `seed_dev`.

## Datos y persistencia

`Prisma/seed.ts` es el bootstrap mínimo y valida `ADMIN_NAME`, `ADMIN_EMAIL` y `ADMIN_PASSWORD`. `Prisma/seed_dev.ts` es otro flujo: requiere `DATABASE_ENV=local` o `shared-dev` y `DEV_SEED_PASSWORD` de al menos 12 caracteres. Compose aporta una contraseña exclusiva del entorno local. El seed crea o conserva 2 tenants, 1 ADMIN, un OWNER y MEMBER por tenant, roles y memberships, 6 campañas, 36 prospectos, asociaciones adicionales y Jobs históricos en los cinco estados. Usa IDs, slugs, emails y source identifiers deterministas. Sus `upsert` con actualización vacía no duplican ni borran datos manuales.

`docker compose down` seguido de `docker compose up` preserva el volumen. El reset local explícito es:

```powershell
docker compose down -v
docker compose up --build
```

El primer comando destruye el volumen de desarrollo del proyecto. No lo use para conservar datos manuales.

## Shared-dev

Shared-dev es una base remota para integración manual y demos, no para CI ni pruebas automáticas. Copie `.env.shared-dev.example` a un archivo local ignorado, introduzca valores externos y cargue esas variables en la sesión. `DATABASE_ENV` clasifica la base (`local`, `shared-dev`, `production`, `test`) y es independiente de `NODE_ENV`. `seed_dev` rechaza `production`.

El reset remoto compartido es deliberado y destructivo: `npm run db:reset:shared-dev` exige simultáneamente `DATABASE_ENV=shared-dev`, `ALLOW_DATABASE_RESET=true`, `DATABASE_URL` y `DEV_SEED_PASSWORD`. Ejecuta `prisma migrate reset --force --skip-seed` y después `seed_dev`. Nunca usar este comando para producción o CI. Revise la URL y coordine con el equipo antes de ejecutarlo.

## Pruebas y calidad

```powershell
npm ci
npm run prisma:generate
npm run lint:check
npm run format:check
npm run build
npm run test:unit:ci
npm run test:e2e:ci
docker compose --profile test run --rm test-postgres
```

Unitarias y E2E son suites aisladas. `test-postgres` levanta `test-db` PostgreSQL 16 efímera, aplica `migrate deploy` y ejecuta la suite PostgreSQL. No toca `db` ni Supabase. Para correrla fuera de Compose, establezca `INTEGRATION_TEST_DATABASE_URL` hacia una base desechable y migrada; el harness falla si falta. Las fixtures de la suite se limpian por sus IDs.

El CI tiene tres checks estables: `quality`, `postgres-integration` y `docker-build`. Usa Node 20, PostgreSQL efímero y ninguna credencial remota. Los scripts `lint:check` y `format:check` no modifican archivos. El manifiesto fija versiones directas exactas, `.npmrc` establece `save-exact=true`, y `npm ci` usa el lockfile. Las auditorías `npm audit --audit-level=high` y `npm audit --omit=dev --audit-level=high` bloquean high/critical; moderate/low se reportan y revisan sin cambios forzados de major.

## Flujo Git y protección posterior de main

Trabaje en ramas, abra PR hacia `main` y revise los tres checks. Después de integrar y comprobar CI, Carlos configurará un ruleset de `main` con PR obligatorio, required checks `quality`, `postgres-integration`, `docker-build`, restricción de updates y deletions, y bloqueo de force pushes. El administrador será el actor autorizado para actualizar o fusionar `main`. CODEOWNERS declara `@CarlosAM03` como responsable global; el ruleset se configura fuera de este repositorio.

## Solución de problemas

- Si `db-init` falla, consulte `docker compose logs db-init` y `docker compose ps`; verifique que `db` está healthy. No use `migrate reset` sobre bases remotas para ocultar discrepancias de historial.
- Si `api` no está healthy, consulte `docker compose logs api` y compruebe `/api/v1/health/ready`; ese endpoint verifica PostgreSQL.
- Si el puerto 3000 está ocupado, inicie Compose con `API_HOST_PORT=3001` en el entorno de la sesión; la API quedará en `localhost:3001` sin cambiar el puerto interno.
- Si hot reload no detecta cambios con Docker Desktop, compruebe que el montaje de `src/` está activo y reinicie `api`. No cambie la configuración de watch sin reproducir el problema.
- Si la suite PostgreSQL falla por falta de URL, utilice el comando Compose anterior o configure una base local desechable. Nunca apunte tests automáticos a shared-dev o producción.
