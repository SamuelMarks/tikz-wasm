/**
 * Unit tests for {@link CompilerPool}.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureCompiler, getCompiler, resetCompiler } from '../src/pool.js';
import { TikzCompiler } from '../src/compiler.js';

const testGlobals = globalThis as unknown as Record<string, unknown>;
testGlobals['__TIKZ_WORKER_CODE__'] = "console.log('Worker Started');";

const mockCreateObjectURL = vi.fn(() => 'blob:http://localhost/mock-uuid');
const mockRevokeObjectURL = vi.fn();
URL.createObjectURL = mockCreateObjectURL;
URL.revokeObjectURL = mockRevokeObjectURL;

class MockBlob {
  readonly content: readonly unknown[];
  readonly options: BlobPropertyBag | undefined;
  constructor(content: readonly unknown[], options?: BlobPropertyBag) {
    this.content = content;
    this.options = options;
  }
}
testGlobals['Blob'] = MockBlob;

vi.mock('../src/compiler.js', () => ({
  TikzCompiler: vi.fn().mockImplementation(function () {
    return {
      terminate: vi.fn(),
    };
  }),
}));

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
    expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(MockBlob));
    const createdBlob = (mockCreateObjectURL.mock.calls[0] as unknown[])?.[0] as MockBlob;
    expect(createdBlob.content[0]).toBe(testGlobals['__TIKZ_WORKER_CODE__']);
    expect(createdBlob.options).toEqual({ type: 'application/javascript' });
    expect(TikzCompiler).toHaveBeenCalledWith('blob:http://localhost/mock-uuid');
  });

  it('should return the same singleton instance on subsequent calls', () => {
    const c1 = getCompiler();
    const c2 = getCompiler();
    expect(c1).toBe(c2);
    expect(TikzCompiler).toHaveBeenCalledTimes(1);
  });

  it('should terminate instance and revoke Blob URL on reset', () => {
    const c1 = getCompiler();
    resetCompiler();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/mock-uuid');

    const c2 = getCompiler();
    expect(c1).not.toBe(c2);
    expect(TikzCompiler).toHaveBeenCalledTimes(2);
  });

  it('should warn when configureCompiler / setWorkerUrl is called (deprecated)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    configureCompiler('external.js');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('deprecated'));
    warnSpy.mockRestore();
  });

  it('should throw descriptive Error if Blob creation fails with Error or non-Error', () => {
    const originalBlob = testGlobals['Blob'];
    testGlobals['Blob'] = function () {
      throw new Error('Blob Error');
    };
    expect(() => getCompiler()).toThrow('Could not spawn TikZ Worker: Blob Error');

    testGlobals['Blob'] = function () {
      throw 'Raw Blob Failure';
    };
    expect(() => getCompiler()).toThrow('Could not spawn TikZ Worker: Raw Blob Failure');

    testGlobals['Blob'] = originalBlob;
  });
});
