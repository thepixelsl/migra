import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const providers = /^https:\/\/(?:[^/]+\.)?(?:openai\.com|googletagmanager\.com|google-analytics\.com|clarity\.ms|facebook\.net|facebook\.com)\//;
const sdkUrl = "https://bzrcdn.openai.com/sdk/oaiq.min.js";
const frameSelector = 'iframe[data-artbild-provider="openai-ads"]';
const fakeSdk = `
  window.__adsCalls = [];
  const pending = window.oaiq.q || [];
  window.oaiq = function(...args) { window.__adsCalls.push(args); };
  pending.forEach(args => window.oaiq(...args));
  try { window.parent.document.querySelector('input'); window.__parentBlocked = false; }
  catch (_) { window.__parentBlocked = true; }
`;
test.use({ storageState: { cookies: [], origins: [] } });
const mockProviders = async (page: Page) => {
  const requests: string[] = [];
  await page.route(providers, async route => {
    requests.push(route.request().url());
    await route.fulfill({ contentType: "application/javascript", body: route.request().url() === sdkUrl ? fakeSdk : "" });
  });
  return requests;
};
const measurementFrame = (page: Page) => page.frames().find(frame => frame.url().includes("/openai-conversion.html"));
const calls = async (page: Page) => await measurementFrame(page)?.evaluate(() => (window as any).__adsCalls || []) || [];
const measurements = async (page: Page) => (await calls(page)).filter((args: unknown[]) => args[0] === "measure");
const openSettings = async (page: Page) => {
  await page.getByRole("button", { name: "EINSTELLUNGEN", exact: true }).click();
  await page.getByText("DETAILS ANZEIGEN", { exact: true }).last().click();
};
const consentOpenAI = async (page: Page) => {
  await openSettings(page);
  await page.getByLabel("OpenAI Ads erlauben", { exact: true }).check();
  await page.getByRole("button", { name: "AUSWAHL SPEICHERN" }).click();
};
const successEvent = async (page: Page) => page.evaluate(() => {
  window.dispatchEvent(new CustomEvent("artbild:form_success", {
    detail: { formId: "kontakt_anfrage_form", formType: "contact_request" },
  }));
});
const fillInquiry = async (page: Page) => {
  await page.locator("#contact-request-type").selectOption("hochzeit");
  await page.locator("#contact-name").fill("Synthetic Testperson");
  await page.locator("#contact-email").fill("synthetic@example.test");
  await page.locator("#contact-event-date").fill("2027-06-12");
  await page.locator("#contact-location").fill("Synthetic Venue");
  await page.locator("#contact-security-year").fill(String(new Date().getFullYear()));
  await page.locator('textarea[name="message"]').fill("SYNTHETIC_PRIVATE_MESSAGE");
  await page.locator('input[name="privacy"]').check();
};
const leadCall = ["measure", "lead_created", { type: "customer_action" }, { opt_out: true }];

test("no OpenAI requests on page views, input, pre-consent success, or later consent", async ({ page, context }) => {
  const requests = await mockProviders(page);
  await page.goto(`${baseUrl}/kontakt/`);
  await expect(page.locator("#consent-summary")).toContainText("erhält keine Formularinhalte");
  await successEvent(page);
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => typeof (window as any).oaiq)).toBe("undefined");
  expect((await context.cookies()).filter(c => /^__(oppref|obref)/.test(c.name))).toEqual([]);
  await consentOpenAI(page);
  await fillInquiry(page);
  await expect(page.locator(frameSelector)).toHaveCount(0);
  expect(requests).toEqual([]);
  expect(await measurements(page)).toEqual([]);
});

