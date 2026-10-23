/**
 * Public SDK entrypoint for rendering TikZ code to SVG strings.
 *
 * @packageDocumentation
 */

import { DviParser } from './parser.js';
import { getCompiler, configureCompiler } from './pool.js';
import { wrapInDocument } from './template.js';
import { TikzCompilationError } from './errors.js';
import type { RenderOptions } from './types.js';

export { configureCompiler };

/**
 * Global runtime interface holding hydrated WebAssembly and format binaries.
 */
interface TikzGlobalScope {
  /**
   * Unpacked `tex.wasm` binary buffer.
   */
  TIKZ_WASM_BINARY?: Uint8Array;
  /**
   * Unpacked `tikz.fmt` memory dump buffer.
   */
  TIKZ_FMT_BINARY?: Uint8Array;
}

/**
 * Renders a TikZ snippet or complete LaTeX document to a standalone SVG string.
 * Orchestrates template wrapping, Web Worker TeX compilation, and DVI-to-SVG parsing.
 *
 * @param tikzCode - Raw TikZ code (e.g., `"\begin{tikzpicture}...\end{tikzpicture}"`).
 * @param options - Optional rendering and diagnostic options.
 * @returns A Promise resolving to the standalone SVG string.
 * @throws {@link TikzCompilationError} if TeX compilation fails.
 * @throws Error if DVI parsing fails.
 */
export async function renderTikzAsSvg(
  tikzCode: string,
  options?: RenderOptions
): Promise<string> {
  const compiler = getCompiler();
  const fullSource = wrapInDocument(tikzCode);
  const scope = globalThis as unknown as TikzGlobalScope;

  const result = await compiler.compile(
    fullSource,
    scope.TIKZ_WASM_BINARY,
    scope.TIKZ_FMT_BINARY
  );

  if (options?.debug) {
    const logger = options.debugLogger ?? ((msg: string): void => { console.debug(msg); });
    for (const line of result.logs) {
      logger(line);
    }
  }

  if (!result.success || !result.dvi) {
    throw new TikzCompilationError('TeX compilation failed', result.logs);
  }

  try {
    const parser = new DviParser(result.dvi, options?.fontBase64Woff2);
    return parser.parse();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`DVI Parsing Error: ${message}`);
  }
}
