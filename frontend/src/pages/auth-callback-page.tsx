import { Loader2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { useAuth } from '../hooks/use-auth';

export function AuthCallbackPage(): ReactElement {
  const [params] = useSearchParams();
  const { setToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const error = params.get('error');
    if (error !== null && error.length > 0) {
      toast.error(`Sign-in failed: ${error}`);
      void navigate('/login', { replace: true });
      return;
    }

    const accessToken = params.get('accessToken');
    if (accessToken === null || accessToken.length === 0) {
      toast.error('Missing access token from sign-in');
      void navigate('/login', { replace: true });
      return;
    }

    setToken(accessToken);
    toast.success('Signed in with your organization account');
    void navigate('/upload', { replace: true });
  }, [params, setToken, navigate]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted">
      <Loader2 className="h-8 w-8 animate-spin text-brand-600" aria-hidden />
      <p className="text-sm">Completing sign-in…</p>
    </div>
  );
}
