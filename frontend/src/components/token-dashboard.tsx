import { Coins, FileStack, Loader2 } from 'lucide-react';
import type { ReactElement } from 'react';

import type { TokenUsageData } from '../types/invoice.types';
import { formatUsd } from '../utils/format';

interface TokenDashboardProps {
  readonly usage: TokenUsageData | null;
  readonly loading: boolean;
  readonly error: string | null;
}

export function TokenDashboard({
  usage,
  loading,
  error,
}: TokenDashboardProps): ReactElement {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card p-10 text-muted">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        Loading usage…
      </div>
    );
  }

  if (error !== null) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800"
      >
        {error}
      </div>
    );
  }

  if (usage === null) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted">
        No usage data available.
      </p>
    );
  }

  const { summary, pricing } = usage;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Aggregated over the last {summary.periodDays} days for your account. Model:{' '}
        <span className="font-mono">{pricing.modelName}</span>.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<FileStack className="h-5 w-5 text-brand-600" aria-hidden />}
          label="Extractions"
          value={String(summary.extractionCount)}
        />
        <StatCard
          icon={<Coins className="h-5 w-5 text-brand-600" aria-hidden />}
          label="Input tokens"
          value={summary.tokensInput.toLocaleString()}
        />
        <StatCard
          icon={<Coins className="h-5 w-5 text-amber-600" aria-hidden />}
          label="Output tokens"
          value={summary.tokensOutput.toLocaleString()}
        />
        <StatCard
          icon={<Coins className="h-5 w-5 text-success" aria-hidden />}
          label="Est. cost (USD)"
          value={formatUsd(summary.estimatedCostUsd)}
          hint={`${pricing.inputCostPerMillionUsd}/M in · ${pricing.outputCostPerMillionUsd}/M out`}
        />
      </div>

      <p className="text-xs text-muted">{pricing.note}</p>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactElement;
  label: string;
  value: string;
  hint?: string;
}): ReactElement {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-muted">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-brand-900">{value}</p>
      {hint !== undefined && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
