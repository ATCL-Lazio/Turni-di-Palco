param(
  [ValidateSet("dev", "preview")] [string] $Mode = "preview",
  [int] $Port = 5173
)

$ErrorActionPreference = 'Stop'

# Pick the first key in root that matches "*-key.pem", and align the cert to the same basename.
$keyFile = Get-ChildItem -Path . -Filter '*-key.pem' -File | Select-Object -First 1
if (-not $keyFile) {
  Write-Error 'Nessun file *-key.pem trovato nella root del progetto.'
  exit 1
}

$keyBase = $keyFile.BaseName -replace '-key$',''
$certFile = Get-ChildItem -Path . -File | Where-Object { $_.Extension -eq '.pem' -and $_.BaseName -eq $keyBase } | Select-Object -First 1
if (-not $certFile) {
  Write-Error "Nessun certificato .pem abbinato alla chiave $($keyFile.Name)."
  exit 1
}

$env:SSL_KEY_FILE = $keyFile.FullName
$env:SSL_CRT_FILE = $certFile.FullName
$env:HTTPS = "true"

Write-Host "Uso certificato: $($certFile.Name) / chiave: $($keyFile.Name)"

if ($Mode -eq "dev") {
  Write-Host "Avvio dev server HTTPS su porta $Port"
  npm --workspace apps/pwa run dev:https -- --host 0.0.0.0 --port $Port --strictPort --clearScreen false
  exit $LASTEXITCODE
}

Write-Host "Eseguo build mobile + PWA, poi preview HTTPS su porta $Port"
npm run build:mobile
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npm run build:pwa
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npm --workspace apps/pwa run preview -- --host 0.0.0.0 --port $Port
