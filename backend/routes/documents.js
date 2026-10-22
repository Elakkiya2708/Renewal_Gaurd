/* ==========================================================================
   backend/routes/documents.js — Private document upload / download / delete
   Files live in data/uploads/<ownerId>/ and are served ONLY to the owner of
   the renewal they are attached to, via an authenticated request.
   ========================================================================== */

const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const { authenticateToken } = require("./auth");

const router = express.Router();
router.use(authenticateToken);

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per file
const BLOCKED_EXT = /\.(exe|bat|cmd|com|msi|scr|js|vbs|sh|ps1|jar|html?|svg)$/i;
const jsonBig = express.json({ limit: "8mb" });

const typeFromName = (n) => ((n.split(".").pop() || "").toUpperCase().slice(0, 6) || "FILE");
const notFound = (res, what = "Document") => res.status(404).json({ ok: false, error: `${what} not found.` });

// POST /api/documents/:renewalId  { name, mimeType, content(base64) }
router.post("/:renewalId", jsonBig, async (req, res) => {
  try {
    const record = await db.getRenewalById(req.params.renewalId, req.user.id);
    if (!record) return notFound(res, "Renewal record");
    const name = String((req.body && req.body.name) || "").replace(/[\\/\0]/g, "_").slice(0, 200);
    const b64 = String((req.body && req.body.content) || "").replace(/^data:[^,]*,/, "");
    if (!name || !b64) return res.status(400).json({ ok: false, error: "File name and content are required." });
    if (BLOCKED_EXT.test(name)) return res.status(400).json({ ok: false, error: "This file type is not allowed." });
    const buf = Buffer.from(b64, "base64");
    if (!buf.length) return res.status(400).json({ ok: false, error: "File is empty." });
    if (buf.length > MAX_BYTES) return res.status(413).json({ ok: false, error: "File is too large (max 5 MB)." });

    const fileId = db.saveStoredFile(req.user.id, buf);
    const doc = {
      id: `doc-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
      fileId,
      name,
      type: typeFromName(name),
      mimeType: String((req.body && req.body.mimeType) || "application/octet-stream").slice(0, 100),
      size: `${(buf.length / 1024).toFixed(1)} KB`,
      uploadDate: new Date().toISOString().slice(0, 10),
      uploadedBy: req.user.fullName,
    };
    const saved = await db.saveRenewal({ ...record, documents: [...(record.documents || []), doc] }, req.user.id);
    res.status(201).json({ ok: true, data: doc, renewal: saved });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/documents/:renewalId/:docId/file — download (owner only)
router.get("/:renewalId/:docId/file", async (req, res) => {
  try {
    const record = await db.getRenewalById(req.params.renewalId, req.user.id);
    const doc = record && (record.documents || []).find((d) => d.id === req.params.docId);
    if (!doc || !doc.fileId) return notFound(res);
    const buf = db.readStoredFile(req.user.id, doc.fileId);
    if (!buf) return notFound(res, "File");
    res.setHeader("Content-Type", "application/octet-stream"); // never render user content inline
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(doc.name)}`);
    res.send(buf);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/documents/:renewalId/:docId
router.delete("/:renewalId/:docId", async (req, res) => {
  try {
    const record = await db.getRenewalById(req.params.renewalId, req.user.id);
    const doc = record && (record.documents || []).find((d) => d.id === req.params.docId);
    if (!doc) return notFound(res);
    db.removeStoredFile(req.user.id, doc.fileId);
    const saved = await db.saveRenewal({ ...record, documents: record.documents.filter((d) => d.id !== doc.id) }, req.user.id);
    res.json({ ok: true, renewal: saved });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
