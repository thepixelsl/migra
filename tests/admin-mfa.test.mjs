import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { test } from "node:test";
import { Secret, TOTP } from "otpauth";
import { createBunnyRuntime } from "../server/bunny-server.mjs";
import { adminConfiguration, ADMIN_IDLE_MS, ADMIN_SESSION_SECONDS } from "../server/admin-auth.mjs";
import {
  TEST_ADMIN_SECRET, TEST_SETUP_TOKEN, TEST_ADMIN_ORIGIN, adminTestClient,
  enrollTestAdmin, loginTestAdmin, cookiePair, csrfFrom, secretFrom, totpCode,
} from "./helpers/admin-login.mjs";

async function fixture(t, env = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "artbild-mfa-test-"));
  const assets = path.join(dir, "dist");
  await mkdir(path.join(assets, "admin-termine"), { recursive: true });
  await writeFile(path.join(assets, "index.html"), "<h1>Public</h1>");
  await writeFile(path.join(assets, "admin-termine/index.html"), "<h1>Private</h1>");
  let clock = Math.floor(Date.now() / 30000) * 30000 + 5000;
  const baseEnv = {
    ADMIN_USERNAME: "york", ADMIN_PASSWORD: "dev-secret", ADMIN_SESSION_SECRET: TEST_ADMIN_SECRET,
    ADMIN_MFA_SETUP_TOKEN: TEST_SETUP_TOKEN, ADMIN_PUBLIC_ORIGIN: TEST_ADMIN_ORIGIN,
    BUNNY_DATABASE_URL: `file:${path.join(dir, "test.db")}`, ADMIN_EMAIL: "info@example.com",
    CONTACT_HASH_SALT: "test-hash-salt-no-production", ...env,
  };
  let runtime = await createBunnyRuntime({ env: baseEnv, assetDirectory: assets, contactMailer: async () => {}, now: () => clock });
  let address = await runtime.listen({ host: "127.0.0.1", port: 0 });
  let baseUrl = `http://127.0.0.1:${address.port}`;
  t.after(async () => { await runtime.close(); await rm(dir, { recursive: true, force: true }); });
  return {
    get runtime() { return runtime; }, get url() { return baseUrl; },
    get now() { return clock; }, advance(ms) { clock += ms; },
    get web() { return adminTestClient(baseUrl); },
    enroll() { return enrollTestAdmin(baseUrl, clock); },
    async login(secret) { clock += 30000; return loginTestAdmin(baseUrl, secret, clock); },
    async begin() {
      const r = await this.web.post({ username: "york", password: "dev-secret" });
      assert.equal(r.status, 303);
      const cookie = cookiePair(r);
      const html = await (await this.web.get(cookie)).text();
      return { cookie, html, csrf: csrfFrom(html) };
    },
    async access(cookie, endpoint = "/api/admin/availability") {
      return fetch(baseUrl + endpoint, { headers: cookie ? { Cookie: cookie } : {}, redirect: "manual" });
    },
    async restart(changes) {
      await runtime.close();
      Object.assign(baseEnv, changes);
      runtime = await createBunnyRuntime({ env: baseEnv, assetDirectory: assets, contactMailer: async () => {}, now: () => clock });
      address = await runtime.listen({ host: "127.0.0.1", port: 0 });
      baseUrl = `http://127.0.0.1:${address.port}`;
    },
  };
}

test("uses interoperable RFC 6238 defaults and known SHA1 test vectors", () => {
  const totp = new TOTP({ secret: Secret.fromUTF8("12345678901234567890"), digits: 8, period: 30, algorithm: "SHA1" });
  for (const [seconds, expected] of [[59, "94287082"], [1111111109, "07081804"], [1234567890, "89005924"], [20000000000, "65353130"]]) {
    assert.equal(totp.generate({ timestamp: seconds * 1000 }), expected);
  }
});

