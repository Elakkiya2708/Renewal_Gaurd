-- ============================================================================
-- RenewalHub — Supabase PostgreSQL schema (private per-user workspaces)
-- Fresh install: run this whole script in the Supabase SQL Editor.
-- Existing database from the old role-based version: run
-- supabase/migrations/20261101_private_workspaces.sql instead.
--
-- SECURITY MODEL: only the Node server talks to the database, using the
-- SERVICE ROLE key (SUPABASE_SERVICE_ROLE_KEY). Row Level Security is enabled
-- with NO public policies, so the public "anon" key cannot read or write
-- anything. The server enforces ownership (owner_id = authenticated user).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS app_users (
  id VARCHAR(100) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),
  password VARCHAR(255),
  mobile VARCHAR(50),
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS renewals (
  id VARCHAR(100) PRIMARY KEY,
  owner_id VARCHAR(100) NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_by VARCHAR(255),
  code VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  organization VARCHAR(255),
  description TEXT,
  reference_number VARCHAR(100),
  issue_date DATE,
  expiry_date DATE NOT NULL,
  reminder_date DATE,
  cost NUMERIC(15, 2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'USD',
  priority VARCHAR(20) DEFAULT 'Medium',
  status VARCHAR(30),
  recurring_cycle VARCHAR(50) DEFAULT 'Yearly',
  notes TEXT,
  reminder_completed BOOLEAN DEFAULT FALSE,
  last_renewed_at DATE,
  documents JSONB DEFAULT '[]'::jsonb,
  history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_renewals_owner ON renewals(owner_id);
CREATE INDEX IF NOT EXISTS idx_renewals_owner_expiry ON renewals(owner_id, expiry_date);

CREATE TABLE IF NOT EXISTS reminder_logs (
  id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_id VARCHAR(100) REFERENCES app_users(id) ON DELETE CASCADE,
  renewal_id VARCHAR(100) NOT NULL,
  renewal_name VARCHAR(255) NOT NULL,
  reminder_interval VARCHAR(50) NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  expiry_date DATE NOT NULL,
  days_remaining INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL,
  delivery_provider VARCHAR(50),
  message_id VARCHAR(255),
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_owner ON reminder_logs(owner_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_lookup ON reminder_logs(renewal_id, reminder_interval, expiry_date);

CREATE TABLE IF NOT EXISTS password_resets (
  id VARCHAR(100) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(128) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- One row per user (id = app_users.id)
CREATE TABLE IF NOT EXISTS notification_settings (
  id VARCHAR(100) PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  email_notifications_enabled BOOLEAN DEFAULT TRUE,
  reminder_days JSONB DEFAULT '[30, 15, 7, 0]'::jsonb,
  default_recipient_email VARCHAR(255) DEFAULT '',
  send_on_expiry_day BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS on, no policies => anon/authenticated roles have no access. service_role bypasses RLS.
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE renewals ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
