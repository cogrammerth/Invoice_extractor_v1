import { Eye, Loader2, Search } from 'lucide-react';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { ExtractionDetailModal } from '../components/extraction-detail-modal';
import { useApi } from '../hooks/use-api';
import type { ExtractionRow } from '../types/invoice.types';
import { ApiClientError } from '../types/api.types';
import { formatDate } from '../utils/format';

const PAGE_SIZE = 10;

export function ListPage(): ReactElement {
  const api = useApi();
  const [rows, setRows] = useState<ExtractionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<ExtractionRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { extractions } = await api.listExtractions(100);
      setRows([...extractions]);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toast.error(err.message);
      } else {
        toast.error('Failed to load extractions');
      }
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length === 0) {
      return rows;
    }
    return rows.filter(
      (r) =>
        r.invoiceNumber.toLowerCase().includes(q) ||
        r.custCode.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const slice = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const openDetail = async (row: ExtractionRow): Promise<void> => {
    try {
      const { extraction } = await api.getExtraction(row.id);
      setSelected(extraction);
    } catch {
      setSelected(row);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-brand-900">Extraction history</h2>
          <p className="mt-1 text-sm text-muted">
            Your saved extractions from the API.
          </p>
        </div>
        <label className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Filter by invoice or cust code"
            className="w-full rounded-lg border border-border py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" aria-hidden />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <p className="text-muted">
            {rows.length === 0
              ? 'No extractions yet. Upload an invoice to get started.'
              : 'No matches for your search.'}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Invoice #</th>
                  <th className="px-4 py-3 font-medium">Cust code</th>
                  <th className="px-4 py-3 font-medium">Net total</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {slice.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border last:border-0 hover:bg-slate-50/80"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-mono font-medium">
                      {row.invoiceNumber}
                    </td>
                    <td className="px-4 py-3 font-mono">{row.custCode}</td>
                    <td className="px-4 py-3 font-mono">
                      {row.extractionData.net_total ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void openDetail(row)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-brand-600 hover:bg-brand-50"
                      >
                        <Eye className="h-4 w-4" aria-hidden />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={safePage <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-muted">
                Page {safePage + 1} of {pageCount}
              </span>
              <button
                type="button"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      <ExtractionDetailModal
        extraction={selected}
        onClose={() => setSelected(null)}
      />
    </section>
  );
}
