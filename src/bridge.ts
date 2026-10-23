/**
 * Emscripten WebAssembly bridge orchestrating interactions between JavaScript memory
 * and the compiled `pdftex` WebAssembly engine.
 *
 * @packageDocumentation
 */

import type { EmscriptenFS, EmscriptenModule, EmscriptenModuleFactory } from './types.js';
import { TikzInitializationError } from './errors.js';

/**
 * `TeXBridge` wraps the Emscripten-compiled TeX WebAssembly module, providing
 * strongly typed methods for VFS manipulation, engine invocation, and log capture.
 */
export class TeXBridge {
  /**
   * Active Emscripten module instance, or `null` prior to {@link TeXBridge.init}.
   */
  private module: EmscriptenModule | null = null;

  /**
   * Accumulated stdout and stderr log lines from the most recent operation.
   */
  private logs: string[] = [];

  /**
   * Initializes the WebAssembly module using the provided Emscripten factory.
   *
   * @param factory - The factory function produced by the patched Emscripten glue code.
   * @param wasmBinary - Optional raw `Uint8Array` of the `tex.wasm` binary.
   */
  async init(factory: EmscriptenModuleFactory, wasmBinary?: Uint8Array): Promise<void> {
    this.module = await factory({
      print: (msg: string): void => {
        this.logs.push(msg);
      },
      printErr: (msg: string): void => {
        this.logs.push(`ERR: ${msg}`);
      },
      ...(wasmBinary ? { wasmBinary } : {})
    });
  }

  /**
   * Writes a file to the Emscripten Virtual File System (`MEMFS`).
   *
   * @param filename - Path or filename inside the VFS (e.g., `"texmf.cnf"`).
   * @param content - File content as a UTF-8 string or `Uint8Array`.
   */
  writeFile(filename: string, content: string | Uint8Array): void {
    const mod = this.getModule();
    mod.FS.writeFile(filename, content);
  }

  /**
   * Runs the TeX engine via its `callMain` entrypoint in non-interactive mode.
   *
   * @param inputFilename - The `.tex` file waiting in the VFS to be processed.
   * @returns `true` if TeX exited with code `0`, `false` otherwise.
   */
  runTeX(inputFilename: string): boolean {
    const mod = this.getModule();
    this.logs = []; // Reset logs for this run

    try {
      const exitCode = mod.callMain([
        '-interaction=nonstopmode',
        '-halt-on-error',
        inputFilename
      ]);
      return exitCode === 0;
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('status: 1')) {
        return false;
      }
      const detail = e instanceof Error ? e.message : String(e);
      this.logs.push(`CRITICAL: WASM Exception: ${detail}`);
      return false;
    }
  }

  /**
   * Reads a binary file from the Emscripten Virtual File System.
   *
   * @param filename - Path to the file in the VFS.
   * @returns The binary file content as a `Uint8Array`.
   * @throws Error if the file does not exist in the VFS.
   */
  readFile(filename: string): Uint8Array {
    const mod = this.getModule();
    try {
      return mod.FS.readFile(filename, { encoding: undefined });
    } catch {
      throw new Error(`File ${filename} not found in VFS`);
    }
  }

  /**
   * Returns a shallow copy of the captured stdout/stderr log lines.
   *
   * @returns Array of captured log strings.
   */
  getLogs(): string[] {
    return [...this.logs];
  }

  /**
   * Returns the underlying Emscripten Virtual File System (`FS`) interface.
   *
   * @returns The initialized {@link EmscriptenFS} object.
   */
  getFS(): EmscriptenFS {
    return this.getModule().FS;
  }

  /**
   * Ensures the Emscripten module is initialized and returns it with narrowed type.
   *
   * @returns The initialized {@link EmscriptenModule}.
   * @throws {@link TikzInitializationError} if {@link TeXBridge.init} has not been called.
   */
  private getModule(): EmscriptenModule {
    if (!this.module) {
      throw new TikzInitializationError('TeXBridge not initialized. Call init() first.');
    }
    return this.module;
  }
}