test("requires an independent key and a canonical HTTPS origin; never falls back to password", () => {
  const base = { ADMIN_USERNAME: "york", ADMIN_PASSWORD: "test-password", ADMIN_SESSION_SECRET: TEST_ADMIN_SECRET };
  assert.equal(adminConfiguration(base).configured, true);
  for (const env of [{ ...base, ADMIN_SESSION_SECRET: "" }, { ...base, ADMIN_PASSWORD: TEST_ADMIN_SECRET }, { ...base, ADMIN_PUBLIC_ORIGIN: "http://admin.example" }, { ...base, ADMIN_PUBLIC_ORIGIN: "https://evil@example.com" }, { ...base, ADMIN_PUBLIC_ORIGIN: "https://admin.example/path" }]) {
    assert.equal(adminConfiguration(env).configured, false);
  }
});

test("password and bootstrap proof cannot access admin until a real OTP is confirmed and backup acknowledged", async (t) => {
  const f = await fixture(t);
  const initial = await f.begin();
  assert.match(initial.html, /Einrichtungsschlüssel/);
  assert.equal(secretFrom(initial.html), "");
  assert.equal((await f.access(initial.cookie)).status, 401);
  const wrong = await f.web.post({ action: "authorize-setup", setup_token: "wrong", csrf: initial.csrf }, initial.cookie);
  assert.equal(wrong.status, 401);
  assert.equal(secretFrom(await wrong.text()), "");
  const authorized = await f.web.post({ action: "authorize-setup", setup_token: TEST_SETUP_TOKEN, csrf: initial.csrf }, initial.cookie);
  assert.equal(authorized.status, 303);
  const pending = cookiePair(authorized);
  const page = await f.web.get(pending);
  const html = await page.text();
  const secret = secretFrom(html);
  assert.ok(secret);
  assert.match(html, /src="data:image\/png;base64,/);
  assert.doesNotMatch(html, /<script|src="https?:/);
  assert.equal(page.headers.get("cache-control"), "private, no-store");
  assert.match(page.headers.get("content-security-policy"), /script-src 'none'/);
  assert.equal((await f.access(pending)).status, 401);
  const confirmed = await f.web.post({ action: "confirm-setup", code: totpCode(secret, f.now), csrf: csrfFrom(html) }, pending);
  assert.equal(confirmed.status, 303);
  const backupCookie = cookiePair(confirmed);
  assert.equal((await f.access(backupCookie)).status, 401);
  const backup = await (await f.web.get(backupCookie)).text();
  const codes = [...backup.matchAll(/<li><code>([^<]+)<\/code><\/li>/g)].map((m) => m[1]);
  assert.equal(codes.length, 10);
  const stored = await f.runtime.database.client.execute("SELECT * FROM admin_mfa_accounts");
  assert.equal(stored.rows.length, 1);
  const serialized = JSON.stringify(stored.rows);
  assert.ok(!serialized.includes(secret));
  for (const code of codes) assert.ok(!serialized.includes(code.replaceAll("-", "")));
  const noAck = await f.web.post({ action: "acknowledge", csrf: csrfFrom(backup) }, backupCookie);
  assert.equal(noAck.status, 400);
  const done = await f.web.post({ action: "acknowledge", saved: "yes", csrf: csrfFrom(backup) }, backupCookie);
  assert.equal(done.status, 303);
  assert.equal((await f.access(cookiePair(done))).status, 200);
  assert.equal((await f.access(backupCookie)).status, 401);
  assert.equal((await f.runtime.database.client.execute("SELECT * FROM admin_login_sessions WHERE payload_cipher IS NOT NULL")).rows.length, 0);
});

test("rejects cross-site, missing-Origin, duplicate fields and missing CSRF during enrollment", async (t) => {
  const f = await fixture(t);
  for (const headers of [{ Origin: "https://attacker.example" }, { Origin: "" }, { "Sec-Fetch-Site": "cross-site" }]) {
    assert.equal((await f.web.post({ username: "york", password: "dev-secret" }, "", "/admin-login/", headers)).status, 403);
  }
  const dup = await fetch(f.url + "/admin-login/", { method: "POST", headers: { Origin: TEST_ADMIN_ORIGIN, "Content-Type": "application/x-www-form-urlencoded" }, body: "username=york&username=attacker&password=dev-secret" });
  assert.equal(dup.status, 400);
  const pending = await f.begin();
  for (const csrf of ["", "incorrect"]) {
    assert.equal((await f.web.post({ action: "authorize-setup", setup_token: TEST_SETUP_TOKEN, csrf }, pending.cookie)).status, 403);
  }
  const rows = await f.runtime.database.client.execute("SELECT * FROM admin_mfa_accounts");
  assert.equal(rows.rows.length, 0);
});

test("enrollment requires bootstrap configuration and incorrect encryption keys fail closed after activation", async (t) => {
  const f = await fixture(t, { ADMIN_MFA_SETUP_TOKEN: "" });
  assert.equal((await f.web.post({ username: "york", password: "dev-secret" })).status, 503);
  await f.restart({ ADMIN_MFA_SETUP_TOKEN: TEST_SETUP_TOKEN });
  const enrolled = await f.enroll();
  await f.restart({ ADMIN_SESSION_SECRET: Buffer.alloc(32, 9).toString("base64url") });
  const original = console.error;
  console.error = () => {};
  try { assert.equal((await f.web.post({ username: "york", password: "dev-secret" })).status, 503); }
  finally { console.error = original; }
  assert.equal((await f.access(enrolled.cookie)).status, 401);
  assert.equal((await fetch(f.url + "/healthz")).status, 200);
  assert.equal((await fetch(f.url + "/")).status, 200);
});

test("rejects used, expired and far-future codes and consumes a valid code only once under concurrency", async (t) => {
  const f = await fixture(t);
  const enrolled = await f.enroll();
  let pending = await f.begin();
  const verify = (code) => f.web.post({ action: "verify", code, csrf: pending.csrf }, pending.cookie);
  assert.equal((await verify(totpCode(enrolled.secret, f.now))).status, 401);
  assert.equal((await verify(totpCode(enrolled.secret, f.now - 120000))).status, 401);
  assert.equal((await verify(totpCode(enrolled.secret, f.now + 120000))).status, 401);
  f.advance(30000);
  const result = await Promise.all([verify(totpCode(enrolled.secret, f.now)), verify(totpCode(enrolled.secret, f.now))]);
  assert.equal(result.filter((r) => r.status === 303).length, 1);
  assert.ok(result.every((r) => [303, 401, 403, 429].includes(r.status)));
  pending = await f.begin();
  assert.equal((await verify(totpCode(enrolled.secret, f.now))).status, 401);
});

test("correct passwords cannot reset or avoid the separate persistent second-factor budget", async (t) => {
  const f = await fixture(t);
  const enrolled = await f.enroll();
  for (let i = 0; i < 5; i++) {
    const pending = await f.begin();
    const bad = await f.web.post({ action: "verify", code: "invalid", csrf: pending.csrf }, pending.cookie);
    assert.equal(bad.status, 401);
  }
  const pending = await f.begin();
  f.advance(30000);
  const blocked = await f.web.post({ action: "verify", code: totpCode(enrolled.secret, f.now), csrf: pending.csrf }, pending.cookie);
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("retry-after")) > 0);
  await f.restart({});
  const afterRestart = await f.begin();
  assert.equal((await f.web.post({ action: "verify", code: totpCode(enrolled.secret, f.now), csrf: afterRestart.csrf }, afterRestart.cookie)).status, 429);
});

