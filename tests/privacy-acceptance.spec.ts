import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { gunzipSync } from "node:zlib";

const services = ["googleAnalytics", "googleAds", "microsoftClarity", "metaPixel", "openaiAds"];
const SDK = "https://bzrcdn.openai.com/sdk/oaiq.min.js";
const root = new URL("../reports/ads-datenschutz-2026-09-30/evidence/", import.meta.url);
const all = Object.fromEntries(services.map(name => [name, true]));
const none = Object.fromEntries(services.map(name => [name, false]));
const fakeSDK = `const pending=window.oaiq.q; window.oaiq=(...a)=>{if(a[0]==='measure')fetch('https://bzr.openai.com/mock',{method:'POST',body:JSON.stringify(a)});};pending.forEach(a=>window.oaiq(...a));`;
type Hit = { url: string; method: string; body: string; resource: string; referer: string };
async function observe(context: BrowserContext, real = false) {
  const hits: Hit[] = [];
  await context.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (["127.0.0.1", "localhost", "artbild-fotografie.de"].includes(url.hostname)) {
      if (url.pathname === "/api/contact") return route.fulfill({ json: { ok: true, message: "Synthetische Testanfrage bestätigt" } });
      if (url.pathname === "/@vite/client") return route.fulfill({contentType: "application/javascript", body: ""});
      if (url.hostname === "artbild-fotografie.de") {
        const response = await route.fetch({ url: "http://127.0.0.1:4341" + url.pathname + url.search });
        return route.fulfill({ response });
      }
      return route.continue();
    }
    const buffer = request.postDataBuffer();
    const decoded = buffer && buffer[0] === 0x1f && buffer[1] === 0x8b ? gunzipSync(buffer).toString("utf8") : buffer?.toString("utf8") || "";
    hits.push({ url: request.url(), method: request.method(), body: decoded,
      resource: request.resourceType(), referer: request.headers().referer || "" });
    if (request.url() === SDK) return route.fulfill({ contentType: "application/javascript", body: real ? readFileSync(new URL("openai-sdk.js", root), "utf8") : fakeSDK });
    if (url.hostname === "bzrcdn.openai.com" && url.pathname.startsWith("/pixel-config/")) {
      // Deliberately hostile configuration tests isolation, not account acceptance.
      return route.fulfill({ headers: { "access-control-allow-origin": "*" }, json: { automatic_advanced_matching_enabled: true } });
    }
    if (real && url.hostname === "www.googletagmanager.com" && url.pathname === "/gtag/js") {
      const id = url.searchParams.get("id");
      if (id === "G-TSWGFD1YKF") return route.fulfill({ contentType: "application/javascript", body: readFileSync(new URL("google-current.js", root), "utf8") });
      if (id === "AW-874983678") return route.fulfill({ contentType: "application/javascript", body: readFileSync(new URL("google-ads-current.js", root), "utf8") });
    }
    if (real && url.hostname === "www.googletagmanager.com" && url.pathname === "/gtm.js") {
      return route.fulfill({ contentType: "application/javascript", body: readFileSync(new URL("gtm-current.js", root), "utf8") });
    }
    if (real && request.resourceType() === "script" && (
      (url.hostname === "connect.facebook.net" && (/\/fbevents\.js$/.test(url.pathname) || url.pathname.startsWith("/signals/config/")))
      || (url.hostname === "www.clarity.ms" && url.pathname.startsWith("/tag/"))
      || (url.hostname === "scripts.clarity.ms" && /\/clarity\.js$/.test(url.pathname)))) {
      const cache = new URL("sdk-cache/", root); mkdirSync(cache, { recursive: true });
      const file = new URL(createHash("sha256").update(request.url()).digest("hex") + ".js", cache);
      if (!existsSync(file)) {
        const response = await fetch(request.url());
        if (!response.ok) throw new Error(`SDK download failed: ${url.hostname} ${response.status}`);
        writeFileSync(file, await response.text());
      }
      return route.fulfill({ contentType: "application/javascript", body: readFileSync(file, "utf8") });
    }
    // Nothing measuring a synthetic visitor is forwarded to a provider.
    return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" },
      contentType: request.resourceType() === "script" ? "application/javascript" : "application/json", body: request.resourceType() === "script" ? "" : "{}" });
  });
  return hits;
}
const choose = (page: Page, values: Record<string, boolean>) => page.evaluate(services => (window as any).artbildConsentApi.setConsent({ services }), values);
const success = (page: Page, id = randomUUID()) => page.evaluate(eventId => window.dispatchEvent(new CustomEvent("artbild:form_success", {
  detail: { eventId, formId: "kontakt_anfrage_form", formType: "contact_request" },
})), id);
async function fill(page: Page) {
  await page.locator("#contact-request-type").selectOption("hochzeit");
  await page.locator("#contact-name").fill("Privacy Canaryperson");
  await page.locator("#contact-email").fill("privacy-canary@example.test");
  await page.locator("#contact-event-date").fill("2027-06-12");
  await page.locator("#contact-location").fill("Privacy Canaryvenue");
  await page.locator("#contact-security-year").fill(String(new Date().getFullYear()));
  await page.locator('textarea[name="message"]').fill("PRIVATE_FORM_CANARY");
  await page.locator('input[name="privacy"]').check();
}
const settle = (page: Page) => page.waitForTimeout(700);

