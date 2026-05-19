import type { ExtractionRow, TokenUsageData, UploadSuccessData } from './invoice.types';

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiErrorBody {
  success: false;
  error: {
    type?: string;
    code: string;
    message: string;
    fieldErrors?: ReadonlyArray<{ field: string; message: string }>;
  };
}

export type ListExtractionsResponse = ApiSuccess<{
  extractions: ExtractionRow[];
}>;

export type GetExtractionResponse = ApiSuccess<{
  extraction: ExtractionRow;
}>;

export type UploadResponse = ApiSuccess<UploadSuccessData>;

export type TokenUsageResponse = ApiSuccess<TokenUsageData>;

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: ReadonlyArray<{ field: string; message: string }>;

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors?: ReadonlyArray<{ field: string; message: string }>,
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}
