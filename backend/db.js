/* ==========================================================================
   backend/db.js — Unified Data Access Layer (Supabase PostgreSQL + local JSON)
   Every renewal, document, reminder log and setting belongs to exactly one
   user (ownerId). All read/write helpers REQUIRE an ownerId, so a caller
   can never accidentally touch another user's data.
   ========================================================================== */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { supabase, isConfigured } = require("./supabaseClient");
const config = require("./config");

const DEFAULT_DATA_DIR = path.join(__dirname, "..", "data");
const DATA_DIR = config.DATA_DIR || DEFAULT_DATA_DIR;
const LOCAL_STORE_FILE = config.DATA_FILE || path.join(DATA_DIR, "store.json");
const SEED_FILE = path.join(DEFAULT_DATA_DIR, "seed.json");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

const DEFAULT_SETTINGS = () => ({
  emailNotificationsEnabled: true,
  reminderDays: [30, 15, 7, 0],
  defaultRecipientEmail: "",
  sendOnExpiryDay: true,
});

// Fields that belonged to the removed team / assignment model
const LEGACY_RENEWAL_FIELDS = [
  "assignedToId", "assignedToName", "assignedToEmail", "assigned_to_id", "assigned_to_name",
  "assigned_to_email", "responsiblePerson", "responsibleEmail", "responsible_person",
  "responsible_email", "department", "assignedTo",
];
const LEGACY_USER_FIELDS = ["role", "status", "isPrimaryAdmin", "assignedRenewalsCount", "invitedBy", "inviteToken"];

function emptyStore() {
  return { users: [], renewals: [], reminder_logs: [], user_settings: {}, password_resets: [] };
}

/* ---------------------------- local store ------------------------------- */

// One-time, idempotent migration from the old role-based model
function migrate(store) {
  let changed = false;
  for (const k of ["users", "renewals", "reminder_logs", "password_resets"]) {
    if (!Array.isArray(store[k])) { store[k] = []; changed = true; }
  }
  if (!store.user_settings || typeof store.user_settings !== "object") { store.user_settings = {}; changed = true; }
  for (const k of ["invitations", "audit_logs", "settings", "app_users"]) {
    if (k in store) { delete store[k]; changed = true; }
  }
  const before = store.users.length;
  store.users = store.users.filter((u) => u && u.email && u.email.toLowerCase() !== "demo@renewaltrack.com" && u.email.toLowerCase() !== "demo@renewgaurd.com");
  if (store.users.length !== before) changed = true;
  store.users.forEach((u) => {
    u.email = u.email.trim().toLowerCase();
    LEGACY_USER_FIELDS.forEach((f) => { if (f in u) { delete u[f]; changed = true; } });
    // Never keep plaintext legacy passwords around
    if (u.password && !String(u.password).startsWith("scrypt$")) {
      u.password = hashPassword(u.password);
      u.passwordHash = u.password;
      changed = true;
    }
  });
  const byEmail = new Map(store.users.map((u) => [u.email, u.id]));
  store.renewals.forEach((r) => {
    if (!r.ownerId) {
      const guess = (r.createdBy || r.assignedToEmail || r.responsibleEmail || "").trim().toLowerCase();
      r.ownerId = byEmail.get(guess) || null; // null = orphan, invisible to everyone
      changed = true;
    }
    LEGACY_RENEWAL_FIELDS.forEach((f) => { if (f in r) { delete r[f]; changed = true; } });
  });
  return changed;
}

function getLocalStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(LOCAL_STORE_FILE) && fs.existsSync(SEED_FILE)) {
      fs.writeFileSync(LOCAL_STORE_FILE, fs.readFileSync(SEED_FILE, "utf-8"), "utf-8");
    }
    if (fs.existsSync(LOCAL_STORE_FILE)) {
      const store = JSON.parse(fs.readFileSync(LOCAL_STORE_FILE, "utf-8"));
      if (migrate(store)) saveLocalStore(store);
      return store;
    }
  } catch (err) {
    console.error(`[Local Store Read Error] ${err.message}`);
  }
  const fresh = emptyStore();
  saveLocalStore(fresh);
  return fresh;
}

function saveLocalStore(store) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = LOCAL_STORE_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf-8");
    fs.renameSync(tmp, LOCAL_STORE_FILE);
  } catch (err) {
    console.error(`[Local Store Write Error] ${err.message}`);
  }
}

function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `scrypt$${salt}$${crypto.scryptSync(plain, salt, 64).toString("hex")}`;
}

const toSnake = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), v]));
const toCamel = (o) => (o && typeof o === "object" ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), v])) : o);
const requireOwner = (ownerId) => { if (!ownerId) throw new Error("ownerId is required."); return String(ownerId); };
const stripLegacy = (r) => { const c = { ...r }; LEGACY_RENEWAL_FIELDS.forEach((f) => delete c[f]); return c; };

