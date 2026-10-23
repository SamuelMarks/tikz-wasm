/**
 * Unit tests for `scripts/setup.ts`.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';

const {
  mockWriteFileSync,
  mockUnlinkSync,
  mockMkdirSync,
  mockExistsSync,
  mockReadFileSync,
  mockCopyFileSync,
} = vi.hoisted(() => ({
  mockWriteFileSync: vi.fn(),
  mockUnlinkSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockExistsSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockCopyFileSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  default: {
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync,
    writeFileSync: mockWriteFileSync,
    readFileSync: mockReadFileSync,
    unlinkSync: mockUnlinkSync,
    copyFileSync: mockCopyFileSync,
  },
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  writeFileSync: mockWriteFileSync,
  readFileSync: mockReadFileSync,
  unlinkSync: mockUnlinkSync,
  copyFileSync: mockCopyFileSync,
}));

import * as setup from '../scripts/setup.js';

describe('Scripts: setup.ts', () => {
  const OriginalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as unknown as (code?: string | number | null) => never);
  });

  afterEach(() => {
    globalThis.fetch = OriginalFetch;
    vi.restoreAllMocks();
  });

  describe('ensureDirectory', () => {
    it('should create directory if it does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      setup.ensureDirectory('/test/dir');
      expect(mockMkdirSync).toHaveBeenCalledWith('/test/dir', { recursive: true });
    });

    it('should do nothing if directory already exists', () => {
      mockExistsSync.mockReturnValue(true);
      setup.ensureDirectory('/test/dir');
      expect(mockMkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('downloadFile', () => {
    it('should fetch and write file to disk', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
        statusText: 'OK',
        status: 200,
      } as unknown as Response);

      await setup.downloadFile('http://example.com/file', '/local/file');

      expect(globalThis.fetch).toHaveBeenCalledWith('http://example.com/file');
      expect(mockWriteFileSync).toHaveBeenCalledWith('/local/file', expect.any(Buffer));
    });

    it('should throw on non-ok HTTP response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        status: 404,
      } as unknown as Response);

      await expect(setup.downloadFile('http://bad.url', '/local/bad')).rejects.toThrow(
        'Failed to fetch http://bad.url: Not Found (404)'
      );
    });
  });

  describe('copyLocal', () => {
    it('should copy pdftex.wasm and PdfTeXEngine.js when both exist', async () => {
      mockExistsSync.mockReturnValue(true);
      await setup.copyLocal('/local/build', '/dest/assets');

      expect(mockCopyFileSync).toHaveBeenCalledWith(
        path.join('/local/build', 'pdftex.wasm'),
        path.join('/dest/assets', setup.CONFIG.wasmPath)
      );
      expect(mockCopyFileSync).toHaveBeenCalledWith(
        path.join('/local/build', 'PdfTeXEngine.js'),
        path.join('/dest/assets', 'temp_glue.js')
      );
    });

    it('should throw if pdftex.wasm is missing', async () => {
      mockExistsSync.mockReturnValueOnce(false);
      await expect(setup.copyLocal('/local/build', '/dest/assets')).rejects.toThrow(
        /Local build missing WASM at:/
      );
    });

    it('should throw if PdfTeXEngine.js is missing', async () => {
      mockExistsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);
      await expect(setup.copyLocal('/local/build', '/dest/assets')).rejects.toThrow(
        /Local build missing JS Glue at:/
      );
    });
  });

  describe('patchGlueCode', () => {
    it('should wrap Emscripten glue code in TikZModuleFactory Promise', () => {
      const raw = 'var Module=typeof Module!="undefined"?Module:{}; const f = require("fs");';
      const output = setup.patchGlueCode(raw);

      expect(output).toContain('export default function TikZModuleFactory');
      expect(output).toContain('return new Promise');
      expect(output).toContain('var Module = moduleOverrides || {};');
      expect(output).toContain('const f = {};');
    });
  });

  describe('main', () => {
    it('should execute remote download workflow and patch glue when temp_glue.js exists', async () => {
      mockExistsSync.mockReturnValue(true);
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(10),
      } as unknown as Response);
      mockReadFileSync.mockReturnValue('var Glue = true;');

      await setup.main([]);

      expect(globalThis.fetch).toHaveBeenCalledWith(setup.ASSET_URLS.wasm);
      expect(globalThis.fetch).toHaveBeenCalledWith(setup.ASSET_URLS.glue);
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        path.join(setup.CONFIG.assetsDir, 'tex_glue.js'),
        expect.stringContaining('export default function TikZModuleFactory')
      );
      expect(mockUnlinkSync).toHaveBeenCalled();
    });

    it('should execute --local workflow and skip patching if temp_glue.js does not exist', async () => {
      const originalWasmUrl = setup.ASSET_URLS.wasm;
      setup.ASSET_URLS.wasm = 'https://custom.domain/pdftex.wasm';

      // ensureDirectory(true), copyLocal wasm(true), copyLocal glue(true), tempGlue exists(false)
      mockExistsSync
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      await setup.main(['--local', '/custom/build']);

      expect(mockCopyFileSync).toHaveBeenCalledTimes(2);
      expect(mockUnlinkSync).not.toHaveBeenCalled();

      setup.ASSET_URLS.wasm = originalWasmUrl;
    });

    it('should skip placeholder warning when ASSET_URLS.wasm is customized', async () => {
      const originalWasmUrl = setup.ASSET_URLS.wasm;
      setup.ASSET_URLS.wasm = 'https://custom.domain/pdftex.wasm';
      mockExistsSync.mockReturnValue(true);
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(4),
      } as unknown as Response);
      mockReadFileSync.mockReturnValue('var Glue = true;');

      await setup.main([]);
      expect(console.warn).not.toHaveBeenCalled();

      setup.ASSET_URLS.wasm = originalWasmUrl;
    });

    it('should fail and exit 1 when --local is passed without a path argument', async () => {
      mockExistsSync.mockReturnValue(true);
      await setup.main(['--local']);

      expect(console.error).toHaveBeenCalledWith('Setup failed:', 'Missing path argument for --local');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle non-Error thrown values in main catch block', async () => {
      mockExistsSync.mockImplementation(() => {
        throw 'String failure';
      });

      await setup.main([]);
      expect(console.error).toHaveBeenCalledWith('Setup failed:', 'String failure');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
