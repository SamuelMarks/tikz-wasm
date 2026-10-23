/**
 * Scans a local TeX Live distribution directory for PGF, TikZ, LaTeX base,
 * and Computer Modern metric files required to dump `tikz.fmt`.
 *
 * @packageDocumentation
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'glob';

/**
 * Scans the local filesystem for TeX Live files needed to compile TikZ in INI mode.
 */
export class TeXFileLoader {
  /**
   * Absolute path to the local TeX Live `texmf-dist` root directory.
   */
  private readonly rootDir: string;

  /**
   * Creates a new {@link TeXFileLoader}.
   *
   * @param texDistRoot - Path to the `texmf-dist` root directory.
   */
  constructor(texDistRoot: string) {
    this.rootDir = texDistRoot;
  }

  /**
   * Loads essential macro and font metric sub-trees from the TeX distribution.
   *
   * @returns A `Map` of normalized `/texmf/...` virtual paths to file `Buffer` contents.
   */
  async loadEssentialTrees(): Promise<Map<string, Buffer>> {
    const vfs = new Map<string, Buffer>();

    const patterns = [
      'tex/plain/base/**/*',
      'tex/plain/pgf/**/*',
      'tex/generic/hyphen/**/*',
      'tex/generic/pgf/**/*',
      'tex/generic/atbegshi/**/*',
      'tex/generic/infwarerr/**/*',
      'tex/generic/ltxcmds/**/*',
      'tex/generic/iftex/**/*',
      'tex/generic/oberdiek/**/*',
      'tex/generic/xkeyval/**/*',
      'tex/latex/pgf/**/*',
      'tex/latex/tikz/**/*',
      'tex/latex/base/**/*',
      'tex/latex/l3kernel/**/*',
      'tex/latex/tools/**/*',
      'fonts/tfm/public/cm/**/*',
      'fonts/tfm/public/knuth-lib/**/*',
    ];

    for (const pattern of patterns) {
      const files = await glob(pattern, { cwd: this.rootDir, nodir: true });

      for (const file of files) {
        const fullPath = path.join(this.rootDir, file);
        const buffer = await fs.readFile(fullPath);

        const vfsPath = '/texmf/' + file.replaceAll(String.fromCharCode(92), '/');
        vfs.set(vfsPath, buffer);
      }
    }

    return vfs;
  }
}
