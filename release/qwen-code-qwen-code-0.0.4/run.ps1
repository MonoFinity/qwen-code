# Qwen Code minimal launcher (PowerShell)
param(
  [switch]$Install
)
$ErrorActionPreference = 'Stop'
Write-Host 'Qwen Code minimal launcher'
Write-Host 'Requires Node.js 20+ installed and QWEN_API_KEY already set.'
$force = $Install -or ($args -contains '--install')
if (-not $force) {
  # Try already-installed first
  $npmBin = (& npm bin -g).Trim()
  $qwenCmd = if ($npmBin) { Join-Path $npmBin 'qwen.cmd' } else { $null }
  if ($qwenCmd -and (Test-Path $qwenCmd)) {
    Write-Host 'Running CLI...'
    & $qwenCmd @args
    exit $LASTEXITCODE
  }
  if (Get-Command qwen -ErrorAction SilentlyContinue) {
    Write-Host 'Running CLI...'
    & qwen @args; exit $LASTEXITCODE
  }
}
# Not installed or force requested — delegate to installer
Write-Host 'Running installer...'
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'install.ps1')
if ($LASTEXITCODE -ne 0) { Write-Host 'Install failed.'; exit 1 }
# Try again
$npmBin = (& npm bin -g).Trim()
$qwenCmd = if ($npmBin) { Join-Path $npmBin 'qwen.cmd' } else { $null }
if ($qwenCmd -and (Test-Path $qwenCmd)) { & $qwenCmd @args; exit $LASTEXITCODE }
Write-Host 'Could not locate qwen on PATH after install. Open a new terminal and run qwen.'
exit 1
