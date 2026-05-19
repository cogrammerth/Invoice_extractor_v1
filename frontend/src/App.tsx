import type { ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { Layout } from './components/layout';
import { ProtectedRoute } from './components/protected-route';
import { AuthCallbackPage } from './pages/auth-callback-page';
import { LoginPage } from './pages/login-page';
import { ListPage } from './pages/list-page';
import { UploadPage } from './pages/upload-page';
import { UsagePage } from './pages/usage-page';

export function App(): ReactElement {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route element={<Layout />}>
          <Route element={<ProtectedRoute />}>
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/extractions" element={<ListPage />} />
            <Route path="/usage" element={<UsagePage />} />
          </Route>
          <Route path="/" element={<Navigate to="/upload" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/upload" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
