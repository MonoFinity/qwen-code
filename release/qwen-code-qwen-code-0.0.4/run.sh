#!/usr/bin/env bash
set -e
echo 'Qwen Code minimal launcher'
echo 'Requires Node.js 20+ installed and QWEN_API_KEY already set.'
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAR="$DIR/qwen-code-qwen-code-0.0.4.tgz"
echo 'Installing package globally...'
if npm install -g "$TAR"; then
  echo 'Running CLI...'
  if command -v qwen >/dev/null 2>&1; then
    exec qwen
  else
    NPM_BIN="$(npm bin -g)"
    if [ -x "$NPM_BIN/qwen" ]; then
      exec "$NPM_BIN/qwen"
    else
      exec npx qwen
    fi
  fi
else
  echo 'Global install failed. Falling back to local temp run...'
  TMPDIR="$(mktemp -d)"
  pushd "$TMPDIR" >/dev/null
  npm init -y >/dev/null 2>&1 || true
  if npm install "$TAR"; then
    npx qwen
    code=$?
    popd >/dev/null
    exit $code
  else
    echo 'Local install failed. Please install Node 20+ and try again.'
    popd >/dev/null
    exit 1
  fi
fi
