/* ==========================================================================
   backend/routes/settings.js — Per-user notification settings
   ========================================================================== */

const express = require("express");
const db = require("../db");
const emailService = require("../emailService");
const { authenticateToken } = require("./auth");

const router = express.Router();
router.use(authenticateToken);

router.get("/notifications", async (req, res) => {
  try {
    res.json({ ok: true, data: await db.getNotificationSettings(req.user.id) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.put("/notifications", async (req, res) => {
  try {
    const { emailNotificationsEnabled, reminderDays, defaultRecipientEmail, sendOnExpiryDay } = req.body || {};
    const updates = {};
    if (emailNotificationsEnabled !== undefined) updates.emailNotificationsEnabled = Boolean(emailNotificationsEnabled);
    if (Array.isArray(reminderDays)) {
      const days = [...new Set(reminderDays.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 365))];
      updates.reminderDays = days.sort((a, b) => b - a);
    }
    if (defaultRecipientEmail !== undefined) {
      const e = String(defaultRecipientEmail || "").trim().toLowerCase();
      if (e && !emailService.isValidEmail(e)) return res.status(400).json({ ok: false, error: "Please enter a valid reminder email address." });
      updates.defaultRecipientEmail = e;
    }
    if (sendOnExpiryDay !== undefined) updates.sendOnExpiryDay = Boolean(sendOnExpiryDay);
    const updated = await db.updateNotificationSettings(req.user.id, updates);
    res.json({ ok: true, message: "Notification settings updated successfully.", data: updated });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
