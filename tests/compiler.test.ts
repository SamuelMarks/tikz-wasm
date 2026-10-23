/**
 * Unit tests for {@link TikzCompiler}.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TikzCompiler } from '../src/compiler.js';
import type { CompileJob, CompileResult } from '../src/types.js';

class MockWorker {
  static instances: MockWorker[] = [];
  readonly url: string | URL;
  readonly options: WorkerOptions | undefined;
  onmessage: ((e: MessageEvent<CompileResult>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  readonly postMessage = vi.fn();
  readonly terminate = vi.fn();

  constructor(url: string | URL, options?: WorkerOptions) {
    this.url = url;
    this.options = options;
    MockWorker.instances.push(this);
  }
}

describe('TikzCompiler', () => {
  const testGlobals = globalThis as unknown as Record<string, unknown>;
  const originalWorker = testGlobals['Worker'];

  beforeEach(() => {
    MockWorker.instances = [];
    testGlobals['Worker'] = MockWorker;
  });

  afterEach(() => {
    testGlobals['Worker'] = originalWorker;
  });

  it('should spawn a Worker with custom workerScriptUrl or default URL', () => {
    const c1 = new TikzCompiler('blob:custom-worker');
    expect(c1).toBeDefined();
    expect(MockWorker.instances[0]?.url).toBe('blob:custom-worker');

    const c2 = new TikzCompiler();
    expect(c2).toBeDefined();
    expect(String(MockWorker.instances[1]?.url)).toContain('worker.ts');
  });

  it('should post CompileJob with optional binaries and resolve when matching id arrives', async () => {
    const compiler = new TikzCompiler('blob:worker');
    const worker = MockWorker.instances[0]!;
    const wasm = new Uint8Array([1]);
    const fmt = new Uint8Array([2]);

    const promise = compiler.compile('source', wasm, fmt);
    expect(worker.postMessage).toHaveBeenCalledTimes(1);

    const postedJob = (worker.postMessage.mock.calls[0] as unknown[])?.[0] as CompileJob;
    expect(postedJob.source).toBe('source');
    expect(postedJob.wasmBinary).toBe(wasm);
    expect(postedJob.fmtBinary).toBe(fmt);

    // Unrelated job ID should be ignored
    worker.onmessage?.(
      new MessageEvent<CompileResult>('message', {
        data: { id: 'unknown-id', success: true, logs: [] },
      })
    );

    // Matching job ID should resolve the promise
    const expectedResult: CompileResult = {
      id: postedJob.id,
      success: true,
      dvi: new Uint8Array([99]),
      logs: ['ok'],
    };
    worker.onmessage?.(
      new MessageEvent<CompileResult>('message', { data: expectedResult })
    );

    const actual = await promise;
    expect(actual).toEqual(expectedResult);
  });

  it('should fail all pending jobs when worker emits an error event', async () => {
    const compiler = new TikzCompiler('blob:worker');
    const worker = MockWorker.instances[0]!;

    const p1 = compiler.compile('job1');
    const p2 = compiler.compile('job2');

    worker.onerror?.({ message: 'Worker syntax error' } as unknown as ErrorEvent);

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.success).toBe(false);
    expect(r1.error).toBe('Worker syntax error');
    expect(r2.success).toBe(false);

    // Fallback error message when e.message is empty
    const p3 = compiler.compile('job3');
    worker.onerror?.({ message: '' } as unknown as ErrorEvent);
    const r3 = await p3;
    expect(r3.error).toBe('Unhandled Web Worker error');
  });

  it('should fail pending jobs and terminate underlying worker on terminate()', async () => {
    const compiler = new TikzCompiler('blob:worker');
    const worker = MockWorker.instances[0]!;

    const pending = compiler.compile('pending-job');
    compiler.terminate();

    const result = await pending;
    expect(result.success).toBe(false);
    expect(result.error).toBe('Compiler worker terminated');
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });
});
