/**
 * Unit tests for {@link TeXBridge}.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TeXBridge } from '../src/bridge.js';
import { TikzInitializationError } from '../src/errors.js';
import type { EmscriptenFS, EmscriptenModule, EmscriptenModuleFactory } from '../src/types.js';

describe('TeXBridge', () => {
  let bridge: TeXBridge;
  let mockFS: EmscriptenFS;
  let mockModule: EmscriptenModule;
  let mockFactory: EmscriptenModuleFactory;

  beforeEach(() => {
    bridge = new TeXBridge();
    mockFS = {
      writeFile: vi.fn(),
      readFile: vi.fn(() => new Uint8Array([1, 2, 3])) as unknown as EmscriptenFS['readFile'],
      unlink: vi.fn(),
      mkdir: vi.fn(),
      stat: vi.fn(() => ({ mode: 0, size: 0 })),
      isDir: vi.fn(() => false),
      mount: vi.fn(),
    };

    mockModule = {
      FS: mockFS,
      callMain: vi.fn(() => 0),
      print: vi.fn(),
      printErr: vi.fn(),
    };

    mockFactory = vi.fn(async (overrides?: Partial<EmscriptenModule>): Promise<EmscriptenModule> => {
      if (overrides?.print) overrides.print('Init Log');
      if (overrides?.printErr) overrides.printErr('Init Warning');
      return mockModule;
    });
  });

  it('should initialize and capture stdout and stderr hooks', async () => {
    const wasmBytes = new Uint8Array([0x00, 0x61, 0x73, 0x6d]);
    await bridge.init(mockFactory, wasmBytes);

    expect(mockFactory).toHaveBeenCalledWith(
      expect.objectContaining({ wasmBinary: wasmBytes })
    );
    expect(bridge.getLogs()).toEqual(['Init Log', 'ERR: Init Warning']);
    expect(bridge.getFS()).toBe(mockFS);
  });

  it('should throw TikzInitializationError if operations are performed before init', () => {
    expect(() => bridge.writeFile('test.tex', 'content')).toThrow(TikzInitializationError);
    expect(() => bridge.runTeX('test.tex')).toThrow(/not initialized/);
    expect(() => bridge.readFile('test.dvi')).toThrow(/not initialized/);
    expect(() => bridge.getFS()).toThrow(/not initialized/);
  });

  it('should write files to VFS', async () => {
    await bridge.init(mockFactory);
    bridge.writeFile('input.tex', 'hello');
    expect(mockFS.writeFile).toHaveBeenCalledWith('input.tex', 'hello');
  });

  it('should run TeX and capture success with non-interactive flags', async () => {
    await bridge.init(mockFactory);
    const success = bridge.runTeX('input.tex');

    expect(mockModule.callMain).toHaveBeenCalledWith([
      '-interaction=nonstopmode',
      '-halt-on-error',
      'input.tex',
    ]);
    expect(success).toBe(true);
  });

  it('should return false when callMain returns non-zero exit code', async () => {
    mockModule.callMain = vi.fn(() => 1);
    await bridge.init(mockFactory);
    expect(bridge.runTeX('fail.tex')).toBe(false);
  });

  it('should return false cleanly when Emscripten throws status: 1 exit exception', async () => {
    mockModule.callMain = vi.fn(() => {
      throw new Error('Program terminated with exit(1), status: 1');
    });
    await bridge.init(mockFactory);
    const success = bridge.runTeX('exit1.tex');
    expect(success).toBe(false);
    expect(bridge.getLogs()).toEqual([]);
  });

  it('should catch critical WASM Error exceptions and append to logs', async () => {
    mockModule.callMain = vi.fn(() => {
      throw new Error('Segfault');
    });
    await bridge.init(mockFactory);
    const success = bridge.runTeX('crash.tex');
    expect(success).toBe(false);
    expect(bridge.getLogs()).toContain('CRITICAL: WASM Exception: Segfault');
  });

  it('should catch critical non-Error exceptions and append stringified form to logs', async () => {
    mockModule.callMain = vi.fn(() => {
      throw 'Raw Trap';
    });
    await bridge.init(mockFactory);
    const success = bridge.runTeX('trap.tex');
    expect(success).toBe(false);
    expect(bridge.getLogs()).toContain('CRITICAL: WASM Exception: Raw Trap');
  });

  it('should read binary files from VFS', async () => {
    await bridge.init(mockFactory);
    const fakeData = new Uint8Array([1, 2, 3]);
    mockFS.readFile = vi.fn(() => fakeData) as unknown as EmscriptenFS['readFile'];

    const result = bridge.readFile('out.dvi');
    expect(result).toBe(fakeData);
  });

  it('should throw descriptive Error if reading a missing file from VFS', async () => {
    await bridge.init(mockFactory);
    mockFS.readFile = vi.fn(() => {
      throw new Error('ENOENT');
    }) as unknown as EmscriptenFS['readFile'];
    expect(() => bridge.readFile('missing.dvi')).toThrow('File missing.dvi not found in VFS');
  });
});
