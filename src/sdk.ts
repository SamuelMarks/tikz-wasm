import { DviParser } from './parser.js';
import { getCompiler, configureCompiler } from './pool.js';
import { wrapInDocument } from './template.js';
import { TikzCompilationError } from './errors.js';

export { configureCompiler };

/**
 * Renders a TikZ string to an SVG string.
 * Orchestrates template wrapping, compilation, and parsing.
 * 
 * @param tikzCode The raw TikZ code (e.g., "\begin{tikzpicture}...\end{tikzpicture}")
 * @returns A Promise resolving to the SVG string.
 */
export async function renderTikzAsSvg(tikzCode: string): Promise<string> {
  const compiler = getCompiler();
  const fullSource = wrapInDocument(tikzCode);

  const result = await compiler.compile(fullSource);

  if (!result.success || !result.dvi) {
    throw new TikzCompilationError(
      'TeX compilation failed',
      result.logs
    );
  }

  try {
    const parser = new DviParser(result.dvi);
    const svg = parser.parse();
    return svg;
  } catch (err: any) {
    throw new Error(`DVI Parsing Error: ${err.message}`);
  }
}