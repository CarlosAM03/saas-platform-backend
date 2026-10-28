param([string]$FlutterPath,[string]$StatePath,[switch]$SkipBuild)
$ErrorActionPreference='Stop'
function Invoke-Docker { & docker @args; if ($LASTEXITCODE -ne 0) { throw ('Docker failed: '+($args -join ' ')) } }
function New-LocalSecret { $bytes=New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Fill($bytes); return [Convert]::ToHexString($bytes).ToLowerInvariant() }
function Assert-VolumeOwner([string]$Name,[string]$Owner,[string]$Project) {
 $volumes=& docker volume ls --format '{{.Name}}'; if($LASTEXITCODE -ne 0){throw 'Docker unavailable'}
 if($volumes -contains $Name){$v=(& docker volume inspect $Name | ConvertFrom-Json)[0]; if($v.Labels.'prospector.owner' -ne $Owner -or $v.Labels.'com.docker.compose.project' -ne $Project){throw "Exclusive ownership not established for $Name"}}
}
function Ensure-LocalConfig([string]$File,[switch]$Experimental) {
 if(-not(Test-Path -LiteralPath $File)){
  $dir=Split-Path -Parent $File; New-Item -ItemType Directory -Path $dir -Force | Out-Null
  $evidence=Join-Path $dir 'evidence';New-Item -ItemType Directory -Path $evidence -Force | Out-Null
  $lines=@(
   ('LOCAL_DB_PASSWORD='+(New-LocalSecret))
   ('LOCAL_DEMO_PASSWORD='+(New-LocalSecret))
   ('LOCAL_JWT_SECRET='+(New-LocalSecret)+'a1b2c3d4e5f67890')
   ('LOCAL_EVIDENCE_DIR='+($evidence.Replace('\','/')))
  )
  if($Experimental){$lines+=@(
   ('LOCAL_SERVICE_KEY='+(New-LocalSecret))
   ('LOCAL_CALLBACK_KEY='+(New-LocalSecret))
   'LOCAL_GENERATION=demo-controlled-initial'
  )}
  [IO.File]::WriteAllLines($File,$lines,[Text.UTF8Encoding]::new($false))
 }
 $settings=@{}
 foreach($line in Get-Content -LiteralPath $File){if($line -match '^([A-Z_]+)=(.*)$'){$settings[$Matches[1]]=$Matches[2]}}
 $required=@('LOCAL_DB_PASSWORD','LOCAL_DEMO_PASSWORD','LOCAL_JWT_SECRET','LOCAL_EVIDENCE_DIR')
 if($Experimental){$required+=@('LOCAL_SERVICE_KEY','LOCAL_CALLBACK_KEY','LOCAL_GENERATION')}
 foreach($key in $required){if(-not $settings[$key]){throw ("Missing local configuration key: "+$key)}}
 if($settings.LOCAL_JWT_SECRET.Length -lt 32 -or $settings.LOCAL_DEMO_PASSWORD.Length -lt 12){throw 'Local credentials do not meet minimum lengths'}
}

$backend=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$worktrees=Split-Path -Parent $backend
if(-not $FlutterPath){$FlutterPath=Join-Path $worktrees 'flutter-core'}
$FlutterPath=(Resolve-Path $FlutterPath).Path
if(-not $StatePath){$StatePath=Join-Path $worktrees '.local-avance2'}
$envFile=Join-Path $StatePath 'core.env'
Ensure-LocalConfig $envFile
Assert-VolumeOwner 'prospector-avance2-core_core-pg' 'avance2-core-exclusive' 'prospector-avance2-core'
Assert-VolumeOwner 'prospector-avance2-core_core-tls' 'avance2-core-exclusive' 'prospector-avance2-core'
if(-not $SkipBuild){
 Invoke-Docker build --target runtime -f (Join-Path $backend 'Dockerfile') -t prospector-avance2-backend:core $backend
 Invoke-Docker build -f (Join-Path $FlutterPath 'Dockerfile.vercel') --build-arg API_BASE_URL=https://localhost:18443 -t prospector-avance2-flutter:core-local $FlutterPath
 Invoke-Docker build -f (Join-Path $PSScriptRoot 'Dockerfile.browser') -t prospector-avance2-browser:trusted-local $PSScriptRoot
}
Invoke-Docker compose -p prospector-avance2-core --env-file $envFile -f (Join-Path $PSScriptRoot 'compose.core.yml') up -d --wait --wait-timeout 180 browser
Write-Host 'Core: http://127.0.0.1:18450/vnc.html?autoconnect=1&resize=scale'
Write-Host 'Trusted HTTPS inside isolated browser: https://localhost:18443'
Write-Host 'API: http://127.0.0.1:18441/api/v1/health/ready | Swagger: http://127.0.0.1:18441/api/docs'
Write-Host "Private demo password: LOCAL_DEMO_PASSWORD in $envFile (never publish)"
Write-Host 'Seed is idempotent and resets passwords of reserved synthetic accounts only. No production data.'
