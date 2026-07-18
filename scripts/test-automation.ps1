$ErrorActionPreference = "Stop"

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Label,
    [Parameter(Mandatory = $true)]
    [string]$WorkingDirectory,
    [Parameter(Mandatory = $true)]
    [string[]]$ArgumentList
  )

  Write-Host ""
  Write-Host "==> $Label" -ForegroundColor Cyan

  $process = Start-Process `
    -FilePath "npm.cmd" `
    -ArgumentList $ArgumentList `
    -WorkingDirectory $WorkingDirectory `
    -NoNewWindow `
    -PassThru `
    -Wait

  if ($process.ExitCode -ne 0) {
    throw "$Label failed with exit code $($process.ExitCode)."
  }
}

$root = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $root "Maa-Baglamkhi-Resort-frontend"
$backendDir = Join-Path $root "Maa-Baglamkhi-Resort-Backend"

Invoke-Step -Label "Frontend Jest" -WorkingDirectory $frontendDir -ArgumentList @("test")
Invoke-Step -Label "Frontend Browser Automation" -WorkingDirectory $frontendDir -ArgumentList @("run", "test:e2e")
Invoke-Step -Label "Backend Jest" -WorkingDirectory $backendDir -ArgumentList @("test")

Write-Host ""
Write-Host "Automation suite completed successfully." -ForegroundColor Green
