import type { EmscriptenModule, EmscriptenModuleFactory } from './types.js';

/**
 * TeXBridge orchestrates the interactions between JS memory and the 
 * Emscripten-compiled TeX WASM binary.
 */
export class TeXBridge {
  private module: EmscriptenModule | null = null;
  private logs: string[] = [];

  /**
   * Initializes the WASM module.
   * @param factory The factory function provided by the auto-generated Emscripten JS.
   */
  async init(factory: EmscriptenModuleFactory): Promise<void> {
    this.module = await factory({
      print: (msg: string) => this.logs.push(msg),
      printErr: (msg: string) => this.logs.push(`ERR: ${msg}`),
    });
  }

  /**
   * Writes a file to the Virtual File System (MEMFS).
   * @param filename name of the file (e.g., "texmf.cnf")
   * @param content content as string or binary buffer
   */
  writeFile(filename: string, content: string | Uint8Array): void {
    this.ensureInitialized();
    this.module!.FS.writeFile(filename, content);
  }

  /**
   * Runs the TeX engine through the callMain entry point.
   * @param inputFilename The file waiting in VFS to be processed
   * @returns Success boolean
   */
  runTeX(inputFilename: string): boolean {
    this.ensureInitialized();
    this.logs = []; // Reset logs for this run
    
    // Safety: wrap in try/catch as callMain might throw on fatal errors (exit)
    try {
      // In TeX, usually inputs are just passed as arguments
      const exitCode = this.module!.callMain([inputFilename]);
      return exitCode === 0;
    } catch (e) {
      this.logs.push(`CRITICAL: WASM Exception: ${e}`);
      return false;
    }
  }

  /**
   * Reads a file from the VFS.
   * @param filename file to read
   * @returns Uint8Array of the file content
   * @throws Error if file does not exist
   */
  readFile(filename: string): Uint8Array {
    this.ensureInitialized();
    try {
      return this.module!.FS.readFile(filename);
    } catch {
      throw new Error(`File ${filename} not found in VFS`);
    }
  }

  /**
   * Helper to retrieve logs.
   */
  getLogs(): string[] {
    return [...this.logs];
  }

  private ensureInitialized(): void {
    if (!this.module) {
      throw new Error('TeXBridge not initialized. Call init() first.');
    }
  }
}