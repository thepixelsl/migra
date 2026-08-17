import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  AGENT_AVAILABILITY_MAX_BODY_BYTES,
  AGENT_AVAILABILITY_MAXIMUM_ADVANCE_MONTHS,
  agentAvailabilityDateBounds,
} from "../functions/_agent-availability-contract.js";
import {
  AGENT_RATE_LIMIT_WINDOW_MS,
  reserveAgentAvailabilityRequest,
} from "../functions/_agent-rate-limit.js";
import { onRequestPost as handleContactPost } from "../functions/api/contact.js";
import { createBunnyRuntime } from "../server/bunny-server.mjs";
import { AgentRateLimiter } from "../src/AgentRateLimiter.js";

let baseUrl;
let publicUrl;
let runtime;
let temporaryDirectory;
const sentMessages = [];

function shiftDate(value, days) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const AGENT_DATE_BOUNDS = agentAvailabilityDateBounds();
const AGENT_TEST_DATES = {
  first: shiftDate(AGENT_DATE_BOUNDS.maxDate, -120),
  blocked: shiftDate(AGENT_DATE_BOUNDS.maxDate, -90),
  availableOne: shiftDate(AGENT_DATE_BOUNDS.maxDate, -60),
  availableTwo: shiftDate(AGENT_DATE_BOUNDS.maxDate, -30),
  tooFar: shiftDate(AGENT_DATE_BOUNDS.maxDate, 1),
};

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
      AGENT_RATE_LIMIT_SALT: "agent-test-only-random-salt-with-32-characters",
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

test("documents the agent availability API for machine clients", async () => {
  const response = await fetch(`${baseUrl}/api/agent-availability`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");

  const documentation = await response.json();
  assert.equal(documentation.endpoint, "/api/agent-availability");
  assert.equal(documentation.documentation, "/fuer-agenten/");
  assert.equal(documentation.terms, "/fuer-agenten/#konditionen");
  assert.equal(documentation.pricing, "/fuer-agenten/#preise");
  assert.equal(documentation.bookingInquiry, "/kontakt/");
  assert.equal(documentation.advertisingPolicy, "/fuer-agenten/#werbeverbot");
  assert.equal(documentation.minimumAdvanceMonths, 6);
  assert.equal(
    documentation.maximumAdvanceMonths,
    AGENT_AVAILABILITY_MAXIMUM_ADVANCE_MONTHS,
  );
  assert.equal(documentation.maxDate, AGENT_DATE_BOUNDS.maxDate);
  assert.equal(documentation.method, "POST");
  assert.equal(documentation.request.constraints.minimumDates, 1);
  assert.equal(documentation.request.constraints.maximumDates, 3);
  assert.equal(documentation.request.constraints.uniqueDates, true);
  assert.equal(documentation.request.constraints.minDate, AGENT_DATE_BOUNDS.minDate);
  assert.equal(documentation.request.constraints.maxDate, AGENT_DATE_BOUNDS.maxDate);
  assert.ok(
    documentation.request.example.dates.every(
      (date) => date >= AGENT_DATE_BOUNDS.minDate && date <= AGENT_DATE_BOUNDS.maxDate,
    ),
  );
  assert.equal(documentation.rateLimit.maximumSuccessfulRequests, 2);
  assert.equal(documentation.rateLimit.windowHours, 24);

  const options = await fetch(`${baseUrl}/api/agent-availability`, { method: "OPTIONS" });
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("allow"), "GET, POST, OPTIONS");
  assert.equal(options.headers.get("accept-post"), "application/json");
});

