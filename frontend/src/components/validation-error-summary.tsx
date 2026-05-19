import { AlertCircle } from 'lucide-react';
import type { ReactElement } from 'react';

export interface FieldErrorItem {
  readonly field: string;
  readonly message: string;
}

interface ValidationErrorSummaryProps {
  readonly title?: string;
  readonly errors: ReadonlyArray<FieldErrorItem>;
  readonly className?: string;
}

function formatFieldLabel(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Displays API field-level validation errors (e.g. from extraction VALIDATION_ERROR).
 */
export function ValidationErrorSummary({
  title = 'Validation failed',
  errors,
  className = '',
}: ValidationErrorSummaryProps): ReactElement | null {
  if (errors.length === 0) {
    return null;
  }

  return (
    <div
      role="alert"
      className={[
        'rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900',
        className,
      ].join(' ')}
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden />
        <div>
          <p className="font-semibold">{title}</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {errors.map((err) => (
              <li key={`${err.field}:${err.message}`}>
                <span className="font-medium">{formatFieldLabel(err.field)}</span>
                {' — '}
                {err.message}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
