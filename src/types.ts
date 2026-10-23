/**
 * Core type definitions for the Emscripten bridge, Virtual File System,
 * Worker message protocol, DVI parser state machine, and public SDK.
 *
 * @packageDocumentation
 */

/**
 * Options for reading or writing files in {@link EmscriptenFS}.
 */
export interface EmscriptenFileOptions {
  /**
   * Optional character encoding (`'utf8'` or `'binary'`).
   */
  encoding?: string | undefined;

  /**
   * Optional POSIX file open flags (e.g., `'r'`, `'w'`).
   */
  flags?: string | undefined;
}

/**
 * Options for reading a UTF-8 string file in {@link EmscriptenFS}.
 */
export interface EmscriptenUtf8ReadOptions {
  /**
   * UTF-8 string encoding selector.
   */
  encoding: 'utf8';
}

/**
 * File metadata returned by {@link EmscriptenFS.stat}.
 */
export interface EmscriptenStat {
  /**
   * POSIX mode bitmask.
   */
  mode: number;

  /**
   * File size in bytes.
   */
  size: number;
}

/**
 * Interface representing the Emscripten Virtual File System (`Module.FS`).
 */
export interface EmscriptenFS {
  /**
   * Writes string or binary content to a virtual file path.
   *
   * @param path - Target path in the virtual file system.
   * @param data - Content to write.
   * @param opts - Optional write flags and encoding.
   */
  writeFile(path: string, data: string | Uint8Array, opts?: EmscriptenFileOptions): void;

  /**
   * Reads a file from the virtual file system as a UTF-8 string.
   *
   * @param path - Target path in the virtual file system.
   * @param opts - Encoding option specifying `'utf8'`.
   * @returns Decoded UTF-8 string content.
   */
  readFile(path: string, opts: EmscriptenUtf8ReadOptions): string;

  /**
   * Reads a file from the virtual file system as raw binary bytes.
   *
   * @param path - Target path in the virtual file system.
   * @param opts - Optional read flags and encoding.
   * @returns Binary content as a `Uint8Array`.
   */
  readFile(path: string, opts?: EmscriptenFileOptions): Uint8Array;

  /**
   * Removes a file from the virtual file system.
   *
   * @param path - Target path to unlink.
   */
  unlink(path: string): void;

  /**
   * Creates a directory in the virtual file system.
   *
   * @param path - Directory path to create.
   */
  mkdir(path: string): void;

  /**
   * Retrieves file status metadata for a virtual path.
   *
   * @param path - Path to inspect.
   * @returns Mode bitmask and byte size of the entry.
   */
  stat(path: string): EmscriptenStat;

  /**
   * Checks whether a `stat.mode` value represents a directory.
   *
   * @param mode - Mode bitmask from {@link EmscriptenFS.stat}.
   * @returns `true` if the mode represents a directory.
   */
  isDir(mode: number): boolean;

  /**
   * Mounts a filesystem driver at a target mountpoint.
   *
   * @param type - Emscripten filesystem type descriptor.
   * @param opts - Mount options specific to the filesystem driver.
   * @param mountpoint - Target virtual directory path.
   */
  mount(type: unknown, opts: Record<string, unknown>, mountpoint: string): void;
}

/**
 * Alias for {@link EmscriptenFS} retained for VFS manager compatibility.
 */
export type IEmscriptenFS = EmscriptenFS;

/**
 * Represents an instantiated Emscripten WebAssembly module for the TeX engine.
 */
export interface EmscriptenModule {
  /**
   * Virtual File System attached to the Emscripten runtime.
   */
  FS: EmscriptenFS;

  /**
   * Invokes the compiled C `main(argc, argv)` entrypoint.
   *
   * @param args - Command-line arguments passed to the TeX engine.
   * @returns Process exit code (`0` indicates success).
   */
  callMain(args: string[]): number;

  /**
   * Standard output hook invoked by Emscripten when TeX prints a line.
   *
   * @param msg - Printed output line.
   */
  print?: (msg: string) => void;

  /**
   * Standard error hook invoked by Emscripten when TeX prints an error line.
   *
   * @param msg - Printed error line.
   */
  printErr?: (msg: string) => void;

  /**
   * Raw WebAssembly linear memory view.
   */
  HEAPU8?: Uint8Array;

