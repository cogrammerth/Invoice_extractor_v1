import type { ReactElement } from 'react';
import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '../hooks/use-auth';

export function ProtectedRoute(): ReactElement {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