/* ------------------------------ database -------------------------------- */

const db = {
  isLiveSupabase: () => isConfigured(),
  hashPassword,
  UPLOAD_DIR,

  /* ----- renewals (always scoped to an owner) ----- */
  async getRenewals(ownerId) {
    const owner = requireOwner(ownerId);
    if (isConfigured()) {
      try {
        const { data, error } = await supabase.from("renewals").select("*").eq("owner_id", owner).order("expiry_date", { ascending: true });
        if (!error && data) return data.map((r) => stripLegacy(toCamel(r)));
        if (error) console.error(`[Supabase renewals error] ${error.message}. Falling back to local store.`);
      } catch (e) { console.error(`[Supabase error] ${e.message}`); }
    }
    return getLocalStore().renewals.filter((r) => r.ownerId === owner);
  },

  // Internal use by the reminder scheduler only (never exposed through an API)
  async getAllRenewalsForScheduler() {
    if (isConfigured()) {
      try {
        const { data, error } = await supabase.from("renewals").select("*");
        if (!error && data) return data.map((r) => stripLegacy(toCamel(r)));
      } catch (e) { console.error(`[Supabase error] ${e.message}`); }
    }
    return getLocalStore().renewals.filter((r) => r.ownerId);
  },

  async getRenewalById(id, ownerId) {
    const owner = requireOwner(ownerId);
    const list = await this.getRenewals(owner);
    return list.find((r) => r.id === id && r.ownerId === owner) || null; // not yours => behaves as "not found"
  },

  async saveRenewal(data, ownerId) {
    const owner = requireOwner(ownerId);
    const id = data.id || `ren-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
    const store = getLocalStore();
    const existingLocal = store.renewals.find((r) => r.id === id);
    if (existingLocal && existingLocal.ownerId !== owner) throw new Error("Renewal record not found.");
    if (isConfigured()) {
      const { data: row } = await supabase.from("renewals").select("owner_id").eq("id", id).maybeSingle();
      if (row && row.owner_id !== owner) throw new Error("Renewal record not found.");
    }

    let history = data.history;
    if (typeof history === "string") { try { history = JSON.parse(history); } catch (e) { history = []; } }
    if (Array.isArray(history)) {
      const seen = new Set();
      history = history.filter((h) => {
        if (!h || typeof h !== "object") return false;
        const k = `${h.newExpiry || ""}_${h.renewalDate || ""}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }
    const record = { ...stripLegacy(data), id, ownerId: owner, history: history || [] };

    if (isConfigured()) {
      try {
        const { data: saved, error } = await supabase.from("renewals").upsert(toSnake(record), { onConflict: "id" }).select().single();
        if (!error && saved) return stripLegacy(toCamel(saved));
        if (error) console.error(`[Supabase saveRenewal error] ${error.message}`);
      } catch (e) { console.error(`[Supabase saveRenewal error] ${e.message}`); }
    }
    const idx = store.renewals.findIndex((r) => r.id === id);
    if (idx >= 0) store.renewals[idx] = { ...store.renewals[idx], ...record };
    else store.renewals.unshift(record);
    saveLocalStore(store);
    return record;
  },

  async deleteRenewal(id, ownerId) {
    const owner = requireOwner(ownerId);
    const existing = await this.getRenewalById(id, owner);
    if (!existing) return false;
    for (const d of existing.documents || []) this.removeStoredFile(owner, d.fileId);
    if (isConfigured()) {
      try { await supabase.from("renewals").delete().eq("id", id).eq("owner_id", owner); }
      catch (e) { console.error(`[Supabase deleteRenewal error] ${e.message}`); }
    }
    const store = getLocalStore();
    store.renewals = store.renewals.filter((r) => !(r.id === id && r.ownerId === owner));
    saveLocalStore(store);
    return true;
  },

  async clearAllRenewals(ownerId) {
    const owner = requireOwner(ownerId);
    const list = await this.getRenewals(owner);
    for (const r of list) await this.deleteRenewal(r.id, owner);
    return list.length;
  },

  /* ----- document files (stored on disk, per-owner folder) ----- */
  filePath(ownerId, fileId) {
    const safeOwner = String(ownerId).replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeFile = String(fileId).replace(/[^a-zA-Z0-9_-]/g, "_");
    return path.join(UPLOAD_DIR, safeOwner, safeFile);
  },
  saveStoredFile(ownerId, buffer) {
    const fileId = `f-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
    const p = this.filePath(ownerId, fileId);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, buffer);
    return fileId;
  },
  readStoredFile(ownerId, fileId) {
    const p = this.filePath(ownerId, fileId);
    return fs.existsSync(p) ? fs.readFileSync(p) : null;
  },
  removeStoredFile(ownerId, fileId) {
    if (!fileId) return;
    try { fs.unlinkSync(this.filePath(ownerId, fileId)); } catch (e) {}
  },

  /* ----- reminder logs ----- */
  async hasReminderBeenSent(renewalId, interval, expiryDate) {
    const ok = ["sent", "simulated"];
    if (isConfigured()) {
      try {
        const { data, error } = await supabase.from("reminder_logs").select("id").eq("renewal_id", renewalId).eq("reminder_interval", interval).eq("expiry_date", expiryDate).in("status", ok);
        if (!error && data && data.length) return true;
      } catch (e) {}
    }
    return getLocalStore().reminder_logs.some((l) => l.renewal_id === renewalId && l.reminder_interval === interval && l.expiry_date === expiryDate && ok.includes(l.status));
  },

  async recordReminderLog(e) {
    const entry = {
      id: e.id || `log-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
      owner_id: e.ownerId || e.owner_id,
      renewal_id: e.renewalId || e.renewal_id,
      renewal_name: e.renewalName || e.renewal_name,
      reminder_interval: e.reminderInterval || e.reminder_interval,
      recipient_email: e.recipientEmail || e.recipient_email,
      recipient_name: e.recipientName || e.recipient_name || "",
      expiry_date: e.expiryDate || e.expiry_date,
      days_remaining: e.daysRemaining !== undefined ? e.daysRemaining : e.days_remaining,
      status: e.status,
      delivery_provider: e.deliveryProvider || config.EMAIL_PROVIDER,
      message_id: e.messageId || null,
      error_message: e.errorMessage || null,
      sent_at: new Date().toISOString(),
    };
    if (isConfigured()) {
      try { await supabase.from("reminder_logs").insert([entry]); } catch (err) { console.error(`[Supabase log error] ${err.message}`); }
    }
    const store = getLocalStore();
    store.reminder_logs = [entry, ...store.reminder_logs].slice(0, 2000);
    saveLocalStore(store);
    return entry;
  },

  async getReminderLogs(ownerId, limit = 100) {
    const owner = requireOwner(ownerId);
    if (isConfigured()) {
      try {
        const { data, error } = await supabase.from("reminder_logs").select("*").eq("owner_id", owner).order("sent_at", { ascending: false }).limit(limit);
        if (!error && data) return data;
      } catch (e) {}
    }
    return getLocalStore().reminder_logs.filter((l) => l.owner_id === owner).slice(0, limit);
  },

  /* ----- per-user notification settings ----- */
  async getNotificationSettings(ownerId) {
    const owner = requireOwner(ownerId);
    if (isConfigured()) {
      try {
        const { data, error } = await supabase.from("notification_settings").select("*").eq("id", owner).maybeSingle();
        if (!error && data) {
          return { ...DEFAULT_SETTINGS(), emailNotificationsEnabled: data.email_notifications_enabled !== false, reminderDays: data.reminder_days || [30, 15, 7, 0], defaultRecipientEmail: data.default_recipient_email || "", sendOnExpiryDay: data.send_on_expiry_day !== false };
        }
      } catch (e) {}
    }
    return { ...DEFAULT_SETTINGS(), ...(getLocalStore().user_settings[owner] || {}) };
  },

  async updateNotificationSettings(ownerId, updates) {
    const owner = requireOwner(ownerId);
    const merged = { ...(await this.getNotificationSettings(owner)), ...updates };
    if (isConfigured()) {
      try {
        await supabase.from("notification_settings").upsert({ id: owner, email_notifications_enabled: merged.emailNotificationsEnabled, reminder_days: merged.reminderDays, default_recipient_email: merged.defaultRecipientEmail, send_on_expiry_day: merged.sendOnExpiryDay, updated_at: new Date().toISOString() });
      } catch (e) { console.error(`[Supabase settings error] ${e.message}`); }
    }
    const store = getLocalStore();
    store.user_settings[owner] = { ...merged, updatedAt: new Date().toISOString() };
    saveLocalStore(store);
    return store.user_settings[owner];
  },

  /* ----- users ----- */
  async getUserByEmail(email) {
    if (!email) return null;
    const clean = String(email).trim().toLowerCase();
    if (isConfigured()) {
      try {
        const { data, error } = await supabase.from("app_users").select("*").eq("email", clean).maybeSingle();
        if (!error && data) return toCamel(data);
      } catch (e) {}
    }
    return getLocalStore().users.find((u) => u.email === clean) || null;
  },

  async getUserById(id) {
    if (!id) return null;
    const sid = String(id);
    if (isConfigured()) {
      try {
        const { data, error } = await supabase.from("app_users").select("*").eq("id", sid).maybeSingle();
        if (!error && data) return toCamel(data);
      } catch (e) {}
    }
    return getLocalStore().users.find((u) => String(u.id) === sid) || null;
  },

  async saveUser(userData) {
    const id = userData.id || `usr-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
    const email = (userData.email || "").trim().toLowerCase();
    const record = { ...userData, id, email, updatedAt: new Date().toISOString() };
    LEGACY_USER_FIELDS.forEach((f) => delete record[f]);
    if (!record.createdAt) record.createdAt = record.updatedAt;
    if (isConfigured()) {
      try { await supabase.from("app_users").upsert(toSnake(record), { onConflict: "id" }); }
      catch (e) { console.error(`[Supabase saveUser error] ${e.message}`); }
    }
    const store = getLocalStore();
    const idx = store.users.findIndex((u) => u.id === id || u.email === email);
    if (idx >= 0) store.users[idx] = { ...store.users[idx], ...record };
    else store.users.push(record);
    saveLocalStore(store);
    return record;
  },

  async deleteUserAndData(ownerId) {
    const owner = requireOwner(ownerId);
    await this.clearAllRenewals(owner);
    if (isConfigured()) {
      try {
        await supabase.from("reminder_logs").delete().eq("owner_id", owner);
        await supabase.from("notification_settings").delete().eq("id", owner);
        await supabase.from("app_users").delete().eq("id", owner);
      } catch (e) {}
    }
    const store = getLocalStore();
    store.users = store.users.filter((u) => String(u.id) !== owner);
    store.reminder_logs = store.reminder_logs.filter((l) => l.owner_id !== owner);
    delete store.user_settings[owner];
    saveLocalStore(store);
    try { fs.rmSync(path.join(UPLOAD_DIR, owner.replace(/[^a-zA-Z0-9_-]/g, "_")), { recursive: true, force: true }); } catch (e) {}
    return true;
  },

  /* ----- password reset tokens ----- */
  async createPasswordReset(email) {
    const cleanEmail = (email || "").trim().toLowerCase();
    const record = { id: `reset-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`, email: cleanEmail, token: crypto.randomBytes(32).toString("hex"), expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), used: false, createdAt: new Date().toISOString() };
    const store = getLocalStore();
    store.password_resets.forEach((r) => { if (r.email === cleanEmail && !r.used) { r.used = true; r.superseded = true; } });
    store.password_resets = [...store.password_resets.filter((r) => new Date(r.expiresAt) > new Date(Date.now() - 864e5)), record];
    saveLocalStore(store);
    if (isConfigured()) {
      try { await supabase.from("password_resets").insert({ id: record.id, email: record.email, token: record.token, expires_at: record.expiresAt, used: false, created_at: record.createdAt }); } catch (e) {}
    }
    return record;
  },

  async getPasswordResetByToken(token) {
    if (!token || typeof token !== "string") return null;
    if (isConfigured()) {
      try {
        const { data, error } = await supabase.from("password_resets").select("*").eq("token", token).maybeSingle();
        if (!error && data) return toCamel(data);
      } catch (e) {}
    }
    return getLocalStore().password_resets.find((r) => r.token === token) || null;
  },

  async consumePasswordReset(token, newHashedPassword) {
    const reset = await this.getPasswordResetByToken(token);
    if (!reset) throw new Error("Invalid password reset token.");
    if (reset.used) throw new Error("This password reset link has already been used. Please request a new one.");
    if (new Date(reset.expiresAt) < new Date()) throw new Error("This password reset link has expired. Please request a new one.");
    const user = await this.getUserByEmail(reset.email);
    if (!user) throw new Error("User account associated with this reset link was not found.");
    user.password = newHashedPassword;
    user.passwordHash = newHashedPassword;
    await this.saveUser(user);
    const store = getLocalStore();
    const idx = store.password_resets.findIndex((r) => r.token === token);
    if (idx >= 0) { store.password_resets[idx].used = true; store.password_resets[idx].usedAt = new Date().toISOString(); saveLocalStore(store); }
    if (isConfigured()) {
      try { await supabase.from("password_resets").update({ used: true, used_at: new Date().toISOString() }).eq("token", token); } catch (e) {}
    }
    return user;
  },

  async getPasswordResets() {
    if (isConfigured()) {
      try {
        const { data, error } = await supabase.from("password_resets").select("*");
        if (!error && data) return data.map(toCamel);
      } catch (e) {}
    }
    return (getLocalStore().password_resets || []).slice();
  },
};

module.exports = db;
