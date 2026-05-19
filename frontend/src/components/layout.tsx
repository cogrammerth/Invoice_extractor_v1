import { BarChart3, FileText, History, LogOut, Upload } from 'lucide-react';
import type { ReactElement } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../hooks/use-auth';

const navClass = ({ isActive }: { isActive: boolean }): string =>
  [
    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-brand-600 text-white shadow-sm'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  ].join(' ');

export function Layout(): ReactElement {
  const { email, role, clearToken, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const appName = import.meta.env.VITE_APP_NAME ?? 'Thai Invoice Extractor';

  const handleLogout = (): void => {
    clearToken();
    void navigate('/login');
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
              <FileText className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-brand-900">{appName}</h1>
              {isAuthenticated && email !== null && (
                <p className="text-xs text-muted">
                  {email}
                  {role !== null ? ` · ${role}` : ''}
                </p>
              )}
            </div>
          </div>

          {isAuthenticated && (
            <nav className="flex flex-wrap items-center gap-2">
              <NavLink to="/upload" className={navClass}>
                <Upload className="h-4 w-4" aria-hidden />
                Upload
              </NavLink>
              <NavLink to="/extractions" className={navClass}>
                <History className="h-4 w-4" aria-hidden />
                History
              </NavLink>
              <NavLink to="/usage" className={navClass}>
                <BarChart3 className="h-4 w-4" aria-hidden />
                Usage
              </NavLink>
              <button
                type="button"
                onClick={handleLogout}
                className="ml-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-danger"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Sign out
              </button>
            </nav>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>

      <footer className="border-t border-border py-4 text-center text-xs text-muted">
        Thai text preserved exactly as extracted — no translation or correction.
      </footer>
    </div>
  );
}

