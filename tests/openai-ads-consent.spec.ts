import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const providers = /^https:\/\/(?:[^/]+\.)?(?:openai\.com|googletagmanager\.com|google-analytics\.com|clarity\.ms|facebook\.net|facebook\.com)\//;
const sdkUrl = "https://bzrcdn.openai.com/sdk/oaiq.min.js";
const fakeSdk = `
  window.__adsCalls = [];
  const pending = window.oaiq.q || [];
  window.oaiq = function(...args) { window.__adsCalls.push(args); };
  pending.forEach(args => window.oaiq(...args));
`;
test.use({ storageState: { cookies: [], origins: [] } });

const mockProviders = async (page: Page) => {
  const requests: string[] = [];
  await page.route(providers, async (route) => {
    requests.push(route.request().url());
    await route.fulfill({ contentType: "application/javascript", body: route.request().url() === sdkUrl ? fakeSdk : "" });
  });
  return requests;
};
const calls = (page: Page) => page.evaluate(() => (window as any).__adsCalls || []);
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

test("blocks OpenAI before consent and never replays earlier successes", async ({ page, context }) => {
  const requests = await mockProviders(page);
  await page.goto(`${baseUrl}/kontakt/`);
  await expect(page.locator('[data-consent-service="openaiAds"]')).toHaveCount(1);
  await expect(page.locator("#consent-summary")).toContainText("Kontaktangaben aus Formularen gehasht");
  await successEvent(page);
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => typeof (window as any).oaiq)).toBe("undefined");
  expect((await context.cookies()).filter(c => /^__(oppref|obref)/.test(c.name))).toEqual([]);
  await consentOpenAI(page);
  await expect.poll(() => measurements(page)).toEqual([
    ["measure", "page_viewed", { type: "contents" }, { opt_out: true }],
  ]);
});

test("OpenAI alone stays independent and initializes once per page", async ({ page }) => {
  const requests = await mockProviders(page);
  await page.goto(`${baseUrl}/kontakt/`);
  await consentOpenAI(page);
  await expect.poll(() => requests).toEqual([sdkUrl]);
  expect(await page.evaluate(() => (window as any).ArtbildConsent.services)).toEqual({
    googleTagManager: false, googleAnalytics: false, microsoftClarity: false, metaPixel: false, openaiAds: true,
  });
  expect((await calls(page))[0]).toEqual(["consent", true]);
  expect((await calls(page)).filter((c: any[]) => c[0] === "init")).toHaveLength(1);
  await page.getByRole("button", { name: "Datenschutz-Einstellungen öffnen" }).click();
  await expect(page.getByLabel("Marketing erlauben")).not.toBeChecked();
  expect(await page.getByLabel("Marketing erlauben").evaluate((el: HTMLInputElement) => el.indeterminate)).toBe(true);
  await page.getByRole("button", { name: "AUSWAHL SPEICHERN" }).click();
  expect(await measurements(page)).toHaveLength(1);
  expect(requests).toEqual([sdkUrl]);
  await page.reload();
  await expect.poll(() => requests).toEqual([sdkUrl, sdkUrl]);
  await expect(page.locator("[data-consent-dialog]")).not.toBeVisible();
  expect(await measurements(page)).toHaveLength(1);
});

test("tracks only a confirmed successful inquiry, with minimal data", async ({ page }) => {
  await mockProviders(page);
  let succeeded = false;
  let posts = 0;
  await page.route("**/api/contact", async route => {
    posts += 1;
    await route.fulfill({ status: succeeded ? 200 : 500, json: { ok: succeeded, message: succeeded ? "Testanfrage bestätigt" : "Testfehler" } });
  });
  await page.goto(`${baseUrl}/kontakt/`);
  await consentOpenAI(page);
  await fillInquiry(page);
  expect(await measurements(page)).toHaveLength(1);
  await page.locator('form[data-track-form] button[type="submit"]').click();
  await expect(page.locator('[data-contact-status]')).toContainText("Testfehler");
  expect(await measurements(page)).toHaveLength(1);
  succeeded = true;
  await page.locator('form[data-track-form] button[type="submit"]').click();
  await expect(page.locator('[data-contact-status]')).toContainText("Testanfrage bestätigt");
  await expect.poll(() => measurements(page)).toEqual([
    ["measure", "page_viewed", { type: "contents" }, { opt_out: true }],
    ["measure", "lead_created", { type: "customer_action" }, { opt_out: true }],
  ]);
  expect(posts).toBe(2);
  await successEvent(page); // Duplicate success notification must not count again.
  expect(await measurements(page)).toHaveLength(2);
  expect(JSON.stringify(await calls(page))).not.toMatch(/synthetic@|Testperson|Venue|2027-06-12|PRIVATE_MESSAGE/);
});