for (let mask = 0; mask < 32; mask++) test(`matrix ${String(mask).padStart(2, "0")} independent services`, async ({ page, context }) => {
  const hits = await observe(context);
  await page.goto("/kontakt/");
  await settle(page);
  expect(hits).toEqual([]);
  const wanted = Object.fromEntries(services.map((name, bit) => [name, Boolean(mask & (1 << bit))]));
  await choose(page, wanted);
  await success(page);
  await settle(page);
  const state = await page.evaluate(() => (window as any).ArtbildConsent.services);
  for (const name of services) expect(state[name], name).toBe(wanted[name]);
  expect(hits.some(hit => hit.url.includes("id=G-TSWGFD1YKF"))).toBe(wanted.googleAnalytics);
  expect(hits.some(hit => hit.url.includes("id=AW-874983678"))).toBe(wanted.googleAds);
  expect(hits.some(hit => hit.url.includes("/gtm.js"))).toBe(wanted.metaPixel || wanted.microsoftClarity);
  expect(hits.some(hit => hit.url === SDK)).toBe(wanted.openaiAds);
  const commands = await page.evaluate(() => (window as any).dataLayer.filter((v: any) => v[0] === "consent").map((v: any) => Array.from(v)));
  expect(commands.at(-1)[2]).toMatchObject({ analytics_storage: wanted.googleAnalytics ? "granted" : "denied",
    ad_storage: wanted.googleAds ? "granted" : "denied", ad_user_data: wanted.googleAds ? "granted" : "denied", ad_personalization: "denied" });
});

test("first visit, rejection, old version and expired decision block all services", async ({ page, context, baseURL }) => {
  const hits = await observe(context);
  await page.goto("/kontakt/");
  await page.getByRole("button", { name: "NUR NOTWENDIGE", exact: true }).click();
  await settle(page);
  expect(hits).toEqual([]);
  const decision = JSON.parse(decodeURIComponent((await context.cookies()).find(c => c.name === "artbild_consent")!.value));
  for (const change of [{ version: "2026-09-29.1" }, { updatedAt: "2020-01-01T00:00:00.000Z" }, { updatedAt: "garbage" }]) {
    await context.addCookies([{ name: "artbild_consent", url: baseURL!, value: encodeURIComponent(JSON.stringify({ ...decision, services: all, ...change })) }]);
    await page.reload(); await settle(page);
    await expect(page.locator("[data-consent-dialog]")).toBeVisible();
    expect(hits).toEqual([]);
  }
});

