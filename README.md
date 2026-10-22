# RenewGaurd / RenewalHub — Private Renewal Management

Track contracts, licenses, certifications, warranties, insurance, subscriptions and
permits with reminders, document storage, history and reports.

**Every user has their own private workspace.** There are no roles, admins, teams or
assignments: anyone can register with a name, email and password, and can only see and
manage their own renewals and documents. This is enforced in the backend.

Stack: HTML/CSS/vanilla JS frontend, Node.js + Express backend, JWT auth, local JSON
store by default (Supabase PostgreSQL optional), Nodemailer/Resend for email.

## Running it

```bash
npm install
cp .env.example .env     # then edit; see "Configuration"
npm start                # http://localhost:3000
```

Open the site, click **Sign Up**, create an account and you land on your own empty
dashboard. Data is stored in `data/store.json` (git-ignored) and uploaded files in
`data/uploads/<your-user-id>/`.

## Configuration

- `JWT_SECRET` — required in production (long random string). In development a secret
  is generated once into `data/.jwt_secret`.
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — optional. Run
  `supabase/COMPLETE_SUPABASE_SCHEMA.sql` (new install) or
  `supabase/migrations/20261101_private_workspaces.sql` (upgrade from the role-based
  version). Use the **service role** key: tables have RLS with no public policies.
- `EMAIL_SEND_ENABLED=true` plus SMTP/Gmail/Resend settings for real reminder emails;
  otherwise emails are simulated in the server console.

## Security model

- Every API route except register/login/forgot/reset requires a valid JWT.
- Every renewal, document, reminder log and notification setting stores an `ownerId`;
  all queries filter by the authenticated user's id. Someone else's record id returns 404.
- Clients cannot set `ownerId`; documents are stored per owner and downloaded only
  through an authenticated request.
- Server files (`data/`, `backend/`, `.env`) are never served over HTTP.
- Passwords are hashed with scrypt on the server; the browser never stores them.
- Run `node test_privacy_isolation.js` to verify isolation (15 checks).

## Project structure

```
renew-gaurding-system/
├── start.bat / server.js / package.json   Local launcher (Node, zero dependencies)
├── index.html          Public landing page (hero, features, FAQ…) — Login/Sign Up buttons lead to the app
├── login.html
├── register.html
├── dashboard.html
├── records.html         Renewal Records table + Add/Edit modal
├── details.html         Renewal Details page (see note below)
├── calendar.html
├── reminders.html
├── history.html
├── documents.html
├── reports.html
├── settings.html
├── css/
│   ├── style.css        Design tokens + app component styles
│   ├── landing.css      Landing page sections only
│   └── responsive.css   Tablet/mobile breakpoints
├── js/
│   ├── app.js           Data layer, auth, utilities, layout wiring, toasts
│   ├── auth.js          Login / register page logic
│   ├── landing.js       Landing page (mobile nav, FAQ accordion, auth-aware nav)
│   ├── dashboard.js
│   ├── records.js
│   ├── details.js
│   ├── calendar.js
│   ├── reminders.js
│   ├── history.js
│   ├── documents.js
│   ├── reports.js
│   └── settings.js
└── assets/              (empty — reserved for any static images/logos you add)
```

**One deviation from the originally requested file list:** the spec's file
structure didn't list a `details.html` / `details.js`, but section 6
("Renewal Details Page") explicitly requires a dedicated page showing full
record info, days remaining, renewal timeline/history, documents, and
Edit / Delete / Mark as Renewed actions. Building that as a real, linkable
page (`details.html?id=...`) rather than cramming it into a modal was the
more standard approach, so it's included as an addition.

## Status logic

Status is calculated from the expiry date, never stored: **Expired** (past), **Due Soon**
(within 30 days), **Renewed** (renewed in the last 30 days), **Active** (everything else).
Renewing a record keeps the previous term in its history.

## Documents

Upload up to 5 MB per file (executables/HTML/SVG are rejected). Files are stored under
`data/uploads/<owner-id>/` when running locally; on hosts with ephemeral disks (e.g.
Render free tier) attach a persistent disk or move storage to object storage.

## Notes

- Icons: [Lucide](https://lucide.dev) via CDN (`unpkg.com/lucide@latest`).
- Fonts: Inter (single family, varying weights) via Google Fonts.
- Design language: professional **indigo/slate** (default) — dark slate sidebar, light
  content area, standard green/amber/red status colours.
- **Themes** (Settings → Application → Theme): Indigo (light, default), Indigo (dark),
  Black & Gold, Ivory & Gold. Everything is driven by CSS variables in `css/style.css`
  (`body.theme-*` blocks), so adding another theme means adding one block.
- **Logo:** `assets/logo.png` (indigo) and `assets/logo-gold.png`; the app swaps logo,
  favicon and the landing preview image automatically when the theme changes
  (`data-img-indigo` / `data-img-gold` attributes + `applyTheme()` in `js/app.js`).
- Fully responsive: collapsible sidebar + off-canvas drawer on tablet/mobile,
  responsive tables, mobile-friendly modals and forms.
- Landing page: opening `index.html` shows the public marketing page. The app
  itself is only entered via the **Login** / **Get Started Free** buttons.
  Note: the testimonials and the stats band on the landing page are placeholder
  content — replace them with real ones before publishing.

## Automated Real Email Reminder System

RenewGaurd includes an automated, background-scheduled email reminder engine powered by **Node.js, Express, node-cron, Nodemailer / Resend, and Supabase PostgreSQL**:

- **Automated Intervals:** Dispatches notifications **30 days, 15 days, 7 days** before expiry, and **on the exact expiry date (0 days)**.
- **Duplicate Prevention:** Tracks every sent reminder in the `reminder_logs` database table with a unique constraint on `(renewal_id, reminder_interval, expiry_date)`. Reminders for the same interval will never be sent twice.
- **Per-user routing:** Reminders go to the renewal owner, or to the reminder email they set in Settings.
- **Safe Development Mode:** By default, `EMAIL_SEND_ENABLED=false` logs email previews to the server console safely. Toggle to `true` with your SMTP or Resend credentials in `.env` to send live emails to inboxes.
- **Scheduled Background Job:** Runs independently on `CRON_SCHEDULE` (default: `0 8 * * *` daily at 8:00 AM) even when no browser session is open.
- **On-Demand Testing:** Test delivery instantly via the Settings page ("Send Test Reminder Email" or "Run Reminder Check Now") or via `POST /api/reminders/trigger`.

