# Global MCP Startup Script for Windows
# Place this in your PowerShell profile or run it from startup

# Global MCP auto-loader configuration
$global:MCPAutoLoaderConfig = @{
    Enabled = $true
    LogPath = "$env:TEMP\mcp-autoloader.log"
    GlobalMCPPath = "$env:APPDATA\Code\User\mcp.json"
    CheckInterval = 300 # seconds
}

function Start-GlobalMCPService {
    [CmdletBinding()]
    param(
        [switch]$Force
    )
    
    if (-not $global:MCPAutoLoaderConfig.Enabled) {
        Write-Host "MCP Auto-loader is disabled" -ForegroundColor Yellow
        return
    }
    
    $logPath = $global:MCPAutoLoaderConfig.LogPath
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    
    try {
        # Ensure global MCP directory exists
        $mcpDir = Split-Path $global:MCPAutoLoaderConfig.GlobalMCPPath -Parent
        if (-not (Test-Path $mcpDir)) {
            New-Item -ItemType Directory -Path $mcpDir -Force | Out-Null
            Write-Host "✅ Created MCP directory: $mcpDir" -ForegroundColor Green
        }
        
        # Pre-install common MCP packages globally for faster startup
        $commonPackages = @(
            "@modelcontextprotocol/server-memory",
            "@modelcontextprotocol/server-sequential-thinking",
            "@modelcontextprotocol/server-filesystem", 
            "@modelcontextprotocol/server-git"
        )
        
        if ($Force) {
            Write-Host "🔄 Force installing MCP packages..." -ForegroundColor Cyan
            foreach ($package in $commonPackages) {
                Write-Host "Installing $package..." -ForegroundColor Gray
                & npm install -g $package 2>$null
            }
        }
        
        # Log success
        "[$timestamp] Global MCP service started successfully" | Out-File -FilePath $logPath -Append
        Write-Host "✅ Global MCP service is running" -ForegroundColor Green
        
    } catch {
        $error = $_.Exception.Message
        "[$timestamp] ERROR: $error" | Out-File -FilePath $logPath -Append
        Write-Host "❌ Global MCP service failed: $error" -ForegroundColor Red
    }
}

function Stop-GlobalMCPService {
    $global:MCPAutoLoaderConfig.Enabled = $false
    Write-Host "🛑 Global MCP service stopped" -ForegroundColor Yellow
}

function Get-MCPServiceStatus {
    $logPath = $global:MCPAutoLoaderConfig.LogPath
    
    Write-Host "📊 MCP Service Status:" -ForegroundColor Cyan
    Write-Host "  Enabled: $($global:MCPAutoLoaderConfig.Enabled)" -ForegroundColor $(if($global:MCPAutoLoaderConfig.Enabled) {"Green"} else {"Red"})
    Write-Host "  Log Path: $logPath" -ForegroundColor Gray
    Write-Host "  Global Config: $($global:MCPAutoLoaderConfig.GlobalMCPPath)" -ForegroundColor Gray
    
    if (Test-Path $logPath) {
        $lastEntries = Get-Content $logPath -Tail 5
        Write-Host "  Recent Log Entries:" -ForegroundColor Gray
        foreach ($entry in $lastEntries) {
            Write-Host "    $entry" -ForegroundColor DarkGray
        }
    }
}

# Auto-start the service
if ($global:MCPAutoLoaderConfig.Enabled) {
    Start-GlobalMCPService
}

# Export functions for easy use
Export-ModuleMember -Function Start-GlobalMCPService, Stop-GlobalMCPService, Get-MCPServiceStatus
