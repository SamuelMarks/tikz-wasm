/**
 * Main library entrypoint for `tikz-wasm`.
 * Handles asset decompression and exports the public compilation SDK.
 *
 * @packageDocumentation
 */

import { configureCompiler, renderTikzAsSvg } from './sdk.js';
import { unpackAsset } from './runtime.js';

import wasmBase64 from './assets/tex.wasm?inline';
import fmtBase64 from './assets/tikz.fmt?inline';

/**
 * Typed global state storing unpacked binaries after {@link initTikz} completes.
 */
interface TikzGlobalState {
  /**
   * Unpacked `tex.wasm` binary buffer.
   */
  TIKZ_WASM_BINARY?: Uint8Array;
  /**
   * Unpacked `tikz.fmt` format dump buffer.
   */
  TIKZ_FMT_BINARY?: Uint8Array;
}

let _initPromise: Promise<void> | null = null;

/**
 * Initializes the TikZ compiler by decompressing the embedded WebAssembly and format assets.
 * Concurrent or subsequent calls share the same initialization Promise unless initialization fails.
 *
 * @returns A Promise that resolves when assets are unpacked and ready.
 */
export function initTikz(): Promise<void> {
  if (_initPromise) return _initPromise;

  _initPromise = (async (): Promise<void> => {
    try {
      const [wasmBinary, fmtBinary] = await Promise.all([
        unpackAsset(wasmBase64),
        unpackAsset(fmtBase64)
      ]);

      const globalState = globalThis as unknown as TikzGlobalState;
      globalState.TIKZ_WASM_BINARY = wasmBinary;
      globalState.TIKZ_FMT_BINARY = fmtBinary;
    } catch (e: unknown) {
      _initPromise = null; // Reset on failure to allow retry
      throw e;
    }
  })();

  return _initPromise;
}

export { renderTikzAsSvg, configureCompiler };
