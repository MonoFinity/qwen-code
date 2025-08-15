// Minimal esbuild config for qwen-code
import { build } from 'esbuild';

build({
  entryPoints: ['packages/cli/index.ts'],
  bundle: true,
  platform: 'node',
  outfile: 'bundle/qwen.mjs',
  sourcemap: true,
  target: ['node20'],
  format: 'esm',
  // Allow `require()` in ESM output for external CJS packages
  banner: {
    js: "import { createRequire as __createRequire } from 'module';const require = __createRequire(import.meta.url);",
  },
  external: [
    // Keep key ESM libs external so Node resolves them natively
    'ink',
    'react',
    'react-dom',
    'yargs',
    // Externalize Google SDKs to avoid bundling dynamic requires
    '@google/genai',
    'google-auth-library',
  ],
}).catch((err) => {
  console.error('esbuild failed:', err);
  process.exit(1);
});
