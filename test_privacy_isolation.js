/* End-to-end check that every user's data is private.
   Usage:  node test_privacy_isolation.js      (starts its own server on a temp data dir, email sending disabled) */
process.env.SUPABASE_URL = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";
process.env.SUPABASE_ANON_KEY = "";
process.env.EMAIL_SEND_ENABLED = "false";
process.env.PORT = "3999";
process.env.DATA_DIR = require("fs").mkdtempSync(require("path").join(require("os").tmpdir(), "rh-"));
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";

const assert = require("assert");
const app = require("./server");
const BASE = "http://localhost:3999";
let passed = 0;

async function call(method, url, { token, body, headers } = {}) {
  const res = await fetch(BASE + url, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}), ...(headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch (e) {}
  return { status: res.status, json };
}
async function check(name, fn) {
  try { await fn(); passed++; console.log("  ✓", name); }
  catch (e) { console.error("  ✗", name, "\n     ", e.message); process.exitCode = 1; }
}
const renewal = (name) => ({ id: "ren-" + name, name, category: "License", expiryDate: "2030-01-01", organization: "Org" });

(async () => {
  await new Promise((r) => setTimeout(r, 500));
  let A, B;
  await check("anyone can register with name, email, password (no role needed)", async () => {
    const a = await call("POST", "/api/auth/register", { body: { fullName: "Alice", email: "alice@example.com", password: "Passw0rd!1" } });
    const b = await call("POST", "/api/auth/register", { body: { fullName: "Bob", email: "bob@example.com", password: "Passw0rd!2" } });
    assert.strictEqual(a.status, 201); assert.strictEqual(b.status, 201);
    assert.ok(!("role" in a.json.user), "user must not carry a role");
    A = a.json.token; B = b.json.token;
  });
  await check("duplicate email and weak password rejected", async () => {
    assert.strictEqual((await call("POST", "/api/auth/register", { body: { fullName: "X", email: "ALICE@example.com", password: "Passw0rd!1" } })).status, 409);
    assert.strictEqual((await call("POST", "/api/auth/register", { body: { fullName: "X", email: "x@example.com", password: "short" } })).status, 400);
  });
  await check("login works; wrong password fails", async () => {
    assert.strictEqual((await call("POST", "/api/auth/login", { body: { email: "alice@example.com", password: "Passw0rd!1" } })).status, 200);
    assert.strictEqual((await call("POST", "/api/auth/login", { body: { email: "alice@example.com", password: "nope1234" } })).status, 401);
  });
  await check("unauthenticated and header-spoofed requests are rejected", async () => {
    assert.strictEqual((await call("GET", "/api/renewals")).status, 401);
    assert.strictEqual((await call("GET", "/api/renewals", { headers: { "x-user-email": "alice@example.com" } })).status, 401);
    assert.strictEqual((await call("GET", "/api/renewals", { token: "tok-fake" })).status, 401);
  });
  await check("Alice creates a renewal; Bob cannot see it in lists", async () => {
    assert.strictEqual((await call("POST", "/api/renewals", { token: A, body: renewal("alice-1") })).status, 201);
    assert.strictEqual((await call("GET", "/api/renewals", { token: A })).json.data.length, 1);
    assert.strictEqual((await call("GET", "/api/renewals", { token: B })).json.data.length, 0);
  });
  await check("Bob cannot read, edit, delete, renew, snooze Alice's record by id (404)", async () => {
    for (const [m, u, body] of [["GET", "/api/renewals/ren-alice-1"], ["PUT", "/api/renewals/ren-alice-1", { name: "hacked" }], ["DELETE", "/api/renewals/ren-alice-1"], ["POST", "/api/renewals/ren-alice-1/mark-renewed", {}], ["POST", "/api/renewals/ren-alice-1/snooze", {}], ["POST", "/api/renewals/ren-alice-1/reminder-status", { reminderCompleted: true }]]) {
      assert.strictEqual((await call(m, u, { token: B, body })).status, 404, `${m} ${u}`);
    }
    assert.strictEqual((await call("GET", "/api/renewals/ren-alice-1", { token: A })).json.data.name, "alice-1");
  });
  await check("Bob cannot hijack Alice's record by POSTing the same id", async () => {
    const r = await call("POST", "/api/renewals", { token: B, body: renewal("alice-1") });
    assert.ok(r.status >= 400);
    assert.strictEqual((await call("GET", "/api/renewals/ren-alice-1", { token: A })).json.data.name, "alice-1");
  });
  await check("client cannot set ownerId to steal/plant records", async () => {
    await call("POST", "/api/renewals", { token: B, body: { ...renewal("bob-1"), ownerId: "someone-else" } });
    assert.strictEqual((await call("GET", "/api/renewals", { token: B })).json.data.length, 1);
    assert.strictEqual((await call("GET", "/api/renewals", { token: A })).json.data.length, 1);
  });
  await check("renewing keeps history and works for the owner", async () => {
    const r = await call("POST", "/api/renewals/ren-alice-1/mark-renewed", { token: A, body: { cost: 99 } });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.data.history.length, 1);
    assert.strictEqual(r.json.data.history[0].previousExpiry, "2030-01-01");
    assert.strictEqual((await call("GET", "/api/renewals/history", { token: B })).json.data.length, 0);
  });
  await check("documents: owner can upload/download/delete; others get 404", async () => {
    const content = Buffer.from("hello secret").toString("base64");
    const up = await call("POST", "/api/documents/ren-alice-1", { token: A, body: { name: "contract.pdf", content } });
    assert.strictEqual(up.status, 201);
    const docId = up.json.data.id;
    assert.strictEqual((await call("POST", "/api/documents/ren-alice-1", { token: B, body: { name: "x.pdf", content } })).status, 404);
    const dl = await fetch(`${BASE}/api/documents/ren-alice-1/${docId}/file`, { headers: { Authorization: "Bearer " + A } });
    assert.strictEqual(await dl.text(), "hello secret");
    assert.strictEqual((await fetch(`${BASE}/api/documents/ren-alice-1/${docId}/file`, { headers: { Authorization: "Bearer " + B } })).status, 404);
    assert.strictEqual((await fetch(`${BASE}/api/documents/ren-alice-1/${docId}/file`)).status, 401);
    assert.strictEqual((await call("DELETE", `/api/documents/ren-alice-1/${docId}`, { token: B })).status, 404);
    assert.strictEqual((await call("POST", "/api/documents/ren-alice-1", { token: A, body: { name: "evil.exe", content } })).status, 400);
    assert.strictEqual((await call("DELETE", `/api/documents/ren-alice-1/${docId}`, { token: A })).status, 200);
  });
  await check("settings and reminder logs are per user", async () => {
    await call("PUT", "/api/settings/notifications", { token: A, body: { reminderDays: [10, 3], emailNotificationsEnabled: false } });
    assert.deepStrictEqual((await call("GET", "/api/settings/notifications", { token: A })).json.data.reminderDays, [10, 3]);
    assert.deepStrictEqual((await call("GET", "/api/settings/notifications", { token: B })).json.data.reminderDays, [30, 15, 7, 0]);
    assert.strictEqual((await call("GET", "/api/reminders/logs", { token: B })).json.count, 0);
    assert.strictEqual((await call("GET", "/api/reminders/logs")).status, 401);
    assert.strictEqual((await call("POST", "/api/reminders/test-email", { token: B, body: { targetEmail: "victim@example.com" } })).status, 400);
  });
  await check("removed admin/team/audit endpoints are gone", async () => {
    for (const u of ["/api/team/members", "/api/audit/logs", "/api/auth/users", "/api/renewals/assignees", "/api/settings/admin-info"]) {
      const r = await call("GET", u, { token: A });
      assert.ok([404].includes(r.status), `${u} -> ${r.status}`);
    }
  });
  await check("server files are not exposed over HTTP", async () => {
    for (const u of ["/data/store.json", "/.env", "/backend/db.js", "/package.json", "/data/.jwt_secret"]) {
      assert.strictEqual((await fetch(BASE + u)).status, 404, u);
    }
  });
  await check("change password requires login; profile update works", async () => {
    assert.strictEqual((await call("POST", "/api/auth/change-password", { body: { currentPassword: "Passw0rd!1", newPassword: "NewPassw0rd1" } })).status, 401);
    assert.strictEqual((await call("POST", "/api/auth/change-password", { token: A, body: { currentPassword: "Passw0rd!1", newPassword: "NewPassw0rd1" } })).status, 200);
    assert.strictEqual((await call("POST", "/api/auth/login", { body: { email: "alice@example.com", password: "NewPassw0rd1" } })).status, 200);
    assert.strictEqual((await call("PUT", "/api/auth/me", { token: A, body: { fullName: "Alice Smith", mobile: "123" } })).json.user.fullName, "Alice Smith");
  });
  await check("deleting an account removes only that user's data", async () => {
    assert.strictEqual((await call("DELETE", "/api/auth/me", { token: B, body: { password: "Passw0rd!2" } })).status, 200);
    assert.strictEqual((await call("GET", "/api/renewals", { token: B })).status, 401);
    assert.strictEqual((await call("GET", "/api/renewals", { token: A })).json.data.length, 1);
  });
  console.log(`\n${passed} checks passed${process.exitCode ? " (with failures)" : ""}`);
  process.exit(process.exitCode || 0);
})();
