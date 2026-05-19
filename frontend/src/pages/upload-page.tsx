import { Check, Copy, ImageUp, Loader2 } from 'lucide-react';
import type { DragEvent, ReactElement } from 'react';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useApi } from '../hooks/use-api';
import type { UploadSuccessData } from '../types/invoice.types';
import { ApiClientError } from '../types/api.types';
import { SourceImagePanel } from '../components/source-image-panel';
import { ValidationErrorSummary } from '../components/validation-error-summary';
import { validateInvoiceFile } from '../utils/file-validation';
import { formatDuration } from '../utils/format';

export function UploadPage(): ReactElement {
  const api = useApi();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<UploadSuccessData | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    ReadonlyArray<{ field: string; message: string }>
  >([]);

  const runUpload = useCallback(
    async (file: File) => {
      const validation = validateInvoiceFile(file);
      if (!validation.valid) {
        toast.error(validation.message ?? 'Invalid file');
        return;
      }

      if (previewUrl !== null) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setFieldErrors([]);
      setUploading(true);
      setProgress(0);

      try {
        const data = await api.uploadInvoice(file, setProgress);
        setResult(data);
        toast.success('Extraction complete');
      } catch (err: unknown) {
        if (err instanceof ApiClientError) {
          if (err.fieldErrors !== undefined && err.fieldErrors.length > 0) {
            setFieldErrors(err.fieldErrors);
          }
          if (err.status === 401) {
            toast.error('Session expired — sign in again');
          } else if (err.status === 429) {
            toast.error('Rate limit reached. Wait a few minutes and try again.');
          } else if (err.fieldErrors === undefined || err.fieldErrors.length === 0) {
            toast.error(err.message);
          }
        } else {
          toast.error('Upload failed');
        }
      } finally {
        setUploading(false);
      }
    },
    [api, previewUrl],
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file !== undefined) {
        void runUpload(file);
      }
    },
    [runUpload],
  );

  const copyJson = async (): Promise<void> => {
    if (result === null) {
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(result.data, null, 2));
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-brand-900">Upload invoice</h2>
        <p className="mt-1 text-sm text-muted">
          JPEG, PNG, or WebP — max 20 MB. Thai text is preserved exactly as printed.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={[
          'relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 transition-colors',
          dragOver ? 'border-brand-500 bg-brand-50' : 'border-border bg-card hover:border-brand-300',
          uploading ? 'pointer-events-none opacity-80' : '',
        ].join(' ')}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file !== undefined) {
              void runUpload(file);
            }
            e.target.value = '';
          }}
        />
        {uploading ? (
          <Loader2 className="h-10 w-10 animate-spin text-brand-600" aria-hidden />
        ) : (
          <ImageUp className="h-10 w-10 text-brand-600" aria-hidden />
        )}
        <p className="mt-3 text-center font-medium">
          {uploading ? 'Extracting…' : 'Drag & drop or click to choose'}
        </p>
        {uploading && (
          <div className="mt-4 w-full max-w-xs">
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-brand-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-center text-xs text-muted">{progress}%</p>
          </div>
        )}
      </div>

      <ValidationErrorSummary errors={fieldErrors} className="max-w-2xl" />

      <div className="grid gap-8 lg:grid-cols-2">
        {previewUrl !== null && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-2 text-sm font-medium text-muted">Preview</h3>
            <img
              src={previewUrl}
              alt="Uploaded invoice preview"
              className="max-h-80 w-full rounded-lg object-contain"
            />
          </div>
        )}

        {result !== null && (
          <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-success">
                <Check className="h-5 w-5" aria-hidden />
                <span className="font-semibold">Extraction successful</span>
              </div>
              <button
                type="button"
                onClick={() => void copyJson()}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                <Copy className="h-4 w-4" aria-hidden />
                Copy JSON
              </button>
            </div>
            <SourceImagePanel
              extractionId={result.extractionId}
              hasStoredFile
              title="Stored upload (server)"
              className="mt-4"
            />
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-muted">Invoice #</dt>
                <dd className="font-mono font-medium">{result.data.invoice_number}</dd>
              </div>
              <div>
                <dt className="text-muted">Cust code</dt>
                <dd className="font-mono font-medium">{result.data.cust_code}</dd>
              </div>
              <div>
                <dt className="text-muted">Net total</dt>
                <dd className="font-mono">{result.data.net_total ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted">Duration</dt>
                <dd>
                  {formatDuration(result.durationMs)}
                  {result.slow && (
                    <span className="ml-1 text-amber-600">(slow)</span>
                  )}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted">Tokens</dt>
                <dd className="font-mono">
                  {result.tokensUsed.input} in / {result.tokensUsed.output} out (
                  {result.tokensUsed.total} total)
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted">Extraction ID</dt>
                <dd className="font-mono text-xs break-all">{result.extractionId}</dd>
              </div>
            </dl>
            <pre className="mt-4 max-h-96 overflow-auto rounded-lg bg-slate-900 p-4 font-mono text-xs text-slate-100">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </section>
  );
}
