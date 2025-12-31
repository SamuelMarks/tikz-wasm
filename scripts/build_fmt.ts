import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TeXBridge } from '../src/bridge.js';
import { FormatGenerator } from '../src/generator.js';

// --- MOCK BROWSER ENVIRONMENT ---
// The upstream Emscripten glue code might expect these globals to exist.
// We explicitly mock them to ensure the factory runs smoothly in Node.
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = globalThis;
}
if (typeof globalThis.self === 'undefined') {
  (globalThis as any).self = globalThis;
}

/**
 * Main build script execution.
 * Steps:
 * 1. Resolves paths for assets and local TeX distro.
 * 2. Imports the patched WASM glue code dynamically.
 * 3. Initializes the TeX Bridge.
 * 4. Runs the FormatGenerator.
 */
export async function runBuild() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error("Usage: tsx scripts/build_fmt.ts <PATH_TO_LOCAL_TEXMF_DIST>");
    console.error("Example: tsx scripts/build_fmt.ts /usr/share/texlive/texmf-dist");
    process.exit(1);
  }

  const texDistPath = args[0];
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const assetsDir = path.join(projectRoot, 'src', 'assets');
  const gluePath = path.join(assetsDir, 'tex_glue.js');
  const outputFmtPath = path.join(assetsDir, 'tikz.fmt');

  console.log(`Building tikz.fmt...`);
  console.log(`Source TeX Dist: ${texDistPath}`);
  console.log(`Glue Code: ${gluePath}`);

  try {
    // Dynamic import of the glue code generated in Step 1
    // We use a query param or absolute path to bypass some TS strictness involves
    const glueModule = await import(gluePath);
    const factory = glueModule.default;

    if (typeof factory !== 'function') {
      throw new Error(`Glue code at ${gluePath} did not export a default factory function.`);
    }

    const bridge = new TeXBridge();
    
    // Initialize WASM
    console.log("Initializing WASM Bridge...");
    await bridge.init(factory);

    // Initialize Generator
    const generator = new FormatGenerator(bridge, texDistPath);

    // Run Generation
    await generator.generate(outputFmtPath);

  } catch (err) {
    console.error("Build Failed:", err);
    process.exit(1);
  }
}

// Execute if run as main script
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runBuild();
}