/**
 * Web Worker entrypoint executing the Emscripten TeX engine (`TeXBridge`) off the main thread.
 *
 * @packageDocumentation
 */

import { TeXBridge } from './bridge.js';
import { VfsManager } from './vfs.js';
import type { CompileJob, CompileResult, EmscriptenModuleFactory } from './types.js';

/**
 * Global worker scope interface holding the Emscripten factory and binary assets.
 */
export interface WorkerGlobalScope {
  /**
   * Emscripten module factory function.
   */
  TikZModuleFactory?: EmscriptenModuleFactory;
  /**
   * Unpacked `tex.wasm` binary buffer.
   */
  TIKZ_WASM_BINARY?: Uint8Array;
  /**
   * Unpacked `tikz.fmt` format dump buffer.
   */
  TIKZ_FMT_BINARY?: Uint8Array;
  /**
   * Sends a message back to the main thread.
   *
   * @param message - The compilation result payload.
   */
  postMessage: (message: CompileResult) => void;
  /**
   * Incoming message handler assigned by the worker entrypoint.
   *
   * @param event - The incoming message event from the main thread.
   */
  onmessage?: ((event: MessageEvent<CompileJob>) => Promise<void>) | null;
}

let bridge = new TeXBridge();
let initialized = false;

/**
 * Resets the internal worker state and replaces the {@link TeXBridge} instance (used for testing).
 *
 * @param customBridge - Optional custom {@link TeXBridge} instance.
 */
export function resetWorkerState(customBridge?: TeXBridge): void {
  bridge = customBridge ?? new TeXBridge();
  initialized = false;
}

/**
 * Processes a single {@link CompileJob} message inside the Web Worker and posts the {@link CompileResult}.
 *
 * @param e - Incoming `MessageEvent` containing the {@link CompileJob}.
 * @param scope - Worker global scope (defaults to `globalThis`).
 */
export async function handleWorkerMessage(
  e: MessageEvent<CompileJob>,
  scope: WorkerGlobalScope = globalThis as unknown as WorkerGlobalScope
): Promise<void> {
  const { id, source, wasmBinary, fmtBinary } = e.data;
  const result: CompileResult = {
    id,
    success: false,
    logs: [],
  };

  try {
    if (!initialized) {
      if (typeof scope.TikZModuleFactory !== 'function') {
        throw new Error('WASM Module Factory not found.');
      }
      const effectiveWasm = wasmBinary ?? scope.TIKZ_WASM_BINARY;
      if (!effectiveWasm) {
        throw new Error('WASM Binary not loaded in worker global scope.');
      }

      await bridge.init(scope.TikZModuleFactory, effectiveWasm);

      const vfs = new VfsManager(bridge.getFS());
      vfs.bootstrap();

      const effectiveFmt = fmtBinary ?? scope.TIKZ_FMT_BINARY;
      if (effectiveFmt) {
        bridge.writeFile('tikz.fmt', effectiveFmt);
      }

      initialized = true;
    }

    bridge.writeFile('input.tex', source);

    const success = bridge.runTeX('input.tex');

    result.logs = bridge.getLogs();
    result.success = success;

    if (success) {
      result.dvi = bridge.readFile('input.dvi');
    }
  } catch (err: unknown) {
    result.error = err instanceof Error && err.message ? err.message : 'Unknown Worker Error';
    result.logs = [...bridge.getLogs(), `CRITICAL: ${result.error}`];
  }

  scope.postMessage(result);
}

/* v8 ignore start */
if (typeof self !== 'undefined') {
  (self as unknown as WorkerGlobalScope).onmessage = (e: MessageEvent<CompileJob>): Promise<void> =>
    handleWorkerMessage(e, self as unknown as WorkerGlobalScope);
}
/* v8 ignore stop */
