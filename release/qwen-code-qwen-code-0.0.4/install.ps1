# Qwen Code installer (PowerShell)
$ErrorActionPreference = 'Stop'
Write-Host 'Installing Qwen Code globally from local package...'
$tar = Join-Path $PSScriptRoot 'qwen-code-qwen-code-0.0.4.tgz'
if (-not (Test-Path $tar)) { Write-Error "Package file not found: $tar"; exit 1 }
& npm install -g $tar
if ($LASTEXITCODE -ne 0) { Write-Error 'Global install failed.'; exit $LASTEXITCODE }
Write-Host 'Install completed.'
exit 0
