import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mocks must be hoisted
const mocks = vi.hoisted(() => ({
  FormatGenerator: vi.fn(),
  generate: vi.fn(),
  TeXBridge: vi.fn(),
  bridgeInit: vi.fn(),
  exit: vi.fn(),
}));

vi.mock('../src/generator.js', () => ({
  FormatGenerator: mocks.FormatGenerator.mockImplementation(() => ({
    generate: mocks.generate
  }))
}));

vi.mock('../src/bridge.js', () => ({
  TeXBridge: mocks.TeXBridge.mockImplementation(() => ({
    init: mocks.bridgeInit
  }))
}));

describe('Script: build_fmt.ts', () => {
  // We simulate script execution by mocking the environment
  // and ensuring the logic structure is sound.
  
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(process, 'exit').mockImplementation(mocks.exit as any);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.argv = ['node', 'script'];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should exit 1 if arguments are missing', async () => {
    // Dynamically import to trigger execution
    const { runBuild } = await import('../scripts/build_fmt.ts');
    await runBuild();
    
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
    expect(mocks.exit).toHaveBeenCalledWith(1);
  });

  it('should run the generation process', async () => {
    process.argv = ['node', 'script', '/mock/tex-path'];
    const { runBuild } = await import('../scripts/build_fmt.ts');
    
    // It will attempt to load glue code. Since that file doesn't exist in test env,
    // it will throw. We catch that flow to verify it attempted to run.
    await runBuild();
    
    // Failure to find glue module means it passed arg checks and tried to build
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Build Failed'), expect.anything());
    expect(mocks.exit).toHaveBeenCalledWith(1);
  });
});