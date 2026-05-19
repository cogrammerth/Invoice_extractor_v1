-- Application users (email/password and organizational SSO)
-- Apply with: npm run db:migrate

CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT        NOT NULL,
  password_hash     TEXT,
  role              TEXT        NOT NULL DEFAULT 'operator'
                    CHECK (role IN ('admin', 'operator', 'viewer')),
  auth_provider     TEXT        NOT NULL DEFAULT 'local'
                    CHECK (auth_provider IN ('local', 'microsoft', 'google')),
  external_subject  TEXT,
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_unique UNIQUE (email)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_provider_external
  ON users (auth_provider, external_subject)
  WHERE external_subject IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_email_active
  ON users (email)
  WHERE is_active = TRUE;
