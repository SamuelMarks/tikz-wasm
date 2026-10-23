/**
 * Unit tests for `build/asset-plugin.ts` ({@link inlineCompressedAssets}).
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inlineCompressedAssets } from '../build/asset-plugin.js';
import zlib from 'node:zlib';
import path from 'node:path';

const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  default: {
    existsSync: fsMocks.existsSync,
    readFileSync: fsMocks.readFileSync,
  },
  existsSync: fsMocks.existsSync,
  readFileSync: fsMocks.readFileSync,
}));

describe('Build Plugin: inlineCompressedAssets', () => {
  const testContent = Buffer.from('Hello World Binary Data');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should resolve relative and non-relative .wasm?inline, .fmt?inline, and .woff2?inline IDs', () => {
    const plugin = inlineCompressedAssets();
    const resolveId = plugin.resolveId as (id: string, importer?: string) => string | null;

    expect(resolveId('some-file.js')).toBeNull();
    expect(resolveId('some-file.txt?inline')).toBeNull();
    expect(resolveId('tex.wasm?inline')).toBe('tex.wasm?inline');

    const resolvedRelative = resolveId('./assets/tex.wasm?inline', '/repo/src/index.ts');
    expect(resolvedRelative).toBe(`${path.resolve('/repo/src', './assets/tex.wasm')}?inline`);

    const resolvedFmt = resolveId('/abs/tikz.fmt?inline', '/repo/src/index.ts');
    expect(resolvedFmt).toBe(`${path.resolve('/repo/src', '/abs/tikz.fmt')}?inline`);
  });

  it('should ignore non-inline or non-binary files in load()', () => {
    const plugin = inlineCompressedAssets();
    const load = plugin.load as (id: string) => string | null;

    expect(load('some-file.js')).toBeNull();
    expect(load('styles.css?inline')).toBeNull();
  });

  it('should process .wasm?inline files and log when verbose is enabled', () => {
    const logs: string[] = [];
    const plugin = inlineCompressedAssets({
      verbose: true,
      logger: (msg: string): void => {
        logs.push(msg);
      },
    });
    const load = plugin.load as (id: string) => string | null;

    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockReturnValue(testContent);

    const result = load('test.wasm?inline');
    expect(result).toBeDefined();
    expect(result).toContain('export default "');

    const match = /"(.*)";/.exec(result ?? '');
    const base64 = match?.[1] ?? '';
    const buffer = Buffer.from(base64, 'base64');
    const unzipped = zlib.gunzipSync(buffer);

    expect(unzipped.toString()).toBe(testContent.toString());
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain('[inline-assets] Compressed test.wasm:');
  });

  it('should use default console.log logger when verbose is true and no custom logger is provided', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const plugin = inlineCompressedAssets({ verbose: true });
    const load = plugin.load as (id: string) => string | null;

    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockReturnValue(testContent);

    load('font.woff2?inline');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Compressed font.woff2'));
    consoleSpy.mockRestore();
  });

  it('should throw if asset file does not exist', () => {
    const plugin = inlineCompressedAssets();
    const load = plugin.load as (id: string) => string | null;
    fsMocks.existsSync.mockReturnValue(false);

    expect(() => load('missing.fmt?inline')).toThrow('Asset not found: missing.fmt');
  });

  it('should process .fmt?inline silently when verbose is false (default)', () => {
    const logs: string[] = [];
    const plugin = inlineCompressedAssets({
      verbose: false,
      logger: (msg: string): void => {
        logs.push(msg);
      },
    });
    const load = plugin.load as (id: string) => string | null;

    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockReturnValue(testContent);

    const result = load('tikz.fmt?inline');
    expect(result).toContain('export default "');
    expect(logs).toEqual([]);
  });
});
