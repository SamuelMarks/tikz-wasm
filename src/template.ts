/**
 * Standalone LaTeX document template wrapper for TikZ snippets.
 *
 * @packageDocumentation
 */

/**
 * Detects if the input string is a full LaTeX document or a TikZ snippet.
 * If strictly a snippet, wraps it in the standalone document boilerplate
 * compatible with the pre-loaded `dvisvgm` format file.
 *
 * @param source - Raw LaTeX document or TikZ environment snippet.
 * @returns Complete LaTeX source ready for the TeX compiler.
 */
export function wrapInDocument(source: string): string {
  const trimmed = source.trim();

  if (trimmed.startsWith(String.raw`\documentclass`) || trimmed.startsWith(String.raw`\input`)) {
    return source;
  }

  return [
    String.raw`\documentclass[dvisvgm]{standalone}`,
    String.raw`\begin{document}`,
    source,
    String.raw`\end{document}`,
  ].join(String.fromCharCode(10));
}
