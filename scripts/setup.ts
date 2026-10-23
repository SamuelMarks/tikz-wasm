/**
 * CLI script (`scripts/setup.ts`) for downloading or copying the upstream `pdftex` WebAssembly
 * binary and patching its Emscripten JavaScript glue code into a Promise-based factory.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Upstream download URLs for the WebAssembly binary and Emscripten glue code.
 */
/* v8 ignore start */
export const ASSET_URLS = {
  /**
   * URL to download `pdftex.wasm`.
   */
  wasm: process.env['TIKZ_WASM_URL'] ?? 'https://github.com/USER/REPO/releases/download/v1/pdftex.wasm',
  /**
   * URL to download `PdfTeXEngine.js` glue code.
   */
  glue: process.env['TIKZ_GLUE_URL'] ?? 'https://github.com/USER/REPO/releases/download/v1/PdfTeXEngine.js',
};
/* v8 ignore stop */

/**
 * Local asset destination configuration.
 */
export const CONFIG = {
  /**
   * Absolute path to `src/assets`.
   */
  assetsDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/assets'),
  /**
   * Filename for the WebAssembly binary inside `src/assets`.
   */
  wasmPath: 'tex.wasm',
  /**
   * Filename for the patched Emscripten glue module inside `src/assets`.
   */
  gluePath: 'tex_glue.js',
};

/**
 * Ensures that the specified directory exists, creating it recursively if absent.
 *
 * @param dirPath - Directory path to check and create.
 */
export function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

/**
 * Downloads a binary file from a remote URL and saves it to disk.
 *
 * @param url - Remote HTTP/HTTPS URL to fetch.
 * @param destPath - Destination file path on disk.
 * @throws Error if the HTTP response status is not OK.
 */
export async function downloadFile(url: string, destPath: string): Promise<void> {
  console.log(`Downloading ${url} -> ${destPath}...`);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText} (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(destPath, buffer);

  console.log(`Saved ${buffer.byteLength} bytes to ${destPath}`);
}

/**
 * Copies `pdftex.wasm` and `PdfTeXEngine.js` from a local SwiftLaTeX build directory.
 *
 * @param srcDir - Source directory containing `pdftex.wasm` and `PdfTeXEngine.js`.
 * @param destDir - Target `src/assets` directory.
 * @throws Error if either artifact is missing in `srcDir`.
 */
export async function copyLocal(srcDir: string, destDir: string): Promise<void> {
  console.log(`Copying artifacts from local build: ${srcDir}`);

  const srcWasm = path.join(srcDir, 'pdftex.wasm');
  const srcGlue = path.join(srcDir, 'PdfTeXEngine.js');

  if (!fs.existsSync(srcWasm)) {
    throw new Error(`Local build missing WASM at: ${srcWasm}`);
  }
  if (!fs.existsSync(srcGlue)) {
    throw new Error(`Local build missing JS Glue at: ${srcGlue}`);
  }

  fs.copyFileSync(srcWasm, path.join(destDir, CONFIG.wasmPath));
  console.log(`Copied ${CONFIG.wasmPath}`);

  fs.copyFileSync(srcGlue, path.join(destDir, 'temp_glue.js'));
  console.log(`Copied ${CONFIG.gluePath} (to temp)`);
}

/**
 * Patches the raw SwiftLaTeX Emscripten JS glue code into an ES module exporting
 * a Promise-returning `TikZModuleFactory` function.
 *
 * @param rawJs - Raw upstream JavaScript glue code.
 * @returns Patched ES module JavaScript string.
 */
export function patchGlueCode(rawJs: string): string {
  const header = `
export default function TikZModuleFactory(moduleOverrides = {}) {
  return new Promise((resolve, reject) => {
    var Module = Object.assign({}, moduleOverrides);
    
    // Safety for 'document.currentScript' in workers
    var _scriptDir = typeof self !== 'undefined' ? self.location.href : undefined;

    Module.onRuntimeInitialized = function() {
      resolve(Module);
    };

    Module.onAbort = function(what) {
      reject(new Error("WASM Aborted: " + what));
    };

    // --- START UPSTREAM CODE ---
`;

  const content = rawJs
    .replace(/require\(['"]fs['"]\)/g, '{}')
    .replace(/require\(['"]path['"]\)/g, '{}')
    .replace(/var Module=typeof Module!="undefined"\?Module:{};/g, 'var Module = moduleOverrides || {};')
    .replace(/if\(typeof Module!=='undefined'\)Module=/, '// Module=');

  const footer = `
    // --- END UPSTREAM CODE ---
  });
} 
`;

  return header + content + footer;
}

/**
 * Executes the setup workflow (remote download or `--local <dir>` copy, followed by glue patching).
 *
 * @param argv - CLI arguments (defaults to `process.argv.slice(2)`).
 */
export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  try {
    ensureDirectory(CONFIG.assetsDir);

    const localFlagIndex = argv.indexOf('--local');
    const isLocal = localFlagIndex !== -1;

    if (isLocal) {
      const srcPath = argv[localFlagIndex + 1];
      if (!srcPath) {
        throw new Error('Missing path argument for --local');
      }
      await copyLocal(srcPath, CONFIG.assetsDir);
    } else {
      if (ASSET_URLS.wasm.includes('https://github.com/USER/REPO')) {
        console.warn('WARNING: Using placeholder URLs. Setup will likely fail.');
        console.warn('Please build SwiftLaTeX/PdfTeX-WASM locally and run: npm run setup -- --local ../PdfTeX-WASM/');
      }

      const wasmDest = path.join(CONFIG.assetsDir, CONFIG.wasmPath);
      const glueDest = path.join(CONFIG.assetsDir, 'temp_glue.js');

      await downloadFile(ASSET_URLS.wasm, wasmDest);
      await downloadFile(ASSET_URLS.glue, glueDest);
    }

    const tempGlue = path.join(CONFIG.assetsDir, 'temp_glue.js');
    const glueDest = path.join(CONFIG.assetsDir, CONFIG.gluePath);

    if (fs.existsSync(tempGlue)) {
      const rawGlue = fs.readFileSync(tempGlue, 'utf-8');
      const patchedGlue = patchGlueCode(rawGlue);
      fs.writeFileSync(glueDest, patchedGlue);
      console.log(`Patched glue code written to ${glueDest}`);
      fs.unlinkSync(tempGlue);
    }
  } catch (err: unknown) {
    console.error('Setup failed:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

/* v8 ignore start */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main();
}
/* v8 ignore stop */