test("OpenAI remains independent, only initializes at success and cannot read the parent form", async ({ page }) => {
  const requests = await mockProviders(page);
  await page.goto(`${baseUrl}/kontakt/`);
  await consentOpenAI(page);
  expect(await page.evaluate(() => (window as any).ArtbildConsent.services)).toEqual({
    googleTagManager: false, googleAnalytics: false, microsoftClarity: false, metaPixel: false, openaiAds: true,
  });
  await fillInquiry(page);
  await successEvent(page);
  await expect.poll(() => measurements(page)).toEqual([leadCall]);
  expect(await measurementFrame(page)!.evaluate(() => (window as any).__parentBlocked)).toBe(true);
  expect(await measurementFrame(page)!.locator("input,textarea,select").count()).toBe(0);
  expect(await page.evaluate(() => typeof (window as any).oaiq)).toBe("undefined");
  await expect(page.locator(frameSelector)).toHaveAttribute("sandbox", "allow-scripts");
  expect(requests).toEqual([sdkUrl]);
  await successEvent(page);
  expect((await calls(page)).filter((c: any[]) => c[0] === "init")).toHaveLength(1);
  expect(await measurements(page)).toHaveLength(1);
  await page.reload();
  expect(requests).toEqual([sdkUrl]);
  await expect(page.locator("[data-consent-dialog]")).not.toBeVisible();
  expect(await measurements(page)).toEqual([]);
});

test("tracks only a server-confirmed inquiry, never a failed send or form values", async ({ page }) => {
  const requests = await mockProviders(page);
  let succeeded = false;
  let posts = 0;
  await page.route("**/api/contact", async route => {
    posts += 1;
    await route.fulfill({ status: succeeded ? 200 : 500, json: { ok: succeeded, message: succeeded ? "Testanfrage bestätigt" : "Testfehler" } });
  });
  await page.goto(`${baseUrl}/kontakt/`);
  await consentOpenAI(page);
  await fillInquiry(page);
  await page.locator('form[data-track-form] button[type="submit"]').click();
  await expect(page.locator('[data-contact-status]')).toContainText("Testfehler");
  expect(requests).toEqual([]);
  succeeded = true;
  await page.locator('form[data-track-form] button[type="submit"]').click();
  await expect(page.locator('[data-contact-status]')).toContainText("Testanfrage bestätigt");
  await expect.poll(() => measurements(page)).toEqual([leadCall]);
  expect(posts).toBe(2);
  await successEvent(page);
  expect(await measurements(page)).toHaveLength(1);
  expect(JSON.stringify(await calls(page))).not.toMatch(/synthetic@|Testperson|Venue|2027-06-12|PRIVATE_MESSAGE/);
});

test("withdrawal removes the sandbox and identifiers and preserves denial on reload", async ({ page, context }) => {
  const requests = await mockProviders(page);
  await page.goto(`${baseUrl}/kontakt/`);
  await consentOpenAI(page);
  await successEvent(page);
  await expect.poll(() => measurements(page)).toHaveLength(1);
  await context.addCookies(["__oppref", "__obref"].map(name => ({ name, value: "synthetic", url: baseUrl })));
  await page.getByRole("button", { name: "Datenschutz-Einstellungen öffnen" }).click();
  await Promise.all([
    page.waitForEvent("domcontentloaded"),
    page.getByRole("button", { name: "Nur notwendige auswählen und schließen" }).click(),
  ]);
  expect((await context.cookies()).filter(c => /^__(oppref|obref)/.test(c.name))).toEqual([]);
  expect(await page.evaluate(() => (window as any).ArtbildConsent.services.openaiAds)).toBe(false);
  await successEvent(page);
  await expect(page.locator(frameSelector)).toHaveCount(0);
  expect(requests).toEqual([sdkUrl]);
});

test("withdrawal discards a pending SDK download and conversion queue", async ({ page }) => {
  await mockProviders(page);
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let requested = false;
  await page.route(sdkUrl, async route => { requested = true; await pending; await route.abort().catch(() => {}); });
  await page.goto(`${baseUrl}/kontakt/`);
  await consentOpenAI(page);
  await successEvent(page);
  await expect.poll(() => requested).toBe(true);
  await page.evaluate(() => (window as any).artbildConsentApi.setConsent({ services: { openaiAds: false } }));
  release();
  await expect(page.locator(frameSelector)).toHaveCount(0);
});