test("a recovery code is single-use, revokes sessions and requires a newly confirmed authenticator", async (t) => {
  const f = await fixture(t);
  const enrolled = await f.enroll();
  let pending = await f.begin();
  let response = await f.web.post({ action: "recover", recovery_code: enrolled.recoveryCodes[0], csrf: pending.csrf }, pending.cookie);
  assert.equal(response.status, 303);
  const recoverySession = cookiePair(response);
  assert.equal((await f.access(enrolled.cookie)).status, 401);
  assert.equal((await f.access(recoverySession)).status, 401);
  const setup = await (await f.web.get(recoverySession)).text();
  const replacementSecret = secretFrom(setup);
  assert.ok(replacementSecret && replacementSecret !== enrolled.secret);
  pending = await f.begin();
  assert.equal((await f.web.post({ action: "recover", recovery_code: enrolled.recoveryCodes[0], csrf: pending.csrf }, pending.cookie)).status, 401);
  response = await f.web.post({ action: "confirm-setup", code: totpCode(replacementSecret, f.now), csrf: csrfFrom(setup) }, recoverySession);
  assert.equal(response.status, 303);
  const backupCookie = cookiePair(response);
  const html = await (await f.web.get(backupCookie)).text();
  assert.ok(!html.includes(enrolled.recoveryCodes[0]));
  response = await f.web.post({ action: "acknowledge", saved: "yes", csrf: csrfFrom(html) }, backupCookie);
  assert.equal((await f.access(cookiePair(response))).status, 200);
  f.advance(30000);
  pending = await f.begin();
  assert.equal((await f.web.post({ action: "verify", code: totpCode(enrolled.secret, f.now), csrf: pending.csrf }, pending.cookie)).status, 401);
  assert.equal((await f.web.post({ action: "verify", code: totpCode(replacementSecret, f.now), csrf: pending.csrf }, pending.cookie)).status, 303);
});

