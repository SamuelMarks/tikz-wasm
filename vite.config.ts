/**
 * Vite and Vitest configuration for bundling `tikz-wasm` and enforcing 100% test coverage.
 *
 * @packageDocumentation
 */

import { defineConfig } from 'vitest/config';
import { inlineCompressedAssets } from './build/asset-plugin.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Bundles `src/worker.ts` into a self-contained, minified IIFE string using esbuild.
 *
 * @param entryPoint - Optional custom entry point path for testing.
 * @returns The bundled JavaScript source string.
 * @throws Error if esbuild fails to produce an output file.
 */
export function bundleWorker(entryPoint: string = resolve(__dirname, 'src/worker.ts')): string {
  const result = esbuild.buildSync({
    entryPoints: [entryPoint],
    bundle: true,
    minify: true,
    format: 'iife',
    write: false,
    target: 'es2020',
    platform: 'browser',
  });
  const firstFile = result.outputFiles?.[0];
  if (!firstFile) {
    throw new Error('Worker bundle failed: esbuild produced no output files.');
  }
  return firstFile.text;
}

const workerCode = bundleWorker();

export default defineConfig({
  plugins: [
    process.env.VITEST
      ? {
          name: 'vitest-mock-assets',
          resolveId(id: string): string | undefined {
            if (id.endsWith('?inline') && (id.includes('tex.wasm') || id.includes('tikz.fmt'))) {
              return '\0virtual:' + id;
            }
            return undefined;
          },
          load(id: string): string | undefined {
            if (id.startsWith('\0virtual:')) {
              if (id.includes('tex.wasm')) {
                return 'export default "MOCK_WASM_CONTENT";';
              }
              if (id.includes('tikz.fmt')) {
                return 'export default "MOCK_FMT_CONTENT";';
              }
              return 'export default "VIRTUAL_ASSET_CONTENT";';
            }
            return undefined;
          }
        }
      : inlineCompressedAssets({ verbose: true })
  ],
  define: {
    '__TIKZ_WORKER_CODE__': JSON.stringify(workerCode)
  },
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'scripts/**/*.ts', 'build/**/*.ts'],
      exclude: ['src/assets.d.ts', 'src/types.ts'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      }
    }
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'TikzWasm',
      fileName: (format) => `tikz-wasm.${format}.js`
    },
    rollupOptions: {
      output: {
        compact: true
      }
    }
  }
});
