import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VfsManager } from '../src/vfs';
import { CNF_PATH, MINIMAL_TEXMF_CNF } from '../src/constants';
import type { IEmscriptenFS } from '../src/types';

describe('VfsManager', () => {
  let vfs: VfsManager;
  let mockFS: IEmscriptenFS;
  let existingDirs: Set<string>;
  let files: Map<string, string | Uint8Array>;

  beforeEach(() => {
    existingDirs = new Set();
    files = new Map();

    mockFS = {
      mkdir: vi.fn((path: string) => existingDirs.add(path)),
      writeFile: vi.fn((path: string, data: any) => files.set(path, data)),
      readFile: vi.fn(),
      stat: vi.fn((path: string) => {
        if (existingDirs.has(path)) return { mode: 16895 }; // Dir mode
        throw new Error('No such file or directory');
      }),
      isDir: () => true
    };
    
    // Stub fetch globally
    global.fetch = vi.fn();
    vfs = new VfsManager(mockFS);
  });

  describe('Bootstrap', () => {
    it('should create the config directory and write texmf.cnf', () => {
      vfs.bootstrap();
      
      // Check hierarchical directory creation
      expect(mockFS.mkdir).toHaveBeenCalledWith('/texmf');
      expect(mockFS.mkdir).toHaveBeenCalledWith('/texmf/web2c');
      
      // Check file write
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

    it('should ignore existing directories', () => {
      existingDirs.add('/a'); // Pre-exist
      vfs.mkdirp('/a/b/file.txt');
      
      // Should not call mkdir for /a, but should for /a/b
      // Note: Implementation calls stat first.
      expect(mockFS.mkdir).toHaveBeenCalledWith('/a/b');
      expect(mockFS.mkdir).not.toHaveBeenCalledWith('/a');
    });
  });

  describe('Asset Loading', () => {
    it('should mount raw binary assets', async () => {
      const data = new Uint8Array([1, 2, 3]);
      await vfs.loadAssets([{ path: '/fonts/font.tfm', source: data }]);
      
      expect(files.get('/fonts/font.tfm')).toBe(data);
    });

    it('should fetch and mount remote assets', async () => {
      const remoteData = new Uint8Array([9, 8, 7]);
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => remoteData.buffer
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      await vfs.loadAssets([
        { path: '/remote/file.dat', source: 'https://example.com/file.dat' }
      ]);

      expect(global.fetch).toHaveBeenCalledWith('https://example.com/file.dat');
      expect(files.get('/remote/file.dat')).toEqual(remoteData);
    });

    it('should throw on fetch error', async () => {
      (global.fetch as any).mockResolvedValue({ ok: false });
      
      await expect(vfs.loadAssets([
        { path: '/fail', source: 'http://fail' }
      ])).rejects.toThrow(/Failed to fetch/);
    });
  });

  describe('Input Handling', () => {
    it('should write raw input.tex', () => {
      vfs.writeInput('\\tikz...');
      expect(mockFS.writeFile).toHaveBeenCalledWith('input.tex', '\\tikz...');
    });
  });
});