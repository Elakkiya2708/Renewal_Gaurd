/* ==========================================================================
   backend/routes/webhooks.js — Email delivery webhook listener (Resend)
   Logs bounce / failure events to the server console. If RESEND_WEBHOOK_SECRET
   is set, requests must send it in the "x-webhook-secret" header.
   ========================================================================== */

const express = require("express");
const crypto = require("crypto");
const config = require("../config");

const router = express.Router();

router.get("/status", (req, res) => {
  res.json({ ok: true, service: "RenewalHub Email Webhook Listener", activeProvider: config.EMAIL_PROVIDER, secretRequired: !!config.RESEND_WEBHOOK_SECRET });
});

function secretOk(req) {
  if (!config.RESEND_WEBHOOK_SECRET) return true;
  const given = Buffer.from(String(req.headers["x-webhook-secret"] || ""));
  const expected = Buffer.from(config.RESEND_WEBHOOK_SECRET);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

function handleWebhookEvent(req, res) {
  if (!secretOk(req)) return res.status(401).json({ ok: false, error: "Invalid webhook secret." });
  const events = Array.isArray(req.body) ? req.body : req.body ? [req.body] : [];
  if (!events.length) return res.status(400).json({ ok: false, error: "Empty webhook payload" });
  events.forEach((evt) => {
    const type = String((evt && evt.type) || "").toLowerCase();
    if (/bounce|fail|complain/.test(type)) console.warn(`[Webhook] Email delivery problem: ${type}`);
  });
  res.json({ ok: true, received: events.length });
}

router.post("/resend", handleWebhookEvent);
router.post("/email", handleWebhookEvent);

module.exports = router;
