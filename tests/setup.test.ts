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

  describe('extractZipEntry & downloadFile', () => {
    /**
     * Builds a minimal synthetic ZIP archive buffer with a single entry.
     *
     * @param name - Entry filename inside the ZIP.
     * @param data - Compressed or uncompressed payload bytes.
     * @param method - Compression method (`0` = store, `8` = deflate, `99` = unsupported).
     * @returns Complete ZIP file buffer.
     */
    function buildMinimalZip(name: string, data: Buffer, method: number): Buffer {
      const nameBuf = Buffer.from(name, 'utf8');
      const localHeader = Buffer.alloc(30 + nameBuf.length);
      localHeader.writeUInt32LE(0x04034b50, 0);
      localHeader.writeUInt16LE(method, 8);
      localHeader.writeUInt32LE(data.length, 18);
      localHeader.writeUInt32LE(data.length, 22);
      localHeader.writeUInt16LE(nameBuf.length, 26);
      localHeader.writeUInt16LE(0, 28);
      nameBuf.copy(localHeader, 30);

      const cdHeader = Buffer.alloc(46 + nameBuf.length);
      cdHeader.writeUInt32LE(0x02014b50, 0);
      cdHeader.writeUInt16LE(method, 10);
      cdHeader.writeUInt32LE(data.length, 20);
      cdHeader.writeUInt32LE(data.length, 24);
      cdHeader.writeUInt16LE(nameBuf.length, 28);
      cdHeader.writeUInt16LE(0, 30);
      cdHeader.writeUInt16LE(0, 32);
      cdHeader.writeUInt32LE(0, 42);
      nameBuf.copy(cdHeader, 46);

      const cdOffset = localHeader.length + data.length;
      const eocd = Buffer.alloc(22);
      eocd.writeUInt32LE(0x06054b50, 0);
      eocd.writeUInt16LE(1, 8);
      eocd.writeUInt16LE(1, 10);
      eocd.writeUInt32LE(cdHeader.length, 12);
      eocd.writeUInt32LE(cdOffset, 16);

      return Buffer.concat([localHeader, data, cdHeader, eocd]);
    }

    it('should extract stored (method 0) and deflated (method 8) ZIP entries', async () => {
      const zlib = await import('node:zlib');
      const rawPayload = Buffer.from('hello-wasm-payload');
      const storedZip = buildMinimalZip('nested/swiftlatexpdftex.wasm', rawPayload, 0);
      expect(setup.extractZipEntry(storedZip, 'swiftlatexpdftex.wasm')).toEqual(rawPayload);

      const deflatedPayload = zlib.deflateRawSync(rawPayload);
      const deflatedZip = buildMinimalZip('swiftlatexpdftex.js', deflatedPayload, 8);
      expect(setup.extractZipEntry(deflatedZip, 'swiftlatexpdftex.js')).toEqual(rawPayload);
    });

    it('should throw on invalid ZIP, missing entry, or unsupported compression method', () => {
      expect(() => setup.extractZipEntry(Buffer.alloc(30), 'foo.wasm')).toThrow(
        'Invalid ZIP archive when extracting foo.wasm'
      );

      const zip = buildMinimalZip('other.txt', Buffer.from('abc'), 0);
      expect(() => setup.extractZipEntry(zip, 'missing.wasm')).toThrow(
        'Entry missing.wasm not found in ZIP archive'
      );

      const badMethodZip = buildMinimalZip('bad.wasm', Buffer.from('abc'), 99);
      expect(() => setup.extractZipEntry(badMethodZip, 'bad.wasm')).toThrow(
        'Unsupported ZIP compression method 99 for bad.wasm'
      );
    });

    it('should fetch and write raw file or extract ZIP entry to disk', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
        statusText: 'OK',
        status: 200,
      } as unknown as Response);

      await setup.downloadFile('http://example.com/file', '/local/file');

      expect(globalThis.fetch).toHaveBeenCalledWith('http://example.com/file');
      expect(mockWriteFileSync).toHaveBeenCalledWith('/local/file', expect.any(Buffer));

      const expectedContent = Buffer.from('zip-extracted-bytes');
      const zipBuf = buildMinimalZip('swiftlatexpdftex.wasm', expectedContent, 0);
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () =>
          zipBuf.buffer.slice(zipBuf.byteOffset, zipBuf.byteOffset + zipBuf.byteLength),
        statusText: 'OK',
        status: 200,
      } as unknown as Response);

      await setup.downloadFile('http://example.com/archive.zip', '/local/tex.wasm', 'swiftlatexpdftex.wasm');
      expect(mockWriteFileSync).toHaveBeenLastCalledWith('/local/tex.wasm', expectedContent);
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
    it('should wrap Emscripten glue code in TikZModuleFactory Promise and strip SwiftLaTeX pre.js when present', () => {
      const raw = 'var Module=typeof Module!="undefined"?Module:{}; const f = require("fs");';
      const output = setup.patchGlueCode(raw);

      expect(output).toContain('export default function TikZModuleFactory');
      expect(output).toContain('return new Promise');
      expect(output).toContain('var Module = moduleOverrides || {};');
      expect(output).toContain('const f = {};');

      const withPreJs =
        'self.onmessage=function(){};var moduleOverrides=Object.assign({},Module);scriptDirectory=__dirname+"/";';
      const strippedOutput = setup.patchGlueCode(withPreJs);
      expect(strippedOutput).not.toContain('self.onmessage=function(){}');
      expect(strippedOutput).toContain('scriptDirectory=""');
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

    it('should warn when ASSET_URLS.wasm uses placeholder URL', async () => {
      const originalWasmUrl = setup.ASSET_URLS.wasm;
      setup.ASSET_URLS.wasm = 'https://github.com/USER/REPO/releases/download/v1/pdftex.wasm';
      mockExistsSync.mockReturnValue(true);
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(4),
      } as unknown as Response);
      mockReadFileSync.mockReturnValue('var Glue = true;');

      await setup.main([]);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('WARNING: Using placeholder URLs')
      );

      setup.ASSET_URLS.wasm = originalWasmUrl;
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
