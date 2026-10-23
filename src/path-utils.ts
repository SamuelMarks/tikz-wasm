/**
 * Path manipulation utilities for the Emscripten Virtual File System.
 *
 * @packageDocumentation
 */

/**
 * Splits a POSIX virtual file path into its ordered parent directory segment names.
 * For example, `"/texmf/fonts/data.tfm"` yields `["texmf", "fonts"]`.
 *
 * @param filePath - The full virtual file path.
 * @returns An array of non-empty parent directory segment names.
 */
export function getParentDirectories(filePath: string): string[] {
  const parts = filePath.split('/').filter(p => p.length > 0);
  parts.pop(); // Remove filename
  return parts;
}
