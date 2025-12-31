import { defineConfig } from 'vite'; 
import { inlineCompressedAssets } from './build/asset-plugin'; 
import { resolve, dirname } from 'path'; 
import { fileURLToPath } from 'url';
import esbuild from 'esbuild'; 

// Fix for ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const bundleWorker = (): string => { 
  try { 
    const result = esbuild.buildSync({ 
      entryPoints: [resolve(__dirname, 'src/worker.ts')], 
      bundle: true, 
      minify: true, 
      format: 'iife', 
      write: false, 
      target: 'es2020', 
      platform: 'browser', 
    }); 
    return result.outputFiles[0].text; 
  } catch (e) { 
    console.warn("Worker bundle failed. Returning empty stub."); 
    return ""; 
  } 
}; 

const workerCode = bundleWorker(); 

export default defineConfig({ 
  plugins: [ 
    // Conditional plugin loading:
    // During tests, we mock asset imports virtually to avoid file-not-found errors.
    process.env.VITEST 
      ? {
          name: 'vitest-mock-assets',
          resolveId(id) {
            if (id.endsWith('?inline') && (id.includes('tex.wasm') || id.includes('tikz.fmt'))) {
              return '\0virtual:' + id;
            }
          },
          load(id) {
            if (id.startsWith('\0virtual:')) {
              // Return distinct mocks matching tests/index.test.ts expectations
              if (id.includes('tex.wasm')) {
                return 'export default "MOCK_WASM_CONTENT";';
              }
              if (id.includes('tikz.fmt')) {
                return 'export default "MOCK_FMT_CONTENT";';
              }
              return 'export default "VIRTUAL_ASSET_CONTENT";';
            }
          }
        }
      : inlineCompressedAssets({ verbose: true }) 
  ], 
  define: { 
    '__TIKZ_WORKER_CODE__': JSON.stringify(workerCode) 
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