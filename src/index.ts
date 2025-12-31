import { configureCompiler, renderTikzAsSvg } from './sdk.js'; 
import { unpackAsset } from './runtime.js'; 

// Assets are loaded as base64 strings thanks to our custom vite plugin
import wasmBase64 from './assets/tex.wasm?inline'; 
import fmtBase64 from './assets/tikz.fmt?inline'; 

let _initPromise: Promise<void> | null = null;

/** 
 * Initializes the compiler with the embedded assets. 
 */ 
export function initTikz(): Promise<void> { 
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      const [wasmBinary, fmtBinary] = await Promise.all([ 
        unpackAsset(wasmBase64), 
        unpackAsset(fmtBase64) 
      ]); 

      (globalThis as any).TIKZ_WASM_BINARY = wasmBinary; 
      (globalThis as any).TIKZ_FMT_BINARY = fmtBinary; 
      
    } catch (e) {
      _initPromise = null; // Reset on failure to allow retry
      throw e;
    }
  })();

  return _initPromise;
} 

export { renderTikzAsSvg, configureCompiler };