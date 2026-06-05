/**
 * Resolves API base URL: runtime-config.json → Vite build env → Railway production default → localhost dev.
 */

import { PRODUCTION_API_URL } from './production-urls.js';

let resolvedBase: string | null = null;

function isRailwayUiHost(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.location.hostname.endsWith('.up.railway.app')
  );
}

function normalizeBase(url: string): string {
  return url.replace(/\/$/, '');
}

export async function initApiBase(): Promise<string> {
  if (resolvedBase !== null) {
    return resolvedBase;
  }

  let fromRuntime = '';
  try {
    const res = await fetch('/runtime-config.json', { cache: 'no-store' });
    if (res.ok) {
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const json = (await res.json()) as { apiUrl?: string };
        if (typeof json.apiUrl === 'string' && json.apiUrl.trim().length > 0) {
          fromRuntime = normalizeBase(json.apiUrl.trim());
        }
      }
    }
  } catch {
    /* local dev or missing file — use build-time / default */
  }

  const fromBuild =
    typeof import.meta.env.VITE_API_URL === 'string' &&
    import.meta.env.VITE_API_URL.length > 0
      ? normalizeBase(import.meta.env.VITE_API_URL)
      : '';

  const fromProductionDefault =
    isRailwayUiHost() ? normalizeBase(PRODUCTION_API_URL) : '';

  resolvedBase =
    fromRuntime || fromBuild || fromProductionDefault || 'http://localhost:3000';
  return resolvedBase;
}

export function getApiBase(): string {
  if (resolvedBase === null) {
    throw new Error('API base not initialized — call initApiBase() before using the API');
  }
  return resolvedBase;
}
