/* ==========================================================================
   backend/routes/reminders.js — Reminder logs, manual trigger, test email
   All routes require login and operate only on the caller's own data.
   ========================================================================== */

const express = require("express");
const db = require("../db");
const emailService = require("../emailService");
const reminderScheduler = require("../reminderScheduler");
const config = require("../config");
const { authenticateToken } = require("./auth");

const router = express.Router();
router.use(authenticateToken);

// GET /api/reminders/logs — the caller's own sent-reminder history
router.get("/logs", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "50", 10) || 50, 500);
    const logs = await db.getReminderLogs(req.user.id, limit);
    res.json({
      ok: true,
      data: logs,
      count: logs.length,
      storageMode: db.isLiveSupabase() ? "supabase_postgresql" : "json_store",
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/reminders/trigger — run the reminder check for the caller's renewals only
router.post("/trigger", async (req, res) => {
  try {
    const summary = await reminderScheduler.checkAndSendReminders({ force: !!(req.body && req.body.force === true), ownerId: req.user.id });
    res.json({ ok: true, message: "Reminder check completed successfully.", summary });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/reminders/test-email — only to the caller's own addresses (not an open relay)
router.post("/test-email", async (req, res) => {
  try {
    const settings = await db.getNotificationSettings(req.user.id);
    const allowed = [req.user.email, (settings.defaultRecipientEmail || "").toLowerCase()].filter(Boolean);
    const target = String((req.body && req.body.targetEmail) || req.user.email).trim().toLowerCase();
    if (!allowed.includes(target)) {
      return res.status(400).json({ ok: false, error: "Test emails can only be sent to your account email or your configured reminder email." });
    }
    const result = await emailService.sendTestEmail(target);
    if (result.success) {
      res.json({ ok: true, message: result.simulated ? `Test email simulated for ${target}. (Email sending is disabled or not configured — see server console)` : `Test email sent to ${target} via ${result.provider}.`, details: { success: true, simulated: !!result.simulated, provider: result.provider } });
    } else {
      res.status(400).json({ ok: false, error: result.error });
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/reminders/status — scheduler status + the caller's own settings
router.get("/status", async (req, res) => {
  try {
    const s = reminderScheduler.getStatus();
    res.json({
      ok: true,
      scheduler: { active: s.active, schedule: s.schedule, lastRunTimestamp: s.lastRunTimestamp, emailProvider: s.emailProvider, emailSendEnabled: s.emailSendEnabled },
      settings: await db.getNotificationSettings(req.user.id),
      database: { isSupabase: db.isLiveSupabase(), type: db.isLiveSupabase() ? "Supabase PostgreSQL" : "Local Safe Store" },
      emailConfig: { provider: config.EMAIL_PROVIDER, isSendEnabled: config.EMAIL_SEND_ENABLED },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/reminders/email-status
router.get("/email-status", (req, res) => {
  try {
    const st = emailService.getProviderStatus();
    res.json({ ok: true, data: { provider: st.provider, sendEnabled: st.sendEnabled, configured: st.configured, isConfigured: st.isConfigured, simulationMode: st.simulationMode } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
