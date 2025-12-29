param(
  [switch]$SkipMobile
)

$previewUrl = "http://localhost:4173"
$previewMobileUrl = "$previewUrl/mobile/"
$previewCmd = "npm run preview:pwa"
$shellExe = if ($PSVersionTable.PSEdition -eq "Desktop") { "powershell" } else { "pwsh" }
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not (Test-Path (Join-Path $repoRoot ".git"))) {
  throw "Esegui lo script dalla root del repository (dove si trova .git)."
}

Push-Location $repoRoot
try {
  if (-not (Test-Path "node_modules")) {
    Write-Host "Installazione dipendenze..." -ForegroundColor Cyan
    npm install
  }

  if (-not $SkipMobile) {
    Write-Host "Build UI mobile e sync in apps/pwa/public/mobile/..." -ForegroundColor Cyan
    npm run build:mobile
  }

  Write-Host "Build PWA..." -ForegroundColor Cyan
  npm run build:pwa

  Write-Host "Preview PWA (produzione) in una nuova finestra..." -ForegroundColor Cyan
  $previewProcess = Start-Process -FilePath $shellExe -ArgumentList @(
    "-NoExit",
    "-Command",
    $previewCmd
  ) -WorkingDirectory $repoRoot -PassThru

  Start-Sleep -Seconds 2
  try {
    Start-Process $previewUrl | Out-Null
    Start-Process $previewMobileUrl | Out-Null
    Write-Host "Browser aperto su $previewUrl" -ForegroundColor Green
    Write-Host "Browser aperto su $previewMobileUrl" -ForegroundColor Green
  } catch {
    Write-Warning "Impossibile aprire il browser automaticamente. Apri manualmente $previewUrl"
  }

  Write-Host "Preview avviata (PID $($previewProcess.Id)). Chiudi con Ctrl+C nella finestra di preview." -ForegroundColor Yellow
} finally {
  Pop-Location
}
