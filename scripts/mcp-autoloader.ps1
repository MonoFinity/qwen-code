# MCP Auto-loader for VS Code
# This script ensures all MCP servers are available and loaded when VS Code starts

param(
    [switch]$Force,
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"

# Define paths
$UserMcpPath = "$env:APPDATA\Code\User\mcp.json"
$WorkspaceMcpPath = ".vscode\mcp.json"

# Color functions for better output
function Write-Success($message) { Write-Host "SUCCESS: $message" -ForegroundColor Green }
function Write-Warning($message) { Write-Host "WARNING: $message" -ForegroundColor Yellow }
function Write-Error($message) { Write-Host "ERROR: $message" -ForegroundColor Red }
function Write-Info($message) { Write-Host "INFO: $message" -ForegroundColor Cyan }

function Test-MCPServer {
    param(
        [string]$ServerName,
        [string]$Command,
        [array]$Args
    )
    
    if ($Verbose) { Write-Info "Testing MCP server: $ServerName" }
    
    try {
        if ($Command -eq "npx") {
            # Check if npx package exists
            $packageName = $Args[1]  # Skip "-y" flag
            $result = & npx $Args[0] $packageName --help 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "MCP server '$ServerName' is available"
                return $true
            }
        } elseif ($Command -eq "docker") {
            # Check if docker image exists
            $imageName = $Args | Where-Object { $_ -match "mcp/" } | Select-Object -First 1
            if ($imageName) {
                docker image inspect $imageName 2>$null | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    Write-Success "Docker MCP server '$ServerName' is available"
                    return $true
                }
            }
        }
        
        Write-Warning "MCP server '$ServerName' may not be available"
        return $false
    }
    catch {
        Write-Warning "Failed to test MCP server '$ServerName': $($_.Exception.Message)"
        return $false
    }
}

function Install-MCPDependencies {
    Write-Info "Installing/updating MCP dependencies..."
    
    # Common MCP servers to ensure are available
    $mcpPackages = @(
        "@modelcontextprotocol/server-memory",
        "@modelcontextprotocol/server-sequential-thinking", 
        "@modelcontextprotocol/server-filesystem",
        "@modelcontextprotocol/server-git",
        "@qwen-swarm/swarm-memory",
        "@qwen-swarm/swarm-sys-ops", 
        "@qwen-swarm/google-vision"
    )
    
    foreach ($package in $mcpPackages) {
        try {
            Write-Info "Ensuring $package is available..."
            # Use npx with -y to auto-install if needed
            npx -y $package --help 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "$package is ready"
            } else {
                Write-Warning "$package may need manual installation"
            }
        }
        catch {
            Write-Warning "Could not verify $package"
        }
    }
}

function Validate-MCPConfig {
    param([string]$ConfigPath)
    
    if (-not (Test-Path $ConfigPath)) {
        Write-Warning "MCP config not found: $ConfigPath"
        return $false
    }
    
    try {
        $config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
        
        if (-not $config.servers) {
            Write-Warning "No servers defined in $ConfigPath"
            return $false
        }
        
        Write-Success "MCP config valid: $ConfigPath"
        
        # Test each server
        foreach ($serverName in $config.servers.PSObject.Properties.Name) {
            $server = $config.servers.$serverName
            Test-MCPServer -ServerName $serverName -Command $server.command -Args $server.args
        }
        
        return $true
    }
    catch {
        Write-Error "Invalid JSON in $ConfigPath : $($_.Exception.Message)"
        return $false
    }
}

function Start-MCPAutoLoader {
    Write-Info "Starting MCP Auto-loader for VS Code..."
    Write-Info "Timestamp: $(Get-Date)"
    
    # Install/update dependencies
    if ($Force) {
        Install-MCPDependencies
    }
    
    # Validate global MCP config
    Write-Info "Checking global MCP configuration..."
    if (Test-Path $UserMcpPath) {
        Validate-MCPConfig -ConfigPath $UserMcpPath
    } else {
        Write-Warning "Global MCP config not found at: $UserMcpPath"
    }
    
    # Validate workspace MCP config
    Write-Info "Checking workspace MCP configuration..."
    if (Test-Path $WorkspaceMcpPath) {
        Validate-MCPConfig -ConfigPath $WorkspaceMcpPath
    } else {
        Write-Info "No workspace MCP config found (this is optional)"
    }
    
    # Check if VS Code is running
    $vscodeProcesses = Get-Process "Code" -ErrorAction SilentlyContinue
    if ($vscodeProcesses) {
        Write-Info "VS Code is currently running with $($vscodeProcesses.Count) process(es)"
        Write-Warning "Restart VS Code to apply any MCP configuration changes"
    } else {
        Write-Info "VS Code is not currently running"
    }
    
    Write-Success "MCP Auto-loader completed successfully!"
}

# Main execution
if ($MyInvocation.InvocationName -ne '.') {
    Start-MCPAutoLoader
} else {
    # If dot-sourced, just define the functions
    Write-Info "MCP Auto-loader functions loaded. Run Start-MCPAutoLoader to execute."
}
