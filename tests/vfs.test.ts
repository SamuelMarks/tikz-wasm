/**
 * Unit tests for {@link VfsManager}.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VfsManager } from '../src/vfs.js';
import { CNF_PATH, MINIMAL_TEXMF_CNF } from '../src/constants.js';
import type { IEmscriptenFS } from '../src/types.js';

describe('VfsManager', () => {
  let vfs: VfsManager;
  let mockFS: IEmscriptenFS;
  let existingDirs: Set<string>;
  let files: Map<string, string | Uint8Array>;

  beforeEach(() => {
    existingDirs = new Set();
    files = new Map();

    mockFS = {
      mkdir: vi.fn((p: string) => {
        existingDirs.add(p);
      }),
      writeFile: vi.fn((p: string, data: string | Uint8Array) => {
        files.set(p, data);
      }),
      readFile: vi.fn() as unknown as IEmscriptenFS['readFile'],
      unlink: vi.fn(),
      stat: vi.fn((p: string) => {
        if (existingDirs.has(p)) return { mode: 16895, size: 0 };
        throw new Error('No such file or directory');
      }),
      isDir: () => true,
      mount: vi.fn(),
    };

    globalThis.fetch = vi.fn();
    vfs = new VfsManager(mockFS);
  });

  describe('Bootstrap', () => {
    it('should create the config directory and write texmf.cnf', () => {
      vfs.bootstrap();

      expect(mockFS.mkdir).toHaveBeenCalledWith('/texmf');
      expect(mockFS.mkdir).toHaveBeenCalledWith('/texmf/web2c');
      expect(mockFS.writeFile).toHaveBeenCalledWith(CNF_PATH, MINIMAL_TEXMF_CNF);
    });
  });

  describe('Directory Management (mkdirp)', () => {
    it('should create nested directories', () => {
      vfs.mountFile('/a/b/c/file.txt', 'content');
      expect(existingDirs.has('/a')).toBe(true);
      expect(existingDirs.has('/a/b')).toBe(true);
      expect(existingDirs.has('/a/b/c')).toBe(true);
    });

    it('should ignore existing directories and tolerate concurrent mkdir EEXIST errors', () => {
      existingDirs.add('/a');
      mockFS.mkdir = vi.fn(() => {
        throw new Error('EEXIST');
      });

      expect(() => vfs.mkdirp('/a/b/file.txt')).not.toThrow();
      expect(mockFS.mkdir).toHaveBeenCalledWith('/a/b');
      expect(mockFS.mkdir).not.toHaveBeenCalledWith('/a');
    });
  });

  describe('Asset Loading', () => {
    it('should mount raw binary and string assets', async () => {
      const data = new Uint8Array([1, 2, 3]);
      await vfs.loadAssets([
        { path: '/fonts/font.tfm', source: data },
        { path: '/macros/custom.tex', source: 'macro_code' },
      ]);

      expect(files.get('/fonts/font.tfm')).toBe(data);
      expect(files.get('/macros/custom.tex')).toBe('macro_code');
    });

    it('should fetch and mount remote HTTP and root-relative assets', async () => {
      const remoteData = new Uint8Array([9, 8, 7]);
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => remoteData.buffer,
      };
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as unknown as Response);

      await vfs.loadAssets([
        { path: '/remote/file.dat', source: 'https://example.com/file.dat' },
        { path: '/local/file.dat', source: '/assets/file.dat' },
      ]);

      expect(globalThis.fetch).toHaveBeenCalledWith('https://example.com/file.dat');
      expect(globalThis.fetch).toHaveBeenCalledWith('/assets/file.dat');
      expect(files.get('/remote/file.dat')).toEqual(remoteData);
      expect(files.get('/local/file.dat')).toEqual(remoteData);
    });

    it('should throw on fetch error', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({ ok: false } as unknown as Response);

      await expect(
        vfs.loadAssets([{ path: '/fail', source: 'http://fail' }])
      ).rejects.toThrow('Failed to fetch http://fail');
    });
  });

  describe('Input Handling', () => {
    it('should write raw input.tex', () => {
      vfs.writeInput(String.raw`	ikz...`);
      expect(mockFS.writeFile).toHaveBeenCalledWith('input.tex', String.raw`	ikz...`);
    });
  });
});
