import { TeXBridge } from './bridge.js';
import type { CompileJob, CompileResult, EmscriptenModuleFactory } from './types.js';

const bridge = new TeXBridge();
let initialized = false;

// The Bundle setup (via index.ts) attaches these binaries to global scope
declare global {
  var TikZModuleFactory: EmscriptenModuleFactory;
  var TIKZ_WASM_BINARY: Uint8Array;
  var TIKZ_FMT_BINARY: Uint8Array;
}

self.onmessage = async (e: MessageEvent<CompileJob>) => {
  const { id, source } = e.data;
  const result: CompileResult = {
    id,
    success: false,
    logs: [],
  };

  try {
    if (!initialized) {
      if (typeof self.TikZModuleFactory !== 'function') {
        throw new Error('WASM Module Factory not found.');
      }
      if (!self.TIKZ_WASM_BINARY) {
        throw new Error('WASM Binary not loaded in worker global scope.');
      }

      // Pass the binary to the bridge to avoid fetching inside worker
      await bridge.init(self.TikZModuleFactory, self.TIKZ_WASM_BINARY);

      // Load the Format File immediately after init
      if (self.TIKZ_FMT_BINARY) {
        // We write to 'tikz.fmt' because our engine invocation defaults to this name based on executable name usually,
        // or we pass it explicitly.
        // Usually, the engine looks for {jobname}.fmt or standard tikz.fmt in local dir.
        bridge.writeFile('tikz.fmt', self.TIKZ_FMT_BINARY);
      }

      initialized = true;
    }

    // 1. Write Input
    bridge.writeFile('input.tex', source);

    // 2. Run Engine
    // Note: SwiftLaTeX might output PDF by default.
    // The Input usually contains \pdfoutput=0, OR we pass flags if possible.
    // But standard tex command line args handling applies.
    // We rely on the input file's preamble to set output mode, or the custom format file.
    const success = bridge.runTeX('input.tex');

    // 3. Harvest Result
    result.logs = bridge.getLogs();
    result.success = success;

    if (success) {
      // .dvi output
      result.dvi = bridge.readFile('input.dvi');
    }

  } catch (err: any) {
    result.error = err.message || 'Unknown Worker Error';
    // Capture logs even on crash if available
    if (bridge) {
      result.logs = [...bridge.getLogs(), `CRITICAL: ${result.error}`];
    }
  }

  self.postMessage(result);
};