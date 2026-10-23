/**
 * Vite plugin for inlining Gzipped and Base64-encoded binary assets (`.wasm`, `.fmt`, `.woff2`).
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import type { Plugin } from 'vite';

/**
 * Configuration options for {@link inlineCompressedAssets}.
 */
export interface InlineAssetOptions {
  /**
   * Whether to log compression statistics during the build.
   */
  readonly verbose?: boolean;
  /**
   * Optional custom logger function used when {@link InlineAssetOptions.verbose} is enabled.
   *
   * @param message - The formatted log message.
   */
  readonly logger?: (message: string) => void;
}

/**
 * Creates a Vite plugin that intercepts `?inline` imports for `.wasm`, `.fmt`, and `.woff2` files,
 * compresses their binary contents with Gzip, and exports the result as a Base64 string literal.
 *
 * @param options - Optional plugin configuration.
 * @returns A configured Vite {@link Plugin} instance.
 */
export function inlineCompressedAssets(options: InlineAssetOptions = {}): Plugin {
  const verbose = options.verbose ?? false;
  const log = options.logger ?? ((msg: string): void => { console.log(msg); });

  return {
    name: 'vite-plugin-inline-compressed-assets',

    /**
     * Resolves `.wasm?inline`, `.fmt?inline`, and `.woff2?inline` import specifiers.
     *
     * @param id - The import specifier.
     * @param importer - The importing module path, if any.
     * @returns The resolved path with `?inline` suffix, or `null` if not handled.
     */
    resolveId(id: string, importer?: string): string | null {
      if (!id.endsWith('?inline')) {
        return null;
      }

      const cleanId = id.slice(0, -'?inline'.length);
      if (!cleanId.endsWith('.wasm') && !cleanId.endsWith('.fmt') && !cleanId.endsWith('.woff2')) {
        return null;
      }

      if (importer && (cleanId.startsWith('.') || cleanId.startsWith('/'))) {
        const resolved = path.resolve(path.dirname(importer), cleanId);
        return `${resolved}?inline`;
      }

      return id;
    },

    /**
     * Loads, Gzip-compresses, and Base64-encodes a resolved `?inline` binary asset.
     *
     * @param id - The resolved module ID.
     * @returns A JavaScript module string exporting the Base64 string, or `null` if not handled.
     * @throws Error if the target binary file does not exist on disk.
     */
    load(id: string): string | null {
      if (!id.endsWith('?inline')) {
        return null;
      }

      const filePath = id.slice(0, -'?inline'.length);
      if (!filePath.endsWith('.wasm') && !filePath.endsWith('.fmt') && !filePath.endsWith('.woff2')) {
        return null;
      }

      if (!fs.existsSync(filePath)) {
        throw new Error(`Asset not found: ${filePath}`);
      }

      const rawBuffer = fs.readFileSync(filePath);
      const compressed = zlib.gzipSync(rawBuffer, { level: 9 });
      const base64 = compressed.toString('base64');

      if (verbose) {
        log(
          `[inline-assets] Compressed ${path.basename(filePath)}: ${rawBuffer.byteLength}B -> ${compressed.byteLength}B`
        );
      }

      return `export default "${base64}";`;
    }
  };
}
