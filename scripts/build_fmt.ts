/**
 * CLI script (`scripts/build_fmt.ts`) for generating the pre-dumped `src/assets/tikz.fmt`
 * binary using a local TeX Live distribution and {@link FormatGenerator}.
 *
 * @packageDocumentation
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TeXBridge } from '../src/bridge.js';
import { FormatGenerator } from '../src/generator.js';
import type { EmscriptenModuleFactory } from '../src/types.js';

/**
 * Ensures `window` and `self` globals exist on `globalThis` when running Emscripten glue in Node.js.
 *
 * @param target - Target global object to polyfill.
 */
export function ensureBrowserGlobals(target: Record<string, unknown> = globalThis as Record<string, unknown>): void {
  if (typeof target['window'] === 'undefined') {
    target['window'] = target;
  }
  if (typeof target['self'] === 'undefined') {
    target['self'] = target;
  }
}

ensureBrowserGlobals();

/**
 * Module shape expected when dynamically importing `tex_glue.js`.
 */
export interface GlueModuleExports {
  /**
   * Default exported Emscripten module factory.
   */
  default?: EmscriptenModuleFactory | unknown;
}

/**
 * Default dynamic module loader for importing `tex_glue.js`.
 *
 * @param modulePath - Absolute path to the glue JS module.
 * @returns A Promise resolving to the imported module namespace.
 */
export async function defaultGlueImporter(modulePath: string): Promise<GlueModuleExports> {
  return (await import(modulePath)) as GlueModuleExports;
}

/**
 * Executes the format generation build workflow.
 *
 * @param args - Command-line arguments (defaults to `process.argv.slice(2)`).
 * @param importer - Module loader function used to import `tex_glue.js`.
 */
export async function runBuild(
  args: readonly string[] = process.argv.slice(2),
  importer: (modulePath: string) => Promise<GlueModuleExports> = defaultGlueImporter
): Promise<void> {
  const texDistPath = args[0];
  if (!texDistPath) {
    console.error('Usage: tsx scripts/build_fmt.ts <PATH_TO_LOCAL_TEXMF_DIST>');
    console.error('Example: tsx scripts/build_fmt.ts /usr/share/texlive/texmf-dist');
    process.exit(1);
    return;
  }

  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const assetsDir = path.join(projectRoot, 'src', 'assets');
  const gluePath = path.join(assetsDir, 'tex_glue.js');
  const outputFmtPath = path.join(assetsDir, 'tikz.fmt');

  console.log('Building tikz.fmt...');
  console.log(`Source TeX Dist: ${texDistPath}`);
  console.log(`Glue Code: ${gluePath}`);

  try {
    const glueModule = await importer(gluePath);
    const factory = glueModule.default;

    if (typeof factory !== 'function') {
      throw new Error(`Glue code at ${gluePath} did not export a default factory function.`);
    }

    const bridge = new TeXBridge();

    console.log('Initializing WASM Bridge...');
    await bridge.init(factory as EmscriptenModuleFactory);

    const generator = new FormatGenerator(bridge, texDistPath);
    await generator.generate(outputFmtPath);
  } catch (err: unknown) {
    console.error('Build Failed:', err);
    process.exit(1);
  }
}

/* v8 ignore start */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void runBuild();
}
/* v8 ignore stop */
