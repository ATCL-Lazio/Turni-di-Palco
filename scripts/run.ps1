param(
  [ValidateSet("dev", "preview")] [string] $Mode = "preview",
  [int] $Port = 5173,
  [switch] $SkipMobile
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not (Test-Path (Join-Path $repoRoot ".git"))) {
  throw "Esegui lo script dalla root del repository (dove si trova .git)."
}

Push-Location $repoRoot
try {
  $certRoot = Join-Path $repoRoot ".cert"
  if (-not (Test-Path $certRoot)) {
    Write-Error "Cartella certificati non trovata: $certRoot"
    exit 1
  }

  # Pick the first key in .cert that matches "*-key.pem", and align the cert to the same basename.
  $keyFile = Get-ChildItem -Path $certRoot -Filter '*-key.pem' -File | Select-Object -First 1
  if (-not $keyFile) {
    Write-Error 'Nessun file *-key.pem trovato nella cartella .cert.'
    exit 1
  }

  $keyBase = $keyFile.BaseName -replace '-key$', ''
  $certFile = Get-ChildItem -Path $certRoot -File | Where-Object { $_.Extension -eq '.pem' -and $_.BaseName -eq $keyBase } | Select-Object -First 1
  if (-not $certFile) {
    Write-Error "Nessun certificato .pem abbinato alla chiave $($keyFile.Name)."
    exit 1
  }

  $env:SSL_KEY_FILE = $keyFile.FullName
  $env:SSL_CRT_FILE = $certFile.FullName
  $env:HTTPS = "true"

  Write-Host "Uso certificato: $($certFile.Name) / chiave: $($keyFile.Name)"

  if ($Mode -ne "dev") {
    if (-not $SkipMobile -and (Test-Path "UI")) {
      Write-Host "Build UI mobile e sync in apps/pwa/public/mobile/..." -ForegroundColor Cyan
      npm run build:mobile
    } elseif ($SkipMobile) {
      Write-Host "Build UI mobile saltata (opzione -SkipMobile)..." -ForegroundColor Yellow
    }

    Write-Host "Pulizia build precedenti e build PWA..." -ForegroundColor Cyan
    npm run clean:builds
    npm run build:pwa
  }

  if ($Mode -eq "dev") {
    Write-Host "Avvio dev server PWA HTTPS su porta $Port"
    npx --workspace apps/pwa vite --host 0.0.0.0 --port $Port --strictPort --clearScreen false
    exit $LASTEXITCODE
  }

  Write-Host "Avvio preview HTTPS su porta $Port (usa build esistente)"
  npx --workspace apps/pwa vite preview --host 0.0.0.0 --port $Port --strictPort --clearScreen false
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