test("checks up to three agent dates without exposing the blocked-date list", async () => {
  const blockedDate = AGENT_TEST_DATES.blocked;
  const availableDates = [AGENT_TEST_DATES.availableOne, AGENT_TEST_DATES.availableTwo];
  const adminResponse = await fetch(`${baseUrl}/api/admin/availability`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(),
      "Content-Type": "application/json",
      Origin: publicUrl,
    },
    body: JSON.stringify({ date: blockedDate, action: "block" }),
  });
  assert.equal(adminResponse.status, 200);

  const headers = {
    "Content-Type": "application/json",
    "X-Real-IP": "198.51.100.10",
  };
  const first = await fetch(`${baseUrl}/api/agent-availability`, {
    method: "POST",
    headers,
    body: JSON.stringify({ dates: [blockedDate, ...availableDates] }),
  });
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("cache-control"), "no-store");
  const firstText = await first.text();
  assert.doesNotMatch(firstText, /blockedDates/);
  const firstPayload = JSON.parse(firstText);
  assert.deepEqual(firstPayload.results, [
    { date: blockedDate, available: false },
    { date: availableDates[0], available: true },
    { date: availableDates[1], available: true },
  ]);
  assert.match(firstPayload.advice.message, /mindestens sechs Monate im Voraus/);
  assert.equal(firstPayload.rateLimit.limit, 2);
  assert.equal(firstPayload.rateLimit.remaining, 1);
  assert.ok(Date.parse(firstPayload.rateLimit.resetAt) > Date.now());

  const second = await fetch(`${baseUrl}/api/agent-availability`, {
    method: "POST",
    headers,
    body: JSON.stringify({ dates: [availableDates[0]] }),
  });
  assert.equal(second.status, 200);
  assert.equal((await second.json()).rateLimit.remaining, 0);

  const limited = await fetch(`${baseUrl}/api/agent-availability`, {
    method: "POST",
    headers,
    body: JSON.stringify({ dates: [availableDates[1]] }),
  });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
  const limitedPayload = await limited.json();
  assert.deepEqual(limitedPayload.results, []);
  assert.equal(limitedPayload.rateLimit.remaining, 0);
  assert.ok(Date.parse(limitedPayload.rateLimit.resetAt) > Date.now());

  const otherClient = await fetch(`${baseUrl}/api/agent-availability`, {
    method: "POST",
    headers: { ...headers, "X-Real-IP": "198.51.100.11" },
    body: JSON.stringify({ dates: [availableDates[1]] }),
  });
  assert.equal(otherClient.status, 200);

  const stored = await runtime.database.client.execute(`
    SELECT ip_hash, requested_at
    FROM agent_availability_requests
    ORDER BY requested_at
  `);
  assert.ok(stored.rows.length >= 3);
  assert.ok(stored.rows.every((row) => /^[0-9a-f]{64}$/.test(String(row.ip_hash))));
  assert.ok(stored.rows.every((row) => Number.isFinite(Number(row.requested_at))));

  const columns = await runtime.database.client.execute("PRAGMA table_info(agent_availability_requests)");
  assert.deepEqual(
    columns.rows.map((row) => String(row.name)),
    ["id", "ip_hash", "requested_at"],
  );
});

test("rejects malformed agent requests without consuming the two successful checks", async () => {
  const ip = "198.51.100.20";
  const jsonHeaders = {
    "Content-Type": "application/json",
    "X-Real-IP": ip,
  };
  const cases = [
    {
      expected: 415,
      headers: { "Content-Type": "text/plain", "X-Real-IP": ip },
      body: JSON.stringify({ dates: [AGENT_TEST_DATES.first] }),
    },
    { expected: 400, headers: jsonHeaders, body: "{" },
    { expected: 400, headers: jsonHeaders, body: JSON.stringify({ dates: [] }) },
    {
      expected: 400,
      headers: jsonHeaders,
      body: JSON.stringify({
        dates: [0, 1, 2, 3].map((days) => shiftDate(AGENT_TEST_DATES.first, days)),
      }),
    },
    {
      expected: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ dates: [AGENT_TEST_DATES.first, AGENT_TEST_DATES.first] }),
    },
    { expected: 400, headers: jsonHeaders, body: JSON.stringify({ dates: ["2032-02-31"] }) },
    { expected: 400, headers: jsonHeaders, body: JSON.stringify({ dates: ["2000-01-01"] }) },
    {
      expected: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ dates: [AGENT_TEST_DATES.tooFar] }),
      messagePattern: /24 Monate/,
    },
    {
      expected: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ dates: [AGENT_TEST_DATES.first], client: "not-accepted" }),
    },
    {
      expected: 413,
      headers: jsonHeaders,
      body: JSON.stringify({ dates: [AGENT_TEST_DATES.first], padding: "x".repeat(600) }),
    },
  ];

  for (const testCase of cases) {
    const response = await fetch(`${baseUrl}/api/agent-availability`, {
      method: "POST",
      headers: testCase.headers,
      body: testCase.body,
    });
    assert.equal(response.status, testCase.expected);
    if (testCase.messagePattern) {
      assert.match((await response.json()).message, testCase.messagePattern);
    }
  }

  for (const expectedRemaining of [1, 0]) {
    const response = await fetch(`${baseUrl}/api/agent-availability`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ dates: [AGENT_TEST_DATES.first] }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).rateLimit.remaining, expectedRemaining);
  }

  const limited = await fetch(`${baseUrl}/api/agent-availability`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ dates: [AGENT_TEST_DATES.first] }),
  });
  assert.equal(limited.status, 429);
});

