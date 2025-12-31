/**
 * --- Emscripten / Bridge Types ---
 */

export interface EmscriptenFS {
  writeFile(path: string, data: string | Uint8Array): void;
  readFile(path: string): Uint8Array;
  unlink(path: string): void;
  mkdir(path: string): void;
  stat(path: string): { mode: number };
  isDir(mode: number): boolean;
}

// Alias for VFS compatibility
export type IEmscriptenFS = EmscriptenFS;

export interface EmscriptenModule {
  FS: EmscriptenFS;
  callMain(args: string[]): number;
  print?: (msg: string) => void;
  printErr?: (msg: string) => void;
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
  h: number; // Horizontal position
  v: number; // Vertical position
  w: number; // Horizontal spacer
  x: number; // Horizontal spacer
  y: number; // Vertical spacer
  z: number; // Vertical spacer
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