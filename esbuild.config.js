// Minimal esbuild config for qwen-code
import { build } from 'esbuild';

build({
  entryPoints: ['packages/cli/index.ts'],
  bundle: true,
  platform: 'node',
  outfile: 'bundle/gemini.mjs',
  sourcemap: true,
  target: ['node20'],
  format: 'esm',
  external: [
    // Node built-ins
    'assert', 'fs', 'path', 'os', 'util', 'stream', 'child_process', 'events', 'crypto', 'http', 'https', 'url', 'zlib', 'tty', 'readline', 'net', 'dns', 'module', 'process', 'buffer', 'timers', 'worker_threads', 'vm', 'perf_hooks', 'inspector', 'constants', 'string_decoder', 'querystring', 'punycode', 'repl', 'dgram', 'cluster', 'console', 'domain', 'v8', 'async_hooks', 'http2', 'tls', 'node:assert', 'node:fs', 'node:path', 'node:os', 'node:util', 'node:stream', 'node:child_process', 'node:events', 'node:crypto', 'node:http', 'node:https', 'node:url', 'node:zlib', 'node:tty', 'node:readline', 'node:net', 'node:dns', 'node:module', 'node:process', 'node:buffer', 'node:timers', 'node:worker_threads', 'node:vm', 'node:perf_hooks', 'node:inspector', 'node:constants', 'node:string_decoder', 'node:querystring', 'node:punycode', 'node:repl', 'node:dgram', 'node:cluster', 'node:console', 'node:domain', 'node:v8', 'node:async_hooks', 'node:http2', 'node:tls',
    // Common dependencies that use dynamic require
    'signal-exit', 'ink', 'react', 'react-dom', 'yargs', 'minimist', 'commander'
  ],
}).catch((err) => {
  console.error('esbuild failed:', err);
  process.exit(1);
});
