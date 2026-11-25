param(
    [Parameter(Mandatory)] [ValidatePattern('^cp-close:[a-f0-9]{7,40}$')] [string] $Image,
    [Parameter(Mandatory)] [string] $ComposeFile,
    [Parameter(Mandatory)] [string] $OutputDirectory
)

$ErrorActionPreference = 'Stop'
$project = 'cpclose11-runtime-' + [Guid]::NewGuid().ToString('N').Substring(0, 10)
$runtime = "$project-api"
$network = "${project}_default"
$output = (New-Item -ItemType Directory -Path $OutputDirectory -Force).FullName
$envFile = Join-Path $output 'runtime.env'
$override = Join-Path $output 'runtime-compose.yml'
Set-Content -LiteralPath $envFile -Value 'COMPOSE_DISABLE_ENV_FILE=1'
Set-Content -LiteralPath $override -Value @'
networks:
  default:
    internal: true
'@
$compose = @('-f', (Resolve-Path -LiteralPath $ComposeFile).Path, '-f', $override,
    '--env-file', $envFile, '-p', $project, '--profile', 'test')

function Confirm-Exit([string] $Step) {
    if ($LASTEXITCODE -ne 0) { throw "$Step reported exit $LASTEXITCODE" }
}

try {
    $raw = docker compose @compose config --format json
    Confirm-Exit 'Compose configuration'
    $config = ($raw | Out-String | ConvertFrom-Json -AsHashtable)
    $pg = $config.services['test-db']
    $url = $config.services['test-postgres'].environment.DATABASE_URL
    if ($pg.ports -or !$config.networks.default.internal -or
        $pg.image -ne 'postgres:16' -or $url -notmatch '^postgresql://[^@]+@test-db:5432/saas_test$') {
        throw 'Unexpected PostgreSQL lab configuration'
    }

    docker compose @compose up -d --wait test-db
    Confirm-Exit 'PostgreSQL readiness'
    docker run --rm --network $network -e DATABASE_ENV=test -e "DATABASE_URL=$url" $Image npm run prisma:migrate:deploy *> (Join-Path $output 'migrate.log')
    Confirm-Exit 'Prisma migrate deploy'
    docker run --rm --network $network -e DATABASE_ENV=test -e "DATABASE_URL=$url" $Image ./node_modules/.bin/prisma migrate status >> (Join-Path $output 'migrate.log')
    Confirm-Exit 'Prisma migrate status'

    $jwt = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
    docker run --rm -d --name $runtime --network $network `
        -e DATABASE_ENV=test -e "DATABASE_URL=$url" -e PORT=3000 `
        -e "JWT_SECRET=$jwt" -e JWT_EXPIRES_IN=8h -e CORS_ORIGINS=https://cpclose.synthetic.test `
        -e TENANT_REGISTRATION_ENABLED=false $Image
    Confirm-Exit 'API container startup'
    $deadline = (Get-Date).AddSeconds(45)
    do {
        docker exec $runtime node -e 'fetch("http://127.0.0.1:3000/api/v1/health/ready").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))' 2>$null
        if ($LASTEXITCODE -eq 0) { break }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)
    Confirm-Exit 'API health/ready'

    Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'smoke-runtime.cjs') |
        docker exec -i $runtime node - *> (Join-Path $output 'smoke.log')
    Confirm-Exit 'Runtime smoke'
    Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'ensayo-migracion.cjs') |
        docker exec -i $runtime node - *> (Join-Path $output 'legacy.log')
    Confirm-Exit 'Legacy migration and interruption'

    $restore = @'
pg_dump -U saas_test -d saas_test -n cpclose_adr -Fc -f /tmp/cp11.dump
createdb -U saas_test cp11_restore
pg_restore -U saas_test -d cp11_restore --exit-on-error /tmp/cp11.dump
for database in saas_test cp11_restore; do
  psql -X -U saas_test -d "$database" -At -v ON_ERROR_STOP=1 -c '
    SELECT (SELECT count(*) FROM cpclose_adr.prospects),
           (SELECT count(*) FROM cpclose_adr.campaign_prospects),
           (SELECT count(*) FROM cpclose_adr.prospect_provenance),
           (SELECT count(*) FROM cpclose_adr._prisma_migrations WHERE finished_at IS NOT NULL);'
done
'@
    $counts = docker compose @compose exec -T test-db sh -ec $restore
    Confirm-Exit 'Synthetic backup restore'
    if (@($counts).Count -ne 2 -or $counts[0] -ne '3|4|1|4' -or $counts[1] -ne $counts[0]) {
        throw 'Unexpected row counts after synthetic restore'
    }
    [pscustomobject]@{ image = $Image; masters = 3; participations = 4; provenance = 1; migrations = 4 } |
        ConvertTo-Json -Compress | Set-Content -LiteralPath (Join-Path $output 'restore.log')
} finally {
    docker stop $runtime 2>$null | Out-Null
    docker compose @compose down
}
