/**
 * Offline format generator (`tikz.fmt`) combining {@link TeXFileLoader} and {@link TeXBridge}.
 *
 * @packageDocumentation
 */

import fs from 'node:fs/promises';
import { TeXFileLoader } from './file-loader.js';
import { TeXBridge } from './bridge.js';
import { PGF_DRIVER_DEF } from './constants.js';

/**
 * Orchestrates the creation of the pre-dumped `tikz.fmt` binary file.
 * Hydrates the Emscripten VFS with local TeX Live files and runs TeX in INI mode.
 */
export class FormatGenerator {
  /**
   * Initialized Emscripten TeX bridge.
   */
  private readonly bridge: TeXBridge;

  /**
   * Local TeX Live distribution file loader.
   */
  private readonly loader: TeXFileLoader;

  /**
   * Creates a new {@link FormatGenerator}.
   *
   * @param bridge - Initialized {@link TeXBridge} instance.
   * @param texDistRoot - Absolute path to the local TeX Live `texmf-dist` directory.
   */
  constructor(bridge: TeXBridge, texDistRoot: string) {
    this.bridge = bridge;
    this.loader = new TeXFileLoader(texDistRoot);
  }

  /**
   * Hydrates the VFS from disk, executes TeX with `\dump`, and writes the resulting `.fmt` file.
   *
   * @param outputPath - Full path where the resulting `.fmt` file should be saved on disk.
   * @throws Error if TeX compilation fails or `ini_tikz.fmt` is missing from the VFS.
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
    const iniSource = [
      String.raw`\catcode` + '`\\{=1',
      String.raw`\catcode` + '`\\}=2',
      String.raw`\input plain.tex`,
      String.raw`\pdfoutput=0`,
      String.raw`\nopagenumbers`,
      String.raw`\catcode` + '`\\@=11',
      String.raw`\let\@@end\end`,
      String.raw`\catcode` + '`\\@=12',
      PGF_DRIVER_DEF,
      String.raw`\input tikz.tex`,
      String.raw`\catcode` + '`\\@=11',
      String.raw`\def\documentclass{\pgfutil@ifnextchar[\@documentclass\@@documentclass}`,
      String.raw`\def\@documentclass[#1]#2{}`,
      String.raw`\def\@@documentclass#1{}`,
      String.raw`\def\usepackage{\pgfutil@ifnextchar[\@usepackage\@@usepackage}`,
      String.raw`\def\@usepackage[#1]#2{}`,
      String.raw`\def\@@usepackage#1{}`,
      String.raw`\def\begin#1{\csname #1\endcsname}`,
      String.raw`\def\end#1{\csname end#1\endcsname}`,
      String.raw`\def\document{\endlinechar=13\relax}`,
      String.raw`\def\enddocument{\vfill\supereject\@@end}`,
      String.raw`\catcode` + '`\\@=12',
      String.raw`\dump`,
      String.raw`\@@end`,
    ].join(String.fromCharCode(10));
    this.bridge.writeFile('ini_tikz.tex', iniSource);

    console.log('4. Running Engine...');
    const success = this.bridge.runTeX('ini_tikz.tex');

    if (!success) {
      const joinedLogs = this.bridge.getLogs().join(String.fromCharCode(10));
      throw new Error(`TeX Compilation Failed. Logs: ${String.fromCharCode(10)}${joinedLogs}`);
    }

    console.log('5. Extracting Format File...');
    try {
      const fmtData = this.bridge.readFile('ini_tikz.fmt');
      await fs.writeFile(outputPath, fmtData);
      console.log(`Success! Wrote ${outputPath} (${fmtData.length} bytes)`);
    } catch (e: unknown) {
      console.error('Could not find output format file in VFS.');
      throw e;
    }
  }
}
