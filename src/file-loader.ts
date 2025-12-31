import fs from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'glob';

/**
 * Scans the local filesystem for files needed to compile TikZ.
 * We cannot blindly load gigabytes of files, so we target specific subdirectories.
 */
export class TeXFileLoader {
  private rootDir: string;

  constructor(texDistRoot: string) {
    this.rootDir = texDistRoot;
  }

  /**
   * Loads necessary sub-trees from the TeX distribution.
   * Focuses on PGF, TikZ, xkeyval, and standard LaTeX base files.
   */
  async loadEssentialTrees(): Promise<Map<string, Buffer>> {
    const vfs = new Map<string, Buffer>();

    // Define patterns relative to TEXMFDIST
    // Note: This is an approximation. A full robust solution might use kpsewhich calls
    // for every file, but bulk loading specific directories is faster for WASM init.
    const patterns = [
      'tex/generic/pgf/**/*', 
      'tex/latex/pgf/**/*',
      'tex/latex/tikz/**/*',
      'tex/latex/base/**/*',
      'tex/latex/l3kernel/**/*',
      'tex/latex/tools/**/*',
      'tex/generic/xkeyval/**/*',
      'fonts/tfm/public/cm/**/*', // Metric files for Computer Modern
    ];

    for (const pattern of patterns) {
      // We expect the root to be structured like a standard TEXMF tree (e.g., /usr/share/texlive/texmf-dist)
      const files = await glob(pattern, { cwd: this.rootDir, nodir: true });
      
      for (const file of files) {
        const fullPath = path.join(this.rootDir, file);
        const buffer = await fs.readFile(fullPath);
        
        // Normalize win32 paths to unix for TeX
        const vfsPath = '/texmf/' + file.replace(/\\/g, '/');
        vfs.set(vfsPath, buffer);
      }
    }

    return vfs;
  }
}