/**
 * Unit tests for `src/worker.ts` ({@link handleWorkerMessage}, {@link resetWorkerState}).
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleWorkerMessage, resetWorkerState, type WorkerGlobalScope } from '../src/worker.js';
import type { TeXBridge } from '../src/bridge.js';
import type { CompileJob, CompileResult, EmscriptenFS, EmscriptenModuleFactory } from '../src/types.js';

describe('Worker: handleWorkerMessage', () => {
  let mockFS: EmscriptenFS;
  let mockBridge: {
    init: ReturnType<typeof vi.fn>;
    writeFile: ReturnType<typeof vi.fn>;
    runTeX: ReturnType<typeof vi.fn>;
    readFile: ReturnType<typeof vi.fn>;
    getLogs: ReturnType<typeof vi.fn>;
    getFS: ReturnType<typeof vi.fn>;
  };
  let postedMessages: CompileResult[];
  let mockScope: WorkerGlobalScope;

  beforeEach(() => {
    postedMessages = [];
    mockFS = {
      writeFile: vi.fn(),
      readFile: vi.fn() as unknown as EmscriptenFS['readFile'],
      unlink: vi.fn(),
      mkdir: vi.fn(),
      stat: vi.fn(() => {
        throw new Error('ENOENT');
      }),
      isDir: vi.fn(() => false),
      mount: vi.fn(),
    };

    mockBridge = {
      init: vi.fn(async () => {}),
      writeFile: vi.fn(),
      runTeX: vi.fn(() => true),
      readFile: vi.fn(() => new Uint8Array([10, 20])),
      getLogs: vi.fn(() => ['TeX log']),
      getFS: vi.fn(() => mockFS),
    };

    resetWorkerState(mockBridge as unknown as TeXBridge);

    mockScope = {
      TikZModuleFactory: vi.fn() as unknown as EmscriptenModuleFactory,
      TIKZ_WASM_BINARY: new Uint8Array([1, 2]),
      TIKZ_FMT_BINARY: new Uint8Array([3, 4]),
      postMessage: (msg: CompileResult): void => {
        postedMessages.push(msg);
      },
    };
  });

  it('should initialize bridge on first job, bootstrap VFS, mount fmt, and compile source', async () => {
    const job: CompileJob = { id: 'j1', source: 'tex-code' };
    await handleWorkerMessage({ data: job } as MessageEvent<CompileJob>, mockScope);

    expect(mockBridge.init).toHaveBeenCalledTimes(1);
    expect(mockFS.mkdir).toHaveBeenCalledWith('/texmf');
    expect(mockBridge.writeFile).toHaveBeenCalledWith('tikz.fmt', mockScope.TIKZ_FMT_BINARY);
    expect(mockBridge.writeFile).toHaveBeenCalledWith('input.tex', 'tex-code');
    expect(mockBridge.runTeX).toHaveBeenCalledWith('input.tex');

    expect(postedMessages[0]).toEqual({
      id: 'j1',
      success: true,
      dvi: new Uint8Array([10, 20]),
      logs: ['TeX log'],
    });

    // Second job should skip initialization
    const job2: CompileJob = { id: 'j2', source: 'tex-code-2' };
    await handleWorkerMessage({ data: job2 } as MessageEvent<CompileJob>, mockScope);
    expect(mockBridge.init).toHaveBeenCalledTimes(1);
  });

  it('should accept wasmBinary from job payload and work without fmtBinary', async () => {
    delete mockScope.TIKZ_WASM_BINARY;
    delete mockScope.TIKZ_FMT_BINARY;

    const job: CompileJob = {
      id: 'j-inline',
      source: 'code',
      wasmBinary: new Uint8Array([9]),
    };
    await handleWorkerMessage({ data: job } as MessageEvent<CompileJob>, mockScope);

    expect(mockBridge.init).toHaveBeenCalledWith(mockScope.TikZModuleFactory, new Uint8Array([9]));
    expect(mockBridge.writeFile).not.toHaveBeenCalledWith('tikz.fmt', expect.anything());
    expect(postedMessages[0]?.success).toBe(true);
  });

  it('should return failure result without dvi when runTeX returns false', async () => {
    mockBridge.runTeX.mockReturnValue(false);
    const job: CompileJob = { id: 'j-fail', source: 'bad-tex' };
    await handleWorkerMessage({ data: job } as MessageEvent<CompileJob>, mockScope);

    expect(postedMessages[0]?.success).toBe(false);
    expect(postedMessages[0]?.dvi).toBeUndefined();
  });

  it('should fail if TikZModuleFactory is missing', async () => {
    delete mockScope.TikZModuleFactory;
    const job: CompileJob = { id: 'j-no-factory', source: 'code' };
    await handleWorkerMessage({ data: job } as MessageEvent<CompileJob>, mockScope);

    expect(postedMessages[0]?.success).toBe(false);
    expect(postedMessages[0]?.error).toBe('WASM Module Factory not found.');
    expect(postedMessages[0]?.logs).toContain('CRITICAL: WASM Module Factory not found.');
  });

  it('should fail if WASM binary is missing from both job and scope', async () => {
    delete mockScope.TIKZ_WASM_BINARY;
    const job: CompileJob = { id: 'j-no-wasm', source: 'code' };
    await handleWorkerMessage({ data: job } as MessageEvent<CompileJob>, mockScope);

    expect(postedMessages[0]?.success).toBe(false);
    expect(postedMessages[0]?.error).toBe('WASM Binary not loaded in worker global scope.');
  });

  it('should fallback to Unknown Worker Error when non-Error or empty Error is thrown', async () => {
    mockBridge.init.mockRejectedValueOnce('raw-error');
    const job: CompileJob = { id: 'j-raw-err', source: 'code' };
    await handleWorkerMessage({ data: job } as MessageEvent<CompileJob>, mockScope);

    expect(postedMessages[0]?.error).toBe('Unknown Worker Error');

    resetWorkerState();
  });
});
