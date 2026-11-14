$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
Push-Location -LiteralPath $projectRoot
try {
    $dockerInfo = & docker info --format '{{.ServerVersion}}' 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $dockerInfo) {
        throw 'Docker Desktop is not ready. Start it, then run this setup again. No local credentials were created.'
    }

    $volumeNames = @(& docker volume ls --format '{{.Name}}' 2>$null)
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not inspect Docker volumes. No local credentials were created.'
    }

    $targetVolumeName = 'iapteca_ux_ui_mongo_data'
    $existingMongoVolumes = @($volumeNames | Where-Object { $_ -eq $targetVolumeName })
    if ($existingMongoVolumes.Count -gt 0) {
        throw "The target MongoDB data volume '$targetVolumeName' already exists. Setup stopped without touching it. Inspect the volume and decide how to preserve its data before continuing."
    }

    $envPath = Join-Path $projectRoot '.env.local'
    $localDir = Join-Path $projectRoot '.local'
    $keyPath = Join-Path $localDir 'mongo-keyfile'
    if ((Test-Path -LiteralPath $envPath) -or (Test-Path -LiteralPath $keyPath)) {
        throw 'A local environment file or key file already exists. Setup will not overwrite either one.'
    }

    function New-RandomHex([int]$byteCount) {
        $bytes = [byte[]]::new($byteCount)
        $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try {
            $generator.GetBytes($bytes)
        } finally {
            $generator.Dispose()
        }
        return [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
    }

    New-Item -ItemType Directory -Path $localDir -Force | Out-Null

    $rootPassword = New-RandomHex 32
    $appPassword = New-RandomHex 32
    $keyBytes = [byte[]]::new(756)
    $keyGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $keyGenerator.GetBytes($keyBytes)
    } finally {
        $keyGenerator.Dispose()
    }
    $keyText = [Convert]::ToBase64String($keyBytes) + [Environment]::NewLine

    $envText = @"
MONGODB_URI=mongodb://iapteca_app:$appPassword@localhost:27017/iapteca?replicaSet=rs0&authSource=iapteca
MONGO_INITDB_ROOT_USERNAME=iapteca_admin
MONGO_INITDB_ROOT_PASSWORD=$rootPassword
MONGO_APP_USERNAME=iapteca_app
MONGO_APP_PASSWORD=$appPassword
"@.Trim() + [Environment]::NewLine

    $envTempPath = Join-Path $projectRoot '.env.local.setup-tmp'
    $keyTempPath = Join-Path $localDir 'mongo-keyfile.setup-tmp'
    try {
        [System.IO.File]::WriteAllText($keyTempPath, $keyText, [System.Text.UTF8Encoding]::new($false))
        [System.IO.File]::WriteAllText($envTempPath, $envText, [System.Text.UTF8Encoding]::new($false))
        Move-Item -LiteralPath $keyTempPath -Destination $keyPath
        Move-Item -LiteralPath $envTempPath -Destination $envPath
    } finally {
        if (Test-Path -LiteralPath $envTempPath) { Remove-Item -LiteralPath $envTempPath -Force }
        if (Test-Path -LiteralPath $keyTempPath) { Remove-Item -LiteralPath $keyTempPath -Force }
    }

    Write-Output 'Local configuration and Replica Set key file created. Secret values were not displayed.'
} finally {
    Pop-Location
}