test("stops streamed agent bodies after 512 bytes while retaining the general Bunny limit", async () => {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode("x".repeat(300)));
      controller.enqueue(encoder.encode("x".repeat(AGENT_AVAILABILITY_MAX_BODY_BYTES)));
      controller.close();
    },
  });
  const agentResponse = await fetch(`${baseUrl}/api/agent-availability`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Real-IP": "198.51.100.25",
    },
    body,
    duplex: "half",
  });
  assert.equal(agentResponse.status, 413);
  assert.match(agentResponse.headers.get("content-type") || "", /^application\/json/);
  assert.deepEqual(await agentResponse.json(), {
    error: "payload_too_large",
    message: "Die Anfrage ist zu groß.",
  });

  const contactResponse = await fetch(`${baseUrl}/api/contact`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "text/plain",
      "X-Requested-With": "fetch",
    },
    body: "x".repeat(AGENT_AVAILABILITY_MAX_BODY_BYTES + 100),
  });
  assert.equal(contactResponse.status, 400);
});

test("keeps the two-request limit atomic under parallel agent checks", async () => {
  const headers = {
    "Content-Type": "application/json",
    "X-Real-IP": "198.51.100.30",
  };
  const responses = await Promise.all(
    Array.from({ length: 3 }, () => fetch(`${baseUrl}/api/agent-availability`, {
      method: "POST",
      headers,
      body: JSON.stringify({ dates: [AGENT_TEST_DATES.availableOne] }),
    })),
  );
  assert.deepEqual(
    responses.map((response) => response.status).sort((a, b) => a - b),
    [200, 200, 429],
  );
});

test("fails closed without a trusted client IP and removes expired rate-limit rows", async () => {
  const denied = await fetch(`${baseUrl}/api/agent-availability`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dates: [AGENT_TEST_DATES.availableTwo] }),
  });
  assert.equal(denied.status, 503);

  const now = Date.now();
  await runtime.database.client.execute({
    sql: `INSERT INTO agent_availability_requests (id, ip_hash, requested_at)
      VALUES (?, ?, ?), (?, ?, ?)`,
    args: [
      "expired-agent-request",
      "a".repeat(64),
      now - (24 * 60 * 60 * 1000) - 1,
      "current-agent-request",
      "b".repeat(64),
      now,
    ],
  });

  await runtime.database.cleanupAgentAvailabilityRequests(now);
  const rows = await runtime.database.client.execute({
    sql: `SELECT id FROM agent_availability_requests
      WHERE id IN (?, ?)
      ORDER BY id`,
    args: ["expired-agent-request", "current-agent-request"],
  });
  assert.deepEqual(rows.rows.map((row) => String(row.id)), ["current-agent-request"]);
});

