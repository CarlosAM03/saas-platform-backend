# Reproducir la validación local

Ejecutar desde la raíz del backend con PowerShell, Git y Docker Desktop. Usar un nombre de proyecto nuevo cada vez. Las salidas detalladas permanecen en `.tmp/` y los resúmenes versionados omiten credenciales, tokens, identificadores de fixtures y cuerpos de respuesta.

```powershell
$sha = '<SHA de código del HANDOFF_FINAL>'
$short = $sha.Substring(0, 7)
$destination = '.tmp/cp-close-review'
if (Test-Path $destination) { throw 'Usar otro directorio de exportación' }
New-Item -ItemType Directory -Path $destination | Out-Null
git -c core.autocrlf=false archive --format=zip -o "$destination/source.zip" $sha
Expand-Archive -LiteralPath "$destination/source.zip" -DestinationPath "$destination/source"
Set-Content -LiteralPath "$destination/lab.env" -Value 'COMPOSE_DISABLE_ENV_FILE=1'
$project = 'cpclose11-review-' + [Guid]::NewGuid().ToString('N').Substring(0, 10)
$lab = @('-f', "$destination/source/compose.yml", '--env-file', "$destination/lab.env", '-p', $project, '--profile', 'test')
try {
    docker compose @lab run --build --rm test-postgres sh -c 'node -v && npm -v && node codex/backend-adr006/verify-target-guards.cjs && node codex/backend-adr006/verify-contract.cjs && npm run lint:check && npm run format:check && npm run build && npm run test:unit:ci -- --verbose && npm run test:e2e:ci -- --verbose && npm run prisma:migrate:deploy && npm run test:postgres -- --verbose && npm run test:postgres -- --testRegex "campaigns-performance[.]postgres-spec[.]ts$" --verbose'
    if ($LASTEXITCODE -ne 0) { throw 'La regresión local falló' }
} finally {
    docker compose @lab down
}
docker build -t "cp-close:$short" "$destination/source"
if ($LASTEXITCODE -ne 0) { throw 'La construcción Docker falló' }
& ./codex/cierre-pr11-backend/evidencias/Invoke-Runtime.ps1 -Image "cp-close:$short" -ComposeFile "$destination/source/compose.yml" -OutputDirectory "$destination/runtime"
```

El Dockerfile instala las dependencias con `npm ci` y genera Prisma 5.22.0. La validación funcional usa un PostgreSQL 16 sin puertos publicados. El runtime se prueba aparte en una red interna de Compose, con las variables del laboratorio y onboarding desactivado. El smoke consulta Swagger desde la interfaz loopback del propio contenedor. Se ejercitan de forma independiente el esquema vacío, ADR-006 poblado, la colisión DDL y la restauración de un respaldo sintético.

Repetir aparte sobre la exportación `npm audit --audit-level=high` y `npm audit --omit=dev --audit-level=high`. Comparar la huella `openapi.digest` de `smoke.log` con la indicada en [Contrato](CONTRATO_Y_HANDOFF.md). Para el arnés CP original, aplicar el procedimiento de finales de línea del mismo documento antes de ejecutar su verificador.
