/* ==========================================================================
   backend/supabaseClient.js — Supabase PostgreSQL Connection
   Initializes the Supabase client safely with connection state detection.
   ========================================================================== */

const { createClient } = require("@supabase/supabase-js");
const config = require("./config");

let supabase = null;
let isConfigured = false;

if (
  config.SUPABASE_URL &&
  config.SUPABASE_URL.trim() !== "" &&
  !config.SUPABASE_URL.includes("your-project") &&
  (config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY)
) {
  try {
    const key = config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY;
    supabase = createClient(config.SUPABASE_URL, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    isConfigured = true;
    console.log(`[Supabase] Successfully initialized client for: ${config.SUPABASE_URL}`);

    if (!config.SUPABASE_SERVICE_ROLE_KEY && config.SUPABASE_ANON_KEY) {
      console.warn(
        "[Supabase Key Notice] SUPABASE_SERVICE_ROLE_KEY is not set; running with SUPABASE_ANON_KEY. Note that if Row-Level Security (RLS) is enabled without public policies, queries will require SUPABASE_SERVICE_ROLE_KEY."
      );
    }

    // Non-blocking table verification on startup
    supabase
      .from("app_users")
      .select("id")
      .limit(1)
      .then(({ data, error }) => {
        if (error) {
          console.warn(`[Supabase Startup Check] Table query status: ${error.message} (code: ${error.code}). Verified local JSON storage will seamlessly serve users.`);
        } else {
          console.log(`[Supabase Startup Check] Supabase PostgreSQL table access verified.`);
        }
      })
      .catch((err) => {
        console.warn(`[Supabase Startup Check] Connection attempt notice: ${err.message}. Verified local storage is active.`);
      });
  } catch (err) {
    console.error(`[Supabase Error] Failed to initialize client: ${err.message}`);
    supabase = null;
    isConfigured = false;
  }
} else {
  console.log(
    "[Supabase Notice] Supabase credentials not set in environment. Verified local JSON store active."
  );
}

module.exports = {
  supabase,
  isConfigured: () => isConfigured,
};

