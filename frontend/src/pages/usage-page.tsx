import type { ReactElement } from 'react';
import { useState } from 'react';

import { TokenDashboard } from '../components/token-dashboard';
import { useTokenTracking } from '../hooks/use-token-tracking';

const PERIOD_OPTIONS = [7, 30, 90] as const;

export function UsagePage(): ReactElement {
  const [periodDays, setPeriodDays] = useState<number>(30);
  const { usage, loading, error } = useTokenTracking(periodDays);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-brand-900">Token usage</h2>
          <p className="mt-1 text-sm text-muted">
            Claude API token totals and estimated cost for your account.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-muted">Period</span>
          <select
            className="rounded-lg border border-border bg-card px-3 py-2"
            value={periodDays}
            onChange={(e) => {
              const next = Number(e.target.value);
              setPeriodDays(next);
            }}
          >
            {PERIOD_OPTIONS.map((d) => (
              <option key={d} value={d}>
                Last {d} days
              </option>
            ))}
          </select>
        </label>
      </div>

      <TokenDashboard usage={usage} loading={loading} error={error} />
    </section>
  );
}
