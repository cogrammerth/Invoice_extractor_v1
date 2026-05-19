/**
 * Thai invoice extraction — database artifacts
 *
 * Canonical DDL lives in:
 *   `src/db/migrations/001_thai_invoice_extractions.sql`
 *
 * Apply locally:
 *   npm run db:migrate
 */

export const SCHEMA_VERSION = '001_thai_invoice_extractions';

/** Logical table name for documentation and ad-hoc tooling. */
export const EXTRACTIONS_TABLE = 'extractions' as const;
