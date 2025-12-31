import { defineConfig } from 'vite';
import { inlineCompressedAssets } from './build/asset-plugin';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    inlineCompressedAssets({ verbose: true })
  ],
  resolve: {
    // --- FIX START ---
    // This tells Vite (and Vitest) exactly where to find the source code 
    // for your imports. Adjust the "../folder-name" paths if your structure differs.
    alias: {
      'tikz-wasm-sdk': resolve(__dirname, '../tikz-wasm-sdk/src/index.ts'),
      'tikz-wasm-compiler': resolve(__dirname, '../tikz-wasm-compiler/src/index.ts'),
      'tikz-dvi-parser': resolve(__dirname, '../tikz-dvi-parser/src/parser.ts')
    }
    // --- FIX END ---
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