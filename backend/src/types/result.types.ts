/**
 * Result<T, E> Discriminated Union
 *
 * Path: backend/src/types/result.types.ts
 *
 * Canonical return shape for every service method in the codebase.
 *
 * Per `.cursor/rules/00-core.md`:
 *   "Functions should return a discriminated Result<T> union rather than
 *    throwing for expected failures."
 *
 * Throwing remains valid for *unexpected* failures (programmer error,
 * unrecoverable infrastructure failure). Every business-level outcome —
 * validation errors, upstream API failures, malformed responses — flows
 * through this type so callers must explicitly handle both branches.
 *
 * The `E` type parameter defaults to `string` (matches the example in
 * `00-core.md`) but can be tightened to a domain-specific error type, e.g.
 * `Result<ThaiInvoiceExtraction, ExtractionError>`.
 *
 * @example Success branch
 *   const r: Result<number> = ok(42);
 *   if (r.success) console.log(r.data); // 42
 *
 * @example Failure branch with custom error type
 *   const r: Result<User, ExtractionError> = err({
 *     type: 'VALIDATION_ERROR',
 *     message: 'invoice_number missing',
 *     retryable: false,
 *   });
 *   if (!r.success) logger.error(r.error.message);
 */
export type Result<T = unknown, E = string> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

/**
 * Construct a successful Result.
 *
 * @example
 *   return ok(parsedInvoice);
 */
export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

/**
 * Construct a failed Result.
 *
 * @example
 *   return err('Invoice number is required');
 *   return err<ExtractionError>({ type: 'TIMEOUT', ... });
 */
export function err<E = string>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Type guard for the success branch. Useful in `.filter()` chains.
 *
 * @example
 *   const successes = results.filter(isOk);
 */
export function isOk<T, E>(
  result: Result<T, E>,
): result is { readonly success: true; readonly data: T } {
  return result.success;
}

/**
 * Type guard for the failure branch.
 *
 * @example
 *   const failures = results.filter(isErr);
 */
export function isErr<T, E>(
  result: Result<T, E>,
): result is { readonly success: false; readonly error: E } {
  return !result.success;
}
