-- Thai invoice extraction persistence (MVP)
-- Apply with: npm run db:migrate
-- Requires: PostgreSQL 13+ (gen_random_uuid)

CREATE TABLE IF NOT EXISTS extractions (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    TEXT        NOT NULL,
  request_id                 TEXT,
  invoice_number             TEXT        NOT NULL,
  cust_code                  TEXT        NOT NULL,
  extraction_data            JSONB       NOT NULL,
  tokens_input               INTEGER     NOT NULL,
  tokens_output              INTEGER     NOT NULL,
  tokens_total               INTEGER     NOT NULL,
  duration_ms                INTEGER     NOT NULL,
  slow                       BOOLEAN     NOT NULL DEFAULT FALSE,
  model_name                 TEXT        NOT NULL,
  source_mime_type           TEXT        NOT NULL,
  source_original_filename   TEXT        NOT NULL,
  source_file_size_bytes     INTEGER     NOT NULL CHECK (source_file_size_bytes >= 0),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extractions_invoice_number
  ON extractions (invoice_number);

CREATE INDEX IF NOT EXISTS idx_extractions_user_created
  ON extractions (user_id, created_at DESC);
