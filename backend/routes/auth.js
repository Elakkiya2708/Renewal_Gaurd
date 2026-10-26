/* ==========================================================================
   backend/routes/auth.js — Open registration, login, profile, password reset
   Authentication is JWT-only. The token's user id is the ONLY identity the
   backend trusts; no client-supplied headers can impersonate another user.
   ========================================================================== */

const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const config = require("../config");
const db = require("../db");
const emailService = require("../emailService");

const router = express.Router();

/* ---- password helpers ---- */
const hashPassword = (plain) => db.hashPassword(plain);
function verifyPassword(plain, stored) {
  try {
    if (stored && stored.startsWith("scrypt$")) {
      const [, salt, key] = stored.split("$");
      const check = crypto.scryptSync(plain, salt, 64);
      const keyBuf = Buffer.from(key, "hex");
      return keyBuf.length === check.length && crypto.timingSafeEqual(keyBuf, check);
    }
  } catch (e) {}
  return false;
}
const passwordProblem = (pw) => {
  if (typeof pw !== "string" || pw.length < 8) return "Password must be at least 8 characters long.";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Password must contain at least one letter and one number.";
  return null;
};

/* ---- tiny in-memory rate limiter (per IP + route) ---- */
const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const rec = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (rec.length >= max) return res.status(429).json({ ok: false, error: "Too many attempts. Please try again later." });
    rec.push(now);
    hits.set(key, rec);
    next();
  };
}

const publicUser = (u) => ({ id: u.id, fullName: u.fullName, email: u.email, mobile: u.mobile || "", avatar: u.avatar || null, createdAt: u.createdAt });
const generateToken = (u) => jwt.sign({ id: u.id, email: u.email }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });

// Middleware: verify Bearer JWT, load the user from the database, attach req.user
async function authenticateToken(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: "Authentication required. Please log in." });
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    const user = await db.getUserById(decoded.id);
    if (!user) return res.status(401).json({ ok: false, error: "User account no longer exists." });
    req.user = { id: String(user.id), email: user.email, fullName: user.fullName };
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: "Invalid or expired session. Please log in again." });
  }
}

