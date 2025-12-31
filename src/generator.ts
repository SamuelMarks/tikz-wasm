import fs from 'node:fs/promises';
import { TeXFileLoader } from './file-loader.js';
import { TeXBridge } from './bridge.js';

/**
 * Orchestrates the creation of the tikz.fmt binary file.
 * This class couples the file loader (disk access) with the bridge (WASM execution).
 */
export class FormatGenerator {
  private bridge: TeXBridge;
  private loader: TeXFileLoader;

  /**
   * @param bridge Initialized TeXBridge instance.
   * @param texDistRoot Absolute path to the local TeX Live 'texmf-dist' directory.
   */
  constructor(bridge: TeXBridge, texDistRoot: string) {
    this.bridge = bridge;
    this.loader = new TeXFileLoader(texDistRoot);
  }

  /**
   * Generates the format file.
   * @param outputPath Full path where the resulting .fmt file should be saved on disk.
   */
  async generate(outputPath: string): Promise<void> {
    console.log('1. Loading TeX Live files from disk...');
    const files = await this.loader.loadEssentialTrees();
    console.log(`   Loaded ${files.size} files.`);

    console.log('2. Hydrating Virtual File System...');
    for (const [vPath, content] of files) {
      this.bridge.writeFile(vPath, content);
    }

    console.log('3. Configuring TeX for INI mode...');
    // We explicitly define the PGF driver here.
    // This allows TikZ to emit the specific `dvisvgm:raw` specials our parser listens for.
    // Without this, PGF might default to 'dvips' or generic drivers which output opaque DVI code.
    const iniSource = `
      \\pdfoutput=0 
      \\def\\pgfsysdriver{pgfsys-dvisvgm.def}
      \\input tikz.tex
      \\dump
      \\end
    `;
    this.bridge.writeFile('ini_tikz.tex', iniSource);

    console.log('4. Running Engine...');
    // Run on the file we just wrote. 
    const success = this.bridge.runTeX('ini_tikz.tex');

    if (!success) {
      throw new Error(`TeX Compilation Failed. Logs: \n${this.bridge.getLogs().join('\n')}`);
    }

    console.log('5. Extracting Format File...');
    try {
      // The engine outputs the fmt with the same basename as the input
      const fmtData = this.bridge.readFile('ini_tikz.fmt');
      await fs.writeFile(outputPath, fmtData);
      console.log(`Success! Wrote ${outputPath} (${fmtData.length} bytes)`);
    } catch (e) {
      console.error("Could not find output format file in VFS.");
      throw e;
    }
  }
}