Qwen Code — Minimal Distributable

Contents:
- qwen-code-qwen-code-0.0.4.tgz (npm package)
- run.bat (Windows launcher)
- install.ps1 (Windows installer used by run.bat)
- run.ps1 (Windows PowerShell one-shot installer+runner)
- run.sh (macOS/Linux one-shot installer+runner)

Prerequisites:
- Node.js 20 or newer
- Set your provider API key in the environment before running (for DashScope users):
  - QWEN_API_KEY=your_key
  - Optional: OPENAI_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1/
  - Optional: OPENAI_MODEL=qwen3-coder-plus

How to run (Windows):
- Double-click run.bat. It first tries to run an existing install; if missing, it calls install.ps1 then launches.
- If you need to force reinstall from the local package, run: run.bat --install
- Alternatively, right-click run.ps1 and select 'Run with PowerShell' (supports -Install to force reinstall).

How to run (macOS/Linux):
- chmod +x ./run.sh
- ./run.sh
- It tries a global install first, then falls back to a temporary local install.

Manual install:
   npm install -g .\qwen-code-qwen-code-0.0.4.tgz
   qwen

Notes:
- No secrets are included. Each user must set their own API key.
- If global install is not permitted, the one-shot launchers fall back to a local temp install for this session.
