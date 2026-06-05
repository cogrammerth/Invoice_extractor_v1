/** Railway `invoiceExtractor` production URLs (see `.cursor/railway.md`). */
export const PRODUCTION_API_URL =
  'https://invoice-api-production-3d13.up.railway.app';

export const PRODUCTION_UI_URL =
  'https://invoice-ui-production-4c66.up.railway.app';

export const PRODUCTION_AUTH_CALLBACK_URL = `${PRODUCTION_UI_URL}/auth/callback`;

const LOCAL_DEV_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
]);

export function isRunningOnRailway(): boolean {
  return Boolean(
    process.env['RAILWAY_ENVIRONMENT'] ||
      process.env['RAILWAY_PROJECT_ID'] ||
      process.env['RAILWAY_SERVICE_ID'],
  );
}

function isLocalDevUrl(url: string): boolean {
  if (LOCAL_DEV_ORIGINS.has(url)) {
    return true;
  }
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

/**
 * Prefer explicit env values; on Railway, replace leftover localhost defaults with production URLs.
 */
export function resolveDeploymentUrl(
  explicit: string | undefined,
  productionDefault: string,
  localDefault: string,
): string {
  const trimmed = explicit?.trim();
  const onRailway = isRunningOnRailway();
  const useProduction = onRailway || process.env['NODE_ENV'] === 'production';

  if (trimmed !== undefined && trimmed.length > 0) {
    if (onRailway && isLocalDevUrl(trimmed)) {
      return productionDefault;
    }
    return trimmed;
  }

  return useProduction ? productionDefault : localDefault;
}
