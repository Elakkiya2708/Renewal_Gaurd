# RenewGaurd — Real Email Delivery Setup & Verification Guide

This guide walks you through configuring and testing real email notifications in **RenewGaurd**. The daily scheduler (and the **Run Reminder Check Now** button in Settings) emails each user about their own renewals that are approaching expiry.

---

## 1. Choose Your Email Provider

RenewGaurd natively supports two industry-standard email providers:
1. **Gmail SMTP (Nodemailer)** — Recommended for fastest, free setup without requiring domain DNS verification.
2. **Resend API** — Recommended for high-scale, modern transactional email delivery via API.

---

## 2. Option A: Gmail SMTP Setup (Recommended)

Gmail allows you to send emails directly via SMTP using a secure **Google App Password**.

### Step-by-Step Instructions:
1. Go to your **[Google Account Security Settings](https://myaccount.google.com/security)**.
2. Ensure **2-Step Verification** is turned **ON** for your Google account.
3. Search for **"App passwords"** in the top search bar (or visit [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)).
4. Enter an app name: `RenewGaurd`.
5. Click **Create**.
6. Google will generate a **16-character code** (e.g., `abcd efgh ijkl mnop`).
7. Open your `.env` file in the project root and add:
   ```env
   EMAIL_PROVIDER=nodemailer
   EMAIL_SEND_ENABLED=true
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_SERVICE=gmail
   SMTP_USER=your-actual-email@gmail.com
   SMTP_PASS=abcdefghijklmnop
   FROM_NAME=RenewGaurd Alerts
   ```
   *(Note: Enter the 16 characters in `SMTP_PASS` without spaces)*

---

## 3. Option B: Resend API Setup

Resend is a developer-first email platform that delivers transactional emails via REST API.

### Step-by-Step Instructions:
1. Sign up for a free account at **[resend.com](https://resend.com)**.
2. Go to **API Keys** at [resend.com/api-keys](https://resend.com/api-keys).
3. Click **Create API Key**, name it `RenewGaurd`, select **Full access**, and copy your key (starts with `re_...`).
4. In your `.env` file, configure:
   ```env
   EMAIL_PROVIDER=resend
   EMAIL_SEND_ENABLED=true
   RESEND_API_KEY=re_your_api_key_here
   FROM_NAME=RenewGaurd Alerts
   ```
5. **Sender domain notes**:
   - In development/sandbox mode, Resend sends from `onboarding@resend.dev` and only allows sending to the email address registered with your Resend account.
   - To send emails to any user's email address, add and verify your custom domain under [resend.com/domains](https://resend.com/domains), and set `FROM_EMAIL=alerts@yourdomain.com`.

---

## 4. Who receives reminders

Each user's reminders are sent to the renewal owner's account email, or to the reminder
email they set in **Settings → Notifications**. Reminder days and the on/off switch are
also per user.


## 5. Testing & Verifying Email Delivery

### Automated Verification Script:
Run the built-in email test script in your terminal:
```bash
node test_email_delivery.js
```
- If credentials are not yet configured, the script reports configuration status and tells you exactly what is missing.
- When valid credentials are provided, it performs a live connectivity check and attempts a real test delivery to verify your setup.

### In-App Test:
Use **Settings → Notifications → Send Test Reminder Email**, or call the API with your login token
(test emails can only go to your own account email or your configured reminder email):
```bash
curl -X POST http://localhost:3000/api/reminders/test-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your JWT from login>" \
  -d '{"targetEmail": "you@example.com"}'
```

---

## 6. Security Best Practices
- **Never commit `.env`** to Git. The `.gitignore` file is preconfigured to protect your `.env` file.
- **Never use your personal Gmail login password**; always use a Google App Password.
- Credentials are strictly read on the backend and are never exposed in client-side code.
