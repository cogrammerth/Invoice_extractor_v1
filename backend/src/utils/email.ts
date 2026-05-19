/**
 * Email normalization and optional domain allowlist checks.
 */

const EMAIL_REGEX =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

/**
 * Lowercase and trim email for storage and lookup.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmailFormat(email: string): boolean {
  const normalized = normalizeEmail(email);
  return normalized.length >= 3 && normalized.length <= 320 && EMAIL_REGEX.test(normalized);
}

/**
 * Returns domain part after @, or null if invalid.
 */
export function emailDomain(email: string): string | null {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf('@');
  if (at < 1 || at === normalized.length - 1) {
    return null;
  }
  return normalized.slice(at + 1);
}

/**
 * When `allowedDomains` is empty, any domain is permitted.
 */
export function isEmailDomainAllowed(
  email: string,
  allowedDomains: readonly string[],
): boolean {
  if (allowedDomains.length === 0) {
    return true;
  }
  const domain = emailDomain(email);
  if (domain === null) {
    return false;
  }
  const normalizedAllowed = allowedDomains.map((d) => d.trim().toLowerCase()).filter(Boolean);
  return normalizedAllowed.includes(domain);
}
