import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { load } from "cheerio";
import { agentAvailabilityDateBounds } from "../functions/_agent-availability-contract.js";
import { readAgentAvailabilityAudit } from "../functions/_agent-audit.js";
import { createBunnyRuntime } from "../server/bunny-server.mjs";
import { handleAgentAvailabilityTrial } from "../server/agent-availability-trial.mjs";

function shiftedDate(offset) {
  const date = new Date(`${agentAvailabilityDateBounds().minDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "artbild-agent-trial-"));
  const assetDirectory = path.join(directory, "assets");
  await mkdir(assetDirectory);
  const runtime = await createBunnyRuntime({ assetDirectory, env: {
    BUNNY_DATABASE_URL: `file:${path.join(directory, "trial.db")}`,
    DEV_NOINDEX: "false",
    AGENT_RATE_LIMIT_SALT: "agent-trial-test-salt-at-least-32-characters",
  } });
  const address = await runtime.listen({ host: "127.0.0.1", port: 0 });
  t.after(async () => {
    await runtime.close();
    await rm(directory, { force: true, recursive: true });
  });
  const get = (href, options = {}) => {
    const url = new URL(href, "https://artbild-fotografie.de");
    return fetch(`http://127.0.0.1:${address.port}${url.pathname}${url.search}`, {
      ...options,
      headers: {
        "X-Forwarded-Host": "artbild-fotografie.de",
        "X-Real-IP": "198.51.100.47",
        "User-Agent": "Claude-User/1.0",
        ...options.headers,
      },
    });
  };
  const audit = () => readAgentAvailabilityAudit({ AGENT_AUDIT_DB: runtime.database.d1 });
  return { runtime, get, audit };
}

test("follows real month and day links to the live calendar without JavaScript", async (t) => {
  const { get, runtime, audit } = await fixture(t);
  const date = shiftedDate(40);
  await runtime.database.kv.put("blockedDates", JSON.stringify([date]));
  const rootResponse = await get("/agenten-test/");
  assert.equal(rootResponse.status, 200);
  assert.equal(rootResponse.headers.get("x-robots-tag"), "noindex, follow, noarchive");
  assert.match(rootResponse.headers.get("cache-control"), /no-store/);
  const root = load(await rootResponse.text());
  assert.equal(root("script, iframe, form").length, 0);
  const months = root('ul[aria-label="Monate"] a');
  assert.equal(months.length, 25);
  const monthUrl = months.toArray().map((a) => root(a).attr("href"))
    .find((href) => href.endsWith(`/${date.slice(0, 7)}/`));
  assert.ok(monthUrl.startsWith("https://artbild-fotografie.de/agenten-test/"));
  const month = load(await (await get(monthUrl)).text());
  const days = month('ul[aria-label="Wunschdaten"] a');
  assert.ok(days.length >= 28 && days.length <= 31);
  const dayUrl = days.toArray().map((a) => month(a).attr("href"))
    .find((href) => href.endsWith(`/${date}/`));
  assert.ok(dayUrl);
  assert.deepEqual(await audit(), []);
  const counts = await runtime.database.client.execute("SELECT COUNT(*) AS total FROM public_availability_requests");
  assert.equal(Number(counts.rows[0].total), 0);
  const response = await get(dayUrl);
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.match(body, /Aktuell nicht verfügbar/);
  assert.match(body, /available: false/);
  assert.match(body, /unverbindlich/);
  assert.doesNotMatch(body, /blockedDates/);
  const id = response.headers.get("x-artbild-check-id");
  assert.match(id, /^trial-[0-9a-f-]{36}$/);
  assert.ok(body.includes(id));
  const rows = await audit();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, id);
  assert.deepEqual(rows[0].results, [{ date, available: false }]);
  assert.equal(rows[0].clientLabel, "Anthropic Claude");
  assert.equal(rows[0].clientVerified, false);
  assert.ok(body.includes(rows[0].requestedAt));
});

test("rereads the same date and issues a new receipt when the calendar changes", async (t) => {
  const { get, runtime, audit } = await fixture(t);
  const date = shiftedDate(42);
  const first = await get(`/agenten-test/${date}/`);
  assert.match(await first.text(), /available: true/);
  await runtime.database.kv.put("blockedDates", JSON.stringify([date]));
  const second = await get(`/agenten-test/${date}/`);
  assert.match(await second.text(), /available: false/);
  assert.notEqual(first.headers.get("x-artbild-check-id"), second.headers.get("x-artbild-check-id"));
  assert.equal(second.headers.get("x-ratelimit-remaining"), "2");
  assert.equal((await audit()).length, 2);
});

