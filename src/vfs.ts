/**
 * Virtual File System (VFS) manager for Emscripten `MEMFS`.
 *
 * @packageDocumentation
 */

import { MINIMAL_TEXMF_CNF, CNF_PATH } from './constants.js';
import { getParentDirectories } from './path-utils.js';
import type { VirtualAsset, IEmscriptenFS } from './types.js';

/**
 * `VfsManager` manages the state of the in-memory Emscripten filesystem (`MEMFS`).
 * It ensures parent directories exist, mounts local or remote assets, and writes
 * the Kpathsea configuration (`texmf.cnf`).
 */
export class VfsManager {
  /**
   * Underlying Emscripten `FS` implementation.
   */
  private readonly fs: IEmscriptenFS;

  /**
   * Creates a new {@link VfsManager}.
   *
   * @param fs - The raw Emscripten `FS` object (accessed via `Module.FS`).
   */
  constructor(fs: IEmscriptenFS) {
    this.fs = fs;
  }

  /**
   * Bootstraps the TeX environment in the VFS by creating `/texmf/web2c` and writing `texmf.cnf`.
   */
  bootstrap(): void {
    this.mkdirp(CNF_PATH);
    this.fs.writeFile(CNF_PATH, MINIMAL_TEXMF_CNF);
  }

  /**
   * Recursively creates all parent directories for a given virtual file path.
   *
   * @param filePath - Full virtual path whose parent directories should be created.
   */
  mkdirp(filePath: string): void {
    const segments = getParentDirectories(filePath);
    let currentPath = '';

    for (const segment of segments) {
      currentPath += `/${segment}`;
      let exists = false;
      try {
        const stat = this.fs.stat(currentPath);
        exists = Boolean(stat);
      } catch {
        exists = false;
      }

      if (!exists) {
        try {
          this.fs.mkdir(currentPath);
        } catch {
          // Ignore EEXIST if created concurrently
        }
      }
    }
  }

  /**
   * Mounts a single file into the VFS, creating its parent directories as needed.
   *
   * @param path - Full virtual path (e.g., `/texmf/fonts/tfm/cmr10.tfm`).
   * @param data - Binary content or UTF-8 string.
   */
  mountFile(path: string, data: string | Uint8Array): void {
    this.mkdirp(path);
    this.fs.writeFile(path, data);
  }

  /**
   * Fetches and mounts a list of virtual assets from literal buffers or external URLs.
   *
   * @param assets - List of {@link VirtualAsset} items to load.
   */
  async loadAssets(assets: readonly VirtualAsset[]): Promise<void> {
    const promises = assets.map(async (asset): Promise<void> => {
      let data: Uint8Array | string;

      if (
        typeof asset.source === 'string' &&
        (asset.source.startsWith('http') || asset.source.startsWith('/'))
      ) {
        const resp = await fetch(asset.source);
        if (!resp.ok) {
          throw new Error(`Failed to fetch ${asset.source}`);
        }
        const buf = await resp.arrayBuffer();
        data = new Uint8Array(buf);
      } else {
        data = asset.source;
      }

      this.mountFile(asset.path, data);
    });

    await Promise.all(promises);
  }

  /**
   * Writes the main `input.tex` source file for the TeX compiler.
   *
   * @param content - Complete LaTeX source document string.
   */
  writeInput(content: string): void {
    this.fs.writeFile('input.tex', content);
  }
}
