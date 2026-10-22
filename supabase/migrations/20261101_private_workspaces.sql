-- Migrate the old role-based schema to private per-user workspaces. Safe to re-run.
BEGIN;

-- 1. Remove team / invitation / audit tables
DROP TABLE IF EXISTS invitations CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;

-- 2. Users: drop role/status columns and the old seeded demo users
DELETE FROM app_users WHERE email = 'demo@renewaltrack.com';
ALTER TABLE app_users DROP COLUMN IF EXISTS role, DROP COLUMN IF EXISTS status, DROP COLUMN IF EXISTS last_login;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password VARCHAR(255);
DROP INDEX IF EXISTS idx_app_users_role;

-- 3. Renewals: add owner, backfill from creator / old assignee, drop assignment fields
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS owner_id VARCHAR(100);
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS status VARCHAR(30);
UPDATE renewals r SET owner_id = u.id FROM app_users u
  WHERE r.owner_id IS NULL AND lower(u.email) = lower(COALESCE(
    NULLIF(r.created_by, ''),
    (to_jsonb(r) ->> 'assigned_to_email'),
    (to_jsonb(r) ->> 'responsible_email')));
ALTER TABLE renewals DROP COLUMN IF EXISTS responsible_person, DROP COLUMN IF EXISTS responsible_email,
  DROP COLUMN IF EXISTS assigned_to_id, DROP COLUMN IF EXISTS assigned_to_name, DROP COLUMN IF EXISTS assigned_to_email;
DROP INDEX IF EXISTS idx_renewals_assigned;
CREATE INDEX IF NOT EXISTS idx_renewals_owner ON renewals(owner_id);
-- Rows still without an owner are orphans (invisible to everyone). Review them:
--   SELECT id, name FROM renewals WHERE owner_id IS NULL;
-- then either assign:  UPDATE renewals SET owner_id = '<user id>' WHERE id = '<id>';
-- or delete:           DELETE FROM renewals WHERE owner_id IS NULL;

-- 4. Reminder logs per owner
ALTER TABLE reminder_logs ADD COLUMN IF NOT EXISTS owner_id VARCHAR(100);
UPDATE reminder_logs l SET owner_id = r.owner_id FROM renewals r WHERE l.owner_id IS NULL AND l.renewal_id = r.id;

-- 5. Notification settings become one row per user
DROP TABLE IF EXISTS notification_settings;
CREATE TABLE notification_settings (
  id VARCHAR(100) PRIMARY KEY,
  email_notifications_enabled BOOLEAN DEFAULT TRUE,
  reminder_days JSONB DEFAULT '[30, 15, 7, 0]'::jsonb,
  default_recipient_email VARCHAR(255) DEFAULT '',
  send_on_expiry_day BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Lock the tables down: remove the old "allow everything" policies
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
           AND tablename IN ('renewals','app_users','reminder_logs','password_resets','notification_settings')
  LOOP EXECUTE format('DROP POLICY %I ON %I', p.policyname, p.tablename); END LOOP;
END $$;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE renewals ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

COMMIT;
