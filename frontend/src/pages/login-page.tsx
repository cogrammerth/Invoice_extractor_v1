import { Building2, KeyRound, Loader2, Lock, Mail } from 'lucide-react';
import type { FormEvent, ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useAuth } from '../hooks/use-auth';
import { useApi } from '../hooks/use-api';
import { API_BASE } from '../services/api';
import { ApiClientError } from '../types/api.types';
import type { AuthProviders } from '../types/auth.types';

export function LoginPage(): ReactElement {
  const { setToken, isAuthenticated } = useAuth();
  const api = useApi();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  const [loadingProviders, setLoadingProviders] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      void navigate('/upload', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.getAuthProviders();
        if (!cancelled) {
          setProviders(data);
        }
      } catch {
        if (!cancelled) {
          setProviders({
            emailPassword: true,
            microsoft: false,
            google: false,
            allowedEmailDomains: [],
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingProviders(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const handleEmailLogin = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (trimmedEmail.length === 0 || password.length === 0) {
      toast.error('Email and password are required');
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.loginWithEmail(trimmedEmail, password);
      setToken(result.accessToken);
      toast.success(`Welcome, ${result.user.email}`);
      void navigate('/upload');
    } catch (err) {
      if (err instanceof ApiClientError) {
        toast.error(err.message);
      } else {
        toast.error('Sign-in failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const startOAuth = (provider: 'microsoft' | 'google'): void => {
    window.location.href = `${API_BASE}/api/auth/oauth/${provider}`;
  };

  const domainHint =
    providers !== null && providers.allowedEmailDomains.length > 0
      ? `Use your work email (@${providers.allowedEmailDomains.join(', @')})`
      : 'Use your organizational email address';

  return (
    <section className="mx-auto max-w-lg">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
          <KeyRound className="h-6 w-6" aria-hidden />
        </div>
        <h2 className="text-2xl font-semibold text-brand-900">Sign in</h2>
        <p className="mt-2 text-sm text-muted">
          Email and password, or sign in with your organization account.
        </p>

        <form onSubmit={(e) => void handleEmailLogin(e)} className="mt-6 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Option 1 — Email & password
          </p>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <div className="relative mt-1">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                type="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                autoComplete="email"
                className="w-full rounded-lg border border-border py-2 pl-10 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                placeholder="you@company.com"
              />
            </div>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <div className="relative mt-1">
              <Lock
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                type="password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                autoComplete="current-password"
                className="w-full rounded-lg border border-border py-2 pl-10 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                placeholder="••••••••"
              />
            </div>
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Signing in…
              </>
            ) : (
              'Sign in with email'
            )}
          </button>
        </form>

        {!loadingProviders && providers !== null && (providers.microsoft || providers.google) && (
          <div className="mt-8 border-t border-border pt-6">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Building2 className="h-4 w-4" aria-hidden />
              Option 2 — Organization account
            </p>
            <p className="mt-1 text-xs text-muted">{domainHint}</p>
            <div className="mt-4 flex flex-col gap-2">
              {providers.microsoft && (
                <button
                  type="button"
                  onClick={() => startOAuth('microsoft')}
                  className="rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  Sign in with Microsoft
                </button>
              )}
              {providers.google && (
                <button
                  type="button"
                  onClick={() => startOAuth('google')}
                  className="rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  Sign in with Google
                </button>
              )}
            </div>
          </div>
        )}

        {loadingProviders && (
          <p className="mt-6 flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading sign-in options…
          </p>
        )}
      </div>
    </section>
  );
}
