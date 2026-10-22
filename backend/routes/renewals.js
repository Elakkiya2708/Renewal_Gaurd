/* ==========================================================================
   backend/routes/renewals.js — Renewal records API (private per user)
   Every route requires a valid JWT and only ever reads/writes records whose
   ownerId equals the authenticated user's id. Someone else's record id simply
   returns 404 — its existence is never revealed.
   ========================================================================== */

const express = require("express");
const db = require("../db");
const { authenticateToken } = require("./auth");

const router = express.Router();
router.use(authenticateToken);

const SERVER_CONTROLLED = ["ownerId", "owner_id", "createdBy", "documents"];
function clientFields(body) {
  const out = { ...(body || {}) };
  SERVER_CONTROLLED.forEach((k) => delete out[k]);
  return out;
}
const notFound = (res) => res.status(404).json({ ok: false, error: "Renewal record not found." });

function parseHistory(h) {
  if (typeof h === "string") { try { h = JSON.parse(h); } catch (e) { h = []; } }
  return Array.isArray(h) ? h : [];
}

// GET /api/renewals — only the caller's renewals
router.get("/", async (req, res) => {
  try {
    res.json({ ok: true, data: await db.getRenewals(req.user.id) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/renewals/history — renewal history across the caller's own records
router.get("/history", async (req, res) => {
  try {
    const list = await db.getRenewals(req.user.id);
    const rows = [];
    const seen = new Set();
    list.forEach((r) => {
      parseHistory(r.history).forEach((h) => {
        if (!h || typeof h !== "object") return;
        const key = `${r.id}_${h.newExpiry || ""}_${h.renewalDate || ""}`;
        if (seen.has(key)) return;
        seen.add(key);
        rows.push({ ...h, renewalId: r.id, renewalName: r.name || "Unnamed Record", category: r.category || "General", recordCode: r.code || "—" });
      });
    });
    rows.sort((a, b) => new Date(b.renewalDate || 0) - new Date(a.renewalDate || 0));
    res.json({ ok: true, data: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/renewals/:id
router.get("/:id", async (req, res) => {
  try {
    const record = await db.getRenewalById(req.params.id, req.user.id);
    if (!record) return notFound(res);
    res.json({ ok: true, data: record });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/renewals — create
router.post("/", async (req, res) => {
  try {
    const data = clientFields(req.body);
    if (!data.name || !data.expiryDate || !data.category) {
      return res.status(400).json({ ok: false, error: "Name, category, and expiryDate are required." });
    }
    data.createdBy = req.user.email;
    data.documents = [];
    const saved = await db.saveRenewal(data, req.user.id);
    res.status(201).json({ ok: true, data: saved });
  } catch (err) {
    res.status(err.message === "Renewal record not found." ? 409 : 500).json({ ok: false, error: err.message });
  }
});

// PUT /api/renewals/:id — update own record
router.put("/:id", async (req, res) => {
  try {
    const existing = await db.getRenewalById(req.params.id, req.user.id);
    if (!existing) return notFound(res);
    const updates = clientFields(req.body);

    // Documents can only be REMOVED through a normal update; new files go through /api/documents
    let documents = existing.documents || [];
    if (req.body && Array.isArray(req.body.documents)) {
      const keep = new Set(req.body.documents.map((d) => d && d.id));
      const removed = documents.filter((d) => !keep.has(d.id));
      removed.forEach((d) => db.removeStoredFile(req.user.id, d.fileId));
      documents = documents.filter((d) => keep.has(d.id));
    }
    const updated = await db.saveRenewal({ ...existing, ...updates, documents, id: existing.id }, req.user.id);
    res.json({ ok: true, data: updated });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/renewals — delete all of the caller's own renewals
router.delete("/", async (req, res) => {
  try {
    const n = await db.clearAllRenewals(req.user.id);
    res.json({ ok: true, message: `${n} renewal(s) cleared.` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/renewals/:id
router.delete("/:id", async (req, res) => {
  try {
    const ok = await db.deleteRenewal(req.params.id, req.user.id);
    if (!ok) return notFound(res);
    res.json({ ok: true, message: "Renewal record deleted successfully." });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Mark a renewal as renewed — preserves the previous term in history
async function handleMarkRenewed(req, res) {
  try {
    const renewalId = req.params.id || (req.body && (req.body.id || req.body.renewalId));
    if (!renewalId) return res.status(400).json({ ok: false, error: "Renewal ID is required." });
    const record = await db.getRenewalById(renewalId, req.user.id);
    if (!record) return notFound(res);

    const { renewalDate, newExpiryDate, newRenewalDate, cost, currency, notes, recurringCycle } = req.body || {};
    const finalRenewalDate = renewalDate || new Date().toISOString().slice(0, 10);
    const cycle = recurringCycle || record.recurringCycle || "Yearly";

    let finalExpiryDate = newExpiryDate || newRenewalDate;
    if (!finalExpiryDate && record.expiryDate) {
      const d = new Date(record.expiryDate);
      if (!isNaN(d.getTime())) {
        switch ((cycle || "").toLowerCase()) {
          case "monthly": d.setMonth(d.getMonth() + 1); break;
          case "quarterly": d.setMonth(d.getMonth() + 3); break;
          case "half-yearly": case "semi-annually": d.setMonth(d.getMonth() + 6); break;
          case "weekly": d.setDate(d.getDate() + 7); break;
          case "bi-weekly": d.setDate(d.getDate() + 14); break;
          case "2-year": d.setFullYear(d.getFullYear() + 2); break;
          case "3-year": d.setFullYear(d.getFullYear() + 3); break;
          case "5-year": d.setFullYear(d.getFullYear() + 5); break;
          default: d.setFullYear(d.getFullYear() + 1);
        }
        finalExpiryDate = d.toISOString().slice(0, 10);
      }
    }
    if (!finalExpiryDate) return res.status(400).json({ ok: false, error: "Unable to determine next expiry date." });

    const historyEntry = {
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      previousExpiry: record.expiryDate,
      newExpiry: finalExpiryDate,
      renewalDate: finalRenewalDate,
      cost: cost !== undefined && cost !== "" && cost !== null ? Number(cost) : record.cost,
      currency: currency || record.currency || "USD",
      renewedBy: req.user.fullName,
      renewedByEmail: req.user.email,
      notes: notes || "",
    };
    const existingHistory = parseHistory(record.history);
    const isDuplicate = record.expiryDate === finalExpiryDate || existingHistory.some((h) => h && h.newExpiry === finalExpiryDate);
    const finalHistory = isDuplicate ? existingHistory : [historyEntry, ...existingHistory];

    let nextReminderDate = req.body && req.body.reminderDate;
    if (!nextReminderDate) {
      const d = new Date(finalExpiryDate);
      if (!isNaN(d.getTime())) { d.setDate(d.getDate() - 14); nextReminderDate = d.toISOString().slice(0, 10); }
    }
    const saved = await db.saveRenewal({
      ...record,
      history: finalHistory,
      issueDate: finalRenewalDate,
      expiryDate: finalExpiryDate,
      lastRenewedAt: finalRenewalDate,
      status: "active",
      reminderCompleted: false,
      recurringCycle: cycle,
      reminderDate: nextReminderDate || record.reminderDate,
    }, req.user.id);

    res.json({ ok: true, data: saved, history: saved.history, historyEntry, message: `Renewal "${saved.name}" successfully renewed. New expiry: ${finalExpiryDate}.` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
router.post("/:id/mark-renewed", handleMarkRenewed);
router.post("/:id/renew", handleMarkRenewed);
router.post("/renew", handleMarkRenewed);

// POST /api/renewals/:id/snooze
router.post("/:id/snooze", async (req, res) => {
  try {
    const record = await db.getRenewalById(req.params.id, req.user.id);
    if (!record) return notFound(res);
    let newDate = req.body && req.body.reminderDate;
    if (!newDate) {
      const d = new Date();
      d.setDate(d.getDate() + (Number(req.body && req.body.days) || 7));
      newDate = d.toISOString().slice(0, 10);
    }
    const saved = await db.saveRenewal({ ...record, reminderDate: newDate, reminderCompleted: false }, req.user.id);
    res.json({ ok: true, data: saved });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/renewals/:id/reminder-status
router.post("/:id/reminder-status", async (req, res) => {
  try {
    const record = await db.getRenewalById(req.params.id, req.user.id);
    if (!record) return notFound(res);
    const saved = await db.saveRenewal({ ...record, reminderCompleted: !!(req.body && req.body.reminderCompleted === true) }, req.user.id);
    res.json({ ok: true, data: saved });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
