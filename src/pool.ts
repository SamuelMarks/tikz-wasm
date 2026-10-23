/**
 * Singleton pool managing the inlined Blob Web Worker instance of {@link TikzCompiler}.
 *
 * @packageDocumentation
 */

import { TikzCompiler } from './compiler.js';

declare const __TIKZ_WORKER_CODE__: string;

/**
 * Manages a singleton instance of {@link TikzCompiler} to avoid spawning redundant Web Workers.
 * Uses an inlined Blob URL strategy created from the bundled worker code.
 */
export class CompilerPool {
  /**
   * Singleton {@link TikzCompiler} instance.
   */
  private static instance: TikzCompiler | null = null;

  /**
   * Active Blob Object URL for the current worker instance, revoked on {@link CompilerPool.reset}.
   */
  private static workerUrl: string | null = null;

  /**
   * Deprecated configuration hook retained for backward compatibility.
   *
   * @deprecated Worker code is now bundled inline; external URLs are ignored.
   * @param _url - Ignored worker script URL.
   */
  static setWorkerUrl(_url: string): void {
    console.warn('TikZ-WASM: setWorkerUrl is deprecated. Worker is bundled inline.');
  }

  /**
   * Gets or creates the singleton {@link TikzCompiler} instance.
   *
   * @returns The active {@link TikzCompiler} singleton.
   * @throws Error if the Blob or Web Worker cannot be created.
   */
  static getInstance(): TikzCompiler {
    if (!this.instance) {
      try {
        const blob = new Blob([__TIKZ_WORKER_CODE__], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        this.workerUrl = url;
        this.instance = new TikzCompiler(url);
      } catch (e: unknown) {
        const reason = e instanceof Error ? e.message : String(e);
        throw new Error(`Could not spawn TikZ Worker: ${reason}`);
      }
    }
    return this.instance;
  }

  /**
   * Terminates the active compiler worker, revokes its Blob Object URL, and clears the singleton.
   */
  static reset(): void {
    if (this.instance) {
      this.instance.terminate();
      this.instance = null;
    }
    if (this.workerUrl && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(this.workerUrl);
      this.workerUrl = null;
    }
  }
}

/**
 * Retrieves or creates the singleton {@link TikzCompiler} instance.
 *
 * @returns The singleton {@link TikzCompiler}.
 */
export const getCompiler = (): TikzCompiler => CompilerPool.getInstance();

/**
 * Deprecated helper to configure the worker script URL.
 *
 * @param url - Ignored worker script URL.
 */
export const configureCompiler = (url: string): void => {
  CompilerPool.setWorkerUrl(url);
};

/**
 * Terminates and resets the singleton {@link TikzCompiler} instance.
 */
export const resetCompiler = (): void => {
  CompilerPool.reset();
};
