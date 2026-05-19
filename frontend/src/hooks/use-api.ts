import { useMemo } from 'react';

import { useAuth } from './use-auth';
import { createApiService, type ApiService } from '../services/api';

export function useApi(): ApiService {
  const { token } = useAuth();
  return useMemo(
    () => createApiService(() => token),
    [token],
  );
}
