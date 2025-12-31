import { TikzCompiler } from './compiler.js';

// Declaration for the injected define from vite.config.ts
declare const __TIKZ_WORKER_CODE__: string;

/** 
 * Manages a singleton instance of the Compiler. 
 * Prevents spawning multiple Workers for multiple render calls. 
 * 
 * Uses the Inlined Worker strategy: created from a Blob URL of the bundled source.
 */ 
export class CompilerPool { 
  private static instance: TikzCompiler | null = null; 

  /** 
   * @deprecated Configuration is no longer needed; worker is bundled inline.
   */ 
  static setWorkerUrl(_url: string) { 
    // No-op for backward compatibility or future overrides
    console.warn("TikZ-WASM: setWorkerUrl is deprecated. Worker is bundled inline.");
  } 

  /** 
   * Gets or creates the compiler instance. 
   * Creates a Blob URL from the injected worker string.
   */ 
  static getInstance(): TikzCompiler { 
    if (!this.instance) { 
      try { 
        // 1. Create a Blob from the inlined code
        const blob = new Blob([__TIKZ_WORKER_CODE__], { type: 'application/javascript' });
        
        // 2. Create an Object URL
        const workerUrl = URL.createObjectURL(blob);
        
        // 3. Instantiate
        this.instance = new TikzCompiler(workerUrl); 
        
        // Note: We deliberately do not revoke the URL immediately as the worker might restart 
        // or need debugging, though for strict memory management one could revoke after init.
      } catch (e) { 
        throw new Error(`Could not spawn TikZ Worker: ${e}`); 
      } 
    } 
    return this.instance; 
  } 

  /** 
   * Resets the instance (e.g. for testing or memory cleanup) 
   */ 
  static reset() { 
    if (this.instance) { 
      this.instance.terminate(); 
      this.instance = null; 
    } 
  } 
} 

export const getCompiler = CompilerPool.getInstance.bind(CompilerPool); 
export const configureCompiler = CompilerPool.setWorkerUrl.bind(CompilerPool); 
export const resetCompiler = CompilerPool.reset.bind(CompilerPool);