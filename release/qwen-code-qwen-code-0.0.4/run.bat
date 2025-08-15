@echo off
setlocal

echo Qwen Code launcher
echo Requires Node.js 20+ installed and QWEN_API_KEY already set.

REM Optional: force install if first arg is --install or /install
if /I "%~1"=="--install" goto doinstall
if /I "%~1"=="/install" goto doinstall

REM Resolve npm global bin (use backticks for reliability)
set "NPM_GLOBAL_BIN="
for /f "usebackq delims=" %%I in (`npm bin -g 2^>nul`) do set "NPM_GLOBAL_BIN=%%I"
if not defined NPM_GLOBAL_BIN (
  for /f "usebackq delims=" %%I in (`npm prefix -g 2^>nul`) do set "NPM_PREFIX=%%I"
  if defined NPM_PREFIX (
    if exist "%NPM_PREFIX%\bin" (set "NPM_GLOBAL_BIN=%NPM_PREFIX%\bin") else set "NPM_GLOBAL_BIN=%NPM_PREFIX%"
  )
)
if defined NPM_GLOBAL_BIN if not exist "%NPM_GLOBAL_BIN%" set "NPM_GLOBAL_BIN="

REM 1) Try running already-installed CLI (npm global bin)
if defined NPM_GLOBAL_BIN if exist "%NPM_GLOBAL_BIN%\qwen.cmd" (
  echo Running CLI...
  call "%NPM_GLOBAL_BIN%\qwen.cmd" %*
  exit /b %errorlevel%
)

REM 2) Try running qwen on PATH
where qwen >nul 2>nul
if %errorlevel%==0 (
  echo Running CLI...
  call qwen %*
  exit /b %errorlevel%
)

:doinstall
REM 3) Not installed — delegate installation to install.ps1
echo Qwen is not installed globally or force install requested. Running installer...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
if %errorlevel% neq 0 (
  echo Install failed. You can run run.ps1 for a one-time temp run.
  if "%~1"=="" pause
  exit /b 1
)

REM Re-resolve npm global bin after install
set "NPM_GLOBAL_BIN="
for /f "usebackq delims=" %%I in (`npm bin -g 2^>nul`) do set "NPM_GLOBAL_BIN=%%I"
if not defined NPM_GLOBAL_BIN (
  for /f "usebackq delims=" %%I in (`npm prefix -g 2^>nul`) do set "NPM_PREFIX=%%I"
  if defined NPM_PREFIX (
    if exist "%NPM_PREFIX%\bin" (set "NPM_GLOBAL_BIN=%NPM_PREFIX%\bin") else set "NPM_GLOBAL_BIN=%NPM_PREFIX%"
  )
)
if defined NPM_GLOBAL_BIN if not exist "%NPM_GLOBAL_BIN%" set "NPM_GLOBAL_BIN="

REM 4) After install, try again via npm global bin
if defined NPM_GLOBAL_BIN if exist "%NPM_GLOBAL_BIN%\qwen.cmd" (
  echo Running CLI...
  call "%NPM_GLOBAL_BIN%\qwen.cmd" %*
  exit /b %errorlevel%
)

REM 5) Fallback: run the installed ESM entry directly from global prefix
set "NPM_PREFIX="
for /f "usebackq delims=" %%I in (`npm prefix -g 2^>nul`) do set "NPM_PREFIX=%%I"
if not defined NPM_PREFIX set "NPM_PREFIX=%APPDATA%\npm"
set "QWEN_MJS=%NPM_PREFIX%\node_modules\@qwen-code\qwen-code\bundle\qwen.mjs"
if exist "%QWEN_MJS%" (
  echo Running CLI directly...
  node "%QWEN_MJS%" %*
  exit /b %errorlevel%
)

echo Could not locate qwen on PATH after install. Try opening a new terminal and run:
if defined NPM_GLOBAL_BIN (
  if exist "%NPM_GLOBAL_BIN%\qwen.cmd" (
    echo   "%NPM_GLOBAL_BIN%\qwen.cmd"
  ) else (
    echo   qwen
  )
) else (
  if defined NPM_PREFIX (
    echo   node "%NPM_PREFIX%\node_modules\@qwen-code\qwen-code\bundle\qwen.mjs"
  ) else (
    echo   qwen
  )
)
if "%~1"=="" pause
exit /b 1

endlocal
