import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pricingParameters, initializePricingTracking, PRICING_STORAGE_KEY } from "../src/lib/pricingTracking.mjs";
import { gscRequest, gaRequest, gscMetrics, compareGsc, dateInZone, shiftDay, renderPricingReport } from "../scripts/lib/pricing-report.mjs";
import { collectPricingReport, collectSearchConsole, collectAnalytics } from "../scripts/collect-pricing-report.mjs";

test("pricing parameters discard PII and free text; hours are bounded numbers", () => {
  assert.deepEqual(pricingParameters("price_calculator_change", { package_name: "rundum_sorglos", hours: 6,
    email: "test@example.invalid", name: "Test", cta_position: "calculator", location: "Hamburg" }), {
    measurement_page: "hochzeitsfotograf_preise", package_name: "rundum_sorglos", hours: 6, cta_position: "calculator",
  });
  assert.equal(pricingParameters("price_package_view", { package_name: "test@example.invalid" }), null);
  assert.equal(pricingParameters("price_calculator_change", { package_name: "rundum_sorglos", hours: "6" }), null);
  assert.equal(pricingParameters("price_calculator_change", { package_name: "rundum_sorglos", hours: 11 }), null);
  assert.equal(pricingParameters("arbitrary_event", {}), null);
});
test("consented navigation carries clicks once and consumes attribution after a real form success", () => {
  const storage = new Map(), recorded = [];
  function surface(path, consent) {
    const documentHandlers = {}, windowHandlers = {};
    const win = { location: { pathname: path, origin: "https://artbild-fotografie.de", href: `https://artbild-fotografie.de${path}` },
      sessionStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
      artbildConsentApi: { isServiceAllowed: () => consent }, artbildTracking: { track: payload => recorded.push(payload) },
      addEventListener: (name, callback) => { windowHandlers[name] = callback; }, clearTimeout() {} };
    const doc = { visibilityState: "visible", addEventListener: (name, callback) => { documentHandlers[name] = callback; }, querySelectorAll: () => [] };
    initializePricingTracking(win, doc); return { win, documentHandlers, windowHandlers };
  }
  const price = surface("/hochzeitsfotograf-preise/", true);
  const card = { dataset: { pricingPackage: "pure_moments", pricingHours: "1" } };
  const link = { target: "", getAttribute: () => "/kontakt/", hasAttribute: () => false,
    closest: selector => ["[data-pricing-package]", ".pricing-package"].includes(selector) ? card : null };
  price.documentHandlers.click({ button: 0, target: { closest: () => link } });
  assert.equal(recorded.length, 0); assert.ok(storage.has(PRICING_STORAGE_KEY));
  const contact = surface("/kontakt/", true);
  assert.deepEqual(recorded.map(x => x.event), ["price_package_click", "price_contact_click"]);
  assert.equal(contact.win.artbildPricingTracking.hasAttributedContact(), true);
  surface("/kontakt/", true);
  assert.equal(recorded.length, 2, "reloading cannot replay clicks again");
  contact.windowHandlers["artbild:form_success"]({ detail: { eventId: "11111111-1111-4111-8111-111111111111", formId: "kontakt_anfrage_form", formType: "contact_request" } });
  assert.equal(recorded.at(-1).event, "generate_lead"); assert.equal(recorded.at(-1).hours, 1);
  assert.equal(storage.has(PRICING_STORAGE_KEY), false);
  assert.equal(contact.win.artbildPricingTracking.hasAttributedContact(), false);
  storage.set(PRICING_STORAGE_KEY, JSON.stringify({ source: "hochzeitsfotograf_preise", at: Date.now() }));
  surface("/kontakt/", false); assert.equal(storage.has(PRICING_STORAGE_KEY), false);
});
test("all Search Console calls have an exact URL filter and finalized page aggregation", () => {
  const request = gscRequest("2026-10-01", "2026-10-16", ["query"]);
  assert.equal(request.dataState, "final"); assert.equal(request.aggregationType, "auto");
  assert.deepEqual(request.dimensionFilterGroups[0].filters, [{ dimension: "page", operator: "equals", expression: "https://artbild-fotografie.de/hochzeitsfotograf-preise/" }]);
});
test("GA4 visitors are scoped to exact page/host; leads to pricing origin", () => {
  const traffic = JSON.stringify(gaRequest("2026-10-01", "2026-10-18", ["date"], ["totalUsers"]));
  assert.match(traffic, /pagePath/); assert.match(traffic, /hochzeitsfotograf-preise/); assert.match(traffic, /hostName/);
  const events = JSON.stringify(gaRequest("2026-10-01", "2026-10-18", ["eventName"], ["eventCount"], true));
  assert.match(events, /customEvent:measurement_page/); assert.doesNotMatch(events, /pagePath/);
});
test("missing observations and zero-impression positions remain unknown", () => {
  assert.equal(gscMetrics(undefined), null);
  assert.equal(gscMetrics({ clicks: 0, impressions: 0, ctr: 0, position: 0 }).position, null);
  assert.equal(compareGsc({ position: 5 }, null), null);
});
test("Berlin report and Pacific Google dates respect DST independently", () => {
  const now = new Date("2026-10-19T06:00:00Z");
  assert.equal(dateInZone(now, "Europe/Berlin"), "2026-10-19");
  assert.equal(dateInZone(now, "America/Los_Angeles"), "2026-10-18");
  assert.equal(shiftDay("2026-03-01", -1), "2026-02-28");
  assert.equal(dateInZone(new Date("2026-10-25T07:00:00Z"), "Europe/Berlin"), "2026-10-25");
});
test("GSC daily comparisons use actual URL totals, never means over queries", async () => {
  const requests = [];
  // Synthetic data only inside this unit test; never written as a real report.
  const api = async (url, body) => {
    requests.push(body);
    return body.dimensions[0] === "date" ? { rows: [
      { keys: ["2026-10-15"], clicks: 1, impressions: 10, ctr: 0.1, position: 9 },
      { keys: ["2026-10-16"], clicks: 2, impressions: 10, ctr: 0.2, position: 8 },
    ] } : { rows: [] };
  };
  const result = await collectSearchConsole(api, new Date("2026-10-19T12:00:00Z"));
  assert.equal(result.latestDate, "2026-10-16"); assert.equal(result.latest.position, 8);
  assert.equal(result.changeDay.position, -1); assert.equal(result.changeWeek, null);
  assert.ok(requests.every(x => x.dataState === "final" && x.dimensionFilterGroups[0].filters[0].operator === "equals"));
});
test("GA4 refuses mixed report-day timezones and missing dimensions", async () => {
  await assert.rejects(() => collectAnalytics(async () => ({ timeZone: "America/New_York" }), "123", new Date()), /timezone/);
  await assert.rejects(() => collectAnalytics(async url => url.endsWith("metadata") ? { dimensions: [] } : { timeZone: "Europe/Berlin" }, "123", new Date()), /custom_dimensions_missing/);
});
test("missing credentials produce a private, explicitly incomplete report without fake metrics", async () => {
  const directory = await mkdtemp(join(tmpdir(), "artbild-pricing-test-"));
  const { report } = await collectPricingReport({ PRICING_REPORT_DIR: directory }, new Date("2026-10-19T06:00:00Z"));
  assert.equal(report.status, "incomplete"); assert.equal(report.trackingLiveSince, null);
  assert.equal(report.searchConsole.status, "unavailable"); assert.equal(report.analytics.status, "unavailable");
  assert.equal((await stat(join(directory, "latest.json"))).mode & 0o077, 0);
  assert.equal((await stat(directory)).mode & 0o077, 0);
  const text = await readFile(join(directory, "latest.md"), "utf8");
  assert.match(text, /nicht verfügbar|Nicht verfügbar/); assert.doesNotMatch(text, /0 %/);
  assert.match(renderPricingReport(report), /Tatsächliches gesamtes Suchvolumen: nicht verfügbar/);
});
