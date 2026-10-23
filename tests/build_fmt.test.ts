/**
 * Unit tests for `scripts/build_fmt.ts`.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  FormatGenerator: vi.fn(),
  generate: vi.fn(),
  TeXBridge: vi.fn(),
  bridgeInit: vi.fn(),
  exit: vi.fn(),
}));

vi.mock('../src/generator.js', () => ({
  FormatGenerator: mocks.FormatGenerator.mockImplementation(function () {
    return {
      generate: mocks.generate,
    };
  }),
}));

vi.mock('../src/bridge.js', () => ({
  TeXBridge: mocks.TeXBridge.mockImplementation(function () {
    return {
      init: mocks.bridgeInit,
    };
  }),
}));

import { runBuild, ensureBrowserGlobals, defaultGlueImporter } from '../scripts/build_fmt.js';

describe('Script: build_fmt.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'exit').mockImplementation(mocks.exit as unknown as (code?: string | number | null) => never);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should polyfill window and self on target object when missing', () => {
    const target: Record<string, unknown> = {};
    ensureBrowserGlobals(target);
    expect(target['window']).toBe(target);
    expect(target['self']).toBe(target);

    // Calling again when already defined should preserve existing values
    const existingWindow = { custom: true };
    const existingSelf = { worker: true };
    const populated: Record<string, unknown> = { window: existingWindow, self: existingSelf };
    ensureBrowserGlobals(populated);
    expect(populated['window']).toBe(existingWindow);
    expect(populated['self']).toBe(existingSelf);
  });

  it('should exit 1 if CLI arguments are missing', async () => {
    await runBuild([]);

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
    expect(mocks.exit).toHaveBeenCalledWith(1);
  });

  it('should execute full format generation workflow when glue exports a valid factory', async () => {
    const fakeFactory = vi.fn();
    mocks.bridgeInit.mockResolvedValue(undefined);
    mocks.generate.mockResolvedValue(undefined);

    await runBuild(['/mock/texlive'], async () => ({ default: fakeFactory }));

    expect(mocks.TeXBridge).toHaveBeenCalledTimes(1);
    expect(mocks.bridgeInit).toHaveBeenCalledWith(fakeFactory);
    expect(mocks.FormatGenerator).toHaveBeenCalledWith(expect.anything(), '/mock/texlive');
    expect(mocks.generate).toHaveBeenCalledWith(expect.stringContaining('tikz.fmt'));
    expect(mocks.exit).not.toHaveBeenCalled();
  });

  it('should fail and exit 1 if glue module does not export a default function', async () => {
    await runBuild(['/mock/texlive'], async () => ({ default: 'not-a-function' }));

    expect(console.error).toHaveBeenCalledWith(
      'Build Failed:',
      expect.objectContaining({
        message: expect.stringContaining('did not export a default factory function'),
      })
    );
    expect(mocks.exit).toHaveBeenCalledWith(1);
  });

  it('should fail and exit 1 when defaultGlueImporter cannot find the module', async () => {
    await expect(defaultGlueImporter('/nonexistent/tex_glue.js')).rejects.toThrow();
  });
});
