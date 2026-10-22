/* ==========================================================================
   scripts/sync_to_supabase.js — one-off copy of the local JSON store into Supabase
   Usage: node scripts/sync_to_supabase.js   (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
   Copies users, renewals (with owner_id), reminder logs and per-user settings.
   ========================================================================== */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env first.");
  process.exit(1);
}
const supabase = createClient(url, key);
const file = process.env.DATA_FILE || path.join(__dirname, "..", "data", "store.json");
const store = JSON.parse(fs.readFileSync(file, "utf-8"));
const snake = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), v]));

async function up(table, rows, onConflict = "id") {
  if (!rows.length) return console.log(`${table}: nothing to sync`);
  const { error } = await supabase.from(table).upsert(rows, { onConflict });
  console.log(error ? `${table}: ERROR ${error.message}` : `${table}: synced ${rows.length}`);
}

(async () => {
  await up("app_users", (store.users || []).map(snake));
  await up("renewals", (store.renewals || []).filter((r) => r.ownerId).map(snake));
  await up("reminder_logs", (store.reminder_logs || []).filter((l) => l.owner_id));
  await up("notification_settings", Object.entries(store.user_settings || {}).map(([id, s]) => ({ id, email_notifications_enabled: s.emailNotificationsEnabled, reminder_days: s.reminderDays, default_recipient_email: s.defaultRecipientEmail || "", send_on_expiry_day: s.sendOnExpiryDay })));
})();
