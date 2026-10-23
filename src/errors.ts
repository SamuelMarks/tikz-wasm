/**
 * Domain error hierarchy for TikZ compilation, initialization, and DVI parsing failures.
 *
 * @packageDocumentation
 */

/**
 * Error thrown when the TeX engine fails to compile a TikZ document or produces invalid DVI output.
 */
export class TikzCompilationError extends Error {
  /**
   * Diagnostic log lines captured from the TeX engine during compilation.
   */
  public readonly logs: readonly string[];

  /**
   * Creates a new {@link TikzCompilationError}.
   *
   * @param message - High-level summary of the compilation failure.
   * @param logs - Array of TeX engine log lines.
   */
  constructor(message: string, logs: readonly string[]) {
    super(message);
    this.name = 'TikzCompilationError';
    this.logs = [...logs];
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when the TikZ WebAssembly runtime or Web Worker fails to initialize.
 */
export class TikzInitializationError extends Error {
  /**
   * Creates a new {@link TikzInitializationError}.
   *
   * @param reason - Detailed description of why initialization failed.
   */
  constructor(reason: string) {
    super(`Failed to initialize TikZ Engine: ${reason}`);
    this.name = 'TikzInitializationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