test("serves month and day links when a fetch service removes the trailing slash", async (t) => {
  const { get, runtime, audit } = await fixture(t);
  const date = shiftedDate(43);
  const monthPath = `/agenten-test/${date.slice(0, 7)}`;
  const month = await get(monthPath, { redirect: "manual" });
  assert.equal(month.status, 200);
  assert.equal(month.headers.has("location"), false);
  assert.equal(await month.text(), await (await get(`${monthPath}/`)).text());
  assert.deepEqual(await audit(), []);

  const first = await get(`/agenten-test/${date}`, { redirect: "manual" });
  assert.equal(first.status, 200);
  assert.equal(first.headers.has("location"), false);
  assert.match(first.headers.get("cache-control"), /no-store/);
  assert.match(await first.text(), /available: true/);
  await runtime.database.kv.put("blockedDates", JSON.stringify([date]));
  const second = await get(`/agenten-test/${date}/`);
  assert.match(await second.text(), /available: false/);
  assert.notEqual(first.headers.get("x-artbild-check-id"), second.headers.get("x-artbild-check-id"));
  assert.equal(second.headers.get("x-ratelimit-remaining"), "2");
  assert.equal((await audit()).length, 2);

  for (const suffix of ["2027-02-30", "2999-01", "2027-06//"]) {
    assert.equal((await get(`/agenten-test/${suffix}`)).status, 404);
  }
});

test("shares the three-date limit with both existing JSON endpoints", async (t) => {
  const { get, audit } = await fixture(t);
  for (const [index, endpoint] of ["/api/availability", "/api/agent-availability"].entries()) {
    assert.equal((await get(`${endpoint}?date=${shiftedDate(index + 5)}`)).status, 200);
  }
  const third = await get(`/agenten-test/${shiftedDate(7)}/`);
  assert.equal(third.status, 200);
  assert.equal(third.headers.get("x-ratelimit-remaining"), "0");
  const rejected = await get(`/agenten-test/${shiftedDate(8)}/`);
  assert.equal(rejected.status, 429);
  assert.ok(Number(rejected.headers.get("retry-after")) > 0);
  const html = await rejected.text();
  assert.match(html, /Nicht geprüft/);
  assert.doesNotMatch(html, /available: false/);
  const entries = await audit();
  const rejection = entries.find((row) => row.responseStatus === 429);
  assert.deepEqual(rejection.results, []);
  assert.deepEqual(rejection.dates, [shiftedDate(8)]);
  assert.equal((await get(`/api/availability?date=${shiftedDate(8)}`)).status, 429);
});

test("clips calendar navigation to the current Berlin date bounds", async (t) => {
  const { get } = await fixture(t);
  const { minDate, maxDate } = agentAvailabilityDateBounds();
  for (const month of [minDate.slice(0, 7), maxDate.slice(0, 7)]) {
    const document = load(await (await get(`/agenten-test/${month}/`)).text());
    for (const a of document('ul[aria-label="Wunschdaten"] a').toArray()) {
      const date = document(a).attr("href").match(/(\d{4}-\d{2}-\d{2})\/$/)[1];
      assert.ok(date >= minDate && date <= maxDate);
    }
  }
});

test("HEAD, invalid paths and unsupported methods never query or audit the calendar", async (t) => {
  const { get, runtime, audit } = await fixture(t);
  const date = shiftedDate(43);
  const head = await get(`/agenten-test/${date}/`, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.equal(head.headers.has("x-artbild-check-id"), false);
  for (const route of ["/agenten-test/2027-02-30/", "/agenten-test/2020-01-01/", "/agenten-test/2999-01-01/", "/agenten-test/2999-01/", "/agenten-test/nicht-vorhanden/"]) {
    assert.equal((await get(route)).status, 404);
  }
  const post = await get(`/agenten-test/${date}/`, { method: "POST" });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("allow"), "GET, HEAD");
  assert.deepEqual(await audit(), []);
  const counts = await runtime.database.client.execute("SELECT COUNT(*) AS total FROM public_availability_requests");
  assert.equal(Number(counts.rows[0].total), 0);
});

test("missing calendar or audit storage yields unverified error text, never false availability", async () => {
  const request = new Request(`https://artbild-fotografie.de/agenten-test/${shiftedDate(45)}/`);
  const response = await handleAgentAvailabilityTrial({ request, env: {} });
  assert.equal(response.status, 503);
  const text = await response.text();
  assert.match(text, /Termin nicht geprüft/);
  assert.doesNotMatch(text, /available:/);
  assert.equal(response.headers.has("x-artbild-check-id"), false);
});
