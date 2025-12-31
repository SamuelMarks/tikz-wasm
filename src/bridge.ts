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
   * @param wasmBinary The raw Uint8Array of the .wasm file.
   */
  async init(factory: EmscriptenModuleFactory, wasmBinary?: Uint8Array): Promise<void> {
    // SwiftLaTeX/Emscripten usually takes 'wasmBinary' in the config object
    // to bypass automatic HXR fetching.
    this.module = await factory({
      print: (msg: string) => this.logs.push(msg),
      printErr: (msg: string) => this.logs.push(`ERR: ${msg}`),
      ...(wasmBinary ? { wasmBinary } : {})
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

    try {
      // SwiftLaTeX acts as a PDFTeX engine.
      // We pass specific flags to ensure we don't drop to shell or interaction mode.
      const exitCode = this.module!.callMain([
        '-interaction=nonstopmode',
        '-halt-on-error',
        inputFilename
      ]);
      return exitCode === 0;
    } catch (e) {
      // Emscripten treats exit(1) as an exception in some configurations
      if (e instanceof Error && e.message.includes('status: 1')) {
        return false;
      }
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
      return this.module!.FS.readFile(filename, { encoding: undefined });
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

  getFS() {
    this.ensureInitialized();
    return this.module!.FS;
  }

  private ensureInitialized(): void {
    if (!this.module) {
      throw new Error('TeXBridge not initialized. Call init() first.');
    }
  }
}