import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Hoist the spy wrapper
const { mockUnpack } = vi.hoisted(() => ({
  mockUnpack: vi.fn()
}));

// 2. Mock downstream Runtime dependency
vi.mock('../src/runtime', () => ({
  unpackAsset: mockUnpack
}));

// 3. Mock the asset imports.
// Vitest will replace imports matching these strings with our factory result.
vi.mock('../src/assets/tex.wasm?inline', () => ({ default: 'MOCK_WASM_CONTENT' }));
vi.mock('../src/assets/tikz.fmt?inline', () => ({ default: 'MOCK_FMT_CONTENT' }));

describe('Entrypoint: initTikz', () => {
  let initTikz: () => Promise<void>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules(); // Force module re-evaluation to reset singleton variables

    // Setup success stub
    mockUnpack.mockResolvedValue(new Uint8Array([1, 2, 3]));

    // Clear globals
    delete (globalThis as any).TIKZ_WASM_BINARY;
    delete (globalThis as any).TIKZ_FMT_BINARY;

    // Import fresh module
    const mod = await import('../src/index.ts');
    initTikz = mod.initTikz;
  });

  it('should unpack assets and assign to globals', async () => {
    await initTikz();

    // Verify it called unpack with our mocked strings, not real Gzip data
    expect(mockUnpack).toHaveBeenCalledTimes(2);
    expect(mockUnpack).toHaveBeenCalledWith('MOCK_WASM_CONTENT');
    expect(mockUnpack).toHaveBeenCalledWith('MOCK_FMT_CONTENT');

    // Verify side effect
    expect((globalThis as any).TIKZ_WASM_BINARY).toBeDefined();
  });

  it('should deduplicate simultaneous calls', async () => {
    const p1 = initTikz();
    const p2 = initTikz();

    // Should be referentially equal (Singleton Promise)
    expect(p1).toBe(p2);

    await Promise.all([p1, p2]);
    
    // Logic inside should run once
    expect(mockUnpack).toHaveBeenCalledTimes(2);
  });

  it('should reset init state on failure', async () => {
    // 1. Force failure
    mockUnpack.mockRejectedValueOnce(new Error('Fail'));
    await expect(initTikz()).rejects.toThrow('Fail');

    // 2. Allow success
    mockUnpack.mockResolvedValue(new Uint8Array([1]));

    // 3. Retry
    await expect(initTikz()).resolves.toBeUndefined();
    expect((globalThis as any).TIKZ_WASM_BINARY).toBeDefined();
  });
});