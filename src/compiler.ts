import type { CompileJob, CompileResult } from './types.js';

/**
 * Public facade to interact with the TikZ compiler via Web Worker.
 */
export class TikzCompiler {
  private worker: Worker;
  private jobs: Map<string, (result: CompileResult) => void>;

  /**
   * @param workerScriptUrl Optional URL to the worker script. 
   * If not provided, relies on bundler's URL resolution defaults.
   */
  constructor(workerScriptUrl?: string) {
    this.worker = workerScriptUrl 
      ? new Worker(workerScriptUrl, { type: 'module' }) 
      : new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      
    this.jobs = new Map();

    this.worker.onmessage = (e: MessageEvent<CompileResult>) => {
      const { id } = e.data;
      const resolver = this.jobs.get(id);
      if (resolver) {
        resolver(e.data);
        this.jobs.delete(id);
      }
    };
  }

  /**
   * Compiles a raw TikZ string.
   * @param tikzSource The complete LaTeX source or fragment.
   */
  compile(tikzSource: string): Promise<CompileResult> {
    const id = crypto.randomUUID();
    
    return new Promise((resolve) => {
      this.jobs.set(id, resolve);
      const job: CompileJob = { id, source: tikzSource };
      this.worker.postMessage(job);
    });
  }

  /**
   * Terminates the underlying worker.
   */
  terminate() {
    this.worker.terminate();
  }
}