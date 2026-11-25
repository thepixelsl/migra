import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { onRequestPost } from "../functions/api/contact.js";
import { createBunnyDatabase } from "../server/bunny-database.mjs";

async function contactFixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "artbild-contact-"));
  let database;
  t.after(async () => {
    database?.close();
    await rm(directory, { recursive: true, force: true });
  });
  database = await createBunnyDatabase({ BUNNY_DATABASE_URL: `file:${path.join(directory, "contact.db")}` });
  const delivered = [];
  const env = {
    DB: database.d1,
    CONTACT_HASH_SALT: "contact-admission-test-salt-only",
    STRATO_SMTP_USER: "sender@example.test",
    STRATO_SMTP_PASS: "test-only",
    CONTACT_TO: "recipient@example.test",
    CONTACT_MAILER: async (message) => delivered.push(message),
  };
  return { database, delivered, env };
}

function submit(env, { email = "contact@example.test", ip = "192.0.2.10" } = {}) {
  const form = new FormData();
  form.set("name", "Test Person");
  form.set("email", email);
  form.set("request_type", "tfp");
  form.set("location", "Hamburg");
  form.set("message", "Kontrollierte Testanfrage");
  form.set("security_year", new Intl.DateTimeFormat("de-DE", {
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(new Date()));
  form.set("privacy", "yes");

  return onRequestPost({
    request: new Request("https://example.test/api/contact", {
      method: "POST",
      headers: { Accept: "application/json", "X-Real-IP": ip },
      body: form,
    }),
    env,
  });
}

for (const quotaKey of ["IP", "email"]) {
  test(`parallel submissions sharing an ${quotaKey} use at most three contact slots`, async (t) => {
    const { database, delivered, env } = await contactFixture(t);
    const submissions = Array.from({ length: 4 }, (_, index) => quotaKey === "IP"
      ? { email: `contact-${index}@example.test` }
      : { ip: `192.0.2.${index + 10}` });
    const responses = await Promise.all(submissions.map((fields) => submit(env, fields)));
    assert.deepEqual(responses.map(({ status }) => status).sort(), [200, 200, 200, 429]);
    const blocked = responses.find(({ status }) => status === 429);
    assert.equal((await blocked.json()).ok, false);

    const stored = await database.client.execute("SELECT status FROM contact_requests");
    assert.deepEqual(stored.rows.map(({ status }) => status), ["delivered", "delivered", "delivered"]);
    assert.equal(delivered.length, 3);
    const independent = await submit(env, { email: "other@example.test", ip: "192.0.2.20" });
    assert.equal(independent.status, 200);
    assert.equal(delivered.length, 4);
  });
}

test("a failed delivery uses its slot and an expired slot opens again", async (t) => {
  const { database, delivered, env } = await contactFixture(t);
  const failingEnv = {
    ...env,
    CONTACT_MAILER: async () => { throw new Error("test transport failure"); },
  };
  assert.equal((await submit(failingEnv)).status, 503);
  assert.equal((await submit(env)).status, 200);
  assert.equal((await submit(env)).status, 200);
  assert.equal((await submit(env)).status, 429);
  assert.equal(delivered.length, 2);
  const failed = await database.client.execute(
    "SELECT status FROM contact_requests WHERE status = 'delivery_failed'",
  );
  assert.equal(failed.rows.length, 1);

  await database.client.execute(
    "UPDATE contact_requests SET created_at = datetime('now', '-16 minutes') WHERE status = 'delivery_failed'",
  );
  assert.equal((await submit(env)).status, 200);
  assert.equal(delivered.length, 3);
});

test("contact delivery requires a database quota reservation", async (t) => {
  const { delivered, env } = await contactFixture(t);
  const response = await submit({ ...env, DB: undefined });
  assert.equal(response.status, 503);
  assert.equal(delivered.length, 0);
});
