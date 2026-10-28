param(
  [ValidatePattern('^[a-z0-9-]{1,24}$')][string]$RunId = 'replay',
  [ValidateRange(1024,65535)][int]$HttpsPort = 3444,
  [ValidatePattern('^172[.]([1-2][0-9]|3[01])[.][0-9]{1,3}[.]0/24$')][string]$Subnet = '172.30.66.0/24'
)
$ErrorActionPreference='Stop'
$taskRoot=(Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
Set-Location -LiteralPath $taskRoot
function D {
  & docker @args
  if($LASTEXITCODE -ne 0){throw "Docker step failed (exit $LASTEXITCODE). Stop; inspect private local diagnostics."}
}
$prefix="prospector-g1-$RunId"
$network="$prefix-net"
$pg="$prefix-pg"
$tools="$prefix-tools"
$dev="prospector-g1-dev:$RunId"
$core="prospector-g1-core:$RunId"
$candidate="prospector-g1-candidate:$RunId"
$lab=Join-Path $taskRoot ".tmp/g1-$RunId"
if(Test-Path -LiteralPath $lab){throw 'RunId directory already exists; choose a new RunId. No cleanup is automatic.'}
$existing=& docker ps -a --filter "name=$prefix" --format '{{.Names}}'
if($existing){throw 'RunId containers already exist; choose a new RunId.'}
New-Item -ItemType Directory -Path (Join-Path $lab 'core') -Force | Out-Null
D build --target development -t $dev .
D build -t $candidate .
& git archive --format=tar "--output=$lab/core.tar" b51b265f1a545fa915f1dd1c57ef2f5858ec6492
if($LASTEXITCODE -ne 0){throw 'Historical baseline archive failed'}
D run --rm --network none --mount "type=bind,source=$lab,target=/lab" $dev tar -xf /lab/core.tar -C /lab/core
D build -t $core (Join-Path $lab 'core')
D network create --internal --subnet $Subnet --label prospector.g1=synthetic $network
D run -d --name $pg --network $network --network-alias prospector-g1-pg --label prospector.g1=synthetic --tmpfs /var/lib/postgresql/data -e POSTGRES_USER=g1_lab -e POSTGRES_PASSWORD=synthetic-g1-only -e POSTGRES_DB=g1_test postgres:16
$ready=$false
for($i=0;$i -lt 60;$i++){ & docker exec $pg pg_isready -U g1_lab -d g1_test *> $null; if($LASTEXITCODE -eq 0){$ready=$true;break};Start-Sleep -Milliseconds 500 }
if(!$ready){throw 'PostgreSQL readiness failed'}
D run -d --name $tools --network $network --label prospector.g1=synthetic -e NODE_ENV=test -e DATABASE_ENV=test -e DATABASE_URL=postgresql://g1_lab:synthetic-g1-only@prospector-g1-pg:5432/g1_test -e INTEGRATION_TEST_DATABASE_URL=postgresql://g1_lab:synthetic-g1-only@prospector-g1-pg:5432/g1_test $dev sleep infinity
D exec $tools npm run prisma:migrate:deploy
D exec $tools node codex/backend-adr006/qa.cjs
D exec $tools node codex/backend-adr006/lab/rehearsal.cjs collision g1_collision
function Start-Api($name,$image,$database,$trust=''){
  $aliases=if($trust){@('--network-alias','prospector-g1-proxy-api')}else{@()}
  D run @aliases -d --name $name --network $network --label prospector.g1=synthetic -e NODE_ENV=production -e PORT=3000 "-e" "DATABASE_URL=postgresql://g1_lab:synthetic-g1-only@prospector-g1-pg:5432/$database" -e JWT_SECRET=synthetic-laboratory-signing-key-32-characters -e JWT_EXPIRES_IN=8h -e CORS_ORIGINS=https://frontend.example.test -e TENANT_REGISTRATION_ENABLED=false "-e" "TRUSTED_PROXY_CIDRS=$trust" $image
}
D exec $tools node codex/backend-adr006/lab/rehearsal.cjs prepare g1_history_1
foreach($iteration in 1,2){
  $database="g1_history_$iteration"
  if($iteration -eq 2){
    D exec $pg createdb -U g1_lab $database
    D exec $pg pg_restore -U g1_lab -d $database --exit-on-error /tmp/g1-before.dump
  }
  $old="$prefix-old-$iteration"
  Start-Api $old $core $database
  D exec $tools node codex/backend-adr006/lab/rehearsal.cjs before $database "http://${old}:3000"
  D exec $tools node codex/backend-adr006/lab/rehearsal.cjs save $database
  if($iteration -eq 1){D exec $pg pg_dump -U g1_lab -d $database -Fc -f /tmp/g1-before.dump}
  D exec $tools node codex/backend-adr006/lab/rehearsal.cjs migrate $database
  D restart $old
  D exec $tools node codex/backend-adr006/lab/rehearsal.cjs old-after $database "http://${old}:3000"
  D stop $old
  $new="$prefix-new-$iteration"
  Start-Api $new $candidate $database
  D exec $tools node codex/backend-adr006/lab/rehearsal.cjs candidate $database "http://${new}:3000"
  D stop $new
}
D exec $tools node codex/backend-adr006/lab/check-legacy-login.cjs prepare
$caseApi="$prefix-old-case"
Start-Api $caseApi $core g1_case
D exec $tools node codex/backend-adr006/lab/check-legacy-login.cjs before "http://${caseApi}:3000"
D exec -e DATABASE_URL=postgresql://g1_lab:synthetic-g1-only@prospector-g1-pg:5432/g1_case $tools node codex/backend-adr006/preflight.cjs --expected-host prospector-g1-pg --expected-db g1_case --apply
D exec $tools node codex/backend-adr006/lab/check-legacy-login.cjs after "http://${caseApi}:3000"
D stop $caseApi
D exec $tools node codex/backend-adr006/lab/rehearsal.cjs save g1_history_2
D exec -e DATABASE_URL=postgresql://g1_lab:synthetic-g1-only@prospector-g1-pg:5432/g1_history_2 -e INTEGRATION_TEST_DATABASE_URL=postgresql://g1_lab:synthetic-g1-only@prospector-g1-pg:5432/g1_history_2 $tools node codex/backend-adr006/qa.cjs --postgres-only
D exec $tools node codex/backend-adr006/lab/rehearsal.cjs check g1_history_2
# Local TLS trust is restricted to the test process. No OS trust-store changes.
D exec $tools sh -c 'openssl req -x509 -newkey rsa:2048 -nodes -keyout /tmp/g1.key -out /tmp/g1.crt -days 1 -subj /CN=frontend.example.test -addext subjectAltName=DNS:frontend.example.test > /tmp/g1-tls.log 2>&1'
D cp "${tools}:/tmp/g1.key" (Join-Path $lab 'g1.key')
D cp "${tools}:/tmp/g1.crt" (Join-Path $lab 'g1.crt')
$proxyIp=($Subnet -replace '[.]0/24$','.200')
$proxyApi="$prefix-proxy-api"
Start-Api $proxyApi $candidate g1_history_2 "$proxyIp/32"
D run -d --name "$prefix-proxy" --network $network --network-alias frontend.example.test --ip $proxyIp --label prospector.g1=synthetic -p "127.0.0.1:${HttpsPort}:443" --mount "type=bind,source=$taskRoot/codex/backend-adr006/lab/nginx.conf,target=/etc/nginx/nginx.conf,readonly" --mount "type=bind,source=$lab/g1.crt,target=/etc/nginx/g1.crt,readonly" --mount "type=bind,source=$lab/g1.key,target=/etc/nginx/g1.key,readonly" nginx:1.28.0-alpine
D exec -e NODE_EXTRA_CA_CERTS=/tmp/g1.crt $tools node codex/backend-adr006/lab/rehearsal.cjs candidate g1_history_2 https://frontend.example.test
D exec -e NODE_EXTRA_CA_CERTS=/tmp/g1.crt -e DATABASE_URL=postgresql://g1_lab:synthetic-g1-only@prospector-g1-pg:5432/g1_history_2 $tools node codex/backend-adr006/lab/check-deployment.cjs
D run --rm --network $network --mount "type=bind,source=$lab/g1.crt,target=/tmp/g1.crt,readonly" -e NODE_EXTRA_CA_CERTS=/tmp/g1.crt $dev node codex/backend-adr006/lab/check-deployment.cjs --second-client
Write-Output "PASS: isolated synthetic rehearsal $RunId. PostgreSQL and TLS proxy remain active. G2_REAL_DATA = NOT RUN. No teardown or production operation was performed."