test("withdrawal in another tab stops an existing measurement sandbox", async ({ page, context }) => {
  await mockProviders(page);
  await page.goto(`${baseUrl}/kontakt/`);
  await consentOpenAI(page);
  const second = await context.newPage();
  const secondRequests = await mockProviders(second);
  await second.goto(`${baseUrl}/kontakt/`);
  await successEvent(second);
  await expect.poll(() => measurements(second)).toHaveLength(1);
  await page.getByRole("button", { name: "Datenschutz-Einstellungen öffnen" }).click();
  await Promise.all([
    second.waitForEvent("domcontentloaded"),
    page.getByRole("button", { name: "Nur notwendige auswählen und schließen" }).click(),
  ]);
  await successEvent(second);
  expect(await second.evaluate(() => (window as any).ArtbildConsent.services.openaiAds)).toBe(false);
  await expect(second.locator(frameSelector)).toHaveCount(0);
  expect(secondRequests).toEqual([sdkUrl]);
  await second.close();
});

test("a failed SDK download cannot prevent a contact inquiry", async ({ page }) => {
  await mockProviders(page);
  await page.route(sdkUrl, route => route.abort("failed"));
  await page.route("**/api/contact", route => route.fulfill({ json: { ok: true, message: "Testanfrage bestätigt" } }));
  await page.goto(`${baseUrl}/kontakt/`);
  await consentOpenAI(page);
  await fillInquiry(page);
  await page.locator('form[data-track-form] button[type="submit"]').click();
  await expect(page.locator('[data-contact-status]')).toContainText("Testanfrage bestätigt");
  expect(await measurements(page)).toEqual([]);
});

test("old consent and legacy marketing consent never enable OpenAI", async ({ page, context }) => {
  const requests = await mockProviders(page);
  await context.addCookies([{ name: "artbild_consent", url: baseUrl, value: encodeURIComponent(JSON.stringify({
    version: "2026-09-02.1", services: { googleTagManager: true, googleAnalytics: true, microsoftClarity: true, metaPixel: true },
  })) }]);
  await page.goto(`${baseUrl}/kontakt/`);
  await expect(page.locator("[data-consent-dialog]")).toBeVisible();
  expect(requests).toEqual([]);
  await page.evaluate(() => (window as any).artbildConsentApi.setConsent({ marketing: true }));
  await successEvent(page);
  expect(await page.evaluate(() => (window as any).ArtbildConsent.services.openaiAds)).toBe(false);
  expect(requests).not.toContain(sdkUrl);
});

test("renders accurate minimal measurement copy on narrow screens", async ({ page }) => {
  await mockProviders(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(`${baseUrl}/kontakt/`);
  const dialogBox = await page.locator("[data-consent-dialog]").boundingBox();
  for (const name of ["ALLE AKZEPTIEREN", "NUR NOTWENDIGE"]) {
    const box = await page.getByRole("button", { name, exact: true }).boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(dialogBox!.y);
    expect(box!.y + box!.height).toBeLessThanOrEqual(dialogBox!.y + dialogBox!.height);
  }
  await page.locator("[data-consent-dialog]").screenshot({ path: test.info().outputPath("cookie-banner-mobile.png") });
  await openSettings(page);
  await expect(page.locator("[data-consent-details]")).toContainText("weder ausgelesen noch an OpenAI übermittelt");
  await expect(page.locator("[data-consent-details]")).toContainText("widersprecht einer Verwendung dieser Messdaten");
  await expect(page.locator("[data-consent-dialog]")).not.toContainText("IP-Adresse");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "AUSWAHL SPEICHERN" }).click();
  await page.goto(`${baseUrl}/datenschutz/#openai-ads`);
  await expect(page.locator("body")).toContainText("Eingabefelder werden von der OpenAI-Messung nicht ausgelesen");
  await expect(page.locator("body")).toContainText("OpenAI als Auftragsverarbeiter");
  await expect(page.locator("body")).not.toContainText("normalisiert");
  await expect(page.locator('a[href="https://openai.com/policies/ad-tools-subprocessors/"]')).toHaveCount(1);
});

