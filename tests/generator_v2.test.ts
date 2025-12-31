import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FormatGenerator } from '../src/generator';

// Mocks
const mockLoader = {
  loadEssentialTrees: vi.fn()
};
const mockBridge = {
  writeFile: vi.fn(),
  runTeX: vi.fn(),
  getLogs: vi.fn(),
  readFile: vi.fn()
};

// --- FIX: Use standard function so 'new TeXFileLoader()' works ---
vi.mock('../src/file-loader', () => ({
  TeXFileLoader: vi.fn().mockImplementation(function() {
    return mockLoader;
  })
}));

vi.mock('node:fs/promises', () => ({
  default: {
    writeFile: vi.fn()
  }
}));

describe('FormatGenerator (Updated)', () => {
  let generator: FormatGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new FormatGenerator(mockBridge as any, '/dummy');
  });

  it('should include pdfoutput=0 in the ini source', async () => {
    mockLoader.loadEssentialTrees.mockResolvedValue(new Map());
    mockBridge.runTeX.mockReturnValue(true);
    mockBridge.readFile.mockReturnValue(new Uint8Array([]));

    await generator.generate('out.fmt');

    // Check the call to write ini_tikz.tex
    const writeCalls = mockBridge.writeFile.mock.calls;
    const iniCall = writeCalls.find((call: any[]) => call[0] === 'ini_tikz.tex');

    expect(iniCall).toBeDefined();
    expect(iniCall[1]).toContain('\\pdfoutput=0');
    expect(iniCall[1]).toContain('\\input tikz.tex');
    expect(iniCall[1]).toContain('\\dump');
  });
});