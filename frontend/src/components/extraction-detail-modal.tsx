import { Copy, X } from 'lucide-react';
import type { ReactElement } from 'react';
import { useCallback } from 'react';
import { toast } from 'sonner';

import type { ExtractionRow } from '../types/invoice.types';
import { formatDate, formatDuration } from '../utils/format';
import { SourceImagePanel } from './source-image-panel';

interface ExtractionDetailModalProps {
  extraction: ExtractionRow | null;
  onClose: () => void;
}

const FIELD_LABELS: ReadonlyArray<{ key: keyof ExtractionRow['extractionData']; label: string }> = [
  { key: 'corner_no', label: 'Corner No.' },
  { key: 'e_tax_flag', label: 'E-TAX' },
  { key: 'invoice_number', label: 'Invoice Number' },
  { key: 'cust_code', label: 'Customer Code' },
  { key: 'currency', label: 'Currency' },
  { key: 'payment_method', label: 'Payment Method' },
  { key: 'net_total', label: 'Net Total' },
  { key: 'delivery_instructions', label: 'Delivery Instructions' },
  { key: 'received_by', label: 'Received By' },
  { key: 'delivery_by', label: 'Delivery By' },
  { key: 'stamp', label: 'Stamp' },
];

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'string') {
    return value.length > 0 ? value : '—';
  }
  return JSON.stringify(value, null, 2);
}

export function ExtractionDetailModal({
  extraction,
  onClose,
}: ExtractionDetailModalProps): ReactElement | null {
  const handleCopyJson = useCallback(async () => {
    if (extraction === null) {
      return;
    }
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(extraction.extractionData, null, 2),
      );
      toast.success('Copied JSON to clipboard');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }, [extraction]);

  if (extraction === null) {
    return null;
  }

  const data = extraction.extractionData;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="extraction-detail-title"
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 id="extraction-detail-title" className="text-lg font-semibold">
              {data.invoice_number}
            </h2>
            <p className="text-sm text-muted">
              {formatDate(extraction.createdAt)} · {formatDuration(extraction.durationMs)}
              {extraction.slow && ' · slow'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleCopyJson()}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              <Copy className="h-4 w-4" aria-hidden />
              Copy JSON
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-muted hover:bg-slate-100"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: 'calc(90vh - 4rem)' }}>
          <SourceImagePanel
            extractionId={extraction.id}
            hasStoredFile={
              extraction.filePath !== null && extraction.filePath.length > 0
            }
            className="mb-4"
          />
          <dl className="grid gap-3 sm:grid-cols-2">
            {FIELD_LABELS.map(({ key, label }) => (
              <div key={key} className="rounded-lg border border-border bg-surface px-3 py-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                  {label}
                </dt>
                <dd className="mt-1 font-mono text-sm break-words text-slate-900">
                  {formatCellValue(data[key])}
                </dd>
              </div>
            ))}
            <div className="rounded-lg border border-border bg-surface px-3 py-2 sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Pages</dt>
              <dd className="mt-1 font-mono text-sm">
                {data.pages.value} (last page: {data.pages.is_last_page ? 'yes' : 'no'})
              </dd>
            </div>
            {data.payment_details !== null && (
              <div className="rounded-lg border border-border bg-surface px-3 py-2 sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                  Payment Details
                </dt>
                <dd className="mt-1 font-mono text-sm whitespace-pre-wrap">
                  {formatCellValue(data.payment_details)}
                </dd>
              </div>
            )}
            {data.item_descriptions.length > 0 && (
              <div className="rounded-lg border border-border bg-surface px-3 py-2 sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                  Item Descriptions
                </dt>
                <dd className="mt-1">
                  <ul className="list-inside list-disc space-y-1 font-mono text-sm">
                    {data.item_descriptions.map((item, i) => (
                      <li key={`${i}-${item.slice(0, 24)}`}>{item}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
          </dl>

          <p className="mt-4 text-xs text-muted">
            Tokens: {extraction.tokensInput} in / {extraction.tokensOutput} out (
            {extraction.tokensTotal} total) · Model: {extraction.modelName}
          </p>
        </div>
      </div>
    </div>
  );
}


