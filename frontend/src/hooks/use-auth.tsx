import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactElement,
  type ReactNode,
} from 'react';

import type { UserRole } from '../types/auth.types';
import { useLocalStorage } from './use-local-storage';

const TOKEN_STORAGE_KEY = 'thai_invoice_jwt';

interface JwtPayloadPartial {
  sub?: unknown;
  email?: unknown;
  role?: unknown;
}

export interface AuthContextValue {
  readonly token: string;
  readonly isAuthenticated: boolean;
  readonly userId: string | null;
  readonly email: string | null;
  readonly role: UserRole | null;
  setToken: (token: string) => void;
  clearToken: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeJwtPayload(token: string): JwtPayloadPartial | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  try {
    const payload = parts[1];
    if (payload === undefined) {
      return null;
    }
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as JwtPayloadPartial;
  } catch {
    return null;
  }
}

function parseRole(value: unknown): UserRole | null {
  if (value === 'admin' || value === 'operator' || value === 'viewer') {
    return value;
  }
  return null;
}

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const [token, setTokenRaw, clearToken] = useLocalStorage(TOKEN_STORAGE_KEY);

  const setToken = useCallback(
    (value: string) => {
      setTokenRaw(value.trim());
    },
    [setTokenRaw],
  );

  const claims = useMemo(
    () => (token.length > 0 ? decodeJwtPayload(token) : null),
    [token],
  );

  const userId = useMemo(() => {
    const sub = claims?.sub;
    return typeof sub === 'string' && sub.length > 0 ? sub : null;
  }, [claims]);

  const email = useMemo(() => {
    const e = claims?.email;
    return typeof e === 'string' && e.length > 0 ? e : null;
  }, [claims]);

  const role = useMemo(() => parseRole(claims?.role), [claims]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      isAuthenticated: token.length > 0,
      userId,
      email,
      role,
      setToken,
      clearToken,
    }),
    [token, userId, email, role, setToken, clearToken],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
