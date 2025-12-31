/**
 * Detects if the input string is a full LaTeX document or just a TikZ snippet.
 * If strictly a snippet, wraps it in the necessary standalone boilerplate
 * compatible with the pre-loaded format file.
 */
export function wrapInDocument(source: string): string {
  const trimmed = source.trim();

  // If the user provided a full document, trust them.
  if (trimmed.startsWith('\\documentclass') || trimmed.startsWith('\\input')) {
    return source;
  }

  // Prepend the load command if it looks like just a TikZ environment
  // We assume the format file (tikz.fmt) has preloaded pgf/tikz but not essentially 
  // the document environment if we are using the standard LaTeX dumped format.
  // We use the 'standalone' logic or a simple page shipment.
  // Adjust based on the actual .fmt content. Here we assume minimal wrapping.
  
  return `
    \\documentclass[dvisvgm]{standalone}
    \\begin{document}
    ${source}
    \\end{document}
  `;
}