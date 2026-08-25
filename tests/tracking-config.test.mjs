import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const trackingKeys = [
  "PUBLIC_TRACKING_ENV",
  "PUBLIC_TRACKING_ALLOWED_HOSTS",
  "PUBLIC_GTM_CONTAINER_ID",
  "PUBLIC_GA4_MEASUREMENT_ID",
  "PUBLIC_GA4_DATA_RETENTION_MONTHS",
];

function validateTracking(extraEnvironment = {}) {
  const environment = { ...process.env };
  for (const key of trackingKeys) delete environment[key];
  Object.assign(environment, extraEnvironment);

  return spawnSync(process.execPath, ["scripts/validate-tracking-config.mjs"], {
    cwd: process.cwd(),
    env: environment,
    encoding: "utf8",
  });
}

test("accepts a staging build without configured tracking providers", () => {
  const result = validateTracking({ PUBLIC_TRACKING_ENV: "staging" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Anbieter deaktiviert/);
});

test("accepts synthetic GTM and GA4 IDs in the test environment", () => {
  const result = validateTracking({
    PUBLIC_TRACKING_ENV: "test",
    PUBLIC_TRACKING_ALLOWED_HOSTS: "127.0.0.1,localhost",
    PUBLIC_GTM_CONTAINER_ID: "GTM-TEST1",
    PUBLIC_GA4_MEASUREMENT_ID: "G-TEST123",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Anbieter konfiguriert/);
});

test("rejects a partial provider configuration", () => {
  const result = validateTracking({
    PUBLIC_TRACKING_ENV: "test",
    PUBLIC_GTM_CONTAINER_ID: "GTM-TEST1",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /GA4-Measurement-ID/);
});

test("rejects an unsupported GA4 data-retention value", () => {
  const result = validateTracking({
    PUBLIC_TRACKING_ENV: "staging",
    PUBLIC_GA4_DATA_RETENTION_MONTHS: "6",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /muss 2 oder 14 sein/);
});

test("uses the verified 14-month retention default in production", () => {
  const result = validateTracking({
    PUBLIC_TRACKING_ENV: "production",
    PUBLIC_TRACKING_ALLOWED_HOSTS: "artbild-fotografie.de",
    PUBLIC_GTM_CONTAINER_ID: "GTM-AB12CD",
    PUBLIC_GA4_MEASUREMENT_ID: "G-AB12CD34",
    PUBLIC_GA4_DATA_RETENTION_MONTHS: "",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Anbieter konfiguriert/);
});
