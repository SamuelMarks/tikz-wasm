/**
 * --- Emscripten / Bridge Types ---
 */

export interface EmscriptenFS {
  writeFile(path: string, data: string | Uint8Array, opts?: { encoding?: string; flags?: string }): void;
  readFile(path: string, opts: { encoding: 'utf8' }): string;
  readFile(path: string, opts?: { encoding?: string; flags?: string }): Uint8Array;
  unlink(path: string): void;
  mkdir(path: string): void;
  stat(path: string): { mode: number; size: number };
  isDir(mode: number): boolean;
  mount(type: any, opts: any, mountpoint: string): void;
}

// Alias for VFS compatibility
export type IEmscriptenFS = EmscriptenFS;

export interface EmscriptenModule {
  FS: EmscriptenFS;
  // SwiftLaTeX specific: callMain usually maps to the underlying C main
  callMain(args: string[]): number;

  // Standard Emscripten hooks
  print?: (msg: string) => void;
  printErr?: (msg: string) => void;

  // Dynamic memory access (optional usage)
  HEAPU8?: Uint8Array;
}

export type EmscriptenModuleFactory = (overrides?: Partial<EmscriptenModule>) => Promise<EmscriptenModule>;

export interface CompileJob {
  id: string;
  source: string;
}

export interface CompileResult {
  id: string;
  success: boolean;
  dvi?: Uint8Array;
  logs: string[];
  error?: string;
}

/**
 * --- VFS Types ---
 */

export interface VirtualAsset {
  path: string;
  source: string | Uint8Array;
}

/**
 * --- DVI Parser Types ---
 */

export interface DviFont {
  checksum: number;
  scale: number;
  designSize: number;
  area: number;
  name: string;
}

export interface MachineState {
  h: number;
  v: number;
  w: number;
  x: number;
  y: number;
  z: number;
  fontId: number;
}

/**
 * --- Generator Types ---
 */
export interface GeneratorConfig {
  wasmPath?: string;
  texDir: string;
}

/**
 * --- SDK Types ---
 */
export interface RenderOptions {
  debug?: boolean;
}