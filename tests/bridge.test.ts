import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TeXBridge } from '../src/bridge';
import type { EmscriptenModule, EmscriptenModuleFactory } from '../src/types';

describe('TeXBridge', () => {
  let bridge: TeXBridge;
  
  // Mock FS
  const mockFS = {
    writeFile: vi.fn(),
    readFile: vi.fn(),
    unlink: vi.fn()
  };

  // Mock Module
  const mockModule: EmscriptenModule = {
    FS: mockFS,
    callMain: vi.fn(() => 0), // Default success
    print: vi.fn(),
    printErr: vi.fn()
  };

  // Mock Factory
  const mockFactory: EmscriptenModuleFactory = vi.fn(async (overrides) => {
    if (overrides?.print) overrides.print("Init Log");
    return mockModule;
  });

  beforeEach(() => {
    bridge = new TeXBridge();
    vi.clearAllMocks();
  });

  it('should initialize correctly', async () => {
    await bridge.init(mockFactory);
    // @ts-ignore - access private for testing or rely on side effects
    expect(bridge['logs']).toContain("Init Log");
    expect(mockFactory).toHaveBeenCalled();
  });

  it('should throw if operations performed before init', () => {
    expect(() => bridge.writeFile('test.tex', 'content')).toThrow(/not initialized/);
  });

  it('should write files to VFS', async () => {
    await bridge.init(mockFactory);
    bridge.writeFile('input.tex', 'hello');
    expect(mockFS.writeFile).toHaveBeenCalledWith('input.tex', 'hello');
  });

  it('should run TeX and capture success', async () => {
    await bridge.init(mockFactory);
    const success = bridge.runTeX('input.tex');
    expect(mockModule.callMain).toHaveBeenCalledWith(['input.tex']);
    expect(success).toBe(true);
  });

  it('should handle TeX errors (non-zero exit)', async () => {
    mockModule.callMain = vi.fn(() => 1); // Error code
    await bridge.init(mockFactory);
    const success = bridge.runTeX('fail.tex');
    expect(success).toBe(false);
  });

  it('should catch critical WASM crashes', async () => {
    mockModule.callMain = vi.fn(() => { throw new Error("Segfault"); });
    await bridge.init(mockFactory);
    const success = bridge.runTeX('crash.tex');
    expect(success).toBe(false);
    expect(bridge.getLogs().some(l => l.includes("Segfault"))).toBe(true);
  });

  it('should read files from VFS', async () => {
    await bridge.init(mockFactory);
    const fakeData = new Uint8Array([1, 2, 3]);
    mockFS.readFile = vi.fn(() => fakeData);
    
    const result = bridge.readFile('out.dvi');
    expect(result).toBe(fakeData);
  });

  it('should throw if reading missing file', async () => {
    await bridge.init(mockFactory);
    mockFS.readFile = vi.fn(() => { throw new Error(); });
    expect(() => bridge.readFile('missing')).toThrow(/not found/);
  });
});