  /**
   * Optional pre-loaded WebAssembly binary passed during instantiation.
   */
  wasmBinary?: Uint8Array;
}

/**
 * Factory function signature produced by patched Emscripten glue code.
 *
 * @param overrides - Partial module configuration and hooks.
 * @returns A promise resolving to the initialized {@link EmscriptenModule}.
 */
export type EmscriptenModuleFactory = (overrides?: Partial<EmscriptenModule>) => Promise<EmscriptenModule>;

/**
 * Represents a compilation job sent from the main thread to the TikZ Web Worker.
 */
export interface CompileJob {
  /**
   * Unique identifier correlating the job request with its {@link CompileResult}.
   */
  id: string;

  /**
   * Complete LaTeX source document to compile.
   */
  source: string;

  /**
   * Optional unpacked WebAssembly binary to hydrate the worker on first run.
   */
  wasmBinary?: Uint8Array;

  /**
   * Optional unpacked `.fmt` memory dump binary to hydrate the worker on first run.
   */
  fmtBinary?: Uint8Array;
}

/**
 * Represents the result of a compilation job returned by the TikZ Web Worker.
 */
export interface CompileResult {
  /**
   * Unique job identifier matching {@link CompileJob.id}.
   */
  id: string;

  /**
   * Whether the TeX compilation succeeded and produced a valid DVI buffer.
   */
  success: boolean;

  /**
   * Raw DVI binary output produced when `success` is `true`.
   */
  dvi?: Uint8Array;

  /**
   * Console and log lines emitted by the TeX engine during execution.
   */
  logs: string[];

  /**
   * Error message when an unhandled worker or initialization failure occurred.
   */
  error?: string;
}

/**
 * Describes a file asset to be mounted into the Emscripten Virtual File System.
 */
export interface VirtualAsset {
  /**
   * Destination path inside the virtual file system (e.g., `/texmf/fonts/cmr10.tfm`).
   */
  path: string;

  /**
   * Raw binary content, literal string content, or remote URL (`http...` / `/...`) to fetch.
   */
  source: string | Uint8Array;
}

/**
 * Metadata for a TeX font defined via a DVI `fnt_def` opcode (`243..246`).
 */
export interface DviFont {
  /**
   * Checksum of the TFM file verified by TeX.
   */
  checksum: number;

  /**
   * Fixed-point scale factor in scaled points (`sp`).
   */
  scale: number;

  /**
   * Fixed-point design size in scaled points (`sp`).
   */
  designSize: number;

  /**
   * Length of the font directory/area prefix.
   */
  area: number;

  /**
   * Font filename (e.g., `'cmr10'`).
   */
  name: string;
}

/**
 * Registers of the DVI virtual typesetting machine at a point in execution.
 */
export interface MachineState {
  /**
   * Current horizontal coordinate in scaled points (`sp`).
   */
  h: number;

  /**
   * Current vertical coordinate in scaled points (`sp`).
   */
  v: number;

  /**
   * Horizontal spacing register `w` in scaled points (`sp`).
   */
  w: number;

  /**
   * Horizontal spacing register `x` in scaled points (`sp`).
   */
  x: number;

  /**
   * Vertical spacing register `y` in scaled points (`sp`).
   */
  y: number;

  /**
   * Vertical spacing register `z` in scaled points (`sp`).
   */
  z: number;

  /**
   * Currently selected DVI font identifier (`f`).
   */
  fontId: number;
}

/**
 * Configuration options for the offline `.fmt` format generator.
 */
export interface GeneratorConfig {
  /**
   * Optional custom path to the `tex.wasm` binary.
   */
  wasmPath?: string;

  /**
   * Root path to the local TeX Live `texmf-dist` directory.
   */
  texDir: string;
}

/**
 * Options controlling SVG rendering in {@link renderTikzAsSvg}.
 */
export interface RenderOptions {
  /**
   * When `true`, logs diagnostic compilation details via `debugLogger`.
   */
  debug?: boolean;

  /**
   * Optional Base64-encoded WOFF2 font data to embed inside the SVG `<style>` block.
   */
  fontBase64Woff2?: string;

  /**
   * Optional logger callback invoked when `debug` is `true`.
   *
   * @param message - Diagnostic log message.
   */
  debugLogger?: (message: string) => void;
}
