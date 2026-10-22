/* ==========================================================================
   backend/config.js — Central Configuration & Environment Management
   Loads environment variables securely and provides validated defaults.
   ========================================================================== */

require("dotenv").config();
const path = require("path");
const fs = require("fs");

// JWT secret: must be provided in production; in development a random secret is
// generated once and persisted so sessions survive restarts.
function resolveJwtSecret() {
  const fromEnv = (process.env.JWT_SECRET || "").trim();
  const weak = !fromEnv || /renewaltrack_jwt|change[-_ ]?me|your[-_ ]?secret/i.test(fromEnv) || fromEnv.length < 24;
  if (!weak) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set to a random string of 24+ characters in production.");
  }
  const dir = process.env.DATA_DIR || path.join(__dirname, "..", "data");
  const file = path.join(dir, ".jwt_secret");
  try {
    if (fs.existsSync(file)) return fs.readFileSync(file, "utf-8").trim();
    fs.mkdirSync(dir, { recursive: true });
    const secret = require("crypto").randomBytes(48).toString("hex");
    fs.writeFileSync(file, secret, { mode: 0o600 });
    console.warn("[Config] JWT_SECRET missing/weak — generated a development secret in data/.jwt_secret. Set JWT_SECRET in .env for production.");
    return secret;
  } catch (e) {
    return require("crypto").randomBytes(48).toString("hex");
  }
}

const config = {
  PORT: process.env.PORT || 3000,
  APP_URL: process.env.APP_URL || process.env.FRONTEND_URL || `http://localhost:${process.env.PORT || 3000}`,
  BACKEND_URL: process.env.BACKEND_URL || "",
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "*",

  // Data Storage Paths (for local JSON store and Render Persistent Disks)
  DATA_DIR: process.env.DATA_DIR || path.join(__dirname, "..", "data"),
  DATA_FILE: process.env.DATA_FILE || "",
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",

  // Authentication
  JWT_SECRET: resolveJwtSecret(),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",

  // Email Delivery Configuration
  EMAIL_PROVIDER: (process.env.EMAIL_PROVIDER || "nodemailer").toLowerCase(), // 'nodemailer' (SMTP/Gmail) or 'resend'
  EMAIL_SEND_ENABLED: process.env.EMAIL_SEND_ENABLED !== "false", // Real delivery enabled by default unless explicitly disabled with 'false'

  // Gmail SMTP & Nodemailer Settings
  GMAIL_USER: (process.env.GMAIL_USER || process.env.SMTP_USER || "").trim(),
  GMAIL_APP_PASSWORD: (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || "").replace(/\s+/g, ""),
  SMTP_HOST: process.env.SMTP_HOST || "smtp.gmail.com",
  SMTP_PORT: parseInt(process.env.SMTP_PORT || "587", 10),
  SMTP_SECURE: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
  SMTP_SERVICE: process.env.SMTP_SERVICE || (process.env.SMTP_HOST && process.env.SMTP_HOST.includes("gmail") ? "gmail" : (process.env.GMAIL_USER ? "gmail" : "")),
  SMTP_USER: (process.env.GMAIL_USER || process.env.SMTP_USER || "").trim(),
  SMTP_PASS: (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || "").replace(/\s+/g, ""),
  EMAIL_FROM: process.env.EMAIL_FROM || process.env.FROM_EMAIL || (process.env.GMAIL_USER ? `RenewalHub <${process.env.GMAIL_USER}>` : "RenewalHub <no-reply@localhost>"),
  FROM_EMAIL: process.env.EMAIL_FROM || process.env.FROM_EMAIL || (process.env.GMAIL_USER ? `RenewalHub <${process.env.GMAIL_USER}>` : "RenewalHub <no-reply@localhost>"),
  FROM_NAME: process.env.FROM_NAME || "RenewalTrack Alerts",

  // Resend API Settings
  RESEND_API_KEY: process.env.RESEND_API_KEY || "",
  RESEND_FROM: process.env.EMAIL_FROM || process.env.RESEND_FROM || "RenewalTrack <onboarding@resend.dev>",
  RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET || "",

  // Background Reminder Scheduler (node-cron)
  // Default is daily at 08:00 AM ('0 8 * * *')
  CRON_SCHEDULE: process.env.CRON_SCHEDULE || "0 8 * * *",

};

module.exports = config;
