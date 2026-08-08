import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import { onRequestPost as handleContactPost } from "../functions/api/contact.js";
import { createBunnyRuntime } from "../server/bunny-server.mjs";

let baseUrl;
let publicUrl;
let runtime;
let temporaryDirectory;
const sentMessages = [];

function basicAuth(username = "york", password = "dev-secret") {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

before(async () => {
  temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "artbild-bunny-"));
  const assetDirectory = path.join(temporaryDirectory, "dist");
  await mkdir(path.join(assetDirectory, "about"), { recursive: true });
  await mkdir(path.join(assetDirectory, "admin-termine"), { recursive: true });
  await mkdir(path.join(assetDirectory, "_astro"), { recursive: true });
  await Promise.all([
    writeFile(path.join(assetDirectory, "index.html"), "<!doctype html><h1>Start</h1>"),
    writeFile(path.join(assetDirectory, "about", "index.html"), "<!doctype html><h1>Über uns</h1>"),
    writeFile(path.join(assetDirectory, "admin-termine", "index.html"), "<!doctype html><h1>Admin</h1>"),
    writeFile(path.join(assetDirectory, "404.html"), "<!doctype html><h1>Nicht gefunden</h1>"),
    writeFile(path.join(assetDirectory, "_astro", "app.js"), "console.log('ok')"),
  ]);

  runtime = await createBunnyRuntime({
    assetDirectory,
    contactMailer: async (message) => sentMessages.push(message),
    env: {
      ADMIN_EMAIL: "info@example.com",
      ADMIN_PASSWORD: "dev-secret",
      ADMIN_USERNAME: "york",
      BUNNY_DATABASE_URL: `file:${path.join(temporaryDirectory, "runtime.db")}`,
      CONTACT_FROM: "mail@example.com",
      CONTACT_HASH_SALT: "test-only-random-salt-with-32-characters",
      CONTACT_TO: "info@example.com",
      DEV_NOINDEX: "true",
      STRATO_SMTP_PASS: "not-used-by-test-mailer",
      STRATO_SMTP_USER: "mail@example.com",
    },
  });
  const address = await runtime.listen({ host: "127.0.0.1", port: 0 });
  baseUrl = `http://127.0.0.1:${address.port}`;
  publicUrl = `https://127.0.0.1:${address.port}`;
});

after(async () => {
  await runtime?.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
});

test("health and readiness endpoints report a ready persistent database", async () => {
  for (const route of ["/healthz", "/readyz"]) {
    const response = await fetch(`${baseUrl}${route}`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, database: "bunny" });
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
  }
});

test("serves static pages, redirects directories, and preserves a real 404", async () => {
  const homepage = await fetch(`${baseUrl}/`);
  assert.equal(homepage.status, 200);
  assert.match(await homepage.text(), /Start/);
  assert.equal(homepage.headers.get("x-content-type-options"), "nosniff");
  const contentSecurityPolicy = homepage.headers.get("content-security-policy") || "";
  assert.match(contentSecurityPolicy, /script-src[^;]+https:\/\/\*\.clarity\.ms/);
  assert.match(contentSecurityPolicy, /connect-src[^;]+https:\/\/\*\.clarity\.ms/);
  assert.match(contentSecurityPolicy, /connect-src[^;]+https:\/\/c\.bing\.com/);

  const redirect = await fetch(`${baseUrl}/about`, { redirect: "manual" });
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get("location"), `${publicUrl}/about/`);

  const missing = await fetch(`${baseUrl}/gibt-es-nicht/`);
  assert.equal(missing.status, 404);
  assert.match(await missing.text(), /Nicht gefunden/);
});

test("uses immutable caching for built Astro assets", async () => {
  const response = await fetch(`${baseUrl}/_astro/app.js`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "public, max-age=31556952, immutable");
});

test("protects the admin page and availability API with dev credentials", async () => {
  const deniedPage = await fetch(`${baseUrl}/admin-termine/`);
  assert.equal(deniedPage.status, 401);
  assert.match(deniedPage.headers.get("www-authenticate") || "", /Basic/);

  const headers = { Authorization: basicAuth() };
  const adminPage = await fetch(`${baseUrl}/admin-termine/`, { headers });
  assert.equal(adminPage.status, 200);
  assert.equal(adminPage.headers.get("cache-control"), "private, no-store");

  const blockedDates = await fetch(`${baseUrl}/api/admin/availability`, { headers });
  assert.equal(blockedDates.status, 200);
  assert.deepEqual(await blockedDates.json(), { blockedDates: [] });
});