test("partial and cross-tab withdrawal stop pending loaders and all future events", async ({ page, context }) => {
  const hits = await observe(context);
  await page.goto("/kontakt/"); await choose(page, all);
  const second = await context.newPage(); await second.goto("/kontakt/");
  await success(second); await settle(second);
  await Promise.all([second.waitForEvent("domcontentloaded"), choose(page, { ...all, googleAnalytics: false, metaPixel: false, openaiAds: false })]);
  await expect.poll(() => second.evaluate(() => (window as any).ArtbildConsent.services.googleAnalytics)).toBe(false);
  await choose(second, none); await settle(second);
  const before = hits.length;
  await success(second); await success(page); await settle(page);
  expect(hits).toHaveLength(before);
  expect((await context.cookies()).filter(c => /^(_ga|_gcl_|_fb|_cl|__op|__ob)/.test(c.name))).toEqual([]);
});

test("withdrawal while scripts are delayed does not replay queued events", async ({ page, context }) => {
  const hits = await observe(context);
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  let requested = false;
  await context.route(SDK, async route => { requested = true; await waiting; await route.fulfill({ contentType: "application/javascript", body: fakeSDK }).catch(() => {}); });
  await page.goto("/kontakt/"); await choose(page, { ...none, openaiAds: true }); await success(page);
  await expect.poll(() => requested).toBe(true);
  await Promise.all([page.waitForEvent("domcontentloaded"), choose(page, none)]);
  release(); await settle(page);
  expect(hits.filter(h => h.url.startsWith("https://bzr.openai.com/"))).toEqual([]);
  await expect(page.locator('iframe[data-artbild-provider="openai-ads"]')).toHaveCount(0);
});

test("server success counts once, errors and page views never count; cookie lifetimes", async ({ page, context }) => {
  const hits = await observe(context);
  await page.goto("/kontakt/?oppref=synthetic-reference");
  await page.getByRole("button", { name: "ALLE AKZEPTIEREN", exact: true }).first().click();
  await settle(page);
  expect(hits.filter(h => h.url === SDK)).toEqual([]);
  let okay = false; let posts = 0;
  await page.route("**/api/contact", route => { posts++; return route.fulfill({ status: okay ? 200 : 500, json: { ok: okay, message: okay ? "Test bestätigt" : "Testfehler" } }); });
  await fill(page);
  await page.locator('form[data-track-form] button[type="submit"]').click();
  await expect(page.locator("[data-contact-status]")).toContainText("Testfehler");
  expect(hits.filter(h => h.url === SDK)).toEqual([]);
  okay = true;
  await page.locator('form[data-track-form] button[type="submit"]').dblclick();
  await expect(page.locator("[data-contact-status]")).toContainText("Test bestätigt");
  await settle(page); expect(posts).toBe(2);
  expect(hits.filter(h => h.url === SDK)).toHaveLength(1);
  const commands = await page.evaluate(() => (window as any).dataLayer.filter((v: any) => v[0] === "event" && v[1] === "conversion").map((v: any) => Array.from(v)));
  expect(commands).toHaveLength(1);
  await success(page, commands[0][2].transaction_id); await settle(page);
  expect(hits.filter(h => h.url === SDK)).toHaveLength(1);
  const cookies = await context.cookies();
  const now = Date.now() / 1000;
  expect(cookies.find(c => c.name === "artbild_consent")!.expires - now).toBeLessThanOrEqual(180 * 86400);
  expect(cookies.find(c => c.name === "__oppref")!.expires - now).toBeLessThanOrEqual(30 * 86400);
  expect(cookies.find(c => c.name === "__obref")).toBeUndefined();
});

test("all five fields start unchecked and equal first-level choices fit a narrow screen", async ({ page, context }) => {
  await observe(context); await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/kontakt/");
  const accept = await page.getByRole("button", { name: "ALLE AKZEPTIEREN", exact: true }).first().boundingBox();
  const reject = await page.getByRole("button", { name: "NUR NOTWENDIGE", exact: true }).boundingBox();
  expect(accept!.width).toBeCloseTo(reject!.width, 0);
  expect(accept!.height).toBeCloseTo(reject!.height, 0);
  await page.getByRole("button", { name: "EINSTELLUNGEN", exact: true }).click();
  expect(await page.locator("[data-consent-service]").count()).toBe(5);
  expect(await page.locator("[data-consent-service]:checked").count()).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("five-services-mobile.png") });
});

