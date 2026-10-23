/**
 * Main-thread facade for communicating with the TikZ Web Worker.
 *
 * @packageDocumentation
 */

import type { CompileJob, CompileResult } from './types.js';

/**
 * Public facade to interact with the TikZ compiler running inside a Web Worker.
 */
export class TikzCompiler {
  /**
   * Underlying Web Worker instance executing `worker.ts`.
   */
  private readonly worker: Worker;

  /**
   * Active map of job IDs to their pending Promise resolution callbacks.
   */
  private readonly jobs: Map<string, (result: CompileResult) => void>;

  /**
   * Creates a new {@link TikzCompiler} spawning a Web Worker.
   *
   * @param workerScriptUrl - Optional URL or Blob URL to the bundled worker script.
   */
  constructor(workerScriptUrl?: string) {
    this.worker = workerScriptUrl
      ? new Worker(workerScriptUrl, { type: 'module' })
      : new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

    this.jobs = new Map();

    this.worker.onmessage = (e: MessageEvent<CompileResult>): void => {
      const { id } = e.data;
      const resolver = this.jobs.get(id);
      if (resolver) {
        this.jobs.delete(id);
        resolver(e.data);
      }
    };

    this.worker.onerror = (e: ErrorEvent): void => {
      const message = e.message || 'Unhandled Web Worker error';
      this.failAllPendingJobs(message);
    };
  }

  /**
   * Compiles a complete LaTeX/TikZ source string in the Web Worker.
   *
   * @param tikzSource - The complete LaTeX source or wrapped fragment.
   * @param wasmBinary - Optional WebAssembly binary to hydrate the worker.
   * @param fmtBinary - Optional `.fmt` dump binary to hydrate the worker.
   * @returns A Promise resolving to the {@link CompileResult}.
   */
  compile(
    tikzSource: string,
    wasmBinary?: Uint8Array,
    fmtBinary?: Uint8Array
  ): Promise<CompileResult> {
    const id = crypto.randomUUID();

    return new Promise((resolve) => {
      this.jobs.set(id, resolve);
      const job: CompileJob = {
        id,
        source: tikzSource,
        ...(wasmBinary ? { wasmBinary } : {}),
        ...(fmtBinary ? { fmtBinary } : {}),
      };
      this.worker.postMessage(job);
    });
  }

  /**
   * Terminates the underlying Web Worker and resolves any pending jobs as failed.
   */
  terminate(): void {
    this.failAllPendingJobs('Compiler worker terminated');
    this.worker.terminate();
  }

  /**
   * Resolves all pending jobs with a failure result and clears the job queue.
   *
   * @param reason - Failure description attached to each result.
   */
  private failAllPendingJobs(reason: string): void {
    for (const [id, resolver] of this.jobs.entries()) {
      resolver({
        id,
        success: false,
        logs: [`CRITICAL: ${reason}`],
        error: reason,
      });
    }
    this.jobs.clear();
  }
}
