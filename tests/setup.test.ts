import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import * as setup from '../scripts/setup';

// Define hoisted names for mocks
const { mockWriteFileSync, mockUnlinkSync, mockMkdirSync, mockExistsSync, mockReadFileSync } = vi.hoisted(() => ({
  mockWriteFileSync: vi.fn(),
  mockUnlinkSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockExistsSync: vi.fn(),
  mockReadFileSync: vi.fn(),
}));

// Mock `fs` module
vi.mock('node:fs', () => ({
  default: {
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync,
    writeFileSync: mockWriteFileSync,
    readFileSync: mockReadFileSync,
    unlinkSync: mockUnlinkSync,
  }
}));

describe('Scripts: setup.ts', () => {
  const OriginalFetch = global.fetch;
  const OriginalConsole = console.error;
  const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

  beforeEach(() => {
    vi.clearAllMocks();
    console.error = vi.fn(); // Silence error logs
  });

  afterEach(() => {
    global.fetch = OriginalFetch;
    console.error = OriginalConsole;
  });

  describe('ensureDirectory', () => {
    it('should create directory if it does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      setup.ensureDirectory('/test/dir');
      expect(mockMkdirSync).toHaveBeenCalledWith('/test/dir', { recursive: true });
    });

    it('should do nothing if directory exists', () => {
      mockExistsSync.mockReturnValue(true);
      setup.ensureDirectory('/test/dir');
      expect(mockMkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('downloadFile', () => {
    const dummyRef = { ok: true, arrayBuffer: async () => new ArrayBuffer(8), statusText: 'OK' };

    it('should fetch and write file', async () => {
      global.fetch = vi.fn().mockResolvedValue(dummyRef as any);
      
      await setup.downloadFile('http://example.com/file', '/local/file');
      
      expect(global.fetch).toHaveBeenCalledWith('http://example.com/file');
      expect(mockWriteFileSync).toHaveBeenCalledWith('/local/file', expect.any(Buffer));
    });

    it('should throw on non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, statusText: 'Not Found' } as any);
      
      await expect(setup.downloadFile('http://bad.url', '/local/bad'))
        .rejects.toThrow('Failed to fetch http://bad.url: Not Found');
    });
  });

  describe('patchGlueCode', () => {
    it('should wrap code in Promise factory', () => {
      const raw = 'var Module = {};';
      const output = setup.patchGlueCode(raw);
      
      expect(output).toContain('export default function TikZModuleFactory');
      expect(output).toContain('return new Promise');
      expect(output).toContain('// --- START UPSTREAM CODE ---');
      expect(output).toContain(raw);
      expect(output).toContain('});'); // End of promise
    });
  });

  describe('main', () => {
    it('should execute full workflow successfully', async () => {
      // Setup mocks for flow
      mockExistsSync.mockReturnValue(true); // Dir exists
      global.fetch = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(10) } as any);
      mockReadFileSync.mockReturnValue('var Glue = true;');

      await setup.main();

      // 1. Ensure dir
      expect(mockExistsSync).toHaveBeenCalledWith(setup.CONFIG.assetsDir);
      
      // 2. Fetch WASM
      expect(global.fetch).toHaveBeenCalledWith(setup.ASSET_URLS.wasm);
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        path.join(setup.CONFIG.assetsDir, 'tex.wasm'),
        expect.any(Buffer)
      );

      // 3. Fetch Glue
      expect(global.fetch).toHaveBeenCalledWith(setup.ASSET_URLS.glue);
      
      // 4. Read Temp & Write Patched
      expect(mockReadFileSync).toHaveBeenCalled();
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        path.join(setup.CONFIG.assetsDir, 'tex_glue.js'),
        expect.stringContaining('export default function')
      );

      // 5. Cleanup
      expect(mockUnlinkSync).toHaveBeenCalled();
    });

    it('should handle errors and exit process', async () => {
      // Simulate fetch error
      global.fetch = vi.fn().mockResolvedValue({ ok: false, statusText: 'Server Error' } as any);

      await setup.main();

      expect(console.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });
});