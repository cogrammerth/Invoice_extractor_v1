/**
 * Use DATABASE_PUBLIC_URL when DATABASE_URL points at Railway internal host
 * (scripts run on your PC cannot resolve postgres.railway.internal).
 */

export function resolveDatabaseUrl(env = process.env) {
  const internal = env.DATABASE_URL ?? '';
  const publicUrl = env.DATABASE_PUBLIC_URL ?? '';

  if (
    publicUrl.length > 0 &&
    (internal.includes('railway.internal') || internal.length === 0)
  ) {
    return publicUrl;
  }
  return internal;
}
