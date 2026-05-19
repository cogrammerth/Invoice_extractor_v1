/**
 * HTTP-facing application error (no env / logging imports).
 * Used by routes and auth middleware; the global error handler maps it to JSON.
 */

export class HttpResponseError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  public constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'HttpResponseError';
    this.statusCode = statusCode;
    this.code = code;
  }
}
