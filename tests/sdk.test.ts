import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderTikzAsSvg, configureCompiler } from '../src/sdk';
import { resetCompiler } from '../src/pool';
import { TikzCompiler } from '../src/compiler';

// 1. Hoisted mocks to allow vi.mock factory to use them
const { mockCompile, mockTerminate, mockParse } = vi.hoisted(() => ({
  mockCompile: vi.fn(),
  mockTerminate: vi.fn(),
  mockParse: vi.fn()
}));

// 2. Mock modules using the hoisted variables
// --- FIX: Use standard function for constructor mock ---
vi.mock('../src/compiler', () => ({
  TikzCompiler: vi.fn().mockImplementation(function() {
    return {
      compile: mockCompile,
      terminate: mockTerminate
    };
  })
}));

vi.mock('../src/parser', () => ({
  DviParser: vi.fn().mockImplementation(function() {
    return {
      parse: mockParse
    };
  })
}));

// Mock global worker code injection and URL API for the "Inline Worker" pattern
(globalThis as any).__TIKZ_WORKER_CODE__ = "console.log('Worker Stub');";
(globalThis as any).URL.createObjectURL = vi.fn((blob) => `blob:stub-${blob}`);

describe('SDK: renderTikzAsSvg', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default Happy Path
    mockCompile.mockResolvedValue({
      success: true,
      dvi: new Uint8Array([0]),
      logs: []
    });
    mockParse.mockReturnValue('<svg>default</svg>');

    // Ensure clean singleton state
    try { resetCompiler(); } catch (e) {}
  });

  afterEach(() => {
    try { resetCompiler(); } catch (e) {}
  });

  it('should unwrap specific valid output', async () => {
    mockCompile.mockResolvedValue({ success: true, dvi: new Uint8Array([1]), logs: [] });
    mockParse.mockReturnValue('<svg>Success</svg>');

    const svg = await renderTikzAsSvg('\\begin{tikzpicture}');

    expect(mockCompile).toHaveBeenCalled();
    // Verify template wrapping happened
    const calledSrc = mockCompile.mock.calls[0][0];
    expect(calledSrc).toContain('\\documentclass');

    expect(svg).toBe('<svg>Success</svg>');
  });

  it('should instantiate the compiler with a Blob URL', () => {
    resetCompiler();

    // Trigger instantiation
    renderTikzAsSvg('code').catch(() => {}); // catch needed if mockParse fails or similar

    // Verify architectural change: We expect a generated blob URL
    expect(TikzCompiler).toHaveBeenCalledWith(expect.stringMatching(/^blob:/));
  });

  it('should warn if configureCompiler is used (Deprecated)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    configureCompiler('ignored.js');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('deprecated'));
    warn.mockRestore();
  });

  it('should reuse compiler instance', async () => {
    resetCompiler();

    // First Call -> Spawns Instance
    await renderTikzAsSvg('1');

    // Second Call -> Reuses Instance
    await renderTikzAsSvg('2');

    expect(TikzCompiler).toHaveBeenCalledTimes(1);
    expect(mockCompile).toHaveBeenCalledTimes(2);
  });

  it('should throw TikzCompilationError on engine failure', async () => {
    mockCompile.mockResolvedValue({
      success: false,
      logs: ['! Undefined control sequence']
    });

    await expect(renderTikzAsSvg('bad code'))
        .rejects
        .toThrow(/TeX compilation failed/);

    try {
      await renderTikzAsSvg('bad code');
    } catch (e: any) {
      expect(e.logs).toBeDefined();
      expect(e.logs).toContain('! Undefined control sequence');
    }
  });

  it('should throw generic error on DVI parsing failure', async () => {
    mockParse.mockImplementation(() => { throw new Error('Corrupt Bytes'); });

    await expect(renderTikzAsSvg('code'))
        .rejects
        .toThrow(/DVI Parsing Error/);
  });
});