test("blocks a date through admin and exposes it through the public API", async () => {
  const date = "2030-08-22";
  const adminResponse = await fetch(`${baseUrl}/api/admin/availability`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(),
      "Content-Type": "application/json",
      Origin: publicUrl,
    },
    body: JSON.stringify({ date, action: "block" }),
  });
  assert.equal(adminResponse.status, 200);
  assert.equal((await adminResponse.json()).available, false);

  const publicResponse = await fetch(`${baseUrl}/api/availability?date=${date}`);
  assert.equal(publicResponse.status, 200);
  assert.deepEqual(await publicResponse.json(), { date, available: false });

  const crossOrigin = await fetch(`${baseUrl}/api/admin/availability`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(),
      "Content-Type": "application/json",
      Origin: "https://attacker.example",
    },
    body: JSON.stringify({ date, action: "unblock" }),
  });
  assert.equal(crossOrigin.status, 403);
});

test("accepts a valid contact request through the injected Node mailer", async () => {
  const form = new FormData();
  form.set("name", "Test Paar");
  form.set("email", "test@example.com");
  form.set("request_type", "hochzeit");
  form.set("event_date", "2030-08-22");
  form.set("location", "Hamburg");
  form.set("message", "Kontrollierte Testanfrage");
  form.set("security_year", String(new Date().getFullYear()));
  form.set("privacy", "yes");
  form.set("website", "");
  form.set("js_enabled", "0");
  form.set("source_path", "/kontakt/");

  const response = await fetch(`${baseUrl}/api/contact`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "X-Requested-With": "fetch",
    },
    body: form,
  });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].to.email, "info@example.com");
  assert.equal(sentMessages[0].reply.email, "test@example.com");

  const stored = await runtime.database.client.execute({
    sql: `SELECT status, security_year, user_agent, ip_hash
      FROM contact_requests
      WHERE email = ?
      ORDER BY created_at DESC
      LIMIT 1`,
    args: ["test@example.com"],
  });
  assert.equal(stored.rows[0].status, "delivered");
  assert.equal(stored.rows[0].security_year, null);
  assert.equal(stored.rows[0].user_agent, null);
  assert.match(String(stored.rows[0].ip_hash), /^[0-9a-f]{64}$/);
});

test("removes short-lived security data and expires database copies", async () => {
  await runtime.database.client.execute({
    sql: `INSERT INTO contact_requests (
      id, created_at, name, email, message, security_year, user_agent, ip_hash
    ) VALUES (?, datetime('now', '-31 minutes'), ?, ?, ?, ?, ?, ?)`,
    args: [
      "security-expired",
      "Security Test",
      "security@example.com",
      "Test",
      "2026",
      "test-browser",
      "hash-value",
    ],
  });
  await runtime.database.client.execute({
    sql: `INSERT INTO contact_requests (
      id, created_at, name, email, message
    ) VALUES (?, datetime('now', '-31 days'), ?, ?, ?)`,
    args: ["request-expired", "Old Test", "old@example.com", "Test"],
  });

  await runtime.database.cleanupContactRequests();

  const securityExpired = await runtime.database.client.execute({
    sql: `SELECT security_year, user_agent, ip_hash
      FROM contact_requests
      WHERE id = ?`,
    args: ["security-expired"],
  });
  assert.equal(securityExpired.rows.length, 1);
  assert.equal(securityExpired.rows[0].security_year, null);
  assert.equal(securityExpired.rows[0].user_agent, null);
  assert.equal(securityExpired.rows[0].ip_hash, null);

  const requestExpired = await runtime.database.client.execute({
    sql: "SELECT id FROM contact_requests WHERE id = ?",
    args: ["request-expired"],
  });
  assert.equal(requestExpired.rows.length, 0);
});

test("rejects a valid request when direct STRATO SMTP is not configured", async () => {
  const form = new FormData();
  form.set("name", "SMTP Test");
  form.set("email", "smtp@example.com");
  form.set("request_type", "hochzeit");
  form.set("event_date", "2030-08-22");
  form.set("location", "Hamburg");
  form.set("message", "Kontrollierte Testanfrage ohne Mailtransport");
  form.set("security_year", String(new Date().getFullYear()));
  form.set("privacy", "yes");
  const response = await handleContactPost({
    request: new Request("https://dev.example/api/contact", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "X-Requested-With": "fetch",
      },
      body: form,
    }),
    env: {
      CONTACT_HASH_SALT: "test-only-random-salt-with-32-characters",
    },
  });

  assert.equal(response.status, 503);
  assert.equal((await response.json()).ok, false);
});
