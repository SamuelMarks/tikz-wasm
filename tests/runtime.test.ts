/**
 * Unit tests for `src/runtime.ts` ({@link unpackAsset}).
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { unpackAsset } from '../src/runtime.js';

const mockArrayBuffer = new ArrayBuffer(8);

class MockResponse {
  constructor(_stream: unknown) {}
  async arrayBuffer(): Promise<ArrayBuffer> {
    return mockArrayBuffer;
  }
}

const mockDecompressionStream = vi.fn();

const runtimeGlobals = globalThis as unknown as Record<string, unknown>;
const originalDS = runtimeGlobals['DecompressionStream'];
const originalResponse = runtimeGlobals['Response'];
const originalBlob = runtimeGlobals['Blob'];
const originalAtob = globalThis.atob;

describe('Runtime: unpackAsset', () => {
  beforeEach(() => {
    runtimeGlobals['DecompressionStream'] = mockDecompressionStream;
    runtimeGlobals['Response'] = MockResponse;

    runtimeGlobals['Blob'] = class {
      readonly parts: readonly unknown[];
      constructor(parts: readonly unknown[]) {
        this.parts = parts;
      }
      stream(): { pipeThrough: ReturnType<typeof vi.fn> } {
        return {
          pipeThrough: vi.fn().mockReturnValue('stream_stub'),
        };
      }
    };
    globalThis.atob = vi.fn((str: string) => str);
  });

  afterEach(() => {
    runtimeGlobals['DecompressionStream'] = originalDS;
    runtimeGlobals['Response'] = originalResponse;
    runtimeGlobals['Blob'] = originalBlob;
    globalThis.atob = originalAtob;
    vi.clearAllMocks();
  });

  it('should successfully decompress compatible assets', async () => {
    const input = 'base64_data';
    const result = await unpackAsset(input);

    expect(globalThis.atob).toHaveBeenCalledWith(input);
    expect(mockDecompressionStream).toHaveBeenCalledWith('gzip');
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.buffer).toBe(mockArrayBuffer);
  });

  it('should throw if DecompressionStream is missing', async () => {
    delete runtimeGlobals['DecompressionStream'];
    await expect(unpackAsset('data')).rejects.toThrow(
      /Browser does not support DecompressionStream/
    );
  });

  it('should correctly map binary string characters to Uint8Array bytes', async () => {
    let capturedBytes: Uint8Array | null = null;

    runtimeGlobals['Blob'] = class {
      constructor(parts: readonly unknown[]) {
        capturedBytes = parts[0] as Uint8Array;
      }
      stream(): { pipeThrough: () => void } {
        return { pipeThrough: (): void => {} };
      }
    };

    globalThis.atob = (s: string): string => s;

    await unpackAsset('ABC');

    expect(capturedBytes).toBeDefined();
    expect(capturedBytes?.[0]).toBe(65);
    expect(capturedBytes?.[1]).toBe(66);
    expect(capturedBytes?.[2]).toBe(67);
  });
});
