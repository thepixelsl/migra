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

const readGtagCommands = (page: Page) => page.evaluate(() =>
  (window.dataLayer || [])
    .filter((entry) => entry && typeof entry === "object" && "callee" in entry)
    .map((entry) => Array.from(entry)),
);

test("loads GTM with denied defaults before a consent decision", async ({ page }) => {
  const requests = await captureProviderRequests(page);

  await page.goto(`${baseUrl}/kontakt/`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-consent-dialog]")).toBeVisible();

  await expect.poll(() => requests.some((url) => url.includes("googletagmanager.com/gtm.js")))
    .toBe(true);
  expect(requests.some((url) => url.includes("clarity.ms"))).toBe(false);
  expect(requests.some((url) => url.includes("connect.facebook.net"))).toBe(false);
  await expect(page.locator('script[data-artbild-provider="google-tag-manager"]')).toHaveCount(1);

  const commands = await readGtagCommands(page);
  const defaultConsent = commands.find(
    (entry) => entry[0] === "consent" && entry[1] === "default",
  );
  expect(defaultConsent?.[2]).toMatchObject({
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
});

test("updates Google consent independently for statistics and marketing", async ({ page }) => {
  const requests = await captureProviderRequests(page);

  await page.goto(`${baseUrl}/kontakt/`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Individuell auswählen" }).click();
  await page.getByLabel("Marketing-Dienste erlauben").check({ force: true });
  await page.getByRole("button", { name: "Auswahl speichern" }).click();

  expect(requests.some((url) => url.includes("googletagmanager.com"))).toBe(true);
  expect(requests.some((url) => url.includes("clarity.ms"))).toBe(false);
  expect(requests.some((url) => url.includes("connect.facebook.net"))).toBe(false);

  await expect.poll(async () => {
    const commands = await readGtagCommands(page);
    return commands.some((entry) =>
      entry[0] === "consent"
      && entry[1] === "update"
      && entry[2]?.analytics_storage === "denied"
      && entry[2]?.ad_storage === "granted"
      && entry[2]?.ad_user_data === "granted"
      && entry[2]?.ad_personalization === "granted"
    );
  }).toBe(true);
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
    (window.dataLayer || []).some((entry) =>
      entry?.[0] === "event" && entry?.[1] === "artbild_tracking_ready"
    ),
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
    (window.dataLayer || []).some((entry) =>
      entry?.[0] === "event" && entry?.[1] === "post_consent_test"
    ),
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

test("keeps the consent dialog usable without horizontal overflow", async ({ page }) => {
  await captureProviderRequests(page);

  for (const viewport of [
    { width: 320, height: 844 },
    { width: 390, height: 844 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`${baseUrl}/kontakt/`, { waitUntil: "domcontentloaded" });

    const dialog = page.locator("[data-consent-dialog]");
    await expect(dialog).toBeVisible();
    const geometry = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(-1);
    expect(geometry.right).toBeLessThanOrEqual(viewport.width + 1);
    expect(geometry.documentOverflow).toBeLessThanOrEqual(0);

    await expect(page.getByRole("button", { name: "Alle akzeptieren" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nur notwendige", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Individuell auswählen" })).toBeVisible();
  }
});
