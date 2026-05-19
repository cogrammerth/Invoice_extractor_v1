import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';

import { App } from './App';
import { AuthProvider } from './hooks/use-auth';
import './styles/globals.css';

const rootEl = document.getElementById('root');
if (rootEl === null) {
  throw new Error('Root element #root not found');
}

createRoot(rootEl).render(
  <StrictMode>
    <AuthProvider>
      <App />
      <Toaster position="top-right" richColors closeButton />
    </AuthProvider>
  </StrictMode>,
);
