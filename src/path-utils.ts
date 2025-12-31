/**
 * Splits a file path into its directory keys.
 * e.g., "/texmf/fonts/data" -> ["texmf", "fonts"]
 */
export function getParentDirectories(filePath: string): string[] {
  const parts = filePath.split('/').filter(p => p.length > 0);
  parts.pop(); // Remove filename
  return parts;
}