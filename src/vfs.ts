import { MINIMAL_TEXMF_CNF, CNF_PATH } from './constants.js';
import { getParentDirectories } from './path-utils.js';
import type { VirtualAsset, IEmscriptenFS } from './types.js';

/**
 * The VfsManager handles the state of the InMemory Filesystem.
 * It is responsible for ensuring directories exist, mounting remote assets,
 * and creating the necessary configuration files.
 */
export class VfsManager {
  private fs: IEmscriptenFS;

  /**
   * @param fs The raw Emscripten FS object (accessed via Module.FS)
   */
  constructor(fs: IEmscriptenFS) {
    this.fs = fs;
  }

  /**
   * Bootstraps the environment.
   * 1. Creates the basic folder structure.
   * 2. Writes the texmf.cnf config file.
   */
  bootstrap(): void {
    // Ensure the config path exists
    this.mkdirp(CNF_PATH);
    this.fs.writeFile(CNF_PATH, MINIMAL_TEXMF_CNF);
  }

  /**
   * Recursively creates directories for a given file path.
   * Emscripten's FS.mkdir does not support 'recursive: true' by default.
   */
  mkdirp(filePath: string): void {
    const segments = getParentDirectories(filePath);
    let currentPath = '';
    
    for (const segment of segments) {
      currentPath += `/${segment}`;
      try {
        // Check if exists
        try {
          const stat = this.fs.stat(currentPath);
          if (!stat) throw new Error(); 
        } catch {
          // If stat fails, directory likely doesn't exist
          this.fs.mkdir(currentPath);
        }
      } catch (e) {
        // Ignore if already exists (race condition or implementation detail)
      }
    }
  }

  /**
   * Mounts a single file, ensuring its parent directories exist.
   * @param path Full virtual path (e.g., /texmf/fonts/tfm/cmr10.tfm)
   * @param data Binary content or string
   */
  mountFile(path: string, data: string | Uint8Array): void {
    this.mkdirp(path);
    this.fs.writeFile(path, data);
  }

  /**
   * Fetches and mounts a list of assets from external URLs.
   * @param assets List of assets to load
   * @returns Promise that resolves when all assets are written to VFS
   */
  async loadAssets(assets: VirtualAsset[]): Promise<void> {
    const promises = assets.map(async (asset) => {
      let data: Uint8Array | string;

      if (typeof asset.source === 'string' && (asset.source.startsWith('http') || asset.source.startsWith('/'))) {
        const resp = await fetch(asset.source);
        if (!resp.ok) throw new Error(`Failed to fetch ${asset.source}`);
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
   * Writes the main input file for the compiler.
   */
  writeInput(content: string): void {
    this.fs.writeFile('input.tex', content);
  }
}