import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { Plugin } from 'vite';

export interface AssetPluginOptions {
  // Option to log stats during build
  verbose?: boolean;
}

/**
 * Vite Plugin to intercept imports ending in `?inline`.
 * It reads the file, gzips it, base64 encodes it, and returns it as a string export.
 */
export function inlineCompressedAssets(options: AssetPluginOptions = {}): Plugin {
  return {
    name: 'inline-compressed-assets',
    enforce: 'pre',
    
    async load(id) {
      // Only handle marked files
      if (!id.endsWith('?inline')) {
        return null;
      }

      // Resolve path (remove query)
      const filePath = id.replace('?inline', '');
      
      // Strict existence check required by tests
      if (!fs.existsSync(filePath)) {
        throw new Error(`Asset not found: ${filePath}`);
      }

      // Read & Compress
      const buffer = fs.readFileSync(filePath);
      const zipped = zlib.gzipSync(buffer);
      const base64 = zipped.toString('base64');

      if (options.verbose) {
        // eslint-disable-next-line no-console
        console.log(`[Asset] Inlining ${path.basename(filePath)} (${base64.length} chars)`);
      }

      // Return ES Module
      return `export default "${base64}";`;
    }
  };
}