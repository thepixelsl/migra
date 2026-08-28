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

test("keeps the agent reference page free of consent UI and optional tracking", async ({ page }) => {
  const requests = await captureProviderRequests(page);

  await page.goto(`${baseUrl}/fuer-agenten/`, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", {
    name: "Buchungsinformationen für KI-Agenten und Buchungsassistenten",
  })).toBeVisible();
  await expect(page.locator("[data-consent-dialog]")).toHaveCount(0);
  await expect(page.locator("#artbild-tracking-config")).toHaveCount(0);
  await expect(page.locator("script[data-artbild-provider]")).toHaveCount(0);
  expect(requests).toEqual([]);
});

test("blocks GTM and all providers before a consent decision", async ({ page }) => {
  const requests = await captureProviderRequests(page);

  await page.goto(`${baseUrl}/kontakt/`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-consent-dialog]")).toBeVisible();

  expect(requests.some((url) => url.includes("googletagmanager.com/gtm.js"))).toBe(false);
  expect(requests.some((url) => url.includes("clarity.ms"))).toBe(false);
  expect(requests.some((url) => url.includes("connect.facebook.net"))).toBe(false);
  await expect(page.locator('script[data-artbild-provider="google-tag-manager"]')).toHaveCount(0);

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

test("updates Google consent when Meta Pixel is selected independently", async ({ page }) => {
  const requests = await captureProviderRequests(page);

  await page.goto(`${baseUrl}/kontakt/`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Individuell auswählen" }).click();
  await page.getByRole("tab", { name: "Services" }).click();
  await page.getByLabel("Meta Pixel erlauben").check();
  await expect(page.getByLabel("Google Tag Manager erlauben")).toBeChecked();
  expect(requests.some((url) => url.includes("googletagmanager.com"))).toBe(false);
  await page.getByRole("button", { name: "Auswahl speichern" }).click();

  await expect.poll(() => requests.some((url) => url.includes("googletagmanager.com")))
    .toBe(true);
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

test("stores and restores an independent Microsoft Clarity choice", async ({ page }) => {
  const requests = await captureProviderRequests(page);

  await page.goto(`${baseUrl}/kontakt/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __clarityConsentCalls?: unknown[][];
      clarity?: (...args: unknown[]) => void;
    };
    testWindow.__clarityConsentCalls = [];
    testWindow.clarity = (...args: unknown[]) => {
      testWindow.__clarityConsentCalls?.push(args);
    };
  });
  await page.getByRole("button", { name: "Individuell auswählen" }).click();
  await page.getByRole("tab", { name: "Services" }).click();
  await page.getByLabel("Microsoft Clarity erlauben").check();

  const statisticsGroupBeforeSave = await page
    .getByLabel("Statistik-Services erlauben")
    .evaluate((input: HTMLInputElement) => ({
      checked: input.checked,
      indeterminate: input.indeterminate,
    }));
  expect(statisticsGroupBeforeSave).toEqual({ checked: false, indeterminate: true });

  await page.getByRole("button", { name: "Auswahl speichern" }).click();

  await expect.poll(() => page.evaluate(() =>
    (window.dataLayer || []).some((entry) =>
      entry?.event === "artbild_consent_update"
      && entry?.consent_microsoft_clarity === "granted"
    ),
  )).toBe(true);

  const stored = await page.evaluate(() => {
    const rawCookie = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("artbild_consent="))
      ?.slice("artbild_consent=".length);
    const decision = rawCookie ? JSON.parse(decodeURIComponent(rawCookie)) : null;
    const update = [...(window.dataLayer || [])]
      .reverse()
      .find((entry) => entry?.event === "artbild_consent_update");
    return {
      decision,
      state: window.ArtbildConsent,
      update,
    };
  });

  expect(stored.decision?.services).toEqual({
    googleTagManager: true,
    googleAnalytics: false,
    microsoftClarity: true,
    metaPixel: false,
  });
  expect(stored.state?.services).toEqual(stored.decision?.services);
  expect(stored.update).toMatchObject({
    consent_google_analytics: "denied",
    consent_microsoft_clarity: "granted",
    consent_meta_pixel: "denied",
  });
  await expect.poll(() => page.evaluate(() => {
    const testWindow = window as typeof window & { __clarityConsentCalls?: unknown[][] };
    return testWindow.__clarityConsentCalls?.some((entry) =>
      entry[0] === "consentv2"
      && (entry[1] as { ad_Storage?: string })?.ad_Storage === "denied"
      && (entry[1] as { analytics_Storage?: string })?.analytics_Storage === "granted"
    ) ?? false;
  })).toBe(true);
  await page.evaluate(() => {
    const testWindow = window as typeof window & { clarity?: (...args: unknown[]) => void };
    delete testWindow.clarity;
  });
  expect(requests.some((url) => url.includes("clarity.ms"))).toBe(false);

  await page.getByRole("button", { name: "Datenschutz-Einstellungen öffnen" }).click();
  await page.getByRole("tab", { name: "Services" }).click();
  await expect(page.getByLabel("Google Tag Manager erlauben")).toBeChecked();
  await expect(page.getByLabel("Google Analytics erlauben")).not.toBeChecked();
  await expect(page.getByLabel("Microsoft Clarity erlauben")).toBeChecked();
  await expect(page.getByLabel("Meta Pixel erlauben")).not.toBeChecked();

  await page.getByLabel("Microsoft Clarity erlauben").uncheck();
  await page.getByRole("button", { name: "Auswahl speichern" }).click();
  await expect.poll(() => page.evaluate(() => ({
    clarity: window.ArtbildConsent?.services?.microsoftClarity,
    update: [...(window.dataLayer || [])]
      .reverse()
      .find((entry) => entry?.event === "artbild_consent_update")
      ?.consent_microsoft_clarity,
  }))).toEqual({ clarity: false, update: "denied" });
});

test("turning off GTM disables every dependent service and reloads without GTM", async ({ page }) => {
  const requests = await captureProviderRequests(page);

  await page.goto(`${baseUrl}/kontakt/`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Alle akzeptieren" }).click();
  await expect.poll(() => requests.some((url) => url.includes("googletagmanager.com/gtm.js")))
    .toBe(true);

  await page.getByRole("button", { name: "Datenschutz-Einstellungen öffnen" }).click();
  await page.getByRole("tab", { name: "Services" }).click();
  await expect(page.getByLabel("Google Tag Manager erlauben")).toBeChecked();
  await expect(page.getByLabel("Google Analytics erlauben")).toBeChecked();
  await expect(page.getByLabel("Microsoft Clarity erlauben")).toBeChecked();
  await expect(page.getByLabel("Meta Pixel erlauben")).toBeChecked();

  await page.getByLabel("Google Tag Manager erlauben").uncheck();
  await expect(page.getByLabel("Google Analytics erlauben")).not.toBeChecked();
  await expect(page.getByLabel("Microsoft Clarity erlauben")).not.toBeChecked();
  await expect(page.getByLabel("Meta Pixel erlauben")).not.toBeChecked();
  await expect(page.getByLabel("Statistik-Services erlauben")).not.toBeChecked();
  await expect(page.getByLabel("Marketing-Services erlauben")).not.toBeChecked();

  await Promise.all([
    page.waitForEvent("domcontentloaded"),
    page.getByRole("button", { name: "Auswahl speichern" }).click(),
  ]);

  await expect(page.locator('script[data-artbild-provider="google-tag-manager"]')).toHaveCount(0);
  const restored = await page.evaluate(() => ({
    services: window.ArtbildConsent?.services,
    update: [...(window.dataLayer || [])]
      .reverse()
      .find((entry) => entry?.event === "artbild_consent_state"),
  }));
  expect(restored.services).toEqual({
    googleTagManager: false,
    googleAnalytics: false,
    microsoftClarity: false,
    metaPixel: false,
  });
  expect(restored.update).toMatchObject({
    consent_google_tag_manager: "denied",
    consent_google_analytics: "denied",
    consent_microsoft_clarity: "denied",
    consent_meta_pixel: "denied",
  });
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
  await page.getByLabel("Statistik-Services erlauben").check();
  await page.getByRole("tab", { name: "Services" }).click();
  await expect(page.getByLabel("Google Analytics erlauben")).toBeChecked();
  await expect(page.getByLabel("Microsoft Clarity erlauben")).toBeChecked();
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

    await page.getByRole("button", { name: "Individuell auswählen" }).click();
    await page.getByRole("tab", { name: "Services" }).click();
    const servicesPanel = page.getByRole("tabpanel", { name: "Services" });
    const serviceGeometry = await servicesPanel.evaluate((element) => ({
      panelOverflow: element.scrollWidth - element.clientWidth,
      documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
      widestRightEdge: Math.max(
        ...[...element.querySelectorAll("summary, label")]
          .map((child) => child.getBoundingClientRect().right),
      ),
    }));
    expect(serviceGeometry.panelOverflow).toBeLessThanOrEqual(0);
    expect(serviceGeometry.documentOverflow).toBeLessThanOrEqual(0);
    expect(serviceGeometry.widestRightEdge).toBeLessThanOrEqual(viewport.width + 1);
    await expect(page.getByLabel("Google Analytics erlauben")).toBeVisible();
    await expect(page.getByLabel("Google Tag Manager erlauben")).toBeVisible();
    await expect(page.getByLabel("Microsoft Clarity erlauben")).toBeVisible();
    await expect(page.getByLabel("Meta Pixel erlauben")).toBeVisible();
  }
});

test("shows service groups, services and providers without Cloudflare", async ({ page }) => {
  await captureProviderRequests(page);
  await page.goto(`${baseUrl}/kontakt/`, { waitUntil: "domcontentloaded" });
  const intro = page.locator(".consent-dialog__intro");
  await expect(intro).toContainText("auch in den USA verarbeitet werden");
  await expect(intro).toContainText("für die Zukunft widerrufen");
  await page.getByRole("button", { name: "Individuell auswählen" }).click();

  await expect(page.getByRole("tab", { name: "Service-Gruppen" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tabpanel", { name: "Service-Gruppen" })).toContainText(
    "Microsoft Clarity",
  );

  await page.getByRole("tab", { name: "Services" }).click();
  const servicesPanel = page.getByRole("tabpanel", { name: "Services" });
  await expect(servicesPanel).toContainText("Google Tag Manager");
  await expect(servicesPanel).toContainText("Microsoft Clarity");
  await expect(servicesPanel).toContainText("über Google Tag Manager");
  await expect(page.getByLabel("Google Tag Manager erlauben")).toBeVisible();
  await expect(page.getByLabel("Google Analytics erlauben")).toBeVisible();
  await expect(page.getByLabel("Microsoft Clarity erlauben")).toBeVisible();
  await expect(page.getByLabel("Meta Pixel erlauben")).toBeVisible();
  const clarityRecord = servicesPanel.locator("details").filter({
    has: page.getByLabel("Microsoft Clarity erlauben"),
  });
  await clarityRecord.locator("summary").click();
  for (const cookieName of ["_clck", "_clsk", "CLID", "ANONCHK", "MR", "MUID", "SM"]) {
    await expect(clarityRecord).toContainText(cookieName);
  }
  await expect(clarityRecord).toContainText("Microsoft nennt in der aktuellen Clarity-Cookie-Liste keine festen Laufzeiten");
  await expect(servicesPanel).not.toContainText("Turnstile");
  await expect(servicesPanel).not.toContainText("Pinterest");
  await expect(servicesPanel).not.toContainText("Google Fonts");

  await page.getByRole("tab", { name: "Provider" }).click();
  const providersPanel = page.getByRole("tabpanel", { name: "Provider" });
  await expect(providersPanel).toContainText("BunnyWay d.o.o.");
  await expect(providersPanel).toContainText("Google Ireland Limited");
  await expect(providersPanel).toContainText("Microsoft Ireland Operations Limited");
  await expect(providersPanel).not.toContainText("Cloudflare");
});