test("withdrawal stops tracking, removes identifiers and preserves denial on reload", async ({ page, context }) => {
  const requests = await mockProviders(page);
  await page.goto(`${baseUrl}/kontakt/`);
  await consentOpenAI(page);
  await expect.poll(() => requests).toEqual([sdkUrl]);
  await context.addCookies(["__oppref", "__obref"].map(name => ({ name, value: "synthetic", url: baseUrl })));
  await page.getByRole("button", { name: "Datenschutz-Einstellungen öffnen" }).click();
  await Promise.all([
    page.waitForEvent("domcontentloaded"),
    page.getByRole("button", { name: "Nur notwendige auswählen und schließen" }).click(),
  ]);
  expect((await context.cookies()).filter(c => /^__(oppref|obref)/.test(c.name))).toEqual([]);
  expect(await page.evaluate(() => (window as any).ArtbildConsent.services.openaiAds)).toBe(false);
  await successEvent(page);
  expect(requests).toEqual([sdkUrl]);
  expect(await page.evaluate(() => typeof (window as any).oaiq)).toBe("undefined");
});

test("drops the pending SDK queue when consent is revoked during download", async ({ page }) => {
  await mockProviders(page);
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route(sdkUrl, async route => { await pending; await route.abort().catch(() => {}); });
  await page.goto(`${baseUrl}/kontakt/`);
  await consentOpenAI(page);
  await successEvent(page);
  const remaining = await page.evaluate(() => {
    (window as any).artbildConsentApi.setConsent({ services: { openaiAds: false } });
    return (window as any).oaiq.q.map((args: IArguments) => Array.from(args));
  });
  release();
  expect(remaining).toEqual([["consent", false]]);
});

test("withdrawal in another tab stops an already loaded pixel", async ({ page, context }) => {
  await mockProviders(page);
  await page.goto(`${baseUrl}/kontakt/`);
  await consentOpenAI(page);
  const second = await context.newPage();
  const secondRequests = await mockProviders(second);
  await second.goto(`${baseUrl}/kontakt/`);
  await expect.poll(() => measurements(second)).toHaveLength(1);
  await page.getByRole("button", { name: "Datenschutz-Einstellungen öffnen" }).click();
  await Promise.all([
    page.waitForEvent("domcontentloaded"),
    second.waitForEvent("domcontentloaded"),
    page.getByRole("button", { name: "Nur notwendige auswählen und schließen" }).click(),
  ]);
  await successEvent(second);
  expect(await second.evaluate(() => (window as any).ArtbildConsent.services.openaiAds)).toBe(false);
  expect(await second.evaluate(() => typeof (window as any).oaiq)).toBe("undefined");
  expect(secondRequests).toEqual([sdkUrl]);
  await second.close();
});

test("a failed SDK download does not prevent a contact inquiry", async ({ page }) => {
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
  expect(await page.evaluate(() => (window as any).ArtbildConsent.services.openaiAds)).toBe(false);
  expect(requests).not.toContain(sdkUrl);
});

