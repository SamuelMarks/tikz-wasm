/**
 * Unit tests for `src/index.ts` ({@link initTikz}).
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockUnpack } = vi.hoisted(() => ({
  mockUnpack: vi.fn(),
}));

vi.mock('../src/runtime.js', () => ({
  unpackAsset: mockUnpack,
}));

vi.mock('../src/assets/tex.wasm?inline', () => ({ default: 'MOCK_WASM_CONTENT' }));
vi.mock('../src/assets/tikz.fmt?inline', () => ({ default: 'MOCK_FMT_CONTENT' }));

interface TestGlobalState {
  TIKZ_WASM_BINARY?: Uint8Array;
  TIKZ_FMT_BINARY?: Uint8Array;
}

describe('Entrypoint: initTikz', () => {
  let initTikz: () => Promise<void>;
  const globalState = globalThis as unknown as TestGlobalState;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    mockUnpack.mockResolvedValue(new Uint8Array([1, 2, 3]));

    delete globalState.TIKZ_WASM_BINARY;
    delete globalState.TIKZ_FMT_BINARY;

    const mod = await import('../src/index.js');
    initTikz = mod.initTikz;
  });

  it('should unpack assets and assign to globals', async () => {
    await initTikz();

    expect(mockUnpack).toHaveBeenCalledTimes(2);
    expect(mockUnpack).toHaveBeenCalledWith('MOCK_WASM_CONTENT');
    expect(mockUnpack).toHaveBeenCalledWith('MOCK_FMT_CONTENT');

    expect(globalState.TIKZ_WASM_BINARY).toEqual(new Uint8Array([1, 2, 3]));
    expect(globalState.TIKZ_FMT_BINARY).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('should deduplicate simultaneous calls', async () => {
    const p1 = initTikz();
    const p2 = initTikz();

    expect(p1).toBe(p2);

    await Promise.all([p1, p2]);
    expect(mockUnpack).toHaveBeenCalledTimes(2);
  });

  it('should reset init state on failure and allow retry', async () => {
    mockUnpack.mockRejectedValueOnce(new Error('Fail'));
    await expect(initTikz()).rejects.toThrow('Fail');

    mockUnpack.mockResolvedValue(new Uint8Array([1]));

    await expect(initTikz()).resolves.toBeUndefined();
    expect(globalState.TIKZ_WASM_BINARY).toEqual(new Uint8Array([1]));
  });
});
