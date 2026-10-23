/**
 * Unit tests for {@link FormatGenerator} and {@link TeXFileLoader}.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FormatGenerator } from '../src/generator.js';
import { TeXFileLoader } from '../src/file-loader.js';
import type { TeXBridge } from '../src/bridge.js';

const { mockGlob, mockReadFile, mockWriteFile } = vi.hoisted(() => ({
  mockGlob: vi.fn(),
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
}));

vi.mock('glob', () => ({ glob: mockGlob }));
vi.mock('node:fs/promises', () => ({
  default: { readFile: mockReadFile, writeFile: mockWriteFile },
}));

describe('FormatGenerator', () => {
  let mockBridge: {
    writeFile: ReturnType<typeof vi.fn>;
    readFile: ReturnType<typeof vi.fn>;
    runTeX: ReturnType<typeof vi.fn>;
    getLogs: ReturnType<typeof vi.fn>;
  };
  let generator: FormatGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    mockReadFile.mockResolvedValue(Buffer.from('fake-content'));
    mockWriteFile.mockResolvedValue(undefined);
    mockGlob.mockResolvedValue(['tex/latex/tikz/tikz.sty']);

    mockBridge = {
      writeFile: vi.fn(),
      readFile: vi.fn(() => new Uint8Array([1, 2, 3])),
      runTeX: vi.fn(() => true),
      getLogs: vi.fn(() => ['Log 1']),
    };

    generator = new FormatGenerator(mockBridge as unknown as TeXBridge, '/mock/texlive');
  });

  it('should load trees, write ini_tikz.tex with pdfoutput=0 and dvisvgm driver, run TeX, and write fmt', async () => {
    await generator.generate('./out.fmt');

    expect(mockGlob).toHaveBeenCalledTimes(8);
    expect(mockBridge.writeFile).toHaveBeenCalledWith(
      '/texmf/tex/latex/tikz/tikz.sty',
      expect.any(Buffer)
    );

    const iniCall = mockBridge.writeFile.mock.calls.find(
      (call: unknown[]) => call[0] === 'ini_tikz.tex'
    );
    expect(iniCall).toBeDefined();
    const iniContent = String(iniCall?.[1]);
    expect(iniContent).toContain(String.raw`\pdfoutput=0`);
    expect(iniContent).toContain(String.raw`\def\pgfsysdriver{pgfsys-dvisvgm.def}`);
    expect(iniContent).toContain(String.raw`\input tikz.tex`);
    expect(iniContent).toContain(String.raw`\dump`);

    expect(mockBridge.runTeX).toHaveBeenCalledWith('ini_tikz.tex');
    expect(mockWriteFile).toHaveBeenCalledWith('./out.fmt', new Uint8Array([1, 2, 3]));
  });

  it('should throw with joined TeX logs if engine fails', async () => {
    mockBridge.runTeX.mockReturnValue(false);
    await expect(generator.generate('out.fmt')).rejects.toThrow(/TeX Compilation Failed[\s\S]*Log 1/);
  });

  it('should log error and rethrow if output format file is missing from VFS', async () => {
    mockBridge.readFile.mockImplementation(() => {
      throw new Error('Not found');
    });
    await expect(generator.generate('out.fmt')).rejects.toThrow('Not found');
    expect(console.error).toHaveBeenCalledWith('Could not find output format file in VFS.');
  });
});

describe('TeXFileLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should scan all 8 essential trees and normalize Windows backslashes', async () => {
    mockGlob
      .mockResolvedValueOnce([String.raw`tex\generic\pgf\pgf.tex`])
      .mockResolvedValue([]);
    mockReadFile.mockResolvedValue(Buffer.from('pgf-content'));

    const loader = new TeXFileLoader('/root');
    const vfs = await loader.loadEssentialTrees();

    expect(mockGlob).toHaveBeenCalledTimes(8);
    expect(vfs.size).toBe(1);
    expect(vfs.get('/texmf/tex/generic/pgf/pgf.tex')).toEqual(Buffer.from('pgf-content'));
  });
});