test("renders the matching notice and privacy section on narrow screens", async ({ page }) => {
  await mockProviders(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(`${baseUrl}/kontakt/`);
  // Both choices must be fully visible without scrolling past an accept button.
  const dialogBox = await page.locator("[data-consent-dialog]").boundingBox();
  for (const name of ["ALLE AKZEPTIEREN", "NUR NOTWENDIGE"]) {
    const buttonBox = await page.getByRole("button", { name, exact: true }).boundingBox();
    expect(buttonBox!.y).toBeGreaterThanOrEqual(dialogBox!.y);
    expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(dialogBox!.y + dialogBox!.height);
  }
  await page.locator("[data-consent-dialog]").screenshot({ path: test.info().outputPath("cookie-banner-mobile.png") });
  await openSettings(page);
  await expect(page.getByLabel("OpenAI Ads erlauben")).toBeVisible();
  await expect(page.locator("[data-consent-details]")).toContainText("für den Abgleich mit Anzeigenkontakten verwenden");
  await expect(page.locator("[data-consent-details]")).toContainText("widersprecht einer Verwendung dieser Messdaten");
  await page.getByLabel("OpenAI Ads erlauben").scrollIntoViewIfNeeded();
  await page.locator("[data-consent-dialog]").screenshot({ path: test.info().outputPath("cookie-openai-details-mobile.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "AUSWAHL SPEICHERN" }).click();
  await page.goto(`${baseUrl}/datenschutz/#openai-ads`);
  await expect(page.locator("#openai-ads")).toContainText("OpenAI Ads");
  await expect(page.locator("body")).toContainText("Dieser automatische Kontaktabgleich ist von Ihrer Einwilligung");
  await expect(page.locator("body")).toContainText("OpenAI als Auftragsverarbeiter");
  await expect(page.locator('a[href="https://openai.com/policies/ad-tools-subprocessors/"]')).toHaveCount(1);
});

test("official SDK honors consent, opt-out and attribution cookies (intercepted transport)", async ({ page, context }) => {
  test.skip(!process.env.OPENAI_ADS_SDK_PATH, "Set an externally downloaded official SDK path for the transport smoke test.");
  await mockProviders(page);
  const events: any[] = [];
  await page.route(sdkUrl, route => route.fulfill({ contentType: "application/javascript", body: readFileSync(process.env.OPENAI_ADS_SDK_PATH!, "utf8") }));
  await page.route("https://bzrcdn.openai.com/pixel-config/**", route => route.fulfill({ json: { automatic_advanced_matching_enabled: true } }));
  await page.route("https://bzr.openai.com/**", async route => {
    const body = route.request().postData();
    if (body) events.push(JSON.parse(body));
    await route.fulfill({ status: 200, json: {} });
  });
  await page.route("**/api/contact", route => route.fulfill({ json: { ok: true, message: "Testanfrage bestätigt" } }));
  await page.goto(`${baseUrl}/kontakt/?oppref=synthetic-attribution&private_test=URL_PRIVATE_CANARY#FRAGMENT_PRIVATE_CANARY`);
  expect(events).toEqual([]);
  const configLoaded = page.waitForResponse(response => response.url().includes("/pixel-config/"));
  await consentOpenAI(page);
  await configLoaded;
  await fillInquiry(page);
  await page.locator('form[data-track-form] button[type="submit"]').click();
  await expect(page.locator('[data-contact-status]')).toContainText("Testanfrage bestätigt");
  await expect.poll(() => JSON.stringify(events)).toContain("lead_created");
  const serialized = JSON.stringify(events);
  expect(serialized).toContain("page_viewed");
  expect(serialized).toContain('"opt_out":true');
  expect(serialized).not.toMatch(/synthetic@|Testperson|PRIVATE_MESSAGE/);
  // The account flag enables matching independently of our minimal measure call.
  expect(serialized).toContain(createHash("sha256").update("synthetic@example.test").digest("hex"));
  expect(serialized).not.toMatch(/URL_PRIVATE_CANARY|FRAGMENT_PRIVATE_CANARY/);
  expect(events.flatMap(batch => batch.events || []).filter(event => event.source_url)
    .every(event => event.source_url === `${baseUrl}/kontakt/`)).toBe(true);
  await test.info().attach("intercepted-sdk-events-synthetic-only", { body: serialized, contentType: "application/json" });
  const cookieBefore = (await context.cookies()).find(cookie => cookie.name === "__oppref");
  expect(cookieBefore?.value).toBe("synthetic-attribution");
  await page.goto(`${baseUrl}/kontakt/`);
  await expect(page.locator('script[data-artbild-provider="openai-ads"]')).toHaveCount(1);
  const cookieAfter = (await context.cookies()).find(cookie => cookie.name === "__oppref");
  expect(cookieAfter?.value).toBe(cookieBefore?.value);
  expect(cookieAfter?.expires).toBe(cookieBefore?.expires);
  await page.getByRole("button", { name: "Datenschutz-Einstellungen öffnen" }).click();
  await Promise.all([
    page.waitForEvent("domcontentloaded"),
    page.getByRole("button", { name: "Nur notwendige auswählen und schließen" }).click(),
  ]);
  await expect(page.locator('script[data-artbild-provider="openai-ads"]')).toHaveCount(0);
  expect((await context.cookies()).filter(cookie => ["__obref", "__oppref"].includes(cookie.name))).toEqual([]);
  expect(await page.evaluate(() => typeof (window as any).oaiq)).toBe("undefined");
});
