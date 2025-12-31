import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CompilerPool, configureCompiler, getCompiler, resetCompiler } from '../src/pool';
import { TikzCompiler } from '../src/compiler';

// Define the global constant for testing
(globalThis as any).__TIKZ_WORKER_CODE__ = "console.log('Worker Started');";

// Mock URL.createObjectURL
const mockCreateObjectURL = vi.fn(() => "blob:http://localhost/mock-uuid");
(globalThis as any).URL.createObjectURL = mockCreateObjectURL;

// Mock Blob using a real class structure to be safe
class MockBlob {
  content: any[];
  options: any;
  constructor(content: any[], options: any) {
    this.content = content;
    this.options = options;
  }
}
(globalThis as any).Blob = MockBlob;

// --- FIX: Use standard function for constructor mock ---
vi.mock('../src/compiler', () => {
  return {
    TikzCompiler: vi.fn().mockImplementation(function () {
      return {
        terminate: vi.fn()
      };
    })
  };
});

describe('CompilerPool (Inline Worker)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCompiler();
  });

  afterEach(() => {
    resetCompiler();
  });

  it('should instantiate TikzCompiler with a Blob URL created from inline code', () => {
    const compiler = getCompiler();

    expect(compiler).toBeDefined();

    // Verify URL creation
    expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(MockBlob));
    const invalidBlob = mockCreateObjectURL.mock.calls[0][0] as MockBlob;
    expect(invalidBlob.content[0]).toBe((globalThis as any).__TIKZ_WORKER_CODE__);
    expect(invalidBlob.options).toEqual({ type: 'application/javascript' });

    // Verify Compiler Instantiation
    expect(TikzCompiler).toHaveBeenCalledWith("blob:http://localhost/mock-uuid");
  });

  it('should return the same instance on subsequent calls', () => {
    const c1 = getCompiler();
    const c2 = getCompiler();
    expect(c1).toBe(c2);
    expect(TikzCompiler).toHaveBeenCalledTimes(1);
  });

  it('should create new instance after reset', () => {
    const c1 = getCompiler();
    resetCompiler();
    const c2 = getCompiler();
    expect(c1).not.toBe(c2);
    expect(TikzCompiler).toHaveBeenCalledTimes(2);
  });

  it('should warn when setWorkerUrl is called (deprecated)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    configureCompiler('external.js');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('deprecated'));
    warnSpy.mockRestore();
  });

  it('should throw error if Blob creation fails', () => {
    // Sabotage Blob
    const originalBlob = (globalThis as any).Blob;
    (globalThis as any).Blob = function() { throw new Error("Blob Error"); };

    expect(() => getCompiler()).toThrow(/Could not spawn TikZ Worker/);

    (globalThis as any).Blob = originalBlob;
  });
});