import { describe, it, expect, vi, beforeEach } from 'vitest'; 
import { FormatGenerator } from '../src/generator'; 
import { TeXFileLoader } from '../src/file-loader'; 

const { mockGlob, mockReadFile, mockWriteFile } = vi.hoisted(() => ({ 
  mockGlob: vi.fn(), 
  mockReadFile: vi.fn(), 
  mockWriteFile: vi.fn() 
})); 

vi.mock('glob', () => ({ glob: mockGlob })); 
vi.mock('node:fs/promises', () => ({ 
  default: { readFile: mockReadFile, writeFile: mockWriteFile } 
})); 

describe('FormatGenerator', () => { 
  let bridge: any; 
  let generator: FormatGenerator; 

  beforeEach(() => { 
    vi.clearAllMocks(); 
    mockReadFile.mockResolvedValue(Buffer.from('fake-content')); 
    mockWriteFile.mockResolvedValue(undefined); 
    mockGlob.mockResolvedValue(['tex/latex/tikz/tikz.sty']); 

    bridge = { 
      writeFile: vi.fn(), 
      readFile: vi.fn(() => new Uint8Array([1, 2, 3])), 
      runTeX: vi.fn(() => true), 
      getLogs: vi.fn(() => ['Log 1']) 
    }; 
    
    generator = new FormatGenerator(bridge, '/mock/texlive'); 
  }); 

  it('should flow through the generation steps', async () => { 
    await generator.generate('./out.fmt'); 
    expect(mockGlob).toHaveBeenCalled(); 
    expect(bridge.writeFile).toHaveBeenCalledWith('ini_tikz.tex', expect.stringContaining('\\dump')); 
    expect(bridge.runTeX).toHaveBeenCalledWith('ini_tikz.tex'); 
    expect(mockWriteFile).toHaveBeenCalledWith('./out.fmt', expect.any(Uint8Array)); 
  }); 

  it('should throw if engine fails', async () => { 
    bridge.runTeX.mockReturnValue(false); 
    // Fix: Updated expectation to match "Compilation"
    await expect(generator.generate('out.fmt')).rejects.toThrow(/TeX Compilation Failed/); 
  }); 

  it('should throw if output file missing', async () => { 
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); 
    bridge.readFile.mockImplementation(() => { throw new Error('Not found'); }); 
    await expect(generator.generate('out.fmt')).rejects.toThrow(); 
    consoleSpy.mockRestore(); 
  }); 
}); 

describe('TeXFileLoader', () => { 
  beforeEach(() => vi.clearAllMocks()); 

  it('should scan essential trees', async () => { 
    mockGlob.mockResolvedValueOnce(['file1.tex']); 
    mockReadFile.mockResolvedValue(Buffer.from('content')); 
    const loader = new TeXFileLoader('/root'); 
    const vfs = await loader.loadEssentialTrees(); 
    expect(vfs.size).toBeGreaterThan(0); 
  }); 
});