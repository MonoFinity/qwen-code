@echo off
REM MCP Auto-loader for VS Code - Windows Batch Version
REM Ensures all MCP servers are available when VS Code starts

setlocal enabledelayedexpansion

echo.
echo 🚀 Starting MCP Auto-loader for VS Code...
echo Timestamp: %date% %time%
echo.

REM Define paths
set "USER_MCP_PATH=%APPDATA%\Code\User\mcp.json"
set "WORKSPACE_MCP_PATH=.vscode\mcp.json"

REM Check if npx is available
where npx >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ❌ npx not found. Please install Node.js first.
    exit /b 1
)

echo ✅ npx is available

REM Function to install MCP dependencies
echo.
echo ℹ️  Installing/updating MCP dependencies...

set "MCP_PACKAGES=@modelcontextprotocol/server-memory @modelcontextprotocol/server-sequential-thinking @modelcontextprotocol/server-filesystem @modelcontextprotocol/server-git"

for %%p in (%MCP_PACKAGES%) do (
    echo ℹ️  Ensuring %%p is available...
    npx -y %%p --help >nul 2>&1
    if !ERRORLEVEL! equ 0 (
        echo ✅ %%p is ready
    ) else (
        echo ⚠️  %%p may need manual installation
    )
)

REM Check global MCP config
echo.
echo ℹ️  Checking global MCP configuration...
if exist "%USER_MCP_PATH%" (
    echo ✅ Global MCP config found: %USER_MCP_PATH%
) else (
    echo ⚠️  Global MCP config not found: %USER_MCP_PATH%
)

REM Check workspace MCP config
echo.
echo ℹ️  Checking workspace MCP configuration...
if exist "%WORKSPACE_MCP_PATH%" (
    echo ✅ Workspace MCP config found: %WORKSPACE_MCP_PATH%
) else (
    echo ℹ️  No workspace MCP config found (this is optional)
)

REM Check if VS Code is running
echo.
echo ℹ️  Checking VS Code status...
tasklist /FI "IMAGENAME eq Code.exe" 2>NUL | find /I /N "Code.exe">NUL
if %ERRORLEVEL% equ 0 (
    echo ℹ️  VS Code is currently running
    echo ⚠️  Restart VS Code to apply any MCP configuration changes
) else (
    echo ℹ️  VS Code is not currently running
)

echo.
echo ✅ MCP Auto-loader completed successfully!
echo.

endlocal