test("server-side logout and logout-all invalidate replayed cookies and pending challenges", async (t) => {
  const f = await fixture(t);
  const enrolled = await f.enroll();
  let html = await (await f.web.get(enrolled.cookie, "/admin-security/")).text();
  const csrf = csrfFrom(html);
  assert.equal((await f.web.post({ action: "logout", csrf: "wrong" }, enrolled.cookie, "/admin-logout/")).status, 403);
  assert.equal((await f.web.get(enrolled.cookie, "/admin-logout/")).status, 405);
  assert.equal((await f.web.post({ action: "logout", csrf }, enrolled.cookie, "/admin-logout/")).status, 303);
  assert.equal((await f.access(enrolled.cookie)).status, 401);
  const first = await f.login(enrolled.secret);
  const second = await f.login(enrolled.secret);
  const pending = await f.begin();
  html = await (await f.web.get(first.cookie, "/admin-security/")).text();
  assert.equal((await f.web.post({ action: "logout-all", csrf: csrfFrom(html) }, first.cookie, "/admin-security/")).status, 303);
  for (const cookie of [first.cookie, second.cookie, pending.cookie]) assert.equal((await f.access(cookie)).status, 401);
  assert.equal((await f.runtime.database.client.execute("SELECT * FROM admin_login_sessions")).rows.length, 0);
});

test("expires idle/full/pre-auth sessions and invalidates sessions when the password changes", async (t) => {
  const f = await fixture(t);
  const enrolled = await f.enroll();
  f.advance(ADMIN_IDLE_MS);
  assert.equal((await f.access(enrolled.cookie)).status, 401);
  let login = await f.login(enrolled.secret);
  const start = f.now;
  while (f.now < start + ADMIN_SESSION_SECONDS * 1000) {
    f.advance(20 * 60 * 1000);
    const r = await f.access(login.cookie);
    assert.equal(r.status, f.now < start + ADMIN_SESSION_SECONDS * 1000 ? 200 : 401);
  }
  const pending = await f.begin();
  f.advance(10 * 60 * 1000);
  assert.equal((await f.web.post({ action: "verify", csrf: pending.csrf, code: totpCode(enrolled.secret, f.now) }, pending.cookie)).status, 403);
  login = await f.login(enrolled.secret);
  await f.restart({ ADMIN_PASSWORD: "new-password" });
  assert.equal((await f.access(login.cookie)).status, 401);
});

test("all admin API paths reject Basic and spoofed identities; writes require canonical Origin", async (t) => {
  const f = await fixture(t);
  const enrolled = await f.enroll();
  for (const endpoint of ["/api/admin/availability", "/api/admin/agent-requests", "/api/admin/future-route"]) {
    const r = await fetch(f.url + endpoint, { headers: { Authorization: `Basic ${Buffer.from("york:dev-secret").toString("base64")}`, "Cf-Access-Authenticated-User-Email": "info@example.com" } });
    assert.equal(r.status, 401);
  }
  for (const extra of [{}, { Origin: "https://evil.example", "X-Forwarded-Host": "evil.example" }]) {
    const r = await fetch(f.url + "/api/admin/availability", { method: "POST", headers: { Cookie: enrolled.cookie, "Content-Type": "application/json", ...extra }, body: JSON.stringify({ date: "2030-09-01", action: "block" }) });
    assert.equal(r.status, 403);
  }
  const head = await fetch(f.url + "/admin-login/", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  const tooLarge = await f.web.post({ username: "a".repeat(9000), password: "wrong" });
  assert.equal(tooLarge.status, 413);
});
