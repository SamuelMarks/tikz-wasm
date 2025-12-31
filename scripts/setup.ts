import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * SwiftLaTeX does not commit built artifacts to their repo.
 * Users must build the SwiftLaTeX/PdfTeX-WASM project manually or fork it and create releases.
 *
 * Default URLs below are placeholders. You should either:
 * 1. Run this script with `--local <path-to-swiftlatex-build>`
 * 2. Set TIKZ_WASM_URL and TIKZ_GLUE_URL environment variables.
 * 3. Update the constants below to point to your fork's release.
 */
export const ASSET_URLS = {
  wasm: process.env.TIKZ_WASM_URL || 'https://github.com/USER/REPO/releases/download/v1/pdftex.wasm',
  glue: process.env.TIKZ_GLUE_URL || 'https://github.com/USER/REPO/releases/download/v1/PdfTeXEngine.js',
};

export const CONFIG = {
  assetsDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/assets'),
  wasmPath: 'tex.wasm',
  gluePath: 'tex_glue.js',
};

export function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    // eslint-disable-next-line no-console
    console.log(`Created directory: ${dirPath}`);
  }
}

export async function downloadFile(url: string, destPath: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`Downloading ${url} -> ${destPath}...`);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText} (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(destPath, buffer);

  // eslint-disable-next-line no-console
  console.log(`Saved ${buffer.byteLength} bytes to ${destPath}`);
}

export async function copyLocal(srcDir: string, destDir: string): Promise<void> {
  console.log(`Copying artifacts from local build: ${srcDir}`);

  const srcWasm = path.join(srcDir, 'pdftex.wasm');
  const srcGlue = path.join(srcDir, 'PdfTeXEngine.js');
  // Sanity check: SwiftLaTeX sometimes nests the wasm inside a pdftex.wasm folder?
  // Based on tree, usually the build artifact is in the root or a dist folder.
  // We try generic names.

  if (!fs.existsSync(srcWasm)) {
    throw new Error(`Local build missing WASM at: ${srcWasm}`);
  }
  if (!fs.existsSync(srcGlue)) {
    throw new Error(`Local build missing JS Glue at: ${srcGlue}`);
  }

  fs.copyFileSync(srcWasm, path.join(destDir, CONFIG.wasmPath));
  console.log(`Copied ${CONFIG.wasmPath}`);

  // We copy glue to a temp file for patching
  fs.copyFileSync(srcGlue, path.join(destDir, 'temp_glue.js'));
  console.log(`Copied ${CONFIG.gluePath} (to temp)`);
}

/**
 * Patches the SwiftLaTeX Emscripten JS glue code.
 */
export function patchGlueCode(rawJs: string): string {
  // SwiftLaTeX/Emscripten usually assigns to 'Module'.
  // We wrap it in a factory.

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

  // Filter out node-isms
  const content = rawJs
      .replace(/require\(['"]fs['"]\)/g, '{}')
      .replace(/require\(['"]path['"]\)/g, '{}')
      // Fix: SwiftLaTeX sometimes uses 'this' at top level which is undefined in strict modules
      .replace(/var Module=typeof Module!="undefined"\?Module:{};/g, 'var Module = moduleOverrides || {};')
      // Prevent auto-execution if present
      .replace(/if\(typeof Module!=='undefined'\)Module=/, '// Module=');

  const footer = `
    // --- END UPSTREAM CODE ---
  });
} 
`;

  return header + content + footer;
}

export async function main(): Promise<void> {
  try {
    ensureDirectory(CONFIG.assetsDir);

    const args = process.argv.slice(2);
    const localFlagIndex = args.indexOf('--local');
    const isLocal = localFlagIndex !== -1;

    if (isLocal) {
      const srcPath = args[localFlagIndex + 1];
      if (!srcPath) throw new Error("Missing path argument for --local");
      await copyLocal(srcPath, CONFIG.assetsDir);
    } else {
      // Attempt download only if URLs look valid (not placeholders)
      if (ASSET_URLS.wasm.includes('https://github.com/USER/REPO')) {
        console.warn("WARNING: Using placeholder URLs. Setup will likely fail.");
        console.warn("Please build SwiftLaTeX/PdfTeX-WASM locally and run: npm run setup -- --local ../PdfTeX-WASM/");
      }

      const wasmDest = path.join(CONFIG.assetsDir, CONFIG.wasmPath);
      const glueDest = path.join(CONFIG.assetsDir, 'temp_glue.js');

      await downloadFile(ASSET_URLS.wasm, wasmDest);
      await downloadFile(ASSET_URLS.glue, glueDest);
    }

    // Patch Glue
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}