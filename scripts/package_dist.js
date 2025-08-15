/**
 * Minimal distributable packager: creates npm tgz, run.bat, and README.txt
 * Usage: npm run package:dist
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function main() {
  const root = process.cwd();
  const pkg = readJson(path.join(root, 'package.json'));
  const {version} = pkg;
  // npm pack tarball name for scoped packages is scope-name-version.tgz
  const nameSlug = pkg.name.replace(/^@/, '').replace(/\//g, '-');
  const tarName = `${nameSlug}-${version}.tgz`;

  // Build bundle (outputs to bundle/) then pack the npm tarball
  execSync('npm run bundle', { stdio: 'inherit' });
  execSync('npm pack', { stdio: 'inherit' });

  const tarPath = path.join(root, tarName);
  if (!fs.existsSync(tarPath)) {
    console.error(`Could not find tarball ${tarName} after npm pack`);
    process.exit(1);
  }

  const outDir = path.join(root, 'release', `${nameSlug}-${version}`);
  await ensureDir(outDir);

  // Copy tgz into release folder
  await fsp.copyFile(tarPath, path.join(outDir, tarName));

  
  const runBat = `@echo off\r\nsetlocal\r\n\r\necho Qwen Code launcher\r\necho Requires Node.js 20+ installed and QWEN_API_KEY already set.\r\n\r\nREM Optional: force install if first arg is --install or /install\r\nif /I "%~1"=="--install" goto doinstall\r\nif /I "%~1"=="/install" goto doinstall\r\n\r\nREM Resolve npm global bin (use backticks for reliability)\r\nset "NPM_GLOBAL_BIN="\r\nfor /f "usebackq delims=" %%I in (\`npm bin -g 2^>nul\`) do set "NPM_GLOBAL_BIN=%%I"\r\nif not defined NPM_GLOBAL_BIN (\r\n  for /f "usebackq delims=" %%I in (\`npm prefix -g 2^>nul\`) do set "NPM_PREFIX=%%I"\r\n  if defined NPM_PREFIX (\r\n    if exist "%NPM_PREFIX%\\bin" (set "NPM_GLOBAL_BIN=%NPM_PREFIX%\\bin") else set "NPM_GLOBAL_BIN=%NPM_PREFIX%"\r\n  )\r\n)\r\nif defined NPM_GLOBAL_BIN if not exist "%NPM_GLOBAL_BIN%" set "NPM_GLOBAL_BIN="\r\n\r\nREM 1) Try running already-installed CLI (npm global bin)\r\nif defined NPM_GLOBAL_BIN if exist "%NPM_GLOBAL_BIN%\\qwen.cmd" (\r\n  echo Running CLI...\r\n  call "%NPM_GLOBAL_BIN%\\qwen.cmd" %*\r\n  exit /b %errorlevel%\r\n)\r\n\r\nREM 2) Try running qwen on PATH\r\nwhere qwen >nul 2>nul\r\nif %errorlevel%==0 (\r\n  echo Running CLI...\r\n  call qwen %*\r\n  exit /b %errorlevel%\r\n)\r\n\r\n:doinstall\r\nREM 3) Not installed — delegate installation to install.ps1\r\necho Qwen is not installed globally or force install requested. Running installer...\r\npowershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"\r\nif %errorlevel% neq 0 (\r\n  echo Install failed. You can run run.ps1 for a one-time temp run.\r\n  if "%~1"=="" pause\r\n  exit /b 1\r\n)\r\n\r\nREM Re-resolve npm global bin after install\r\nset "NPM_GLOBAL_BIN="\r\nfor /f "usebackq delims=" %%I in (\`npm bin -g 2^>nul\`) do set "NPM_GLOBAL_BIN=%%I"\r\nif not defined NPM_GLOBAL_BIN (\r\n  for /f "usebackq delims=" %%I in (\`npm prefix -g 2^>nul\`) do set "NPM_PREFIX=%%I"\r\n  if defined NPM_PREFIX (\r\n    if exist "%NPM_PREFIX%\\bin" (set "NPM_GLOBAL_BIN=%NPM_PREFIX%\\bin") else set "NPM_GLOBAL_BIN=%NPM_PREFIX%"\r\n  )\r\n)\r\nif defined NPM_GLOBAL_BIN if not exist "%NPM_GLOBAL_BIN%" set "NPM_GLOBAL_BIN="\r\n\r\nREM 4) After install, try again via npm global bin\r\nif defined NPM_GLOBAL_BIN if exist "%NPM_GLOBAL_BIN%\\qwen.cmd" (\r\n  echo Running CLI...\r\n  call "%NPM_GLOBAL_BIN%\\qwen.cmd" %*\r\n  exit /b %errorlevel%\r\n)\r\n\r\nREM 5) Fallback: run the installed ESM entry directly from global prefix\r\nset "NPM_PREFIX="\r\nfor /f "usebackq delims=" %%I in (\`npm prefix -g 2^>nul\`) do set "NPM_PREFIX=%%I"\r\nif not defined NPM_PREFIX set "NPM_PREFIX=%APPDATA%\\npm"\r\nset "QWEN_MJS=%NPM_PREFIX%\\node_modules\\@qwen-code\\qwen-code\\bundle\\qwen.mjs"\r\nif exist "%QWEN_MJS%" (\r\n  echo Running CLI directly...\r\n  node "%QWEN_MJS%" %*\r\n  exit /b %errorlevel%\r\n)\r\n\r\necho Could not locate qwen on PATH after install. Try opening a new terminal and run:\r\nif defined NPM_GLOBAL_BIN (\r\n  if exist "%NPM_GLOBAL_BIN%\\qwen.cmd" (\r\n    echo   "%NPM_GLOBAL_BIN%\\qwen.cmd"\r\n  ) else (\r\n    echo   qwen\r\n  )\r\n) else (\r\n  if defined NPM_PREFIX (\r\n    echo   node "%NPM_PREFIX%\\node_modules\\@qwen-code\\qwen-code\\bundle\\qwen.mjs"\r\n  ) else (\r\n    echo   qwen\r\n  )\r\n)\r\nif "%~1"=="" pause\r\nexit /b 1\r\n\r\nendlocal\r\n`;

  const runPs1 = `# Qwen Code minimal launcher (PowerShell)\nparam(\n  [switch]$Install\n)\n$ErrorActionPreference = 'Stop'\nWrite-Host 'Qwen Code minimal launcher'\nWrite-Host 'Requires Node.js 20+ installed and QWEN_API_KEY already set.'\n$force = $Install -or ($args -contains '--install')\nif (-not $force) {\n  # Try already-installed first\n  $npmBin = (& npm bin -g).Trim()\n  $qwenCmd = if ($npmBin) { Join-Path $npmBin 'qwen.cmd' } else { $null }\n  if ($qwenCmd -and (Test-Path $qwenCmd)) {\n    Write-Host 'Running CLI...'\n    & $qwenCmd @args\n    exit $LASTEXITCODE\n  }\n  if (Get-Command qwen -ErrorAction SilentlyContinue) {\n    Write-Host 'Running CLI...'\n    & qwen @args; exit $LASTEXITCODE\n  }\n}\n# Not installed or force requested — delegate to installer\nWrite-Host 'Running installer...'\n& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'install.ps1')\nif ($LASTEXITCODE -ne 0) { Write-Host 'Install failed.'; exit 1 }\n# Try again\n$npmBin = (& npm bin -g).Trim()\n$qwenCmd = if ($npmBin) { Join-Path $npmBin 'qwen.cmd' } else { $null }\nif ($qwenCmd -and (Test-Path $qwenCmd)) { & $qwenCmd @args; exit $LASTEXITCODE }\nWrite-Host 'Could not locate qwen on PATH after install. Open a new terminal and run qwen.'\nexit 1\n`;

  const runSh = `#!/usr/bin/env bash\nset -e\necho 'Qwen Code minimal launcher'\necho 'Requires Node.js 20+ installed and QWEN_API_KEY already set.'\nDIR="$(cd \"$(dirname \"\${BASH_SOURCE[0]}\")\" && pwd)"\nTAR="$DIR/${tarName}"\necho 'Installing package globally...'\nif npm install -g "$TAR"; then\n  echo 'Running CLI...'\n  if command -v qwen >/dev/null 2>&1; then\n    exec qwen\n  else\n    NPM_BIN="$(npm bin -g)"\n    if [ -x "$NPM_BIN/qwen" ]; then\n      exec "$NPM_BIN/qwen"\n    else\n      exec npx qwen\n    fi\n  fi\nelse\n  echo 'Global install failed. Falling back to local temp run...'\n  TMPDIR="$(mktemp -d)"\n  pushd "$TMPDIR" >/dev/null\n  npm init -y >/dev/null 2>&1 || true\n  if npm install "$TAR"; then\n    npx qwen\n    code=$?\n    popd >/dev/null\n    exit $code\n  else\n    echo 'Local install failed. Please install Node 20+ and try again.'\n    popd >/dev/null\n    exit 1\n  fi\nfi\n`;

  const installPs1 = `# Qwen Code installer (PowerShell)\n$ErrorActionPreference = 'Stop'\nWrite-Host 'Installing Qwen Code globally from local package...'\n$tar = Join-Path $PSScriptRoot '${tarName}'\nif (-not (Test-Path $tar)) { Write-Error \"Package file not found: $tar\"; exit 1 }\n& npm install -g $tar\nif ($LASTEXITCODE -ne 0) { Write-Error 'Global install failed.'; exit $LASTEXITCODE }\nWrite-Host 'Install completed.'\nexit 0\n`;

  const readme = `Qwen Code — Minimal Distributable\r\n\r\nContents:\r\n- ${tarName} (npm package)\r\n- run.bat (Windows launcher)\r\n- install.ps1 (Windows installer used by run.bat)\r\n- run.ps1 (Windows PowerShell one-shot installer+runner)\r\n- run.sh (macOS/Linux one-shot installer+runner)\r\n\r\nPrerequisites:\r\n- Node.js 20 or newer\r\n- Set your provider API key in the environment before running (for DashScope users):\r\n  - QWEN_API_KEY=your_key\r\n  - Optional: OPENAI_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1/\r\n  - Optional: OPENAI_MODEL=qwen3-coder-plus\r\n\r\nHow to run (Windows):\r\n- Double-click run.bat. It first tries to run an existing install; if missing, it calls install.ps1 then launches.\r\n- If you need to force reinstall from the local package, run: run.bat --install\r\n- Alternatively, right-click run.ps1 and select 'Run with PowerShell' (supports -Install to force reinstall).\r\n\r\nHow to run (macOS/Linux):\r\n- chmod +x ./run.sh\r\n- ./run.sh\r\n- It tries a global install first, then falls back to a temporary local install.\r\n\r\nManual install:\r\n   npm install -g .\\${tarName}\r\n   qwen\r\n\r\nNotes:\r\n- No secrets are included. Each user must set their own API key.\r\n- If global install is not permitted, the one-shot launchers fall back to a local temp install for this session.\r\n`;

  await fsp.writeFile(path.join(outDir, 'run.bat'), runBat, 'utf-8');
  await fsp.writeFile(path.join(outDir, 'run.ps1'), runPs1, 'utf-8');
  await fsp.writeFile(path.join(outDir, 'run.sh'), runSh, 'utf-8');
  await fsp.writeFile(path.join(outDir, 'install.ps1'), installPs1, 'utf-8');
  await fsp.writeFile(path.join(outDir, 'README.txt'), readme, 'utf-8');

  // Also create a ZIP of the release folder for easy sharing
  try {
    const releaseDir = path.dirname(outDir);
    const baseName = path.basename(outDir);
    const zipPath = path.join(releaseDir, `${baseName}.zip`);

    if (process.platform === 'win32') {
      // Use PowerShell's Compress-Archive on Windows
      const psCommand = `Compress-Archive -Force -Path \"${outDir}/*\" -DestinationPath \"${zipPath}\"`;
      execSync(`powershell -NoProfile -Command ${psCommand}`, {
        stdio: 'inherit',
      });
    } else {
      // Use zip on Unix-like systems
      // Example: (cd release && zip -r name.zip name)
      execSync(
        `bash -lc "cd \"${releaseDir}\" && zip -r \"${baseName}.zip\" \"${baseName}\""`,
        { stdio: 'inherit' },
      );
    }
    console.log(`\nCreated ZIP: ${zipPath}`);
  } catch (zipErr) {
    console.warn(
      `\nWarning: Failed to create ZIP archive automatically: ${zipErr?.message || zipErr}. You can zip the folder manually.`,
    );
  }

  console.log(`\nPackaged distributable at: ${outDir}`);
  console.log(
    `\nNext:\n- Share the folder or ZIP '${nameSlug}-${version}' inside 'release/'\n- Recipient sets QWEN_API_KEY, then runs run.bat`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
