/**
 * Build the plugin's two halves:
 *  - lib/index.js  — host ESM entry (the `/open-folder` command).
 *  - lib/client.js — browser CJS bundle wrapped in the dsh ModuleLoader
 *    registration format (window.__ModuleLoader__.load({ id, factory })),
 *    with the shell's baseline module-table externals (react family, cordis)
 *    left as require() calls.
 */
import { defineConfig } from 'tsdown'

const CLIENT_ID = 'dsh-palette'
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
]

export default defineConfig([
  {
    entry: ['src/index.ts'],
    outDir: 'lib',
    format: 'esm',
    platform: 'node',
    target: 'node22',
    dts: false,
    sourcemap: false,
    clean: false,
  },
  {
    entry: ['src/client/index.ts'],
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    external: CLIENT_EXTERNALS,
    dts: false,
    sourcemap: false,
    clean: false,
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({\n  id: ${JSON.stringify(CLIENT_ID)},\n  factory: (require) => {`,
      intro: 'var module = { exports: {} };\nvar exports = module.exports;',
      footer: 'return module.exports;\n  },\n});',
    },
  },
])
