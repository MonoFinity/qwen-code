# MCP Auto-loader for VS Code

This system automatically loads and manages Model Context Protocol (MCP) servers for VS Code, ensuring all dependencies are available both globally and per-project.

## 🚀 Quick Setup

### 1. Automatic Project Setup
When you open this workspace, the MCP auto-loader will run automatically via the VS Code task system.

### 2. Manual Setup (First Time)

#### Windows PowerShell:
```powershell
# Run from project root
.\scripts\mcp-autoloader.ps1 -Force -Verbose
```

#### Windows Command Prompt:
```cmd
# Run from project root  
scripts\mcp-autoloader.bat
```

### 3. Global Setup (Optional)
To ensure MCP servers are always available system-wide:

```powershell
# Add to your PowerShell profile
. "C:\Users\Steven\Documents\MyProjects\git\qwen-code\scripts\mcp-global-service.ps1"
```

## 📁 Configuration Files

### Global Configuration
- **Location**: `%APPDATA%\Code\User\mcp.json`
- **Purpose**: MCP servers available to all VS Code instances
- **Current servers**: memory, sequential-thinking

### Project Configuration
- **Location**: `.vscode\mcp.json` 
- **Purpose**: Project-specific MCP servers
- **Current servers**: filesystem, git, swarm-memory, swarm-sys-ops, google-vision

## 🔧 Available Scripts

| Script | Purpose | Platform |
|--------|---------|----------|
| `mcp-autoloader.ps1` | Full MCP validation and setup | Windows PowerShell |
| `mcp-autoloader.bat` | Basic MCP setup | Windows Command Prompt |
| `mcp-global-service.ps1` | Global MCP service management | Windows PowerShell |

## 📋 Available Tasks

Use `Ctrl+Shift+P` → "Tasks: Run Task" to access:

- **MCP Auto-loader**: Validates all MCP configurations (runs on folder open)
- **MCP Install Dependencies**: Force installs/updates all MCP packages

## 🎯 MCP Servers Included

### Global Servers
- **memory**: Persistent knowledge graph storage
- **sequential-thinking**: Multi-step reasoning capabilities

### Project Servers  
- **filesystem**: File system operations within workspace
- **git**: Git repository operations
- **swarm-memory**: Project-specific memory storage
- **swarm-sys-ops**: System operations for development
- **google-vision**: Image analysis capabilities

## 🔄 How It Works

1. **On VS Code startup**: Auto-loader task runs via `runOptions.runOn: "folderOpen"`
2. **Dependency check**: Verifies all MCP packages are available via npx
3. **Configuration validation**: Ensures JSON configs are valid
4. **Server testing**: Tests each MCP server for availability
5. **Status reporting**: Provides colored output for easy debugging

## 🛠 Troubleshooting

### Common Issues

**"npx not found"**
```bash
# Install Node.js first
winget install OpenJS.NodeJS
```

**"MCP server not available"**
```powershell
# Force reinstall dependencies
.\scripts\mcp-autoloader.ps1 -Force
```

**"VS Code not recognizing MCP servers"**
1. Restart VS Code completely
2. Check configuration file syntax
3. Run MCP Auto-loader task manually

### Debug Commands

```powershell
# Check MCP service status
Get-MCPServiceStatus

# View recent logs
Get-Content "$env:TEMP\mcp-autoloader.log" -Tail 10

# Test specific package
npx -y @modelcontextprotocol/server-memory --help
```

## 🐳 Docker Support

The MCP configurations use relative paths and environment variables that work in Docker:

```dockerfile
# In your Dockerfile
COPY .vscode/mcp.json /app/.vscode/
ENV MEMORY_FILE_PATH=/app/data/memory.json
```

## 🚦 Status Indicators

- ✅ **Green**: Success/Available
- ⚠️ **Yellow**: Warning/Optional  
- ❌ **Red**: Error/Missing
- ℹ️ **Blue**: Information
- 🚀 **Rocket**: Starting process

## 📝 Configuration Examples

### Adding a New MCP Server

Edit `.vscode/mcp.json`:
```json
{
  "servers": {
    "your-new-server": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@your-org/your-mcp-server"],
      "env": {
        "YOUR_ENV_VAR": "value"
      }
    }
  }
}
```

### Global vs Project Servers

- **Global**: Use for general-purpose tools (memory, thinking)
- **Project**: Use for workspace-specific tools (filesystem, git)

## 🔐 Security Notes

- All MCP servers run with current user permissions
- File system access is restricted to workspace folder
- Docker containers use non-privileged user when possible
- Environment variables are not logged for security

## 📚 Further Reading

- [MCP Specification](https://modelcontextprotocol.io/)
- [VS Code MCP Extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-mcp)
- [MCP Server Gallery](https://github.com/modelcontextprotocol/servers)
