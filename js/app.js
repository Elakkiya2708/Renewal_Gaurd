/* ==========================================================================
   Renewal Tracking System — app.js
   Shared utilities, data layer (localStorage mock persistence), auth guard,
   layout wiring (sidebar/topbar), toast notifications, modal helpers.

   NOTE ON BACKEND INTEGRATION:
   All data access goes through the RTS.data.* functions below. To connect
   a real Node.js + Express + Supabase backend, replace the internals of
   those functions with `fetch()` calls to your API while keeping the same
   function names/signatures — every page script only talks to RTS.data.*
   and never touches localStorage directly, so the rest of the app does
   not need to change.
   ========================================================================== */

(function (global) {
  "use strict";

  const STORAGE_KEYS = {
    RENEWALS: "rts_renewals",
    USER: "rts_current_user",
    AUTH: "rts_auth_token",
    REMEMBER: "rts_remember_email",
    SETTINGS: "rts_settings_v3",
    ACCOUNTS: "rts_accounts",
    LANG: "rts_lang",
  };

  const CATEGORIES = [
    "Contract",
    "License",
    "Certification",
    "Warranty",
    "Insurance",
    "Subscription",
    "Regulatory Permit",
    "Other",
  ];

  const PRIORITIES = ["High", "Medium", "Low"];
  const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AUD", "CAD"];

  const RECURRING_CYCLES = [
    "None",
    "Monthly",
    "Quarterly",
    "Yearly",
    "2-Year",
    "3-Year",
    "5-Year",
  ];

  /* ------------------------------------------------------------------ */
  /* i18n Dictionary (English & தமிழ்)                                   */
  /* ------------------------------------------------------------------ */

  const I18N = {
    en: {
      appName: "RenewGaurd",
      tagline: "Renewal Tracking System",
      main: "Main",
      teamManagement: "Team Management",
      teamMembers: "Team Members",
      inviteMembers: "Invite Members",
      auditLogs: "Audit Logs",
      account: "Account",
      dashboard: "Dashboard",
      records: "Renewal Records",
      calendar: "Calendar",
      reminders: "Reminders",
      history: "Renewal History",
      documents: "Documents",
      reports: "Reports",
      settings: "Settings",
      logout: "Logout",
      profileSettings: "Profile Settings",
      appSettings: "App Settings",
      searchPlaceholder: "Search renewals, documents…",
      notifications: "Notifications",
      urgentRenewals: "urgent renewal(s)",
      allCaughtUp: "You're all caught up. No urgent renewals.",
      viewAllReminders: "View All Reminders",
      snooze1Week: "Snooze 1w",
      snooze1Day: "Snooze 1d",
      snooze1Month: "Snooze 1m",
      snoozeCustom: "Custom",
      snoozeSuccess: "Reminder snoozed for {days} day(s).",
      active: "Active",
      dueSoon: "Due Soon",
      expired: "Expired",
      renewed: "Renewed",
      priorityHigh: "High",
      priorityMedium: "Medium",
      priorityLow: "Low",
      addNewRenewal: "Add New Renewal",
      quickAddRenewal: "Quick Add Renewal",
      importCsv: "Import CSV",
      exportCsv: "Export CSV",
      exportCalendar: "Export Calendar (.ics)",
      printReport: "Print Report",
      markAsRenewed: "Mark as Renewed",
      renewSelected: "Renew Selected",
      exportSelectedCsv: "Export Selected CSV",
      exportSelectedIcs: "Export Selected .ics",
      deleteSelected: "Delete Selected",
      clearSelection: "Clear",
      selectedCount: "{count} selected",
      recordId: "Record ID",
      recordName: "Record Name",
      category: "Category",
      organization: "Organization",
      issueDate: "Issue Date",
      expiryDate: "Expiry Date",
      reminderDate: "Reminder Date",
      status: "Status",
      priority: "Priority",
      cost: "Renewal Cost",
      actions: "Actions",
      recurringCycle: "Renewal Cycle",
      cycleNone: "None (One-time)",
      cycleMonthly: "Monthly",
      cycleQuarterly: "Quarterly",
      cycleYearly: "Yearly",
      cycle2Year: "2 Years",
      cycle3Year: "3 Years",
      cycle5Year: "5 Years",
      daysRemaining: "days remaining",
      cmdPalettePlaceholder: "Type a command, page name, or search renewals…",
      cmdPages: "Pages",
      cmdActions: "Quick Actions",
      cmdRenewals: "Renewals",
      cmdNoResults: "No matching renewals or actions found.",
      costForecast: "Cost Forecast & Budget Planning",
      next30Days: "Next 30 Days",
      next90Days: "Next 90 Days",
      next365Days: "Next 365 Days (1 Year)",
      allUpcoming: "All Upcoming",
      projectedCost: "Projected Renewal Cost",
      renewalsDue: "Renewals Due in Window",
      highPriorityCost: "High-Priority Spend",
      avgRenewalCost: "Average Spend / Record",
      categoryBreakdown: "Category-wise Spending Breakdown",
      monthlyProjections: "Monthly Projected Spend",
      topUpcoming: "Top Costly Upcoming Renewals",
      allCategories: "All Categories",
      allStatuses: "All Statuses",
      allPriorities: "All Priorities",
    },
    ta: {
      appName: "ரினீவல் ட்ராக்",
      tagline: "புதுப்பித்தல் கண்காணிப்பு அமைப்பு",
      main: "முதன்மை",
      teamManagement: "குழு மேலாண்மை",
      teamMembers: "குழு உறுப்பினர்கள்",
      inviteMembers: "உறுப்பினர்களை அழைக்க",
      auditLogs: "தணிக்கை பதிவுகள்",
      account: "கணக்கு",
      dashboard: "முகப்பு பலகை",
      records: "புதுப்பித்தல் பதிவுகள்",
      calendar: "நாள்காட்டி",
      reminders: "நினைவூட்டல்கள்",
      history: "புதுப்பித்தல் வரலாறு",
      documents: "ஆவணங்கள்",
      reports: "அறிக்கைகள்",
      settings: "அமைப்புகள்",
      logout: "வெளியேறு",
      profileSettings: "சுயவிவர அமைப்புகள்",
      appSettings: "செயலி அமைப்புகள்",
      searchPlaceholder: "பதிவுகள், ஆவணங்களைத் தேடுக…",
      notifications: "அறிவிப்புகள்",
      urgentRenewals: "அவசர புதுப்பித்தல்(கள்)",
      allCaughtUp: "எல்லாம் புதுப்பிக்கப்பட்டுள்ளது. அவசர புதுப்பித்தல்கள் இல்லை.",
      viewAllReminders: "எல்லா நினைவூட்டல்களையும் பார்",
      snooze1Week: "1வ தள்ளிப்போடு",
      snooze1Day: "1நா தள்ளிப்போடு",
      snooze1Month: "1மா தள்ளிப்போடு",
      snoozeCustom: "தேதி அமை",
      snoozeSuccess: "நினைவூட்டல் {days} நாள்(கள்) தள்ளிவைக்கப்பட்டது.",
      active: "செயலில்",
      dueSoon: "விரைவில் காலாவதி",
      expired: "காலாவதியானது",
      renewed: "புதுப்பிக்கப்பட்டது",
      priorityHigh: "உயர்",
      priorityMedium: "நடுத்தர",
      priorityLow: "குறைவு",
      addNewRenewal: "புதிய பதிவு சேர்",
      quickAddRenewal: "உடனடி பதிவு சேர்",
      importCsv: "CSV இறக்குமதி",
      exportCsv: "CSV ஏற்றுமதி",
      exportCalendar: "நாள்காட்டி ஏற்றுமதி (.ics)",
      printReport: "அறிக்கை அச்சிடுக",
      markAsRenewed: "புதுப்பிக்கப்பட்டதாக குறி",
      renewSelected: "தேர்ந்தெடுத்ததை புதுப்பி",
      exportSelectedCsv: "தேர்ந்தெடுத்த CSV ஏற்றுமதி",
      exportSelectedIcs: "தேர்ந்தெடுத்த .ics ஏற்றுமதி",
      deleteSelected: "தேர்ந்தெடுத்ததை நீக்கு",
      clearSelection: "அழி",
      selectedCount: "{count} தேர்ந்தெடுக்கப்பட்டது",
      recordId: "பதிவு எண்",
      recordName: "பதிவு பெயர்",
      category: "வகை",
      organization: "நிறுவனம் / வழங்குநர்",
      issueDate: "வழங்கப்பட்ட தேதி",
      expiryDate: "காலாவதி தேதி",
      reminderDate: "நினைவூட்டல் தேதி",
      status: "நிலை",
      priority: "முன்னுரிமை",
      cost: "புதுப்பித்தல் செலவு",
      actions: "செயல்கள்",
      recurringCycle: "புதுப்பித்தல் சுழற்சி",
      cycleNone: "இல்லை (ஒருமுறை)",
      cycleMonthly: "மாதாந்திர",
      cycleQuarterly: "காலாண்டு",
      cycleYearly: "ஆண்டுதோறும்",
      cycle2Year: "2 ஆண்டுகள்",
      cycle3Year: "3 ஆண்டுகள்",
      cycle5Year: "5 ஆண்டுகள்",
      daysRemaining: "மீதமுள்ள நாட்கள்",
      cmdPalettePlaceholder: "பக்கம், செயல் அல்லது புதுப்பித்தலைத் தேடுக…",
      cmdPages: "பக்கங்கள்",
      cmdActions: "உடனடி செயல்கள்",
      cmdRenewals: "புதுப்பித்தல் பதிவுகள்",
      cmdNoResults: "பொருந்தும் பதிவுகள் எதுவும் கிடைக்கவில்லை.",
      costForecast: "செலவு முன்னறிவிப்பு & பட்ஜெட் திட்டம்",
      next30Days: "அடுத்த 30 நாட்கள்",
      next90Days: "அடுத்த 90 நாட்கள்",
      next365Days: "அடுத்த 365 நாட்கள் (1 ஆண்டு)",
      allUpcoming: "அனைத்து வரவிருக்கும்",
      projectedCost: "மதிப்பிடப்பட்ட புதுப்பித்தல் செலவு",
      renewalsDue: "காலாவதியாகும் பதிவுகள்",
      highPriorityCost: "உயர் முன்னுரிமை செலவு",
      avgRenewalCost: "பதிவிற்கான சராசரி செலவு",
      categoryBreakdown: "வகை வாரியான செலவுப் பகிர்வு",
      monthlyProjections: "மாதாந்திர செலவு முன்னறிவிப்பு",
      topUpcoming: "அதிக செலவாகும் வரவிருக்கும் புதுப்பித்தல்கள்",
      allCategories: "அனைத்து வகைகள்",
      allStatuses: "அனைத்து நிலைகள்",
      allPriorities: "அனைத்து முன்னுரிமைகள்",
    },
  };

  function getLanguage() {
    return localStorage.getItem(STORAGE_KEYS.LANG) || "en";
  }

  function setLanguage(lang) {
    if (lang !== "en" && lang !== "ta") lang = "en";
    localStorage.setItem(STORAGE_KEYS.LANG, lang);
    document.documentElement.lang = lang;
    applyTranslations();
    initLanguageToggle();
    renderNotifications();
    refreshIcons();
    window.dispatchEvent(new CustomEvent("rts-language-changed", { detail: { lang } }));
  }

  function t(key, fallback) {
    const lang = getLanguage();
    return (I18N[lang] && I18N[lang][key]) || (I18N.en && I18N.en[key]) || fallback || key;
  }

  function cycleLabel(cycle) {
    const lang = getLanguage();
    const dict = I18N[lang] || I18N.en;
    const map = {
      None: dict.cycleNone,
      Monthly: dict.cycleMonthly,
      Quarterly: dict.cycleQuarterly,
      Yearly: dict.cycleYearly,
      "2-Year": dict.cycle2Year,
      "3-Year": dict.cycle3Year,
      "5-Year": dict.cycle5Year,
    };
    return map[cycle] || cycle || dict.cycleNone;
  }

  /* ------------------------------------------------------------------ */
  /* Generic utilities                                                   */
  /* ------------------------------------------------------------------ */

  function uid(prefix) {
    return (
      (prefix || "id") +
      "_" +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 8)
    );
  }

  function recordCode(index) {
    return "REN-" + String(index).padStart(4, "0");
  }

  function toISODate(date) {
    const d = new Date(date);
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0, 10);
  }

  function todayISO() {
    return toISODate(new Date());
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return toISODate(d);
  }

  function calculateNextExpiry(dateISO, cycle) {
    const base = dateISO ? new Date(dateISO + "T00:00:00") : new Date();
    if (isNaN(base.getTime())) return addDays(todayISO(), 365);
    const d = new Date(base.getTime());
    switch (cycle) {
      case "Monthly":
        d.setMonth(d.getMonth() + 1);
        break;
      case "Quarterly":
        d.setMonth(d.getMonth() + 3);
        break;
      case "Yearly":
        d.setFullYear(d.getFullYear() + 1);
        break;
      case "2-Year":
        d.setFullYear(d.getFullYear() + 2);
        break;
      case "3-Year":
        d.setFullYear(d.getFullYear() + 3);
        break;
      case "5-Year":
        d.setFullYear(d.getFullYear() + 5);
        break;
      default:
        d.setFullYear(d.getFullYear() + 1);
        break;
    }
    return toISODate(d);
  }

  function parseSafeDate(val) {
    if (!val && val !== 0) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    const s = String(val).trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const d = new Date(s + "T00:00:00");
      return isNaN(d.getTime()) ? null : d;
    }
    const cleanISO = s.includes("T") ? s : s.replace(" ", "T");
    const d = new Date(cleanISO);
    return isNaN(d.getTime()) ? null : d;
  }

  function daysBetween(fromISO, toISOStr) {
    const a = parseSafeDate(fromISO);
    const b = parseSafeDate(toISOStr);
    if (!a || !b) return 0;
    return Math.round((b - a) / 86400000);
  }

  function daysRemaining(expiryISO) {
    return daysBetween(todayISO(), expiryISO);
  }

  function formatDate(iso, opts) {
    if (!iso && iso !== 0) return "—";
    const d = parseSafeDate(iso);
    if (!d) return String(iso);
    if (opts) {
      return d.toLocaleDateString("en-US", opts);
    }
    const settings = typeof getSettings === "function" ? getSettings() : {};
    const fmt = settings.dateFormat || "DD/MM/YYYY";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    if (fmt === "MM/DD/YYYY") return `${month}/${day}/${year}`;
    if (fmt === "YYYY-MM-DD") return `${year}-${month}-${day}`;
    if (fmt === "MMM D, YYYY") return `${monthNamesShort[d.getMonth()]} ${d.getDate()}, ${year}`;
    return `${day}/${month}/${year}`;
  }

  function formatMonthYear(iso) {
    if (!iso) return "—";
    const d = parseSafeDate(iso);
    if (!d) return String(iso);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  function formatCurrency(amount, currency) {
    if (amount === undefined || amount === null || amount === "") return "—";
    const num = Number(amount);
    if (isNaN(num)) return "—";
    const settings = typeof getSettings === "function" ? getSettings() : {};
    currency = currency || settings.defaultCurrency || "USD";
    const symbols = { USD: "$", EUR: "€", GBP: "£", INR: "₹", AUD: "A$", CAD: "C$" };
    const symbol = symbols[currency] || (currency ? currency + " " : "");
    return symbol + num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function escapeHtml(str) {
    if (str === undefined || str === null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function debounce(fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait || 250);
    };
  }

  function refreshIcons() {
    if (global.lucide && typeof global.lucide.createIcons === "function") {
      global.lucide.createIcons();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Status logic                                                        */
  /* ------------------------------------------------------------------ */

  function computeStatus(record) {
    const days = daysRemaining(record.expiryDate);
    if (record.lastRenewedAt) {
      const sinceRenewal = daysBetween(record.lastRenewedAt, todayISO());
      if (sinceRenewal >= 0 && sinceRenewal <= 30 && days > 30) {
        return "renewed";
      }
    }
    if (days < 0) return "expired";
    if (days <= 30) return "due-soon";
    return "active";
  }

  function statusLabel(status) {
    const lang = getLanguage();
    const dict = I18N[lang] || I18N.en;
    return (
      {
        active: dict.active,
        "due-soon": dict.dueSoon,
        expired: dict.expired,
        renewed: dict.renewed,
      }[status] || status
    );
  }

  function priorityLabel(priority) {
    const lang = getLanguage();
    const dict = I18N[lang] || I18N.en;
    const key = "priority" + (priority || "Low");
    return dict[key] || priority;
  }

  function statusBadgeHtml(status) {
    const label = statusLabel(status);
    return `<span class="badge badge-${status}">${escapeHtml(label)}</span>`;
  }

  function priorityBadgeHtml(priority) {
    const cls = "badge-priority-" + String(priority || "low").toLowerCase();
    return `<span class="badge ${cls}">${escapeHtml(priorityLabel(priority))}</span>`;
  }

  /* ------------------------------------------------------------------ */
  /* Data layer (localStorage-backed mock persistence)                   */
  /* ------------------------------------------------------------------ */

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getRawRenewals() {
    return readJSON(STORAGE_KEYS.RENEWALS, []);
  }

  function getRenewals() {
    return getRawRenewals();
  }

  function saveRenewals(list) {
    writeJSON(STORAGE_KEYS.RENEWALS, list);
  }

  function getRenewalById(id) {
    return getRawRenewals().find((r) => r.id === id) || null;
  }

  function apiUrl(endpoint) {
    if (!endpoint) return "";
    const clean = endpoint.startsWith("/") ? endpoint : "/" + endpoint;

    // Check runtime config or global variables (for Vercel frontend pointing to external Render backend)
    let runtimeBase =
      (window.RTS_CONFIG && window.RTS_CONFIG.API_URL) ||
      window.RTS_API_URL ||
      (typeof localStorage !== "undefined" ? localStorage.getItem("rts_api_url") : null);

    // Automatic fallback if deployed on Vercel without custom config
    if (!runtimeBase && typeof window !== "undefined" && window.location && window.location.hostname) {
      const host = window.location.hostname;
      const isLocal = host === "localhost" || host === "127.0.0.1" || host === "";
      const isBackendHost = host.includes("onrender.com");
      if (!isLocal && !isBackendHost && (host.endsWith(".vercel.app") || host.includes("vercel"))) {
        runtimeBase = "https://renewgaurd-tyvw.onrender.com";
      }
    }

    if (runtimeBase && typeof runtimeBase === "string" && runtimeBase.trim() !== "") {
      return runtimeBase.trim().replace(/\/+$/, "") + clean;
    }

    if (window.location.protocol === "file:" || !window.location.host) {
      return "http://localhost:3000" + clean;
    }
    return clean;
  }

  // Cross-tab and component data synchronization via BroadcastChannel
  let syncBroadcastChannel = null;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      syncBroadcastChannel = new BroadcastChannel("renewgaurd_data_sync");
      syncBroadcastChannel.onmessage = (evt) => {
        if (evt && evt.data && evt.data.type === "renewal-data-updated") {
          syncRenewalsFromBackend({ broadcast: false }).then(() => {
            try {
              window.dispatchEvent(new CustomEvent("rts-renewal-updated", { detail: evt.data.detail }));
            } catch (_) {}
          });
        }
      };
    }
  } catch (e) {
    console.warn("[RTS Sync] BroadcastChannel initialization failed:", e);
  }

  function broadcastDataSync(detail = {}) {
    try {
      window.dispatchEvent(new CustomEvent("rts-renewal-updated", { detail }));
    } catch (_) {}
    try {
      if (syncBroadcastChannel) {
        syncBroadcastChannel.postMessage({ type: "renewal-data-updated", detail, timestamp: Date.now() });
      }
    } catch (_) {}
  }

  // Cross-tab storage event synchronization
  try {
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEYS.RENEWALS || e.key === "rts_renewals") {
        try {
          window.dispatchEvent(new CustomEvent("rts-renewal-updated", { detail: { storageEvent: true } }));
        } catch (_) {}
      }
    });
  } catch (_) {}

  // Helper to deduplicate history arrays
  function deduplicateHistory(history) {
    if (typeof history === "string") {
      try { history = JSON.parse(history); } catch (e) { history = []; }
    }
    if (!Array.isArray(history)) return [];
    const seen = new Set();
    const result = [];
    for (const h of history) {
      if (!h || typeof h !== "object") continue;
      const key = `${h.previousExpiry || ''}_${h.newExpiry || ''}_${h.renewalDate || ''}_${h.cost || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(h);
      }
    }
    return result;
  }

  function handleUnauthorized() {
    clearSessionData();
    if (!/login\.html|register\.html|forgot-password|reset-password|index\.html/.test(global.location.pathname) && global.location.pathname !== "/") {
      global.location.href = "login.html";
    }
  }

  // Backend writes run one at a time, in order (so a create always finishes before its uploads/updates)
  let syncChain = Promise.resolve();
  function syncRenewalToBackend(method, url, body) {
    const p = syncChain.then(() => doSyncRenewal(method, url, body));
    syncChain = p.catch(() => {});
    return p;
  }
  function whenSynced() {
    return syncChain;
  }

  async function doSyncRenewal(method, url, body) {
    try {
      const headers = authHeaders();
      const res = await fetch(apiUrl(url), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 401) {
        handleUnauthorized();
        return { ok: false, error: "Session expired.", status: 401 };
      }

      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json && json.ok) {
          if (json.data) {
            const raw = getRawRenewals();
            const idx = raw.findIndex((r) => r.id === json.data.id);
            if (idx >= 0) {
              raw[idx] = Object.assign({}, raw[idx], json.data);
              saveRenewals(raw);
            } else if (method === "POST" && !url.includes("mark-renewed") && !url.includes("snooze") && !url.includes("reminder-status")) {
              raw.unshift(json.data);
              saveRenewals(raw);
            }
          }
          broadcastDataSync({ method, url, data: json ? json.data : null });
          return json;
        }
        broadcastDataSync({ method, url });
        return json || { ok: true };
      } else {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson.error || `Operation rejected by server (${res.status} ${res.statusText})`;
        console.error(`[RTS Sync Error] ${method} ${url}:`, errMsg);
        showToast(errMsg, "error");
        // Roll back any optimistic client divergence by refetching actual database state
        await syncRenewalsFromBackend({ broadcast: true });
        return { ok: false, error: errMsg, status: res.status };
      }
    } catch (e) {
      console.warn(`[RTS Network Sync Error] ${method} ${url}:`, e);
      return { ok: false, error: e.message };
    }
  }

  async function syncRenewalsFromBackend(options = {}) {
    const shouldBroadcast = options && options.broadcast !== false;
    if (!getToken()) return [];
    try {
      const res = await fetch(apiUrl("/api/renewals"), { headers: authHeaders() });
      if (res.status === 401) {
        handleUnauthorized();
        return [];
      }
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && Array.isArray(data.data)) {
          saveRenewals(data.data);
          if (shouldBroadcast) {
            try {
              window.dispatchEvent(new CustomEvent("rts-renewal-updated", { detail: { fromServer: true } }));
            } catch (e) {}
          }
          return data.data;
        }
      }
    } catch (e) {}
    return getRenewals();
  }

  function addRenewal(data) {
    const list = getRawRenewals();
    const nextIndex = list.length + 1;
    const record = Object.assign(
      {
        id: uid("ren"),
        code: recordCode(nextIndex),
        documents: [],
        history: [],
        recurringCycle: "Yearly",
        reminderCompleted: false,
        lastRenewedAt: null,
        createdAt: new Date().toISOString(),
      },
      data
    );
    list.unshift(record);
    saveRenewals(list);
    broadcastDataSync({ id: record.id, record, created: true });
    syncRenewalToBackend("POST", "/api/renewals", record);
    return record;
  }

  function updateRenewal(id, data) {
    const list = getRawRenewals();
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const oldRecord = list[idx];

    // If expiryDate is advancing forward to a new date, automatically record history!
    if (data.expiryDate && oldRecord.expiryDate && data.expiryDate !== oldRecord.expiryDate) {
      const oldD = new Date(oldRecord.expiryDate).getTime();
      const newD = new Date(data.expiryDate).getTime();
      if (!isNaN(oldD) && !isNaN(newD) && newD > oldD && !data.history) {
        const currentUser = (global.RTS && global.RTS.auth && typeof global.RTS.auth.getCurrentUser === "function" && global.RTS.auth.getCurrentUser()) || null;
        const historyEntry = {
          id: uid("hist"),
          previousExpiry: oldRecord.expiryDate,
          newExpiry: data.expiryDate,
          renewalDate: todayISO(),
          cost: data.cost !== undefined && data.cost !== "" && data.cost !== null ? Number(data.cost) : oldRecord.cost,
          currency: data.currency || oldRecord.currency || "USD",
          renewedBy: (currentUser && currentUser.fullName) || "System User",
          notes: data.notes || "Renewed via record update",
        };
        let hist = oldRecord.history;
        if (typeof hist === "string") {
          try { hist = JSON.parse(hist); } catch (e) { hist = []; }
        }
        if (!Array.isArray(hist)) hist = [];
        const isDup = hist.some(
          (h) => h && h.previousExpiry === oldRecord.expiryDate && h.newExpiry === data.expiryDate && h.renewalDate === historyEntry.renewalDate
        );
        data.history = isDup ? deduplicateHistory(hist) : deduplicateHistory([historyEntry, ...hist]);
        data.lastRenewedAt = todayISO();
        data.reminderCompleted = false;
      }
    }

    if (data.history) {
      data.history = deduplicateHistory(data.history);
    }

    list[idx] = Object.assign({}, list[idx], data);
    saveRenewals(list);
    broadcastDataSync({ id, record: list[idx] });
    syncRenewalToBackend("PUT", "/api/renewals/" + encodeURIComponent(id), list[idx]);
    return list[idx];
  }

  function deleteRenewal(id) {
    const list = getRawRenewals();
    const target = list.find((r) => r.id === id);
    if (!target) return;
    const updated = list.filter((r) => r.id !== id);
    saveRenewals(updated);
    broadcastDataSync({ id, deleted: true });
    syncRenewalToBackend("DELETE", "/api/renewals/" + encodeURIComponent(id));
  }

  function markAsRenewed(id, payload) {
    const list = getRawRenewals();
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const record = list[idx];


    const cycle = payload.recurringCycle || record.recurringCycle || "Yearly";
    const newExpiry = payload.newExpiryDate || calculateNextExpiry(record.expiryDate, cycle);
    const currentUser = (global.RTS && global.RTS.auth && typeof global.RTS.auth.getCurrentUser === "function" && global.RTS.auth.getCurrentUser()) || null;
    const renewedBy = payload.renewedBy || (currentUser && currentUser.fullName) || "System User";
    const renewalDate = payload.renewalDate || todayISO();

    const historyEntry = {
      id: uid("hist"),
      previousExpiry: record.expiryDate,
      newExpiry: newExpiry,
      renewalDate: renewalDate,
      cost: payload.cost !== undefined && payload.cost !== "" && payload.cost !== null ? Number(payload.cost) : record.cost,
      currency: payload.currency || record.currency || "USD",
      renewedBy: renewedBy,
      notes: payload.notes || "",
    };

    let existingHistory = record.history;
    if (typeof existingHistory === "string") {
      try { existingHistory = JSON.parse(existingHistory); } catch (e) { existingHistory = []; }
    }
    if (!Array.isArray(existingHistory)) existingHistory = [];

    const isDup = existingHistory.some(
      (h) => h && (
        (h.previousExpiry === record.expiryDate && h.newExpiry === newExpiry && h.renewalDate === renewalDate) ||
        (h.newExpiry === newExpiry && h.renewalDate === renewalDate)
      )
    );
    const combinedHistory = isDup ? existingHistory : [historyEntry, ...existingHistory];
    record.history = deduplicateHistory(combinedHistory);
    record.issueDate = renewalDate;
    record.expiryDate = newExpiry;
    record.lastRenewedAt = renewalDate;
    record.reminderCompleted = true;
    record.reminderReopened = false;
    record.recurringCycle = cycle;
    if (payload.reminderDate) {
      record.reminderDate = payload.reminderDate;
    } else {
      record.reminderDate = addDays(newExpiry, -14);
    }
    list[idx] = record;
    saveRenewals(list);

    broadcastDataSync({ id, record, historyEntry });

    syncRenewalToBackend("POST", "/api/renewals/" + encodeURIComponent(id) + "/mark-renewed", {
      ...payload,
      renewalDate,
      newExpiryDate: newExpiry,
      reminderDate: record.reminderDate,
      renewedBy,
      cost: historyEntry.cost,
      currency: historyEntry.currency,
      recurringCycle: cycle,
    });
    return record;
  }

  function snoozeReminder(id, days, customDate) {
    const list = getRawRenewals();
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const record = list[idx];
    const newDate = customDate || addDays(todayISO(), days || 7);
    list[idx].reminderDate = newDate;
    list[idx].reminderCompleted = false;
    list[idx].reminderReopened = true;
    saveRenewals(list);
    broadcastDataSync({ id, record: list[idx] });
    syncRenewalToBackend("POST", "/api/renewals/" + encodeURIComponent(id) + "/snooze", {
      reminderDate: newDate,
      days: days || 7,
    });
    return list[idx];
  }

  function bulkRenew(ids) {
    if (!ids || !ids.length) return 0;
    const list = getRawRenewals();
    let count = 0;
    const currentUser = (global.RTS && global.RTS.auth && typeof global.RTS.auth.getCurrentUser === "function" && global.RTS.auth.getCurrentUser()) || null;
    const actorName = (currentUser && currentUser.fullName) || "Bulk Action";

    ids.forEach((id) => {
      const idx = list.findIndex((r) => r.id === id);
      if (idx !== -1) {
        const record = list[idx];
        const cycle = record.recurringCycle || "Yearly";
        const newExpiry = calculateNextExpiry(record.expiryDate, cycle);
        const historyEntry = {
          id: uid("hist"),
          previousExpiry: record.expiryDate,
          newExpiry: newExpiry,
          renewalDate: todayISO(),
          cost: record.cost,
          currency: record.currency || "USD",
          renewedBy: actorName,
          notes: "Auto-renewed via Bulk Action (" + cycle + ")",
        };
        let hist = record.history;
        if (typeof hist === "string") {
          try { hist = JSON.parse(hist); } catch (e) { hist = []; }
        }
        if (!Array.isArray(hist)) hist = [];
        const isDup = hist.some(
          (h) => h && h.previousExpiry === record.expiryDate && h.newExpiry === newExpiry && h.renewalDate === historyEntry.renewalDate
        );
        record.history = isDup ? deduplicateHistory(hist) : deduplicateHistory([historyEntry, ...hist]);
        record.issueDate = historyEntry.renewalDate;
        record.expiryDate = newExpiry;
        record.lastRenewedAt = historyEntry.renewalDate;
        record.reminderCompleted = false;
        record.reminderDate = addDays(newExpiry, -14);
        list[idx] = record;
        count++;

        syncRenewalToBackend("POST", "/api/renewals/" + encodeURIComponent(id) + "/mark-renewed", {
          newExpiryDate: newExpiry,
          reminderDate: record.reminderDate,
          cost: record.cost,
          currency: record.currency,
          recurringCycle: cycle,
          renewedBy: actorName,
          notes: historyEntry.notes,
        });
      }
    });
    saveRenewals(list);
    broadcastDataSync({ count });
    return count;
  }

  function bulkDelete(ids) {
    if (!ids || !ids.length) return 0;
    let list = getRawRenewals();
    const before = list.length;
    const toDelete = ids.filter((id) => {
      const target = list.find((r) => r.id === id);
      return !!target;
    });
    list = list.filter((r) => !toDelete.includes(r.id));
    saveRenewals(list);
    broadcastDataSync({ count: toDelete.length, deleted: true });
    toDelete.forEach((id) => {
      syncRenewalToBackend("DELETE", "/api/renewals/" + encodeURIComponent(id));
    });
    return before - list.length;
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result).split(",")[1] || "");
      fr.onerror = () => reject(new Error("Could not read file."));
      fr.readAsDataURL(file);
    });
  }

  function applyServerRenewal(renewal) {
    if (!renewal || !renewal.id) return;
    const list = getRawRenewals();
    const idx = list.findIndex((r) => r.id === renewal.id);
    if (idx >= 0) list[idx] = Object.assign({}, list[idx], renewal);
    else list.unshift(renewal);
    saveRenewals(list);
    broadcastDataSync({ id: renewal.id });
  }

  // Upload a real file to the user's private storage (max 5 MB)
  async function uploadDocument(renewalId, file) {
    if (!file) return { ok: false, error: "No file selected." };
    if (file.size > 5 * 1024 * 1024) return { ok: false, error: "File is too large (max 5 MB)." };
    try {
      const content = await readFileAsBase64(file);
      const res = await fetch(apiUrl("/api/documents/" + encodeURIComponent(renewalId)), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ name: file.name, mimeType: file.type, content }),
      });
      if (res.status === 401) { handleUnauthorized(); return { ok: false, error: "Session expired." }; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) return { ok: false, error: data.error || "Upload failed." };
      applyServerRenewal(data.renewal);
      return { ok: true, doc: data.data };
    } catch (e) {
      return { ok: false, error: e.message || "Upload failed." };
    }
  }

  // Download requires the user's token, so the file is fetched and saved via a blob
  async function downloadDocument(renewalId, doc) {
    try {
      const res = await fetch(apiUrl("/api/documents/" + encodeURIComponent(renewalId) + "/" + encodeURIComponent(doc.id) + "/file"), { headers: { Authorization: "Bearer " + getToken() } });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast(j.error || "File is not available for download.", "error");
        return false;
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name || "document";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return true;
    } catch (e) {
      showToast("Download failed.", "error");
      return false;
    }
  }

  async function deleteDocumentFromRenewal(recordId, docId) {
    try {
      const res = await fetch(apiUrl("/api/documents/" + encodeURIComponent(recordId) + "/" + encodeURIComponent(docId)), { method: "DELETE", headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) return { ok: false, error: data.error || "Could not delete document." };
      applyServerRenewal(data.renewal);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: "Could not delete document." };
    }
  }

  function toggleReminderCompleted(id, completed, options) {
    const list = getRawRenewals();
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const record = list[idx];
    if (completed && options && options.renew) {
      return markAsRenewed(id, {
        notes: options.notes || "Completed & renewed via Reminders",
      });
    }
    list[idx].reminderCompleted = completed;
    list[idx].reminderReopened = !completed;
    saveRenewals(list);
    broadcastDataSync({ id, record: list[idx] });
    syncRenewalToBackend("POST", "/api/renewals/" + encodeURIComponent(id) + "/reminder-status", {
      reminderCompleted: completed,
      reminderReopened: !completed,
    });
    return list[idx];
  }

  function getAllDocuments() {
    const renewals = getRenewals();
    const docs = [];
    renewals.forEach((r) => {
      (r.documents || []).forEach((d) => {
        docs.push(Object.assign({}, d, { renewalId: r.id, renewalName: r.name }));
      });
    });
    return docs.sort((a, b) => (a.uploadDate < b.uploadDate ? 1 : -1));
  }

  function getAllHistory() {
    const renewals = getRenewals();
    const rows = [];
    const seen = new Set();
    renewals.forEach((r) => {
      const hist = deduplicateHistory(r.history);
      hist.forEach((h) => {
        if (!h || typeof h !== "object") return;
        const dedupeKey = `${r.id}_${h.previousExpiry || ''}_${h.newExpiry || ''}_${h.renewalDate || ''}_${h.cost || ''}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);
        rows.push(
          Object.assign({}, h, {
            renewalId: r.id,
            renewalName: r.name || r.recordName || "Unnamed Record",
            category: r.category || "General",
            recordCode: r.code || r.referenceNumber || "—",
          })
        );
      });
    });
    return rows.sort((a, b) => {
      const da = new Date(a.renewalDate || a.createdAt || 0).getTime();
      const db = new Date(b.renewalDate || b.createdAt || 0).getTime();
      return db - da;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Mock data seeding                                                    */
  /* ------------------------------------------------------------------ */

  function seedData() {
    // Default sample data disabled — user adds real records
    if (!localStorage.getItem(STORAGE_KEYS.RENEWALS)) {
      saveRenewals([]);
    }
  }

  function clearAllRenewals() {
    saveRenewals([]);
    broadcastDataSync({ cleared: true });
    syncRenewalToBackend('DELETE', '/api/renewals');
  }

  function seedAccount() {
    // Accounts live ONLY on the server. The browser never stores passwords or a list of users.
    try { localStorage.removeItem(STORAGE_KEYS.ACCOUNTS); } catch (e) {}
    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
      writeJSON(STORAGE_KEYS.SETTINGS, {
        theme: "indigo",
        reminderDays: [30, 15, 7],
        notifyEmail: true,
        notifyBrowser: true,
        notifyReminderDigest: false,
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Auth (server-verified; every user has a private workspace)          */
  /* ------------------------------------------------------------------ */

  function getToken() {
    return localStorage.getItem("rts_jwt_token") || localStorage.getItem(STORAGE_KEYS.AUTH) || "";
  }

  function authHeaders(extra) {
    const t = getToken();
    return Object.assign({ "Content-Type": "application/json" }, t ? { Authorization: "Bearer " + t } : {}, extra || {});
  }

  // Wipe everything that belongs to the signed-in user from this browser
  function clearSessionData() {
    [STORAGE_KEYS.AUTH, "rts_jwt_token", STORAGE_KEYS.USER, STORAGE_KEYS.RENEWALS, "rts_renewals"].forEach((k) => {
      try { localStorage.removeItem(k); } catch (e) {}
    });
  }

  function startSession(data, remember, email) {
    const previous = readJSON(STORAGE_KEYS.USER, null);
    // A different person on the same browser must never see the previous user's cached records
    if (!previous || String(previous.id) !== String(data.user.id)) {
      try { localStorage.removeItem(STORAGE_KEYS.RENEWALS); } catch (e) {}
    }
    writeJSON(STORAGE_KEYS.USER, data.user);
    localStorage.setItem(STORAGE_KEYS.AUTH, data.token);
    localStorage.setItem("rts_jwt_token", data.token);
    if (remember) localStorage.setItem(STORAGE_KEYS.REMEMBER, email);
    else localStorage.removeItem(STORAGE_KEYS.REMEMBER);
  }

  async function postJSON(url, body, method) {
    const res = await fetch(apiUrl(url), { method: method || "POST", headers: authHeaders(), body: JSON.stringify(body || {}) });
    let data = {};
    try { data = await res.json(); } catch (e) {}
    return { res, data };
  }

  async function registerAccount({ fullName, email, mobile, password }) {
    const cleanEmail = (email || "").trim().toLowerCase();
    try {
      const { res, data } = await postJSON("/api/auth/register", { fullName, email: cleanEmail, mobile, password });
      if (!res.ok || !data.ok) return { ok: false, error: data.error || "Registration failed." };
      startSession(data, false, cleanEmail);
      return { ok: true, user: data.user };
    } catch (err) {
      return { ok: false, error: "Unable to connect to the server. Please make sure the app server is running and try again." };
    }
  }

  async function login(email, password, remember) {
    const cleanEmail = (email || "").trim().toLowerCase();
    try {
      const { res, data } = await postJSON("/api/auth/login", { email: cleanEmail, password });
      if (!res.ok || !data.ok) return { ok: false, error: data.error || "Invalid email or password." };
      startSession(data, remember, cleanEmail);
      return { ok: true, user: data.user };
    } catch (err) {
      return { ok: false, error: "Unable to connect to the server. Please make sure the app server is running and try again." };
    }
  }

  async function changePassword(currentPassword, newPassword) {
    try {
      const { res, data } = await postJSON("/api/auth/change-password", { currentPassword, newPassword });
      if (!res.ok || !data.ok) return { ok: false, error: data.error || "Could not change password." };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: "Unable to connect to the server." };
    }
  }

  async function updateProfile({ fullName, mobile, avatar }) {
    try {
      const payload = {};
      if (fullName !== undefined) payload.fullName = fullName;
      if (mobile !== undefined) payload.mobile = mobile;
      if (avatar !== undefined) payload.avatar = avatar;
      const { res, data } = await postJSON("/api/auth/me", payload, "PUT");
      if (!res.ok || !data.ok) return { ok: false, error: data.error || "Could not update profile." };
      setCurrentUser(data.user);
      renderTopbarUser();
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, error: "Unable to connect to the server." };
    }
  }

  async function deleteAccount(password) {
    try {
      const { res, data } = await postJSON("/api/auth/me", { password }, "DELETE");
      if (!res.ok || !data.ok) return { ok: false, error: data.error || "Could not delete account." };
      clearSessionData();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: "Unable to connect to the server." };
    }
  }

  async function requestPasswordReset(email) {
    const generic = "If an account with that email exists, a password reset link has been sent. Please check your inbox.";
    try {
      const { data } = await postJSON("/api/auth/forgot-password", { email: (email || "").trim().toLowerCase() });
      return { ok: true, message: data.message || generic, devResetUrl: data.devResetUrl, emailSent: data.emailSent };
    } catch (err) {
      return { ok: true, message: generic };
    }
  }

  async function verifyResetToken(token) {
    if (!token) return { ok: false, error: "Missing reset token." };
    try {
      const res = await fetch(apiUrl("/api/auth/verify-reset-token/" + encodeURIComponent(token)));
      const data = await res.json();
      if (!res.ok || !data.ok) return { ok: false, error: data.error || "Invalid or expired password reset link." };
      return { ok: true, maskedEmail: data.maskedEmail };
    } catch (err) {
      return { ok: false, error: "Unable to verify reset token. Please check your network connection." };
    }
  }

  async function resetPassword(token, newPassword, confirmPassword) {
    if (!token) return { ok: false, error: "Missing reset token." };
    if (!newPassword || newPassword.length < 8) return { ok: false, error: "Password must be at least 8 characters long and contain both letters and numbers." };
    if (newPassword !== confirmPassword) return { ok: false, error: "Passwords do not match." };
    try {
      const { res, data } = await postJSON("/api/auth/reset-password", { token, newPassword, confirmPassword });
      if (!res.ok || !data.ok) return { ok: false, error: data.error || "Failed to reset password." };
      return { ok: true, message: data.message || "Password has been successfully reset." };
    } catch (err) {
      return { ok: false, error: "Server error resetting password. Please try again." };
    }
  }

  function logout() {
    clearSessionData();
    global.location.href = "login.html";
  }

  function isLoggedIn() {
    return !!getToken();
  }

  function getCurrentUser() {
    const user = readJSON(STORAGE_KEYS.USER, null);
    return user && user.email ? user : { id: "", fullName: "", email: "", mobile: "", avatar: null };
  }

  function setCurrentUser(data) {
    writeJSON(STORAGE_KEYS.USER, Object.assign({}, getCurrentUser(), data));
  }

  function requireAuth() {
    if (!isLoggedIn()) {
      global.location.href = "login.html";
    }
  }

  function redirectIfAuthed() {
    if (isLoggedIn()) {
      global.location.href = "dashboard.html";
    }
  }

  function getSettings() {
    return readJSON(STORAGE_KEYS.SETTINGS, {
      theme: "indigo",
      language: "en",
      defaultCurrency: "USD",
      dateFormat: "DD/MM/YYYY",
      tableDensity: "comfortable",
      rowsPerPage: 8,
      defaultCycle: "Yearly",
      reminderDays: [30, 15, 7],
      notifyEmail: true,
      notifyBrowser: true,
      notifyReminderDigest: false,
    });
  }

  function setSettings(data) {
    const current = getSettings();
    const next = Object.assign({}, current, data);
    writeJSON(STORAGE_KEYS.SETTINGS, next);
    applyTheme(next.theme);
    return next;
  }

  // Themes: "indigo" (default), "indigo-dark", "gold" (black & gold), "gold-light" (ivory & gold)
  const THEMES = ["indigo-dark", "gold", "gold-light"];

  function applyTheme(theme) {
    theme = theme || "indigo";
    THEMES.forEach((t) => document.body.classList.remove("theme-" + t));
    if (THEMES.indexOf(theme) !== -1) document.body.classList.add("theme-" + theme);

    // Apply Table Density
    const settings = getSettings();
    if (settings.tableDensity === "compact") {
      document.body.classList.add("density-compact");
    } else {
      document.body.classList.remove("density-compact");
    }

    // Logo / favicon / preview images follow the palette
    const gold = theme.indexOf("gold") === 0;
    document.querySelectorAll("[data-img-indigo]").forEach((el) => {
      const url = gold ? el.getAttribute("data-img-gold") : el.getAttribute("data-img-indigo");
      if (!url) return;
      el.setAttribute(el.tagName === "LINK" ? "href" : "src", url);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Toasts                                                               */
  /* ------------------------------------------------------------------ */

  function ensureToastContainer() {
    let el = document.querySelector(".toast-container");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast-container";
      document.body.appendChild(el);
    }
    return el;
  }

  const TOAST_ICONS = {
    success: "check-circle-2",
    error: "x-circle",
    warning: "alert-triangle",
    info: "info",
  };

  function showToast(message, type, duration) {
    type = type || "info";
    const container = ensureToastContainer();
    const toast = document.createElement("div");
    toast.className = "toast toast-" + type;
    toast.innerHTML =
      '<i data-lucide="' +
      (TOAST_ICONS[type] || "info") +
      '" class="icon"></i><span>' +
      escapeHtml(message) +
      "</span>";
    container.appendChild(toast);
    refreshIcons();
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.2s ease";
      setTimeout(() => toast.remove(), 200);
    }, duration || 3200);
  }

  /* ------------------------------------------------------------------ */
  /* Modal helpers                                                        */
  /* ------------------------------------------------------------------ */

  function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add("open");
    el.style.display = "flex";
    document.body.style.overflow = "hidden";
    refreshIcons();
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("open");
    el.style.display = "none";
    document.body.style.overflow = "";
  }

  function initModalDismiss() {
    document.querySelectorAll(".modal-overlay, .modal-backdrop").forEach((overlay) => {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal(overlay.id);
      });
    });
    document.querySelectorAll("[data-close-modal], [data-modal-close]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-close-modal") || btn.getAttribute("data-modal-close");
        if (id) {
          closeModal(id);
        } else {
          const parentOverlay = btn.closest(".modal-overlay, .modal-backdrop");
          if (parentOverlay) closeModal(parentOverlay.id);
        }
      });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-overlay.open, .modal-backdrop.open").forEach((o) => closeModal(o.id));
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Layout wiring: sidebar, topbar, notifications, user menu             */
  /* ------------------------------------------------------------------ */

  function currentPageName() {
    const path = global.location.pathname.split("/").pop() || "dashboard.html";
    return path;
  }

  function initSidebarActive() {
    const page = currentPageName();
    document.querySelectorAll(".nav-link").forEach((link) => {
      const hrefBase = (link.getAttribute("href") || "").split("?")[0].split("#")[0];
      if (hrefBase === page || (page === "" && hrefBase === "dashboard.html")) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  }

  // Every user has the same private workspace: one flat navigation, no roles.
  function renderSidebar() {
    const nav = document.querySelector(".sidebar-nav");
    if (!nav) return;
    // Remove leftovers of the old role-based navigation if any page still contains them
    nav.querySelectorAll(
      "[data-role], .sidebar-team-link, .sidebar-team-label, a[href='team.html'], a[href='audit.html'], a[href='assigned.html'], a[href*='assigned=me'], a[href*='#invite']"
    ).forEach((el) => el.remove());
    initSidebarActive();
    refreshIcons();
  }

  function initMobileSidebar() {
    const toggle = document.querySelector(".sidebar-toggle");
    const sidebar = document.querySelector(".sidebar");
    const overlay = document.querySelector(".sidebar-overlay");
    if (!toggle || !sidebar) return;
    const open = () => {
      sidebar.classList.add("open");
      if (overlay) overlay.classList.add("open");
    };
    const close = () => {
      sidebar.classList.remove("open");
      if (overlay) overlay.classList.remove("open");
    };
    toggle.addEventListener("click", () => {
      sidebar.classList.contains("open") ? close() : open();
    });
    if (overlay) overlay.addEventListener("click", close);
    sidebar.querySelectorAll(".nav-link").forEach((l) => l.addEventListener("click", close));
  }

  function initDropdowns() {
    document.querySelectorAll("[data-dropdown-trigger]").forEach((trigger) => {
      const targetId = trigger.getAttribute("data-dropdown-trigger");
      const panel = document.getElementById(targetId);
      if (!panel) return;
      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        const willOpen = !panel.classList.contains("open");
        document.querySelectorAll(".dropdown-panel.open").forEach((p) => p.classList.remove("open"));
        if (willOpen) panel.classList.add("open");
      });
    });
    document.addEventListener("click", () => {
      document.querySelectorAll(".dropdown-panel.open").forEach((p) => p.classList.remove("open"));
    });
  }

  function initials(name) {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    return ((parts[0] || "")[0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
  }

  function renderTopbarUser() {
    const user = getCurrentUser();
    document.querySelectorAll("[data-user-name]").forEach((el) => (el.textContent = user.fullName || "User"));
    document.querySelectorAll("[data-user-email]").forEach((el) => (el.textContent = user.email || ""));
    document.querySelectorAll("[data-user-initials]").forEach((el) => {
      if (user.avatar) {
        el.innerHTML = `<img src="${user.avatar}" alt="${user.fullName || 'User'}" class="avatar-img" />`;
        el.classList.add("has-avatar-img");
      } else {
        el.textContent = initials(user.fullName);
        el.classList.remove("has-avatar-img");
      }
    });
    const profLarge = document.getElementById("profileAvatarLarge");
    if (profLarge) {
      if (user.avatar) {
        profLarge.innerHTML = `<img src="${user.avatar}" alt="${user.fullName || 'User'}" class="avatar-img" />`;
        profLarge.classList.add("has-avatar-img");
      } else {
        profLarge.textContent = initials(user.fullName);
        profLarge.classList.remove("has-avatar-img");
      }
    }
    document.querySelectorAll(".role-pill-badge").forEach((el) => el.remove());

    // Ensure Settings link in dropdown panel and remove redundant profile link
    const userPanel = document.getElementById("userPanel");
    if (userPanel) {
      const oldProf = userPanel.querySelector("a[href='profile.html']");
      if (oldProf) oldProf.remove();
      if (!userPanel.querySelector("a[href='settings.html']")) {
        const firstItem = userPanel.querySelector(".dropdown-item");
        const settingsLink = document.createElement("a");
        settingsLink.href = "settings.html";
        settingsLink.className = "dropdown-item";
        settingsLink.innerHTML = `<i data-lucide="settings" class="icon"></i>Settings`;
        if (firstItem) {
          userPanel.insertBefore(settingsLink, firstItem);
        } else {
          userPanel.appendChild(settingsLink);
        }
      }
    }
  }

  function buildNotifications() {
    const renewals = getRenewals();
    const items = [];
    renewals.forEach((r) => {
      const status = computeStatus(r);
      const days = daysRemaining(r.expiryDate);
      if (status === "expired") {
        items.push({
          recordId: r.id,
          name: r.name,
          title: r.name + " has expired",
          detail: Math.abs(days) + " day(s) overdue",
          urgency: "expired",
          date: r.expiryDate,
        });
      } else if (status === "due-soon") {
        items.push({
          recordId: r.id,
          name: r.name,
          title: r.name + " is due soon",
          detail: "Expires in " + days + " day(s)",
          urgency: "due-soon",
          date: r.expiryDate,
        });
      }
    });
    items.sort((a, b) => (a.date > b.date ? 1 : -1));
    return items;
  }

  function renderNotifications() {
    const list = document.getElementById("notifList");
    const dot = document.getElementById("notifDot");
    const countEl = document.getElementById("notifCount");
    if (!list) return;
    const lang = getLanguage();
    const dict = I18N[lang] || I18N.en;
    const items = buildNotifications();
    if (dot) dot.style.display = items.length ? "block" : "none";
    if (countEl) countEl.textContent = items.length;
    if (!items.length) {
      list.innerHTML = `<div class="notif-empty">${escapeHtml(dict.allCaughtUp)}</div>`;
      return;
    }
    list.innerHTML =
      items
        .slice(0, 8)
        .map(
          (n) => `
      <div class="notif-item">
        <div class="notif-body">
          <strong>${escapeHtml(n.title)}</strong>
          <span>${escapeHtml(n.detail)}</span>
        </div>
        <div class="notif-actions">
          <button type="button" class="notif-btn-snooze" onclick="RTS.snoozeAndRefresh('${n.recordId}', 7)" title="${escapeHtml(dict.snooze1Week)}">
            <i data-lucide="clock" class="icon" style="width:11px;height:11px;"></i> ${escapeHtml(dict.snooze1Week)}
          </button>
          <a href="details.html?id=${n.recordId}" class="notif-btn-view" title="View details">
            <i data-lucide="chevron-right" class="icon" style="width:13px;height:13px;"></i>
          </a>
        </div>
      </div>`
        )
        .join("") +
      `<div class="notif-footer"><a href="reminders.html" class="link">${escapeHtml(dict.viewAllReminders)} →</a></div>`;
    refreshIcons();
  }

  function snoozeAndRefresh(recordId, days) {
    snoozeReminder(recordId, days);
    const lang = getLanguage();
    const dict = I18N[lang] || I18N.en;
    showToast(dict.snoozeSuccess.replace("{days}", days || 7), "success");
    renderNotifications();
    if (global.RemindersPage && typeof global.RemindersPage.render === "function") {
      global.RemindersPage.render();
    }
    if (global.RecordsPage && typeof global.RecordsPage.render === "function") {
      global.RecordsPage.render();
    }
  }

  function initLogout() {
    document.querySelectorAll("[data-logout]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        logout();
      });
    });
  }

  function initGlobalSearch() {
    const input = document.getElementById("globalSearch");
    if (!input) return;
    const existingKbd = input.parentElement ? input.parentElement.querySelector(".search-kbd") : null;
    if (existingKbd) existingKbd.remove();
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && input.value.trim()) {
        global.location.href = "records.html?q=" + encodeURIComponent(input.value.trim());
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* i18n DOM translation application                                    */
  /* ------------------------------------------------------------------ */

  function applyTranslations() {
    const lang = getLanguage();
    const dict = I18N[lang] || I18N.en;

    // Sidebar navigation mapping
    const navMap = {
      "dashboard.html": dict.dashboard,
      "records.html": dict.records,
      "calendar.html": dict.calendar,
      "reminders.html": dict.reminders,
      "history.html": dict.history,
      "documents.html": dict.documents,
      "reports.html": dict.reports,
      "settings.html": dict.settings,
    };
    document.querySelectorAll(".sidebar-nav .nav-link").forEach((link) => {
      const href = link.getAttribute("href");
      if (navMap[href]) {
        const icon = link.querySelector(".icon");
        link.textContent = "";
        if (icon) link.appendChild(icon);
        link.appendChild(document.createTextNode(" " + navMap[href]));
      }
    });

    document.querySelectorAll(".sidebar-section-label").forEach((el) => {
      if (el.textContent.trim().toLowerCase() === "main" || el.textContent.trim() === "முதன்மை" || (el.parentElement && el === el.parentElement.querySelector(".sidebar-section-label"))) {
        el.textContent = dict.main;
      } else {
        el.textContent = dict.account;
      }
    });

    // Topbar search placeholder
    const globalSearch = document.getElementById("globalSearch");
    if (globalSearch) globalSearch.placeholder = dict.searchPlaceholder;

    // Direct elements with data-i18n
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (dict[key]) {
        const icon = el.querySelector(".icon");
        if (icon) {
          el.innerHTML = "";
          el.appendChild(icon);
          el.appendChild(document.createTextNode(" " + dict[key]));
        } else {
          el.textContent = dict[key];
        }
      }
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (dict[key]) el.placeholder = dict[key];
    });

    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      if (dict[key]) el.title = dict[key];
    });

    refreshIcons();
  }

  function initLanguageToggle() {
    const existing = document.getElementById("langToggleBtn");
    if (existing) {
      existing.remove();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Ctrl+K Command Palette                                              */
  /* ------------------------------------------------------------------ */

  let cmdSelectedIndex = 0;
  let cmdCurrentItems = [];

  function ensureCommandPaletteModal() {
    let modal = document.getElementById("cmdPaletteModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "cmdPaletteModal";
    modal.className = "cmd-palette-overlay";
    modal.innerHTML = `
      <div class="cmd-palette-box">
        <div class="cmd-palette-header">
          <i data-lucide="search" class="icon"></i>
          <input type="text" id="cmdPaletteInput" placeholder="Type a command, page name, or renewal…" autocomplete="off" />
          <kbd class="cmd-kbd">ESC</kbd>
        </div>
        <div class="cmd-palette-body" id="cmdPaletteResults"></div>
        <div class="cmd-palette-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
          <span><kbd>↵</kbd> Select</span>
          <span><kbd>ESC</kbd> Close</span>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeCommandPalette();
    });

    const input = modal.querySelector("#cmdPaletteInput");
    input.addEventListener("input", () => {
      cmdSelectedIndex = 0;
      renderCommandPaletteResults(input.value);
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (cmdCurrentItems.length > 0) {
          cmdSelectedIndex = (cmdSelectedIndex + 1) % cmdCurrentItems.length;
          highlightCmdItem();
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (cmdCurrentItems.length > 0) {
          cmdSelectedIndex = (cmdSelectedIndex - 1 + cmdCurrentItems.length) % cmdCurrentItems.length;
          highlightCmdItem();
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (cmdCurrentItems[cmdSelectedIndex]) {
          cmdCurrentItems[cmdSelectedIndex].action();
          closeCommandPalette();
        }
      } else if (e.key === "Escape") {
        closeCommandPalette();
      }
    });

    return modal;
  }

  function highlightCmdItem() {
    const list = document.getElementById("cmdPaletteResults");
    if (!list) return;
    const items = list.querySelectorAll(".cmd-item");
    items.forEach((item, idx) => {
      if (idx === cmdSelectedIndex) {
        item.classList.add("selected");
        item.scrollIntoView({ block: "nearest" });
      } else {
        item.classList.remove("selected");
      }
    });
  }

  function renderCommandPaletteResults(query) {
    const container = document.getElementById("cmdPaletteResults");
    if (!container) return;
    const q = (query || "").trim().toLowerCase();
    const lang = getLanguage();
    const dict = I18N[lang] || I18N.en;

    const pages = [
      { title: dict.dashboard, sub: "Overview & key metrics", icon: "layout-dashboard", href: "dashboard.html" },
      { title: dict.records, sub: "Manage contracts, licenses & warranties", icon: "file-text", href: "records.html" },
      { title: dict.calendar, sub: "Timeline of renewal expiry dates", icon: "calendar", href: "calendar.html" },
      { title: dict.reminders, sub: "Stay ahead of deadlines", icon: "bell", href: "reminders.html" },
      { title: dict.history, sub: "Audit trail of renewals", icon: "history", href: "history.html" },
      { title: dict.documents, sub: "Contracts, files & attachments", icon: "folder", href: "documents.html" },
      { title: dict.reports, sub: "Executive spending & status summaries", icon: "bar-chart-2", href: "reports.html" },
      { title: dict.settings, sub: "Preferences, team & profile", icon: "settings", href: "settings.html" },
    ];

    const actions = [
      {
        title: dict.addNewRenewal,
        sub: "Create a new tracked renewal record",
        icon: "plus-circle",
        action: () => {
          if (global.location.pathname.includes("records.html")) {
            if (global.RecordsPage && global.RecordsPage.openAdd) global.RecordsPage.openAdd();
          } else {
            global.location.href = "records.html#add";
          }
        },
      },
      {
        title: dict.importCsv,
        sub: "Upload spreadsheet to bulk-add renewals",
        icon: "upload-cloud",
        action: () => {
          if (global.location.pathname.includes("records.html")) {
            openModal("importModal");
          } else {
            global.location.href = "records.html#import";
          }
        },
      },
      {
        title: dict.exportCalendar,
        sub: "Download .ics file for Google / Outlook / Apple Calendar",
        icon: "calendar",
        action: () => {
          exportICS("all-renewals.ics", getRenewals());
          showToast("Exported renewals calendar (.ics)", "success");
        },
      },
    ];

    const renewals = getRenewals();
    const matchingRenewals = renewals.filter((r) => {
      if (!q) return false;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.organization || "").toLowerCase().includes(q) ||
        (r.category || "").toLowerCase().includes(q) ||
        (r.code || "").toLowerCase().includes(q) ||
        (r.referenceNumber || "").toLowerCase().includes(q)
      );
    });

    const matchingPages = pages.filter((p) => !q || p.title.toLowerCase().includes(q) || p.sub.toLowerCase().includes(q));
    const matchingActions = actions.filter((a) => !q || a.title.toLowerCase().includes(q) || a.sub.toLowerCase().includes(q));

    cmdCurrentItems = [];
    let html = "";

    if (matchingRenewals.length > 0) {
      html += `<div class="cmd-section-title">${escapeHtml(dict.cmdRenewals)} (${matchingRenewals.length})</div>`;
      matchingRenewals.slice(0, 6).forEach((r) => {
        const idx = cmdCurrentItems.length;
        cmdCurrentItems.push({
          action: () => { global.location.href = `details.html?id=${r.id}`; },
        });
        const status = computeStatus(r);
        html += `
          <div class="cmd-item" data-index="${idx}" onclick="cmdCurrentItems[${idx}].action()">
            <div class="cmd-item-icon"><i data-lucide="file-check" class="icon"></i></div>
            <div class="cmd-item-text">
              <div class="cmd-item-title">${escapeHtml(r.name)} <span class="cmd-code">${r.code}</span></div>
              <div class="cmd-item-sub">${escapeHtml(r.category)} • ${escapeHtml(r.organization || "—")} • Expires ${formatDate(r.expiryDate)}</div>
            </div>
            <div class="cmd-item-badge">${statusBadgeHtml(status)}</div>
          </div>
        `;
      });
    }

    if (matchingActions.length > 0) {
      html += `<div class="cmd-section-title">${escapeHtml(dict.cmdActions)}</div>`;
      matchingActions.forEach((a) => {
        const idx = cmdCurrentItems.length;
        cmdCurrentItems.push({ action: a.action });
        html += `
          <div class="cmd-item" data-index="${idx}" onclick="cmdCurrentItems[${idx}].action()">
            <div class="cmd-item-icon"><i data-lucide="${a.icon}" class="icon"></i></div>
            <div class="cmd-item-text">
              <div class="cmd-item-title">${escapeHtml(a.title)}</div>
              <div class="cmd-item-sub">${escapeHtml(a.sub)}</div>
            </div>
          </div>
        `;
      });
    }

    if (matchingPages.length > 0) {
      html += `<div class="cmd-section-title">${escapeHtml(dict.cmdPages)}</div>`;
      matchingPages.forEach((p) => {
        const idx = cmdCurrentItems.length;
        cmdCurrentItems.push({ action: () => { global.location.href = p.href; } });
        html += `
          <div class="cmd-item" data-index="${idx}" onclick="cmdCurrentItems[${idx}].action()">
            <div class="cmd-item-icon"><i data-lucide="${p.icon}" class="icon"></i></div>
            <div class="cmd-item-text">
              <div class="cmd-item-title">${escapeHtml(p.title)}</div>
              <div class="cmd-item-sub">${escapeHtml(p.sub)}</div>
            </div>
          </div>
        `;
      });
    }

    if (cmdCurrentItems.length === 0) {
      html = `<div class="cmd-empty">${escapeHtml(dict.cmdNoResults)}</div>`;
    }

    container.innerHTML = html;
    highlightCmdItem();
    refreshIcons();
  }

  function openCommandPalette() {
    const modal = ensureCommandPaletteModal();
    modal.classList.add("open");
    const input = modal.querySelector("#cmdPaletteInput");
    input.value = "";
    cmdSelectedIndex = 0;
    renderCommandPaletteResults("");
    setTimeout(() => input.focus(), 60);
  }

  function closeCommandPalette() {
    const modal = document.getElementById("cmdPaletteModal");
    if (modal) modal.classList.remove("open");
  }

  function initGlobalKeyboardShortcuts() {
    // Ctrl+K removed
  }

  /* ------------------------------------------------------------------ */
  /* iCalendar (.ics) Export                                             */
  /* ------------------------------------------------------------------ */

  function exportICS(filename, records) {
    if (!records || !records.length) {
      showToast("No records available to export.", "warning");
      return;
    }
    const pad = (n) => String(n).padStart(2, "0");
    const formatCalDate = (iso) => (iso ? iso.replace(/-/g, "") : "");

    const now = new Date();
    const stamp =
      now.getUTCFullYear() +
      pad(now.getUTCMonth() + 1) +
      pad(now.getUTCDate()) +
      "T" +
      pad(now.getUTCHours()) +
      pad(now.getUTCMinutes()) +
      pad(now.getUTCSeconds()) +
      "Z";

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//RenewGaurd//Renewal Tracking System//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:RenewGaurd Expirations",
    ];

    records.forEach((r) => {
      const dt = formatCalDate(r.expiryDate);
      if (!dt) return;
      const nextDay = formatCalDate(addDays(r.expiryDate, 1));
      const summary = `Renewal Due: ${r.name}`;
      const desc = `Category: ${r.category}\\nOrganization: ${r.organization || "—"}\\nCost: ${r.currency || "USD"} ${r.cost || 0}\\nPriority: ${r.priority || "Medium"}\\nCycle: ${r.recurringCycle || "Yearly"}\\nRecord ID: ${r.code}`;

      lines.push(
        "BEGIN:VEVENT",
        `UID:${r.id || uid("cal")}@renewgaurd.com`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${dt}`,
        `DTEND;VALUE=DATE:${nextDay}`,
        `SUMMARY:${summary.replace(/,/g, "\\,").replace(/;/g, "\\;")}`,
        `DESCRIPTION:${desc.replace(/,/g, "\\,").replace(/;/g, "\\;")}`,
        "STATUS:CONFIRMED",
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        "TRIGGER:-P7D",
        `DESCRIPTION:Reminder: ${r.name} expires in 7 days`,
        "END:VALARM",
        "END:VEVENT"
      );
    });

    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || "renewals-calendar.ics";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /* ------------------------------------------------------------------ */
  /* CSV Import & Template Helpers                                       */
  /* ------------------------------------------------------------------ */

  function normalizeDate(val) {
    if (!val && val !== 0) return "";
    if (val instanceof Date && !isNaN(val.getTime())) {
      try {
        return val.toISOString().slice(0, 10);
      } catch (e) {
        return "";
      }
    }
    // Handle Excel serial date numbers (e.g. 45678)
    if (typeof val === "number" || (!isNaN(val) && Number(val) > 20000 && Number(val) < 70000)) {
      const n = Number(val);
      const d = new Date(Math.round((n - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    let s = String(val).trim();
    if (!s) return "";

    // ISO format: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    // YYYY/MM/DD or YYYY.MM.DD
    if (/^\d{4}[\/\.]\d{1,2}[\/\.]\d{1,2}$/.test(s)) {
      const p = s.split(/[\/\.]/);
      return `${p[0]}-${p[1].padStart(2, "0")}-${p[2].padStart(2, "0")}`;
    }

    // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (dmy) {
      const p1 = parseInt(dmy[1], 10);
      const p2 = parseInt(dmy[2], 10);
      const y = dmy[3];
      if (p1 > 12) {
        return `${y}-${String(p2).padStart(2, "0")}-${String(p1).padStart(2, "0")}`;
      }
      if (p2 > 12) {
        return `${y}-${String(p1).padStart(2, "0")}-${String(p2).padStart(2, "0")}`;
      }
      return `${y}-${String(p2).padStart(2, "0")}-${String(p1).padStart(2, "0")}`;
    }

    // Standard date parsing
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      try {
        const yr = parsed.getFullYear();
        if (yr >= 1990 && yr <= 2100) {
          const m = String(parsed.getMonth() + 1).padStart(2, "0");
          const d = String(parsed.getDate()).padStart(2, "0");
          return `${yr}-${m}-${d}`;
        }
      } catch (e) {}
    }

    return "";
  }

  function mapRowToRecord(vals, headers) {
    if (!vals || !headers) return null;
    const obj = {};
    let foundDate = "";
    let firstNonEmptyText = "";

    headers.forEach((h, idx) => {
      const rawVal = vals[idx] !== undefined && vals[idx] !== null ? String(vals[idx]).trim() : "";
      if (!firstNonEmptyText && rawVal && isNaN(rawVal) && rawVal.length > 1) {
        firstNonEmptyText = rawVal;
      }
      // Check if value itself looks like a date
      if (!foundDate && rawVal && (/\d{4}[\-\/\.]\d{1,2}[\-\/\.]\d{1,2}/.test(rawVal) || /\d{1,2}[\-\/\.]\d{1,2}[\-\/\.]\d{4}/.test(rawVal))) {
        foundDate = normalizeDate(rawVal);
      }

      // 1. Record Name / Title / Item
      if (
        h.includes("name") ||
        h.includes("title") ||
        h.includes("record") ||
        h.includes("service") ||
        h.includes("item") ||
        h.includes("software") ||
        h.includes("contract") ||
        h.includes("license") ||
        h.includes("certificate") ||
        h.includes("subscription") ||
        h.includes("domain") ||
        h.includes("asset") ||
        h.includes("product") ||
        h.includes("description") ||
        h === "desc"
      ) {
        if (!obj.name && rawVal) obj.name = rawVal;
      }
      // 2. Expiry / Due / Renewal Date
      else if (
        h.includes("exp") ||
        h.includes("due") ||
        h.includes("renew") ||
        h.includes("end") ||
        h.includes("valid") ||
        h.includes("deadline") ||
        h.includes("finish") ||
        h.includes("until") ||
        h.includes("maturity") ||
        h === "date"
      ) {
        if (!obj.expiryDate) obj.expiryDate = normalizeDate(rawVal);
      }
      // 3. Category / Type
      else if (h.includes("cat") || h.includes("type") || h.includes("kind") || h.includes("group") || h.includes("class") || h.includes("dept") || h.includes("sector")) {
        if (!obj.category && rawVal) obj.category = rawVal;
      }
      // 4. Provider / Organization / Vendor
      else if (
        h.includes("org") ||
        h.includes("prov") ||
        h.includes("vendor") ||
        h.includes("company") ||
        h.includes("issuer") ||
        h.includes("supplier") ||
        h.includes("partner") ||
        h.includes("source") ||
        h.includes("client") ||
        h.includes("account") ||
        h.includes("brand")
      ) {
        if (!obj.organization && rawVal) obj.organization = rawVal;
      }
      // 5. Cost / Amount
      else if (
        h.includes("cost") ||
        h.includes("price") ||
        h.includes("amount") ||
        h.includes("fee") ||
        h.includes("charge") ||
        h.includes("rate") ||
        h.includes("val") ||
        h.includes("sum") ||
        h.includes("total") ||
        h.includes("bill")
      ) {
        const cleaned = rawVal.replace(/[^\d.]/g, "");
        obj.cost = parseFloat(cleaned) || 0;
        if (rawVal.includes("₹")) obj.currency = "INR";
        else if (rawVal.includes("€")) obj.currency = "EUR";
        else if (rawVal.includes("£")) obj.currency = "GBP";
      }
      // 6. Currency
      else if (h.includes("curr")) {
        if (rawVal) obj.currency = rawVal.toUpperCase();
      }
      // 7. Priority
      else if (h.includes("prior") || h.includes("urg") || h.includes("level") || h.includes("prio")) {
        if (rawVal) obj.priority = rawVal;
      }
      // 9. Recurring Cycle
      else if (h.includes("cycle") || h.includes("recur") || h.includes("freq") || h.includes("period") || h.includes("interval")) {
        if (rawVal) obj.recurringCycle = rawVal;
      }
      // 10. Issue / Start Date
      else if (h.includes("issue") || h.includes("start") || h.includes("begin") || h.includes("create") || h.includes("from")) {
        if (!obj.issueDate) obj.issueDate = normalizeDate(rawVal);
      }
      // 11. Reminder Date
      else if (h.includes("remind") || h.includes("alert") || h.includes("notify")) {
        if (!obj.reminderDate) obj.reminderDate = normalizeDate(rawVal);
      }
      // 12. Reference Number
      else if (h.includes("ref") || h.includes("serial") || h.includes("code") || h.includes("policy") || h.includes("invoice") || h.includes("id")) {
        if (!obj.referenceNumber && rawVal) obj.referenceNumber = rawVal;
      }
      // 13. Notes
      else if (h.includes("note") || h.includes("comment") || h.includes("remark") || h.includes("info")) {
        if (!obj.notes && rawVal) obj.notes = rawVal;
      }
    });

    // Fallbacks
    if (!obj.name) {
      obj.name = firstNonEmptyText || (vals[0] ? String(vals[0]).trim() : "");
    }
    if (!obj.name || obj.name.trim() === "") return null;

    if (!obj.expiryDate) {
      obj.expiryDate = foundDate || addDays(todayISO(), 365);
    }

    // Category mapping
    const catMatch = CATEGORIES.find((c) => c.toLowerCase() === (obj.category || "").toLowerCase());
    obj.category = catMatch || (obj.category && obj.category.trim() ? obj.category.trim() : "Contract");

    // Priority mapping
    const prioLower = (obj.priority || "").toLowerCase();
    if (prioLower.includes("high") || prioLower.includes("crit")) obj.priority = "High";
    else if (prioLower.includes("low")) obj.priority = "Low";
    else obj.priority = "Medium";

    // Cycle mapping
    const cycleLower = (obj.recurringCycle || "").toLowerCase();
    if (cycleLower.includes("month")) obj.recurringCycle = "Monthly";
    else if (cycleLower.includes("quart")) obj.recurringCycle = "Quarterly";
    else if (cycleLower.includes("one") || cycleLower.includes("none")) obj.recurringCycle = "One-time";
    else obj.recurringCycle = "Yearly";

    if (!obj.currency || !CURRENCIES.includes(obj.currency)) obj.currency = "USD";
    if (obj.cost === undefined) obj.cost = 0;
    if (!obj.issueDate) obj.issueDate = todayISO();
    if (!obj.reminderDate) obj.reminderDate = addDays(obj.expiryDate, -14);

    return obj;
  }

  function parseCSVText(csvText) {
    if (!csvText || typeof csvText !== "string") return [];
    csvText = csvText.replace(/^\uFEFF/, "");

    const firstLine = csvText.split(/\r?\n/).find((l) => l.trim().length > 0) || "";
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const pipeCount = (firstLine.match(/\|/g) || []).length;

    let delim = ",";
    if (semiCount > commaCount && semiCount > tabCount) delim = ";";
    else if (tabCount > commaCount && tabCount > semiCount) delim = "\t";
    else if (pipeCount > commaCount && pipeCount > semiCount) delim = "|";

    const lines = [];
    let row = [];
    let inQuotes = false;
    let cur = "";

    for (let i = 0; i < csvText.length; i++) {
      const c = csvText[i];
      const next = csvText[i + 1];
      if (c === '"') {
        if (inQuotes && next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === delim && !inQuotes) {
        row.push(cur.trim());
        cur = "";
      } else if ((c === "\r" || c === "\n") && !inQuotes) {
        if (c === "\r" && next === "\n") i++;
        row.push(cur.trim());
        cur = "";
        if (row.some((cell) => cell.length > 0)) lines.push(row);
        row = [];
      } else {
        cur += c;
      }
    }
    if (cur.length > 0 || row.length > 0) {
      row.push(cur.trim());
      if (row.some((cell) => cell.length > 0)) lines.push(row);
    }
    if (lines.length < 2) return [];

    const headers = lines[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const records = [];

    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i];
      const rec = mapRowToRecord(vals, headers);
      if (rec) records.push(rec);
    }
    return records;
  }

  function parseSheetRows(sheetRows) {
    if (!Array.isArray(sheetRows) || !sheetRows.length) return [];
    const records = [];
    sheetRows.forEach((rowObj) => {
      if (typeof rowObj !== "object" || !rowObj) return;
      const keys = Object.keys(rowObj);
      const headers = keys.map((k) => k.toLowerCase().replace(/[^a-z0-9]/g, ""));
      const vals = keys.map((k) => rowObj[k]);
      const rec = mapRowToRecord(vals, headers);
      if (rec) records.push(rec);
    });
    return records;
  }

  function importRecords(recordsArray) {
    if (!recordsArray || !recordsArray.length) return 0;
    const currentList = getRenewals();
    let nextIdx = currentList.length + 1;
    const newRecords = recordsArray.map((data) => {
      const rec = Object.assign(
        {
          id: uid("ren"),
          code: recordCode(nextIdx++),
          documents: [],
          history: [],
          reminderCompleted: false,
          lastRenewedAt: null,
          createdAt: new Date().toISOString(),
        },
        data
      );
      return rec;
    });
    const combined = [...newRecords, ...currentList];
    saveRenewals(combined);

    newRecords.forEach((r) => {
      syncRenewalToBackend("POST", "/api/renewals", r);
    });

    broadcastDataSync({ count: newRecords.length, imported: true });

    return newRecords.length;
  }

  function downloadCSVTemplate() {
    const T = todayISO();
    const template =
      `Record Name,Category,Organization,Expiry Date,Issue Date,Renewal Cost,Currency,Priority,Reference Number,Recurring Cycle,Notes\n` +
      `"Google Workspace Business Plus","License","Google LLC","${addDays(T, 45)}","${addDays(T, -320)}",2160,"USD","High","GSUITE-2024","Yearly","Annual renewal for 15 seats"\n` +
      `"Office Building HVAC Maintenance","Contract","Apex Cooling Ltd","${addDays(T, 120)}","${addDays(T, -240)}",4500,"USD","Medium","SRV-MNT-99","Yearly","Quarterly HVAC inspection included"\n` +
      `"Slack Enterprise Grid","Subscription","Salesforce Inc","${addDays(T, 15)}","${addDays(T, -350)}",12000,"USD","High","SLK-2026","Monthly","Tier 1 messaging subscription"`;
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "RenewGaurd_Template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /* ------------------------------------------------------------------ */
  /* CSV export                                                           */
  /* ------------------------------------------------------------------ */

  function exportCSV(filename, rows, columns) {
    const header = columns.map((c) => '"' + c.label.replace(/"/g, '""') + '"').join(",");
    const lines = rows.map((row) =>
      columns
        .map((c) => {
          const val = typeof c.value === "function" ? c.value(row) : row[c.value];
          return '"' + String(val === undefined || val === null ? "" : val).replace(/"/g, '""') + '"';
        })
        .join(",")
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function ensureSeed() {
    seedAccount();
    seedData();
  }

  async function syncCurrentUserFromBackend() {
    if (!getToken()) return;
    try {
      const res = await fetch(apiUrl("/api/auth/me"), { headers: authHeaders() });
      if (res.status === 401) return handleUnauthorized();
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && data.user) {
          setCurrentUser(data.user);
          renderTopbarUser();
        }
      }
    } catch (e) {
      // Backend offline: keep working with cached data
    }
  }

  function initLayout() {
    ensureSeed();
    applyTheme(getSettings().theme);
    renderSidebar();
    initMobileSidebar();
    initDropdowns();
    initModalDismiss();
    renderTopbarUser();
    renderNotifications();
    initLogout();
    initGlobalSearch();
    initLanguageToggle();
    applyTranslations();
    refreshIcons();
    syncCurrentUserFromBackend();
    syncRenewalsFromBackend();
  }

  /* ------------------------------------------------------------------ */
  /* Public API                                                           */
  /* ------------------------------------------------------------------ */

  global.RTS = {
    KEYS: STORAGE_KEYS,
    CATEGORIES,
    PRIORITIES,
    CURRENCIES,
    RECURRING_CYCLES,
    uid,
    todayISO,
    addDays,
    daysBetween,
    daysRemaining,
    formatDate,
    formatMonthYear,
    formatCurrency,
    escapeHtml,
    debounce,
    refreshIcons,
    computeStatus,
    statusLabel,
    statusBadgeHtml,
    priorityBadgeHtml,
    calculateNextExpiry,
    cycleLabel,
    i18n: {
      getLanguage,
      setLanguage,
      t,
      applyTranslations,
      dict: I18N,
    },
    data: {
      getRenewals,
      saveRenewals,
      getRenewalById,
      addRenewal,
      updateRenewal,
      deleteRenewal,
      markAsRenewed,
      snoozeReminder,
      bulkRenew,
      bulkDelete,
      syncFromBackend: syncRenewalsFromBackend,
      whenSynced,
      uploadDocument,
      downloadDocument,
      deleteDocumentFromRenewal,
      toggleReminderCompleted,
      getAllDocuments,
      getAllHistory,
      clearAllRenewals,
    },
    auth: {
      login,
      logout,
      isLoggedIn,
      getCurrentUser,
      setCurrentUser,
      requireAuth,
      redirectIfAuthed,
      registerAccount,
      changePassword,
      updateProfile,
      deleteAccount,
      requestPasswordReset,
      verifyResetToken,
      resetPassword,
      getToken,
      headers: authHeaders,
    },
    settings: {
      getSettings,
      setSettings,
      applyTheme,
    },
    reminders: {
      async triggerCheck(force) {
        const res = await fetch(apiUrl("/api/reminders/trigger"), { method: "POST", headers: authHeaders(), body: JSON.stringify({ force }) });
        return res.json();
      },
      async sendTestEmail(targetEmail) {
        const res = await fetch(apiUrl("/api/reminders/test-email"), { method: "POST", headers: authHeaders(), body: JSON.stringify({ targetEmail }) });
        return res.json();
      },
      async getLogs(limit) {
        const res = await fetch(apiUrl("/api/reminders/logs?limit=" + (limit || 50)), { headers: authHeaders() });
        return res.json();
      },
      async getStatus() {
        const res = await fetch(apiUrl("/api/reminders/status"), { headers: authHeaders() });
        return res.json();
      },
      async getNotificationSettings() {
        const res = await fetch(apiUrl("/api/settings/notifications"), { headers: authHeaders() });
        return res.json();
      },
      async saveNotificationSettings(body) {
        const res = await fetch(apiUrl("/api/settings/notifications"), { method: "PUT", headers: authHeaders(), body: JSON.stringify(body) });
        return res.json();
      },
    },
    apiUrl,
    toast: showToast,
    modal: { open: openModal, close: closeModal },
    initLayout,
    ensureSeed,
    renderSidebar,
    exportCSV,
    exportICS,
    parseCSVText,
    parseSheetRows,
    normalizeDate,
    mapRowToRecord,
    importRecords,
    downloadCSVTemplate,
    openCommandPalette,
    closeCommandPalette,
    snoozeAndRefresh,
  };
})(window);