test("real transport: opaque OpenAI SDK emits one minimal opt-out lead without identity data", async ({ page, context }) => {
  const hits = await observe(context, true);
  await page.goto("/kontakt/?oppref=synthetic-reference&email=privacy-canary%40example.test#PRIVATE_FRAGMENT");
  await choose(page, { ...none, openaiAds: true });
  await page.locator("[data-consent-close]").click();
  await choose(page, { ...none, openaiAds: true });
  await fill(page);
  const id = randomUUID(); await success(page, id); await success(page, id);
  await expect.poll(() => hits.filter(h => h.url.startsWith("https://bzr.openai.com/") && h.body.includes("lead_created")).length).toBe(1);
  const payloads = hits.filter(h => h.url.startsWith("https://bzr.openai.com/"));
  const data = JSON.stringify(payloads);
  const eventBodies = payloads.map(hit => JSON.parse(hit.body));
  expect(JSON.stringify(eventBodies)).toMatch(/\"opt_out\":true/);
  const canaries = ["privacy-canary@example.test", "privacy canaryperson", "privacy canaryvenue", "PRIVATE_FORM_CANARY", "2027-06-12"];
  for (const value of canaries) for (const form of [value, encodeURIComponent(value), createHash("sha256").update(value.toLowerCase()).digest("hex"), createHash("sha256").update(value.toLowerCase()).digest("base64url")]) expect(data.toLowerCase()).not.toContain(form.toLowerCase());
  expect(data).not.toContain("PRIVATE_FRAGMENT");
  expect(data).not.toContain("page_viewed");
  expect((await context.cookies()).some(c => c.name === "__obref")).toBe(false);
  await test.info().attach("intercepted-real-sdk-synthetic-payloads", { body: data, contentType: "application/json" });
});

for (const choice of ["googleAnalytics", "googleAds", "both"]) test(`real transport: isolated Google ${choice}`, async ({ page, context }) => {
  const hits = await observe(context, true);
  await page.goto("/kontakt/?email=privacy-canary%40example.test&gclid=SYNTHETIC_CLICK#PRIVATE_FRAGMENT");
  await page.getByRole("button", { name: "NUR NOTWENDIGE", exact: true }).click();
  await choose(page, { ...none, googleAnalytics: choice !== "googleAds", googleAds: choice !== "googleAnalytics" });
  await settle(page);
  expect(hits.filter(h => h.url.includes("44lFCI_K0KkYEP7hnKED")), "no lead on page load").toEqual([]);
  await fill(page); await success(page); await settle(page);
  await test.info().attach("intercepted-google-requests", { body: JSON.stringify({ hits, cookies: await context.cookies() }), contentType: "application/json" });
  const combined = hits.map(h => `${h.url} ${h.body} ${h.referer}`).join("\n");
  for (const value of ["privacy-canary@example.test", "Privacy Canaryperson", "PRIVATE_FORM_CANARY", "2027-06-12"]) {
    for (const encoding of [value, encodeURIComponent(value), createHash("sha256").update(value.toLowerCase()).digest("hex")]) expect(combined.toLowerCase()).not.toContain(encoding.toLowerCase());
  }
  expect(combined).not.toContain("PRIVATE_FRAGMENT");
  if (choice === "googleAnalytics") {
    expect(hits.filter(h => /pagead|doubleclick|googleadservices|AW-874983678/.test(h.url))).toEqual([]);
    expect(hits.some(h => h.url.includes("/g/collect") && (h.url + h.body).includes("G-TSWGFD1YKF"))).toBe(true);
  }
  if (choice === "googleAds") expect(hits.filter(h => /google-analytics|G-TSWGFD1YKF/.test(h.url))).toEqual([]);
  if (choice !== "googleAnalytics") expect(hits.some(h => (h.url + h.body).includes("44lFCI_K0KkYEP7hnKED"))).toBe(true);
});

for (let mask = 0; mask < 32; mask++) test(`real transport matrix ${mask} provider separation and data`, async ({ page, context }) => {
  const hits = await observe(context, true);
  await page.goto("/kontakt/?email=privacy-canary%40example.test#PRIVATE_FRAGMENT");
  await page.getByRole("button", { name: "NUR NOTWENDIGE", exact: true }).click();
  const wanted = Object.fromEntries(services.map((name, bit) => [name, Boolean(mask & (1 << bit))]));
  await choose(page, wanted); await fill(page); await success(page); await page.waitForTimeout(3500);
  await test.info().attach("real-recipients-cookies-storage", { body: JSON.stringify({ mask, wanted, hits,
    cookies: await context.cookies(), storage: await page.evaluate(() => ({ local: {...localStorage}, session: {...sessionStorage} })) }), contentType: "application/json" });
  for (const hit of hits) {
    const u = new URL(hit.url);
    if (/openai\.com$/.test(u.hostname)) expect(wanted.openaiAds).toBe(true);
    else if (/facebook\.(net|com)$/.test(u.hostname)) expect(wanted.metaPixel).toBe(true);
    else if (/(clarity\.ms|bing\.com)$/.test(u.hostname)) expect(wanted.microsoftClarity).toBe(true);
    else if (u.hostname === "www.googletagmanager.com") {
      if (u.pathname === "/gtm.js") expect(wanted.metaPixel || wanted.microsoftClarity).toBe(true);
      else if (u.searchParams.get("id") === "G-TSWGFD1YKF") expect(wanted.googleAnalytics).toBe(true);
      else if (u.searchParams.get("id") === "AW-874983678") expect(wanted.googleAds).toBe(true);
      else throw new Error(`Unexpected Google loader: ${hit.url}`);
    } else if (/(google-analytics\.com|analytics\.google\.com)$/.test(u.hostname)) expect(wanted.googleAnalytics).toBe(true);
    else if (/google(adservices)?\.(com|de)$|doubleclick\.net$|googlesyndication\.com$/.test(u.hostname)) expect(wanted.googleAds).toBe(true);
    else throw new Error(`Unexpected recipient: ${hit.url}`);
  }
  if (wanted.metaPixel) expect(hits.some(h => /facebook\.com\/tr/.test(h.url)), "Meta must actually emit a measurement").toBe(true);
  if (wanted.microsoftClarity) expect(hits.some(h => /clarity\.ms\/collect/.test(h.url)), "Clarity must actually emit a measurement").toBe(true);
  if (wanted.openaiAds) expect(hits.filter(h => h.url.startsWith("https://bzr.openai.com/") && h.body.includes("lead_created")), "OpenAI must emit exactly one lead").toHaveLength(1);
  const combined = JSON.stringify(hits).toLowerCase();
  for (const value of ["privacy-canary@example.test", "privacy canaryperson", "privacy canaryvenue", "PRIVATE_FORM_CANARY", "2027-06-12"]) {
    for (const representation of [value, encodeURIComponent(value), createHash("sha256").update(value.toLowerCase()).digest("hex"), createHash("sha256").update(value.toLowerCase()).digest("base64url")]) expect(combined).not.toContain(representation.toLowerCase());
  }
  expect(combined).not.toContain("private_fragment");
});

test('consent dialog traps focus, restores its trigger, and Escape rejects', async ({page,context})=>{
 const hits=await observe(context);await page.goto('/kontakt/');
 const dialog=page.locator('[data-consent-dialog]');await expect(dialog).toBeVisible();
 await page.keyboard.press('Shift+Tab');
 for(let i=0;i<10;i++){expect(await page.evaluate(()=>document.querySelector('[data-consent-dialog]')?.contains(document.activeElement))).toBe(true);await page.keyboard.press('Tab');}
 await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
 const settings=page.getByRole('button',{name:'Datenschutz-Einstellungen öffnen',exact:true});await expect(settings).toBeFocused();
 await settings.click();await expect(dialog).toBeVisible();
 await page.getByRole('button',{name:'Nur notwendige auswählen und schließen',exact:true}).click();await expect(settings).toBeFocused();
 expect(hits).toEqual([]);
});
test('standalone OpenAI document cannot create measurements',async({page,context})=>{
 const hits=await observe(context,true);await page.goto('/openai-conversion.html');await page.waitForTimeout(1000);expect(hits).toEqual([]);
});
