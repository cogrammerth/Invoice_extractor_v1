/**
 * Resolves API base URL: runtime-config.json (Railway) → Vite build env → localhost dev.
 */

let resolvedBase: string | null = null;

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
      const json = (await res.json()) as { apiUrl?: string };
      if (typeof json.apiUrl === 'string' && json.apiUrl.trim().length > 0) {
        fromRuntime = normalizeBase(json.apiUrl.trim());
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

  resolvedBase = fromRuntime || fromBuild || 'http://localhost:3000';
  return resolvedBase;
}

export function getApiBase(): string {
  if (resolvedBase === null) {
    throw new Error('API base not initialized — call initApiBase() before using the API');
  }
  return resolvedBase;
}
