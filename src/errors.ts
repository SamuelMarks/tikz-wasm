export class TikzCompilationError extends Error {
  public logs: string[];

  constructor(message: string, logs: string[]) {
    super(message);
    this.name = 'TikzCompilationError';
    this.logs = logs;
  }
}

export class TikzInitializationError extends Error {
  constructor(reason: string) {
    super(`Failed to initialize TikZ Engine: ${reason}`);
    this.name = 'TikzInitializationError';
  }
}