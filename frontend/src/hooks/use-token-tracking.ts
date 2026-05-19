import { useCallback, useEffect, useState } from 'react';

import { useApi } from './use-api';
import type { TokenUsageData } from '../types/invoice.types';
import { ApiClientError } from '../types/api.types';

export interface UseTokenTrackingResult {
  readonly usage: TokenUsageData | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
}

export function useTokenTracking(periodDays: number): UseTokenTrackingResult {
  const api = useApi();
  const [usage, setUsage] = useState<TokenUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTokenUsage(periodDays);
      setUsage(data);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to load token usage');
      }
      setUsage(null);
    } finally {
      setLoading(false);
    }
  }, [api, periodDays]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { usage, loading, error, refresh };
}
