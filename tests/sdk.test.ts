/**
 * Unit tests for `src/sdk.ts` ({@link renderTikzAsSvg}, {@link configureCompiler}).
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderTikzAsSvg, configureCompiler } from '../src/sdk.js';
import { resetCompiler } from '../src/pool.js';
import { TikzCompiler } from '../src/compiler.js';
import { TikzCompilationError } from '../src/errors.js';

const { mockCompile, mockTerminate, mockParse } = vi.hoisted(() => ({
  mockCompile: vi.fn(),
  mockTerminate: vi.fn(),
  mockParse: vi.fn(),
}));

vi.mock('../src/compiler.js', () => ({
  TikzCompiler: vi.fn().mockImplementation(function () {
    return {
      compile: mockCompile,
      terminate: mockTerminate,
    };
  }),
}));

vi.mock('../src/parser.js', () => ({
  DviParser: vi.fn().mockImplementation(function () {
    return {
      parse: mockParse,
    };
  }),
}));

const testGlobals = globalThis as unknown as Record<string, unknown>;
testGlobals['__TIKZ_WORKER_CODE__'] = "console.log('Worker Stub');";
URL.createObjectURL = vi.fn((blob: unknown) => `blob:stub-${String(blob)}`);
URL.revokeObjectURL = vi.fn();

describe('SDK: renderTikzAsSvg', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCompile.mockResolvedValue({
      id: 'job-1',
      success: true,
      dvi: new Uint8Array([0]),
      logs: ['TeX output line 1'],
    });
    mockParse.mockReturnValue('<svg>default</svg>');

    resetCompiler();
  });

  afterEach(() => {
    resetCompiler();
  });

  it('should wrap snippet in document, compile, and parse valid DVI output', async () => {
    mockCompile.mockResolvedValue({
      id: 'job-2',
      success: true,
      dvi: new Uint8Array([1]),
      logs: [],
    });
    mockParse.mockReturnValue('<svg>Success</svg>');

    const svg = await renderTikzAsSvg(String.raw`\begin{tikzpicture}\end{tikzpicture}`);

    expect(mockCompile).toHaveBeenCalledTimes(1);
    const calledSrc = String((mockCompile.mock.calls[0] as unknown[])?.[0]);
    expect(calledSrc).toContain(String.raw`\documentclass`);
    expect(svg).toBe('<svg>Success</svg>');
  });

  it('should log compilation lines when options.debug is enabled', async () => {
    const debugLines: string[] = [];
    await renderTikzAsSvg('code', {
      debug: true,
      debugLogger: (msg: string): void => {
        debugLines.push(msg);
      },
    });
    expect(debugLines).toEqual(['TeX output line 1']);

    const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    await renderTikzAsSvg('code', { debug: true });
    expect(consoleDebugSpy).toHaveBeenCalledWith('TeX output line 1');
    consoleDebugSpy.mockRestore();
  });

  it('should instantiate the compiler with a Blob URL', async () => {
    resetCompiler();
    await renderTikzAsSvg('code');
    expect(TikzCompiler).toHaveBeenCalledWith(expect.stringMatching(/^blob:/));
  });

  it('should warn if configureCompiler is used (Deprecated)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    configureCompiler('ignored.js');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('deprecated'));
    warn.mockRestore();
  });

  it('should reuse compiler instance across multiple calls', async () => {
    resetCompiler();
    await renderTikzAsSvg('1');
    await renderTikzAsSvg('2');

    expect(TikzCompiler).toHaveBeenCalledTimes(1);
    expect(mockCompile).toHaveBeenCalledTimes(2);
  });

  it('should throw TikzCompilationError with logs on engine failure', async () => {
    mockCompile.mockResolvedValue({
      id: 'fail-1',
      success: false,
      logs: ['! Undefined control sequence'],
    });

    await expect(renderTikzAsSvg('bad code')).rejects.toThrow(TikzCompilationError);

    try {
      await renderTikzAsSvg('bad code');
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(TikzCompilationError);
      if (e instanceof TikzCompilationError) {
        expect(e.logs).toContain('! Undefined control sequence');
      }
    }
  });

  it('should wrap Error and non-Error DVI parsing failures', async () => {
    mockParse.mockImplementationOnce(() => {
      throw new Error('Corrupt Bytes');
    });
    await expect(renderTikzAsSvg('code')).rejects.toThrow('DVI Parsing Error: Corrupt Bytes');

    mockParse.mockImplementationOnce(() => {
      throw 'String Parse Failure';
    });
    await expect(renderTikzAsSvg('code')).rejects.toThrow(
      'DVI Parsing Error: String Parse Failure'
    );
  });
});