test("standalone measurement document cannot emit a conversion", async ({ page }) => {
  const requests = await mockProviders(page);
  await page.goto(`${baseUrl}/openai-conversion.html`);
  await page.evaluate(() => window.postMessage({ type: "artbild:openai:lead", pixelId: "TEST_OPENAI_PIXEL" }, "*"));
  expect(requests).toEqual([]);
});

test("official SDK cannot collect form data even with automatic matching enabled", async ({ page, context }) => {
  test.skip(!process.env.OPENAI_ADS_SDK_PATH, "Set a downloaded official SDK path for intercepted transport verification.");
  await mockProviders(page);
  const events: any[] = [];
  await page.route(sdkUrl, route => route.fulfill({ contentType: "application/javascript", body: readFileSync(process.env.OPENAI_ADS_SDK_PATH!, "utf8") }));
  await page.route("https://bzrcdn.openai.com/pixel-config/**", route => route.fulfill({ headers: { "access-control-allow-origin": "*" }, json: { automatic_advanced_matching_enabled: true } }));
  await page.route("https://bzr.openai.com/**", async route => {
    const body = route.request().postData();
    if (body) events.push(JSON.parse(body));
    await route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" }, json: {} });
  });
  await context.addCookies([{ name: "__obref", value: "old-persistent-reference", url: baseUrl }]);
  await page.goto(`${baseUrl}/kontakt/?oppref=synthetic-attribution&private_test=URL_PRIVATE_CANARY#FRAGMENT_PRIVATE_CANARY`);
  await consentOpenAI(page);
  await fillInquiry(page);
  // Keep all inputs populated while emitting the same confirmed-success signal.
  // Real submissions and failures are exercised separately with a mocked backend.
  await successEvent(page);
  await expect.poll(() => JSON.stringify(events)).toContain("lead_created");
  const serialized = JSON.stringify(events);
  expect(serialized).not.toContain("page_viewed");
  expect(serialized).toContain('"opt_out":true');
  expect(serialized).toContain("synthetic-attribution");
  expect(serialized).not.toMatch(/synthetic@|Testperson|Venue|2027-06-12|PRIVATE_MESSAGE|URL_PRIVATE_CANARY|FRAGMENT_PRIVATE_CANARY|old-persistent-reference/);
  for (const value of ["synthetic@example.test", "synthetic", "testperson", "synthetic testperson", "synthetic venue"]) {
    expect(serialized).not.toContain(createHash("sha256").update(value).digest("hex"));
  }
  const records = events.flatMap(batch => batch.events || []).filter(event => event.type === "lead_created");
  expect(records).toHaveLength(1);
  expect(records[0].source_url).toBe(`${baseUrl}/openai-conversion.html`);
  await test.info().attach("intercepted-sdk-events-synthetic-only", { body: serialized, contentType: "application/json" });
  const before = (await context.cookies()).find(cookie => cookie.name === "__oppref");
  expect(before?.value).toBe("synthetic-attribution");
  expect((await context.cookies()).find(cookie => cookie.name === "__obref")).toBeUndefined();
  await page.goto(`${baseUrl}/kontakt/`);
  expect((await context.cookies()).find(cookie => cookie.name === "__oppref")?.expires).toBe(before?.expires);
  await successEvent(page);
  await expect.poll(() => events.flatMap(batch => batch.events || []).filter(event => event.type === "lead_created").length).toBe(2);
  expect(events.filter(batch => batch.events?.some((event: any) => event.type === "lead_created")).every(batch => JSON.stringify(batch).includes("synthetic-attribution"))).toBe(true);
});
