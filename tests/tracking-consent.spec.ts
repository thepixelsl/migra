import { expect, test, type Page } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";

test.use({
  storageState: {
    cookies: [],
    origins: [],
  },
});

const providerRequest = /https:\/\/(?:www\.googletagmanager\.com|www\.clarity\.ms|connect\.facebook\.net)\//;

const captureProviderRequests = async (page: Page) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (providerRequest.test(request.url())) requests.push(request.url());
  });
  await page.route(providerRequest, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: "",
    });
  });
  return requests;
};

test("loads Google and Clarity only after statistics consent", async ({ page }) => {
  const requests = await captureProviderRequests(page);

  await page.goto(`${baseUrl}/kontakt/`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-consent-dialog]")).toBeVisible();
  expect(requests).toEqual([]);

  await page.getByRole("button", { name: "Individuell auswählen" }).click();
  await page.getByLabel("Google Analytics und Microsoft Clarity erlauben").check({ force: true });
  await page.getByRole("button", { name: "Auswahl speichern" }).click();

  await expect.poll(() => requests.some((url) => url.includes("googletagmanager.com/gtm.js")))
    .toBe(true);
  await expect.poll(() => requests.some((url) => url.includes("clarity.ms/tag/")))
    .toBe(true);
  expect(requests.some((url) => url.includes("connect.facebook.net"))).toBe(false);

  await expect(page.locator('script[data-artbild-provider="google-tag-manager"]')).toHaveCount(1);
  await expect(page.locator('script[data-artbild-provider="microsoft-clarity"]')).toHaveCount(1);
  await expect(page.locator('script[data-artbild-provider="meta"]')).toHaveCount(0);

  const providerRequestCount = requests.length;
  await page.getByRole("button", { name: "Datenschutz-Einstellungen öffnen" }).click();
  await page.getByLabel("Google Analytics und Microsoft Clarity erlauben").uncheck({ force: true });
  await Promise.all([
    page.waitForEvent("framenavigated"),
    page.getByRole("button", { name: "Auswahl speichern" }).click(),
  ]);
  await page.waitForLoadState("domcontentloaded");

  await expect(page.locator('script[data-artbild-provider="google-tag-manager"]')).toHaveCount(0);
  await expect(page.locator('script[data-artbild-provider="microsoft-clarity"]')).toHaveCount(0);
  expect(requests).toHaveLength(providerRequestCount);
});

test("keeps Google and Clarity blocked when only marketing is accepted", async ({ page }) => {
  const requests = await captureProviderRequests(page);

  await page.goto(`${baseUrl}/kontakt/`, { waitUntil: "domcontentloaded" });
  expect(requests).toEqual([]);

  await page.getByRole("button", { name: "Individuell auswählen" }).click();
  await page.getByLabel("Marketing-Dienste erlauben").check({ force: true });
  await page.getByRole("button", { name: "Auswahl speichern" }).click();

  await expect.poll(() => requests.some((url) => url.includes("connect.facebook.net")))
    .toBe(true);
  expect(requests.some((url) => url.includes("googletagmanager.com"))).toBe(false);
  expect(requests.some((url) => url.includes("clarity.ms"))).toBe(false);

  await expect(page.locator('script[data-artbild-provider="meta"]')).toHaveCount(1);
  await expect(page.locator('script[data-artbild-provider="google-tag-manager"]')).toHaveCount(0);
  await expect(page.locator('script[data-artbild-provider="microsoft-clarity"]')).toHaveCount(0);

  const providerRequestCount = requests.length;
  await page.getByRole("button", { name: "Datenschutz-Einstellungen öffnen" }).click();
  await page.getByLabel("Marketing-Dienste erlauben").uncheck({ force: true });
  await Promise.all([
    page.waitForEvent("framenavigated"),
    page.getByRole("button", { name: "Auswahl speichern" }).click(),
  ]);
  await page.waitForLoadState("domcontentloaded");

  await expect(page.locator('script[data-artbild-provider="meta"]')).toHaveCount(0);
  expect(requests).toHaveLength(providerRequestCount);
});

test("does not queue behavioral events before statistics consent", async ({ page }) => {
  await captureProviderRequests(page);
  await page.goto(`${baseUrl}/kontakt/`, { waitUntil: "domcontentloaded" });

  await page.locator("#contact-name").focus();
  const beforeConsent = await page.evaluate(() =>
    (window.dataLayer || []).map((entry) => entry?.event).filter(Boolean),
  );
  expect(beforeConsent).not.toContain("form_view");
  expect(beforeConsent).not.toContain("form_start");
  expect(beforeConsent).not.toContain("artbild_tracking_ready");

  await page.getByRole("button", { name: "Individuell auswählen" }).click();
  await page.getByLabel("Google Analytics und Microsoft Clarity erlauben").check({ force: true });
  await page.getByRole("button", { name: "Auswahl speichern" }).click();

  await expect.poll(async () => page.evaluate(() =>
    (window.dataLayer || []).some((entry) => entry?.event === "artbild_tracking_ready"),
  )).toBe(true);

  const afterConsent = await page.evaluate(() =>
    (window.dataLayer || []).map((entry) => entry?.event).filter(Boolean),
  );
  expect(afterConsent).not.toContain("form_view");
  expect(afterConsent).not.toContain("form_start");

  await page.evaluate(() => {
    window.artbildTracking?.track?.({ event: "post_consent_test" });
  });
  await expect.poll(async () => page.evaluate(() =>
    (window.dataLayer || []).some((entry) => entry?.event === "post_consent_test"),
  )).toBe(true);
});

test("masks every public form from Clarity", async ({ page }) => {
  for (const pathname of [
    "/kontakt/",
    "/standesamt-hamburg/",
    "/gallery/lovebirds-am-elbstrand/",
  ]) {
    await page.goto(`${baseUrl}${pathname}`, { waitUntil: "domcontentloaded" });

    const forms = page.locator("form");
    await expect(forms).not.toHaveCount(0);
    expect(await forms.count()).toBe(await page.locator("form[data-clarity-mask]").count());
  }
});
