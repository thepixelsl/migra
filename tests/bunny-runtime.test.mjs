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
      CONTACT_HASH_SALT: "test-only-random-salt",
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
});

test("relays a validated TFP request and attachment as multipart form data", async () => {
  const form = new FormData();
  form.set("name", "Relay Test");
  form.set("email", "relay@example.com");
  form.set("request_type", "tfp");
  form.set("event_date", "");
  form.set("location", "Hamburg");
  form.set("message", "Kontrollierte Relay-Testanfrage");
  form.set("security_year", String(new Date().getFullYear()));
  form.set("privacy", "yes");
  form.set("website", "");
  form.set("js_enabled", "0");
  form.set("source_path", "/kontakt/");
  form.append(
    "tfp_images",
    new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: "image/png" }),
    "relay-test.png",
  );

  const originalFetch = globalThis.fetch;
  let relayCalls = 0;
  globalThis.fetch = async (url, options) => {
    relayCalls += 1;
    assert.equal(url, "https://relay.example/api/contact");
    assert.equal(options.method, "POST");
    assert.equal(options.headers["X-Artbild-Contact-Relay-Hop"], "1");
    assert.equal(options.headers["X-Requested-With"], "fetch");
    assert.match(options.headers["X-Artbild-Relay-Request-Id"], /^[0-9a-f-]{36}$/);
    const serializedRequest = new Request(url, options);
    assert.match(serializedRequest.headers.get("content-type") || "", /^multipart\/form-data; boundary=/);
    const serializedForm = await serializedRequest.formData();
    assert.equal(serializedForm.get("name"), "Relay Test");
    assert.equal(serializedForm.get("request_type"), "tfp");
    assert.equal(serializedForm.get("privacy"), "yes");

    const attachment = serializedForm.get("tfp_images");
    assert.equal(attachment.name, "relay-test.png");
    assert.equal(attachment.type, "image/png");
    assert.equal(attachment.size, 8);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
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
        CONTACT_HASH_SALT: "test-only-random-salt",
        CONTACT_RELAY_URL: "https://relay.example/api/contact",
      },
    });

    assert.equal(response.status, 200);
    assert.equal((await response.json()).ok, true);
    assert.equal(relayCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("does not recursively forward an already relayed request", async () => {
  const form = new FormData();
  form.set("name", "Relay Schutz");
  form.set("email", "relay-schutz@example.com");
  form.set("request_type", "hochzeit");
  form.set("event_date", "2030-08-22");
  form.set("location", "Hamburg");
  form.set("message", "Kontrollierte Schleifenschutz-Anfrage");
  form.set("security_year", String(new Date().getFullYear()));
  form.set("privacy", "yes");

  const originalFetch = globalThis.fetch;
  let relayCalls = 0;
  globalThis.fetch = async () => {
    relayCalls += 1;
    return new Response(JSON.stringify({ ok: true }));
  };

  try {
    const response = await handleContactPost({
      request: new Request("https://dev.example/api/contact", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "X-Artbild-Contact-Relay-Hop": "1",
          "X-Requested-With": "fetch",
        },
        body: form,
      }),
      env: {
        CONTACT_RELAY_URL: "https://relay.example/api/contact",
        CONTACT_WEBHOOK_URL: "https://webhook.example/contact",
      },
    });

    assert.equal(response.status, 503);
    assert.equal(relayCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
