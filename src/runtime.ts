/**
 * Asset decompression and runtime state utilities.
 *
 * @packageDocumentation
 */

/**
 * Unpacks a Base64-encoded Gzipped string into its original binary form.
 * Utilizes the modern `DecompressionStream` API for native performance.
 *
 * @param base64 - The Gzipped content encoded as Base64.
 * @returns A Promise resolving to the uncompressed `Uint8Array`.
 * @throws Error if `DecompressionStream` is not supported in the current environment.
 */
export async function unpackAsset(base64: string): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error(
      'Browser does not support DecompressionStream used for asset hydration. ' +
      'Please use a modern browser (Chrome 80+, FF 113+, Safari 16.4+) or include a polyfill.'
    );
  }

  // 1. Base64 -> Binary String
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);

  // 2. Binary String -> Uint8Array
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // 3. Decompress via Stream
  const stream = new Blob([bytes]).stream()
    .pipeThrough(new DecompressionStream('gzip'));

  // 4. Collect Stream Result
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