// POST /api/auth/register — anyone can sign up with name, email and password
router.post("/register", rateLimit(20, 15 * 60 * 1000), async (req, res) => {
  try {
    const fullName = String((req.body && req.body.fullName) || "").trim();
    const email = String((req.body && req.body.email) || "").trim().toLowerCase();
    const password = req.body && req.body.password;
    if (!fullName || !email || !password) return res.status(400).json({ ok: false, error: "Full name, email, and password are required." });
    if (!emailService.isValidEmail(email)) return res.status(400).json({ ok: false, error: "Please enter a valid email address." });
    const problem = passwordProblem(password);
    if (problem) return res.status(400).json({ ok: false, error: problem });
    if (await db.getUserByEmail(email)) return res.status(409).json({ ok: false, error: "An account with this email already exists." });

    const hashed = hashPassword(password);
    const user = await db.saveUser({ fullName, email, mobile: String(req.body.mobile || "").trim(), password: hashed, passwordHash: hashed });

    // Verify user persistence before reporting success
    const verified = await db.getUserById(user.id);
    if (!verified) {
      console.error(`[Register Persistence Failure] User ${user.id} (${email}) could not be retrieved after saveUser.`);
      return res.status(500).json({ ok: false, error: "Database error: Unable to store user record. Please try again." });
    }

    res.status(201).json({ ok: true, token: generateToken(user), user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/auth/login
router.post("/login", rateLimit(30, 15 * 60 * 1000), async (req, res) => {
  try {
    const email = String((req.body && req.body.email) || "").trim().toLowerCase();
    const password = req.body && req.body.password;
    if (!email || !password) return res.status(400).json({ ok: false, error: "Email and password are required." });
    const user = await db.getUserByEmail(email);
    if (!user || !verifyPassword(String(password), user.passwordHash || user.password)) {
      return res.status(401).json({ ok: false, error: "Invalid email or password." });
    }
    res.json({ ok: true, token: generateToken(user), user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/auth/me
router.get("/me", authenticateToken, async (req, res) => {
  const user = await db.getUserById(req.user.id);
  res.json({ ok: true, user: publicUser(user) });
});

// PUT /api/auth/me — update own profile (name / mobile / avatar)
router.put("/me", authenticateToken, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.id);
    const fullName = req.body && req.body.fullName !== undefined ? String(req.body.fullName).trim() : user.fullName;
    if (!fullName) return res.status(400).json({ ok: false, error: "Full name is required." });
    const mobile = req.body && req.body.mobile !== undefined ? String(req.body.mobile).trim() : (user.mobile || "");
    const avatar = req.body && ("avatar" in req.body) ? req.body.avatar : (user.avatar || null);
    const saved = await db.saveUser({ ...user, fullName, mobile, avatar });
    res.json({ ok: true, user: publicUser(saved) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/auth/change-password — requires login AND the current password
router.post("/change-password", authenticateToken, rateLimit(10, 15 * 60 * 1000), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ ok: false, error: "Current password and new password are required." });
    const user = await db.getUserById(req.user.id);
    if (!verifyPassword(String(currentPassword), user.passwordHash || user.password)) {
      return res.status(400).json({ ok: false, error: "Current password is incorrect." });
    }
    const problem = passwordProblem(newPassword);
    if (problem) return res.status(400).json({ ok: false, error: problem });
    const hashed = hashPassword(newPassword);
    await db.saveUser({ ...user, password: hashed, passwordHash: hashed });
    res.json({ ok: true, message: "Password updated successfully." });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/auth/me — delete own account and ALL of own data
router.delete("/me", authenticateToken, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.id);
    if (!verifyPassword(String((req.body && req.body.password) || ""), user.passwordHash || user.password)) {
      return res.status(400).json({ ok: false, error: "Password is incorrect." });
    }
    await db.deleteUserAndData(req.user.id);
    res.json({ ok: true, message: "Account and all data deleted." });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/auth/forgot-password
router.post("/forgot-password", rateLimit(10, 15 * 60 * 1000), async (req, res) => {
  try {
    const email = String((req.body && req.body.email) || "").trim().toLowerCase();
    if (!emailService.isValidEmail(email)) return res.status(400).json({ ok: false, error: "Please enter a valid email address." });
    const user = await db.getUserByEmail(email);
    let emailSent = false;
    let devResetUrl = null;
    if (user) {
      const reset = await db.createPasswordReset(email);
      const appUrl = config.APP_URL || `http://localhost:${config.PORT || 3000}`;
      const resetUrl = `${appUrl}/reset-password.html?token=${encodeURIComponent(reset.token)}`;
      console.log(`\n================================================================================`);
      console.log(`  [PASSWORD RESET REQUESTED]`);
      console.log(`  User:      ${user.email}`);
      console.log(`  Reset URL: ${resetUrl}`);
      console.log(`  Expires:   30 minutes`);
      console.log(`================================================================================\n`);
      try {
        const r = await emailService.sendPasswordResetEmail({ to: user.email, fullName: user.fullName, resetUrl, expiresMinutes: 30 });
        emailSent = !!(r && r.success);
      } catch (e) {
        console.error(`[Forgot Password] email failed: ${e.message}`);
      }
      if (!emailSent && process.env.NODE_ENV !== "production") {
        devResetUrl = resetUrl;
      }
    }
    // Generic response: never reveals whether the email is registered
    res.json({
      ok: true,
      message: "If an account with that email exists, a password reset link has been sent. Please check your inbox.",
      emailSent,
      ...(devResetUrl ? { devResetUrl } : {})
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/auth/verify-reset-token/:token
router.get("/verify-reset-token/:token", async (req, res) => {
  try {
    const reset = await db.getPasswordResetByToken(req.params.token);
    if (!reset) return res.status(400).json({ ok: false, error: "Invalid password reset link." });
    if (reset.used) return res.status(400).json({ ok: false, error: "This password reset link has already been used. Please request a new one." });
    if (new Date(reset.expiresAt) < new Date()) return res.status(400).json({ ok: false, error: "This password reset link has expired. Please request a new one." });
    const [local, domain] = reset.email.split("@");
    const masked = (local.slice(0, 2) || "*") + "***@" + (domain || "");
    res.json({ ok: true, valid: true, emailMasked: masked, maskedEmail: masked, expiresAt: reset.expiresAt });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", rateLimit(10, 15 * 60 * 1000), async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body || {};
    if (!token || !newPassword) return res.status(400).json({ ok: false, error: "Reset token and new password are required." });
    if (confirmPassword !== undefined && newPassword !== confirmPassword) return res.status(400).json({ ok: false, error: "Passwords do not match." });
    const problem = passwordProblem(newPassword);
    if (problem) return res.status(400).json({ ok: false, error: problem });
    await db.consumePasswordReset(token, hashPassword(newPassword));
    res.json({ ok: true, message: "Your password has been reset successfully. You can now sign in with your new password." });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

router.authenticateToken = authenticateToken;
module.exports = router;
