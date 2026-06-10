export type ErrorCode = 'PARSE_FAILURE' | 'GEMINI_ERROR' | 'VALIDATION_ERROR' | 'INVALID_INPUT';

export class CortexError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
  ) {
    super(message);
    this.name = 'CortexError';
  }
}
