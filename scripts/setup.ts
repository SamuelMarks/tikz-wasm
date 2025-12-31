import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * URLs for the upstream binary artifacts.
 * Currently pointing to a stable commit of texlive.js for pdftex.
 */
export const ASSET_URLS = {
  wasm: 'https://raw.githubusercontent.com/Manuels/texlive.js/master/pdftex_worker/pdftex.wasm',
  glue: 'https://raw.githubusercontent.com/Manuels/texlive.js/master/pdftex_worker/pdftex.js',
};

/**
 * Configuration for local paths.
 */
export const CONFIG = {
  assetsDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/assets'),
  wasmPath: 'tex.wasm',
  gluePath: 'tex_glue.js', // This will be the raw JS we patch
};

/**
 * Ensures the target directory exists.
 * @param dirPath The directory to ensure.
 */
export function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

/**
 * Downloads a file from a URL to a local path.
 * @param url Remote URL.
 * @param destPath Local destination.
 * @returns Promise resolving to the file path.
 */
export async function downloadFile(url: string, destPath: string): Promise<string> {
  console.log(`Downloading ${url} -> ${destPath}...`);
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(destPath, buffer);
  
  console.log(`Saved ${buffer.byteLength} bytes to ${destPath}`);
  return destPath;
}

/**
 * Patches the raw Emscripten JS glue code to export a Module Factory.
 * The upstream code is designed to run globally or in a generic Worker.
 * We wrap it in a function that returns a Promise resolving to the Module.
 * 
 * @param rawJs The original JS string from upstream.
 * @returns The patched JS string suitable for ES Module import.
 */
export function patchGlueCode(rawJs: string): string {
  // We inject a factory wrapper.
  // 1. We create a Promise.
  // 2. We assign the incoming `overrides` to `Module`.
  // 3. We hook `onRuntimeInitialized` to resolve the promise.
  // 4. We catch the standard Emscripten `var Module` declaration to ensure it uses our scope.

  const header = `
export default function TikZModuleFactory(moduleOverrides = {}) {
  return new Promise((resolve, reject) => {
    var Module = moduleOverrides;
    Module.onRuntimeInitialized = function() {
      resolve(Module);
    };
    // Patch: Ensure printErr is bound if not provided
    if (!Module.printErr) Module.printErr = console.error;
    if (!Module.print) Module.print = console.log;

    // --- START UPSTREAM CODE ---
`;

  const footer = `
    // --- END UPSTREAM CODE ---
  });
}
`;

  // Prevent upstream from re-declaring Module if it does "var Module" at top level
  // We replace the first occurrence of `var Module` implies strict mode might be tricky,
  // but usually Emscripten code checks `if (typeof Module !== ...`.
  // A safe generic patch for texlive.js style:
  // It usually starts with `var Module; ...` or `if (typeof Module ...`.
  // We'll leave the code largely intact but wrapped. Variable hoisting "var Module" 
  // inside our factory function stays local to the factory function.
  
  return header + rawJs + footer;
}

/**
 * Main execution flow.
 */
export async function main(): Promise<void> {
  try {
    ensureDirectory(CONFIG.assetsDir);

    const wasmDest = path.join(CONFIG.assetsDir, CONFIG.wasmPath);
    const glueDest = path.join(CONFIG.assetsDir, CONFIG.gluePath);

    // 1. Download WASM
    // (Only download if missing or forced - simplistic check logic here implies overwrite for 'setup')
    await downloadFile(ASSET_URLS.wasm, wasmDest);

    // 2. Download Glue
    // We download to a temporary buffer logic ideally, but here we write then-read-patch-write for simplicity/testability
    const tempGlue = path.join(CONFIG.assetsDir, 'temp_glue.js');
    await downloadFile(ASSET_URLS.glue, tempGlue);

    // 3. Patch Glue
    const rawGlue = fs.readFileSync(tempGlue, 'utf-8');
    const patchedGlue = patchGlueCode(rawGlue);
    fs.writeFileSync(glueDest, patchedGlue);
    console.log(`Patched glue code written to ${glueDest}`);

    // Cleanup
    fs.unlinkSync(tempGlue);

  } catch (err: unknown) {
    console.error('Setup failed:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

// execute if running directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}