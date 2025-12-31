import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inlineCompressedAssets } from '../build/asset-plugin';
import zlib from 'node:zlib';

// 1. Hoist FS mocks to ensure they are available for the factory
const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn()
}));

// 2. Mock 'node:fs' ensuring compatibility with different import styles
vi.mock('node:fs', async () => {
  return {
    default: {
      existsSync: fsMocks.existsSync,
      readFileSync: fsMocks.readFileSync
    },
    existsSync: fsMocks.existsSync,
    readFileSync: fsMocks.readFileSync
  };
});

describe('Build Plugin: inlineCompressedAssets', () => {
  const plugin = inlineCompressedAssets();
  const testContent = Buffer.from('Hello World Binary Data');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should ignore non-inline files', async () => {
    // @ts-ignore - Validating plugin hook signature
    const result = await plugin.load('some-file.js');
    expect(result).toBeNull();
  });

  it('should process .wasm?inline files', async () => {
    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockReturnValue(testContent);

    // @ts-ignore
    const result = await plugin.load('test.wasm?inline');
    
    expect(result).toBeDefined();
    expect(result).toContain('export default "');
    
    // Validate compression
    const match = result.match(/"(.*)";/);
    const base64 = match![1];
    const buffer = Buffer.from(base64, 'base64');
    const unzipped = zlib.gunzipSync(buffer);
    
    expect(unzipped.toString()).toBe(testContent.toString());
  });

  it('should throw if file does not exist', async () => {
    fsMocks.existsSync.mockReturnValue(false); // Simulate missing

    await expect(async () => {
      // @ts-ignore
      await plugin.load('missing.fmt?inline');
    }).rejects.toThrow(/Asset not found/);
  });
});