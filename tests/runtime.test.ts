import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { unpackAsset } from '../src/runtime';

const mockArrayBuffer = new ArrayBuffer(8);

// --- FIX: Use a class for Response mock ---
class MockResponse {
  constructor(_stream: any) {}
  async arrayBuffer() {
    return mockArrayBuffer;
  }
}

const mockDecompressionStream = vi.fn();

const originalDS = globalThis.DecompressionStream;
const originalResponse = globalThis.Response;
const originalBlob = globalThis.Blob;
const originalAtob = globalThis.atob;

describe('Runtime: unpackAsset', () => {
  beforeEach(() => {
    globalThis.DecompressionStream = mockDecompressionStream as any;
    globalThis.Response = MockResponse as any; // Assign class directly

    globalThis.Blob = class {
      constructor(parts: any[]) {
        (this as any).parts = parts;
      }
      stream() {
        return {
          pipeThrough: vi.fn().mockReturnValue("stream_stub")
        };
      }
    } as any;
    globalThis.atob = vi.fn((str) => str);
  });

  afterEach(() => {
    globalThis.DecompressionStream = originalDS;
    globalThis.Response = originalResponse;
    globalThis.Blob = originalBlob;
    globalThis.atob = originalAtob;
    vi.clearAllMocks();
  });

  it('should successfully decompress compatible assets', async () => {
    const input = "base64_data";
    const result = await unpackAsset(input);

    expect(globalThis.atob).toHaveBeenCalledWith(input);
    expect(mockDecompressionStream).toHaveBeenCalledWith('gzip');
    // Response.arrayBuffer() logic is verified by the result check below
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.buffer).toBe(mockArrayBuffer);
  });

  it('should throw if DecompressionStream is missing', async () => {
    // @ts-ignore
    delete globalThis.DecompressionStream;
    await expect(unpackAsset("data"))
        .rejects.toThrow(/Browser does not support DecompressionStream/);
  });

  it('should correctly map binary string to Uint8Array', async () => {
    let capturedBytes: Uint8Array | null = null;

    globalThis.Blob = class {
      constructor(parts: any[]) {
        capturedBytes = parts[0] as Uint8Array;
      }
      stream() { return { pipeThrough: () => {} }; }
    } as any;

    globalThis.atob = (s) => s;

    await unpackAsset('ABC');

    expect(capturedBytes).toBeDefined();
    expect(capturedBytes![0]).toBe(65);
    expect(capturedBytes![1]).toBe(66);
    expect(capturedBytes![2]).toBe(67);
  });
});