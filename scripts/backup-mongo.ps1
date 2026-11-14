$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
Push-Location -LiteralPath $projectRoot
try {
    $envPath = Join-Path $projectRoot '.env.local'
    if (-not (Test-Path -LiteralPath $envPath)) {
        throw '.env.local is missing. Run scripts/setup-local.ps1 first.'
    }

    $uriLine = Get-Content -LiteralPath $envPath | Where-Object { $_ -match '^MONGODB_URI=' } | Select-Object -First 1
    if (-not $uriLine) { throw 'MONGODB_URI is missing from .env.local.' }
    $uriText = $uriLine.Substring('MONGODB_URI='.Length).Trim().Trim('"', "'")

    try { $parsedUri = [Uri]$uriText } catch { throw 'MONGODB_URI is not a valid URI.' }
    $query = $parsedUri.Query.TrimStart('?')
    if ($parsedUri.Host -notin @('localhost', '127.0.0.1') -or $parsedUri.AbsolutePath.Trim('/') -ne 'iapteca' -or $query -notmatch '(^|&)replicaSet=rs0(&|$)') {
        throw 'Backup stopped: this helper only accepts the local iapteca rs0 database.'
    }

    $dumpCommand = Get-Command 'mongodump' -ErrorAction SilentlyContinue
    if (-not $dumpCommand) {
        throw 'MongoDB Database Tools (mongodump) are required on Windows for backups.'
    }

    $backupDir = Join-Path $projectRoot 'backups'
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $archivePath = Join-Path $backupDir "iapteca-$stamp.archive.gz"

    & $dumpCommand.Source "--uri=$uriText" "--archive=$archivePath" --gzip
    if ($LASTEXITCODE -ne 0) {
        throw 'mongodump failed. The local backup file may be incomplete; check the MongoDB Database Tools output.'
    }

    Write-Output "Local database backup created: backups/iapteca-$stamp.archive.gz"
} finally {
    Pop-Location
}