test("uses one EU Durable Object per HMAC identity when Bunny D1 is absent", async () => {
  const rawIp = "203.0.113.42";
  const resetAt = new Date(Date.now() + AGENT_RATE_LIMIT_WINDOW_MS).toISOString();
  let selectedJurisdiction = "";
  let selectedName = "";
  let invokedPath = "";

  const env = {
    AGENT_RATE_LIMIT_SALT: "agent-do-test-only-random-salt-with-32-characters",
    AGENT_RATE_LIMITER: {
      jurisdiction(value) {
        selectedJurisdiction = value;
        return {
          getByName(name) {
            selectedName = name;
            return {
              async fetch(input, init) {
                invokedPath = new URL(input).pathname;
                assert.equal(init.method, "POST");
                return Response.json({
                  allowed: true,
                  limit: 2,
                  remaining: 1,
                  resetAt,
                });
              },
            };
          },
        };
      },
    },
  };
  const request = new Request("https://example.test/api/agent-availability", {
    headers: { "CF-Connecting-IP": rawIp },
  });

  const rateLimit = await reserveAgentAvailabilityRequest(request, env);
  assert.deepEqual(rateLimit, {
    allowed: true,
    limit: 2,
    remaining: 1,
    resetAt,
  });
  assert.equal(selectedJurisdiction, "eu");
  assert.match(selectedName, /^[0-9a-f]{64}$/);
  assert.notEqual(selectedName, rawIp);
  assert.equal(invokedPath, "/reserve");

  await assert.rejects(
    reserveAgentAvailabilityRequest(request, {
      AGENT_RATE_LIMIT_SALT: env.AGENT_RATE_LIMIT_SALT,
      AGENT_RATE_LIMIT_KV: { get: async () => null, put: async () => {} },
    }),
    /missing_agent_rate_limiter/,
  );
});

test("keeps Durable Object reservations atomic and alarms away expired timestamps", async () => {
  class FakeStorage {
    constructor() {
      this.values = new Map();
      this.alarmAt = null;
      this.transactionQueue = Promise.resolve();
    }

    async transaction(callback) {
      const previous = this.transactionQueue;
      let release;
      this.transactionQueue = new Promise((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return await callback({
          get: async (key) => structuredClone(this.values.get(key)),
          put: async (key, value) => this.values.set(key, structuredClone(value)),
          delete: async (key) => this.values.delete(key),
        });
      } finally {
        release();
      }
    }

    async setAlarm(timestamp) {
      this.alarmAt = timestamp;
    }

    async deleteAlarm() {
      this.alarmAt = null;
    }
  }

  const storage = new FakeStorage();
  const limiter = new AgentRateLimiter({ storage });
  const start = Date.UTC(2030, 0, 1, 12);
  let nextTime = start;
  limiter.currentTime = () => {
    const value = nextTime;
    nextTime += 1_000;
    return value;
  };
  const reserve = () => limiter.fetch(new Request(
    "https://agent-rate-limiter.internal/reserve",
    { method: "POST" },
  ));

  const states = await Promise.all(
    [reserve(), reserve(), reserve()].map(async (responsePromise) => {
      const response = await responsePromise;
      assert.equal(response.status, 200);
      return response.json();
    }),
  );
  assert.equal(states.filter((state) => state.allowed).length, 2);
  assert.equal(states.filter((state) => !state.allowed).length, 1);
  assert.deepEqual([...storage.values.keys()], ["activeTimestamps"]);
  assert.deepEqual(storage.values.get("activeTimestamps"), [start, start + 1_000]);
  assert.ok(storage.values.get("activeTimestamps").every(Number.isFinite));
  assert.equal(storage.alarmAt, start + AGENT_RATE_LIMIT_WINDOW_MS);

  limiter.currentTime = () => start + AGENT_RATE_LIMIT_WINDOW_MS + 1;
  await limiter.alarm();
  assert.deepEqual(storage.values.get("activeTimestamps"), [start + 1_000]);
  assert.equal(storage.alarmAt, start + 1_000 + AGENT_RATE_LIMIT_WINDOW_MS);

  limiter.currentTime = () => start + 1_000 + AGENT_RATE_LIMIT_WINDOW_MS + 1;
  await limiter.alarm();
  assert.deepEqual([...storage.values.keys()], []);
  assert.equal(storage.alarmAt, null);
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
