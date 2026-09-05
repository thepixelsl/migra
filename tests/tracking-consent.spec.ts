import { expect, test, type Page } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";

test.use({
  storageState: {
    cookies: [],
    origins: [],
  },
});

const providerRequest = /https:\/\/(?:www\.googletagmanager\.com|www\.google-analytics\.com|www\.clarity\.ms|connect\.facebook\.net)\//;

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
    name: "Terminprüfung für KI-Agenten",
  })).toBeVisible();
  await expect(page.locator("[data-consent-dialog]")).toHaveCount(0);
  await expect(page.locator("#artbild-tracking-config")).toHaveCount(0);
  await expect(page.locator("script[data-artbild-provider]")).toHaveCount(0);
  expect(requests).toEqual([]);
});

test("exposes and renders the single-date GET quick check", async ({ page }) => {
  await page.route("**/api/agent-availability?date=2026-09-12", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      headers: {
        "X-RateLimit-Limit": "3",
        "X-RateLimit-Remaining": "2",
      },
      body: JSON.stringify({ date: "2026-09-12", available: false }),
    });
  });

  await page.goto(`${baseUrl}/fuer-agenten/`, { waitUntil: "domcontentloaded" });

  const form = page.locator("[data-single-date-form]");
  await expect(form).toHaveAttribute("method", "get");
  await expect(form).toHaveAttribute("action", "/api/agent-availability");
  await expect(form).toHaveAttribute("toolname", "check_single_date_availability");
  await expect(form).toHaveAttribute("tooldescription", /genau ein Wunschdatum/);
  await expect(form).toHaveAttribute("toolautosubmit", "");
  await expect(page.locator("#agent-quick-date")).toHaveAttribute(
    "toolparamdescription",
    "Das zu prüfende Wunschdatum im Format YYYY-MM-DD.",
  );
  await expect(page.getByText(
    "https://artbild-fotografie.de/api/agent-availability?date=YYYY-MM-DD",
    { exact: true },
  )).toBeVisible();

  await page.getByLabel("Wunschdatum", { exact: true }).fill("2026-09-12");
  await page.getByRole("button", { name: "Termin unverbindlich prüfen" }).click();

  await expect(page.locator("[data-single-date-result]")).toContainText(
    "12.09.2026: aktuell nicht verfügbar",
  );
  await expect(page.locator("[data-single-date-result]")).toContainText(
    "Noch 2 unterschiedliche Kalendertag(e)",
  );
  await expect(page).toHaveURL(`${baseUrl}/fuer-agenten/`);
});

test("returns a structured result for the single-date WebMCP tool", async ({ page }) => {
  await page.route("**/api/agent-availability?date=2026-09-12", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      headers: {
        "X-RateLimit-Limit": "3",
        "X-RateLimit-Remaining": "2",
        "X-RateLimit-Reset": "2026-09-01T12:00:00.000Z",
      },
      body: JSON.stringify({ date: "2026-09-12", available: true }),
    });
  });

  await page.goto(`${baseUrl}/fuer-agenten/`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Wunschdatum", { exact: true }).fill("2026-09-12");

  const response = await page.evaluate(async () => {
    const form = document.querySelector<HTMLFormElement>("[data-single-date-form]");
    if (!form) throw new Error("Single-date form not found");

    let responsePromise: Promise<unknown> | undefined;
    const event = new SubmitEvent("submit", { bubbles: true, cancelable: true });
    Object.defineProperties(event, {
      agentInvoked: { value: true },
      respondWith: {
        value: (operation: Promise<unknown>) => {
          responsePromise = operation;
        },
      },
    });
    form.dispatchEvent(event);

    if (!responsePromise) throw new Error("WebMCP response was not registered");
    return responsePromise;
  });

  expect(response).toEqual({
    ok: true,
    date: "2026-09-12",
    available: true,
    availabilityIsBinding: false,
    createsReservation: false,
    rateLimit: {
      limit: 3,
      remaining: 2,
      resetAt: "2026-09-01T12:00:00.000Z",
    },
  });
});

test("exposes the multi-date form as a structured WebMCP tool", async ({ page }) => {
  let requestBody: unknown;
  await page.route("**/api/agent-availability", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        results: [
          { date: "2026-09-12", available: true },
          { date: "2026-10-03", available: false },
        ],
        advice: { message: "Unverbindliche Auskunft; keine Reservierung." },
        rateLimit: { limit: 2, remaining: 1, resetAt: "2026-09-01T12:00:00.000Z" },
      }),
    });
  });

  await page.goto(`${baseUrl}/fuer-agenten/`, { waitUntil: "domcontentloaded" });

  const form = page.locator("[data-agent-availability-form]");
  await expect(form).toHaveAttribute("toolname", "check_multiple_date_availability");
  await expect(form).toHaveAttribute("tooldescription", /ein bis drei unterschiedliche Wunschdaten/);
  await expect(form).toHaveAttribute("toolautosubmit", "");
  const webMcpDateInputs = form.locator('input[type="date"]');
  await expect(webMcpDateInputs).toHaveCount(3);
  await expect(webMcpDateInputs.nth(0)).toHaveAttribute("name", "date1");
  await expect(webMcpDateInputs.nth(1)).toHaveAttribute("name", "date2");
  await expect(webMcpDateInputs.nth(2)).toHaveAttribute("name", "date3");
  for (const input of await webMcpDateInputs.all()) {
    await expect(input).toHaveAttribute(
      "toolparamdescription",
      /Wunschdatum im Format YYYY-MM-DD/,
    );
  }

  await page.locator("#agent-date-1").fill("2026-09-12");
  await page.locator("#agent-date-2").fill("2026-10-03");

  const response = await page.evaluate(async () => {
    const form = document.querySelector<HTMLFormElement>("[data-agent-availability-form]");
    if (!form) throw new Error("Multi-date form not found");

    let responsePromise: Promise<unknown> | undefined;
    const event = new SubmitEvent("submit", { bubbles: true, cancelable: true });
    Object.defineProperties(event, {
      agentInvoked: { value: true },
      respondWith: {
        value: (operation: Promise<unknown>) => {
          responsePromise = operation;
        },
      },
    });
    form.dispatchEvent(event);

    if (!responsePromise) throw new Error("WebMCP response was not registered");
    return responsePromise;
  });

  expect(requestBody).toEqual({ dates: ["2026-09-12", "2026-10-03"] });
  expect(response).toEqual({
    ok: true,
    results: [
      { date: "2026-09-12", available: true },
      { date: "2026-10-03", available: false },
    ],
    advice: { message: "Unverbindliche Auskunft; keine Reservierung." },
    rateLimit: { limit: 2, remaining: 1, resetAt: "2026-09-01T12:00:00.000Z" },
    availabilityIsBinding: false,
    createsReservation: false,
  });
});

test("keeps the multi-date availability form usable without a WebMCP agent", async ({ page }) => {
  await page.route("**/api/agent-availability", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        results: [
          { date: "2026-09-12", available: true },
          { date: "2026-10-03", available: false },
        ],
        advice: { message: "Der Kalenderstand ist unverbindlich und reserviert keinen Termin." },
        rateLimit: { limit: 2, remaining: 1, resetAt: "2026-09-01T12:00:00.000Z" },
      }),
    });
  });

  await page.goto(`${baseUrl}/fuer-agenten/`, { waitUntil: "domcontentloaded" });
  await page.locator("#agent-date-1").fill("2026-09-12");
  await page.locator("#agent-date-2").fill("2026-10-03");
  await page.getByRole("button", { name: "Wunschdaten unverbindlich prüfen" }).click();

  const result = page.locator("[data-agent-availability-result]");
  await expect(result).toContainText("12.09.2026aktuell verfügbar");
  await expect(result).toContainText("03.10.2026aktuell nicht verfügbar");
  await expect(result).toContainText("Noch 1 Abfrage(n)");
  await expect(page).toHaveURL(`${baseUrl}/fuer-agenten/`);
});

test("prepares a reviewed contact draft with one complementary imperative WebMCP tool", async ({ page }) => {
  let contactRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/contact")) contactRequests += 1;
  });

  await page.addInitScript(() => {
    const tools: Array<Record<string, any>> = [];
    Object.defineProperty(window, "__artbildWebMcpTools", {
      configurable: true,
      value: tools,
    });
    Object.defineProperty(Document.prototype, "modelContext", {
      configurable: true,
      get: () => ({
        registerTool: async (tool: Record<string, any>) => {
          tools.push(tool);
        },
      }),
    });
  });

  await page.goto(`${baseUrl}/fuer-agenten/`, { waitUntil: "domcontentloaded" });

  await expect.poll(() => page.evaluate(() =>
    (window as any).__artbildWebMcpTools?.length ?? 0,
  )).toBe(1);

  const registeredTool = await page.evaluate(() => {
    const tool = (window as any).__artbildWebMcpTools[0];
    return {
      name: tool.name,
      title: tool.title,
      description: tool.description,
      annotations: tool.annotations,
      required: tool.inputSchema.required,
      requestTypes: tool.inputSchema.properties.requestType.enum,
      packageIds: tool.inputSchema.properties.packageId.enum,
    };
  });

  expect(registeredTool).toEqual({
    name: "start_booking_inquiry",
    title: "Buchungsanfrage vorbereiten",
    description: "Öffnet das Kontaktformular mit Auftragsart, Wunschdatum, Ort und optionalem Paket. Es wird keine Anfrage versendet.",
    annotations: { readOnlyHint: false },
    required: ["requestType", "date", "location"],
    requestTypes: ["hochzeit", "standesamtliche-trauung", "portraitshooting"],
    packageIds: ["pure-moments", "standesamt-paket", "rundum-sorglos-paket"],
  });

  const invalidResult = await page.evaluate(() => {
    const tool = (window as any).__artbildWebMcpTools[0];
    return tool.execute({
      requestType: "hochzeit",
      date: "2020-01-01",
      location: "Hamburg",
    });
  });
  expect(invalidResult).toMatchObject({ ok: false, error: "invalid_date" });
  await expect(page).toHaveURL(`${baseUrl}/fuer-agenten/`);

  const executionResult = await page.evaluate(() => {
    const tool = (window as any).__artbildWebMcpTools[0];
    return tool.execute({
      requestType: "hochzeit",
      date: "2027-06-14",
      location: "Hamburg, Speicherstadt",
      packageId: "rundum-sorglos-paket",
    });
  });

  expect(executionResult).toEqual({
    ok: true,
    status: "draft_prepared",
    destination: "/kontakt/#kontaktformular",
    submitted: false,
    message: "Das Kontaktformular wird zur persönlichen Prüfung geöffnet. Es wurde nichts versendet.",
  });
  await expect(page).toHaveURL(`${baseUrl}/kontakt/#kontaktformular`);

  await expect(page.locator("[data-contact-draft-note]")).toBeVisible();
  await expect(page.locator("[data-contact-request-type]")).toHaveValue("hochzeit");
  await expect(page.locator("[data-contact-date]")).toHaveValue("2027-06-14");
  await expect(page.locator('input[name="location"]')).toHaveValue("Hamburg, Speicherstadt");
  await expect(page.locator('textarea[name="message"]')).toHaveValue(
    "Paketwunsch: Rundum-Sorglos-Paket",
  );
  await expect(page.locator('input[name="source_path"]')).toHaveValue("/fuer-agenten/");
  await expect(page.locator('input[name="name"]')).toHaveValue("");
  await expect(page.locator('input[name="email"]')).toHaveValue("");
  await expect(page.locator('input[name="security_year"]')).toHaveValue("");
  await expect(page.locator('input[name="privacy"]')).not.toBeChecked();
  expect(await page.evaluate(() =>
    sessionStorage.getItem("artbild_booking_inquiry_draft_v1"),
  )).toBeNull();
  expect(contactRequests).toBe(0);
});

test("blocks GTM and all providers before a consent decision", async ({ page }) => {
  const requests = await captureProviderRequests(page);

  await page.goto(`${baseUrl}/kontakt/`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-consent-dialog]")).toBeVisible();

  expect(requests.some((url) => url.includes("googletagmanager.com/gtm.js"))).toBe(false);
  expect(requests.some((url) => url.includes("googletagmanager.com/gtag/js"))).toBe(false);
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

test("starts direct GA4 once after statistics consent and restores it on the next page", async ({ page }) => {
  const requests = await captureProviderRequests(page);
  await page.goto(`${baseUrl}/kontakt/`, { waitUntil: "domcontentloaded" });
  expect(requests).toEqual([]);
  await page.getByRole("button", { name: "EINSTELLUNGEN" }).click();
  await page.getByLabel("Statistik erlauben").check();
  await page.getByRole("button", { name: "AUSWAHL SPEICHERN" }).click();
  await expect.poll(() => requests.filter((url) => url.includes("/gtag/js?")).length).toBe(1);
  const commands = await readGtagCommands(page);
  const consentIndex = commands.findIndex((entry) => entry[0] === "consent" && entry[1] === "update");
  const configIndex = commands.findIndex((entry) => entry[0] === "config");
  const cookieFlagsIndex = commands.findIndex((entry) => entry[0] === "set" && entry[1] === "cookie_flags");
  const expectedCookieFlags = new URL(baseUrl).protocol === "https:" ? "SameSite=Lax;Secure" : "SameSite=Lax";
  expect(consentIndex).toBeGreaterThanOrEqual(0);
  expect(configIndex).toBeGreaterThan(consentIndex);
  expect(cookieFlagsIndex).toBeGreaterThanOrEqual(0);
  expect(cookieFlagsIndex).toBeLessThan(configIndex);
  expect(commands[cookieFlagsIndex][2]).toBe(expectedCookieFlags);
  expect(commands[configIndex][2]).toMatchObject({ cookie_flags: expectedCookieFlags });
  expect(commands[consentIndex][2]).toMatchObject({
    analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
  });
  expect(await page.evaluate(() => window.dataLayer.find((entry) => entry?.event === "artbild_tracking_config")?.google_analytics_delivery)).toBe("direct");
  await page.getByRole("button", { name: "Datenschutz-Einstellungen öffnen" }).click();
  await page.getByRole("button", { name: "AUSWAHL SPEICHERN" }).click();
  expect((await readGtagCommands(page)).filter((entry) => entry[0] === "config")).toHaveLength(1);
  expect(requests.filter((url) => url.includes("/gtag/js?"))).toHaveLength(1);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect.poll(() => requests.filter((url) => url.includes("/gtag/js?")).length).toBe(2);
  expect((await readGtagCommands(page)).filter((entry) => entry[0] === "config")).toHaveLength(1);
});

test("retries a failed direct GA4 download once without duplicating configuration", async ({ page }) => {
  await captureProviderRequests(page);
  let attempts = 0;
  await page.route("https://www.googletagmanager.com/gtag/js?**", async (route) => {
    attempts += 1;
    if (attempts === 1) await route.abort("failed");
    else await route.fulfill({ status: 200, contentType: "application/javascript", body: "" });
  });
  await page.goto(`${baseUrl}/kontakt/`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "EINSTELLUNGEN" }).click();
  await page.getByLabel("Statistik erlauben").check();
  await page.getByRole("button", { name: "AUSWAHL SPEICHERN" }).click();
  await expect.poll(() => attempts).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__artbildGoogleAnalyticsLoaded)).toBe(true);
  expect((await readGtagCommands(page)).filter((entry) => entry[0] === "config")).toHaveLength(1);
  await expect(page.locator('script[data-artbild-provider="google-analytics"]')).toHaveCount(1);
});

test("revoking only Analytics removes the direct tag while preserving Clarity consent", async ({ page }) => {
  const requests = await captureProviderRequests(page);
  await page.goto(`${baseUrl}/kontakt/`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "EINSTELLUNGEN" }).click();
  await page.getByLabel("Statistik erlauben").check();
  await page.getByRole("button", { name: "AUSWAHL SPEICHERN" }).click();
  await expect.poll(() => requests.filter((url) => url.includes("/gtag/js?")).length).toBe(1);
  await page.getByRole("button", { name: "Datenschutz-Einstellungen öffnen" }).click();
  await page.getByText("DETAILS ANZEIGEN", { exact: true }).first().click();
  await page.getByLabel("Google Analytics erlauben", { exact: true }).uncheck();
  await Promise.all([
    page.waitForEvent("domcontentloaded"),
    page.getByRole("button", { name: "AUSWAHL SPEICHERN" }).click(),
  ]);
  await expect(page.locator('script[data-artbild-provider="google-analytics"]')).toHaveCount(0);
  expect(requests.filter((url) => url.includes("/gtag/js?"))).toHaveLength(1);
  expect(await page.evaluate(() => window.ArtbildConsent.services)).toMatchObject({
    googleAnalytics: false, microsoftClarity: true, googleTagManager: true,
  });
  expect((await readGtagCommands(page)).filter((entry) => entry[0] === "config")).toHaveLength(0);
});

test("updates Google consent when Meta Pixel is selected independently", async ({ page }) => {
  const requests = await captureProviderRequests(page);

  await page.goto(`${baseUrl}/kontakt/`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "EINSTELLUNGEN" }).click();
  await page.getByLabel("Meta Pixel erlauben").check();
  expect(requests.some((url) => url.includes("googletagmanager.com"))).toBe(false);
  await page.getByRole("button", { name: "AUSWAHL SPEICHERN" }).click();

  await expect.poll(() => requests.some((url) => url.includes("googletagmanager.com")))
    .toBe(true);
  expect(requests.some((url) => url.includes("clarity.ms"))).toBe(false);
  expect(requests.some((url) => url.includes("connect.facebook.net"))).toBe(false);

  expect(requests.some((url) => url.includes("/gtag/js?"))).toBe(false);

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

test("accepts all optional services only after the decision and restores it", async ({ page }) => {
  const requests = await captureProviderRequests(page);

  await page.goto(`${baseUrl}/kontakt/`, { waitUntil: "domcontentloaded" });
  expect(requests).toEqual([]);

  await page.getByRole("button", { name: "ALLE AKZEPTIEREN" }).click();
  await expect.poll(() => requests.some((url) => url.includes("googletagmanager.com/gtm.js")))
    .toBe(true);
  await expect(page.locator("[data-consent-dialog]")).not.toBeVisible();

  const accepted = await page.evaluate(() => window.ArtbildConsent?.services);
  expect(accepted).toEqual({
    googleTagManager: true,
    googleAnalytics: true,
    microsoftClarity: true,
    metaPixel: true,
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-consent-dialog]")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Datenschutz-Einstellungen öffnen" }))
    .toBeVisible();
  expect(await page.evaluate(() => window.ArtbildConsent?.services)).toEqual(accepted);
});

test("stores only necessary on Escape and keeps the dialog closed after reload", async ({ page }) => {
  const requests = await captureProviderRequests(page);

  await page.goto(`${baseUrl}/kontakt/`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-consent-dialog]")).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(page.locator("[data-consent-dialog]")).not.toBeVisible();
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => window.ArtbildConsent?.services)).toEqual({
    googleTagManager: false,
    googleAnalytics: false,
    microsoftClarity: false,
    metaPixel: false,
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-consent-dialog]")).not.toBeVisible();
  expect(requests).toEqual([]);
});

test("locks background scrolling, traps focus and restores the settings trigger", async ({ page }) => {
  await captureProviderRequests(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/kontakt/`, { waitUntil: "domcontentloaded" });

  const dialog = page.locator("[data-consent-dialog]");
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.activeElement?.id)).toBe("consent-title");
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe("hidden");

  await page.keyboard.press("Shift+Tab");
  for (let index = 0; index < 10; index += 1) {
    expect(await page.evaluate(() => (
      document.querySelector("[data-consent-dialog]")?.contains(document.activeElement)
    ))).toBe(true);
    await page.keyboard.press("Tab");
  }

  await page.getByRole("button", { name: "NUR NOTWENDIGE", exact: true }).click();
  const settings = page.getByRole("button", { name: "Datenschutz-Einstellungen öffnen" });
  await expect(settings).toBeFocused();
  await settings.click();
  expect(await page.evaluate(() => document.activeElement?.id)).toBe("consent-details-title");

  await page.getByRole("button", { name: "Nur notwendige auswählen und schließen" }).click();
  await expect(settings).toBeFocused();
  expect(await page.evaluate(() => document.body.classList.contains("has-consent-dialog")))
    .toBe(false);
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
  await page.getByRole("button", { name: "EINSTELLUNGEN" }).click();
  await page.getByText("DETAILS ANZEIGEN", { exact: true }).first().click();
  await page.getByLabel("Microsoft Clarity erlauben").check();

  const statisticsGroupBeforeSave = await page
    .getByLabel("Statistik erlauben")
    .evaluate((input: HTMLInputElement) => ({
      checked: input.checked,
      indeterminate: input.indeterminate,
    }));
  expect(statisticsGroupBeforeSave).toEqual({ checked: false, indeterminate: true });

  await page.getByRole("button", { name: "AUSWAHL SPEICHERN" }).click();

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
  await expect(page.getByLabel("Google Analytics erlauben")).not.toBeChecked();
  await expect(page.getByLabel("Microsoft Clarity erlauben")).toBeChecked();
  await expect(page.getByLabel("Meta Pixel erlauben")).not.toBeChecked();

  await page.getByLabel("Microsoft Clarity erlauben").uncheck();
  await Promise.all([
    page.waitForEvent("domcontentloaded"),
    page.getByRole("button", { name: "AUSWAHL SPEICHERN" }).click(),
  ]);
  await expect.poll(() => page.evaluate(() => ({
    clarity: window.ArtbildConsent?.services?.microsoftClarity,
    update: [...(window.dataLayer || [])]
      .reverse()
      .find((entry) => ["artbild_consent_update", "artbild_consent_state"].includes(entry?.event))
      ?.consent_microsoft_clarity,
  }))).toEqual({ clarity: false, update: "denied" });
});

test("revoking all optional services reloads without GTM", async ({ page }) => {
  const requests = await captureProviderRequests(page);

  await page.goto(`${baseUrl}/kontakt/`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "ALLE AKZEPTIEREN" }).click();
  await expect.poll(() => requests.some((url) => url.includes("googletagmanager.com/gtm.js")))
    .toBe(true);

  await page.getByRole("button", { name: "Datenschutz-Einstellungen öffnen" }).click();
  await expect(page.getByLabel("Statistik erlauben")).toBeChecked();
  await expect(page.getByLabel("Meta Pixel erlauben")).toBeChecked();

  await page.getByLabel("Statistik erlauben").uncheck();
  await page.getByLabel("Meta Pixel erlauben").uncheck();

  await Promise.all([
    page.waitForEvent("domcontentloaded"),
    page.getByRole("button", { name: "AUSWAHL SPEICHERN" }).click(),
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

  await page.getByRole("button", { name: "EINSTELLUNGEN" }).click();
  await page.getByLabel("Statistik erlauben").check();
  await page.getByRole("button", { name: "AUSWAHL SPEICHERN" }).click();

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
    { width: 1440, height: 900 },
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

    const acceptAll = page.getByRole("button", { name: "ALLE AKZEPTIEREN" }).first();
    const necessary = page.getByRole("button", { name: "NUR NOTWENDIGE", exact: true });
    await expect(acceptAll).toBeVisible();
    await expect(necessary).toBeVisible();
    await expect(page.getByRole("button", { name: "EINSTELLUNGEN" })).toBeVisible();
    await page.mouse.move(0, 0);

    const decisionGeometry = await Promise.all([acceptAll, necessary].map((button) =>
      button.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          width: rect.width,
          height: rect.height,
          color: style.color,
          background: style.backgroundColor,
          border: style.borderColor,
        };
      })));
    expect(decisionGeometry[0]).toEqual(decisionGeometry[1]);

    await page.getByRole("button", { name: "EINSTELLUNGEN" }).click();
    await page.getByText("DETAILS ANZEIGEN", { exact: true }).first().click();
    const servicesPanel = page.locator("[data-consent-details]");
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
    await expect(page.getByLabel("Microsoft Clarity erlauben")).toBeVisible();
    await expect(page.getByLabel("Meta Pixel erlauben")).toBeVisible();
  }
});

test("the X is a necessary-only decision and revokes prior consent", async ({ page }) => {
  await captureProviderRequests(page);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    await page.context().clearCookies();
    await page.setViewportSize(viewport);
    await page.goto(`${baseUrl}/kontakt/`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "ALLE AKZEPTIEREN" }).first().click();
    await page.getByRole("button", { name: "Datenschutz-Einstellungen öffnen" }).click();

    const closeButton = page.getByRole("button", {
      name: "Nur notwendige auswählen und schließen",
    });
    const closeIcon = closeButton.locator("svg");
    await expect(closeButton).toBeVisible();
    await expect(closeIcon).toHaveCount(1);

    const geometry = await closeButton.evaluate((button) => {
      const buttonRect = button.getBoundingClientRect();
      const icon = button.querySelector("svg");
      const iconRect = icon?.getBoundingClientRect();
      const path = icon?.querySelector("path");
      return {
        buttonWidth: buttonRect.width,
        buttonHeight: buttonRect.height,
        iconWidth: iconRect?.width ?? 0,
        iconHeight: iconRect?.height ?? 0,
        strokeWidth: path ? Number.parseFloat(getComputedStyle(path).strokeWidth) : 0,
      };
    });
    expect(geometry.buttonWidth).toBeGreaterThanOrEqual(44);
    expect(geometry.buttonHeight).toBeGreaterThanOrEqual(44);
    expect(geometry.iconWidth).toBeGreaterThanOrEqual(20);
    expect(geometry.iconHeight).toBeGreaterThanOrEqual(20);
    expect(geometry.strokeWidth).toBeGreaterThanOrEqual(1.7);

    await Promise.all([
      page.waitForEvent("domcontentloaded"),
      closeButton.click(),
    ]);
    await expect(page.locator("[data-consent-dialog]")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Datenschutz-Einstellungen öffnen" }))
      .toBeVisible();
    expect(await page.evaluate(() => window.ArtbildConsent?.services)).toEqual({
      googleTagManager: false,
      googleAnalytics: false,
      microsoftClarity: false,
      metaPixel: false,
    });
  }
});

test("shows the compact branded view and three service cards without hosting details", async ({ page }) => {
  await captureProviderRequests(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}/kontakt/`, { waitUntil: "domcontentloaded" });
  const intro = page.locator(".consent-dialog__intro");
  await expect(intro).toContainText("Schön, dass Du da bist.");
  await expect(intro).toContainText("Eure Auswahl könnt ihr jederzeit ändern.");
  const dialog = page.locator("[data-consent-dialog]");
  await expect(dialog).toHaveAttribute("aria-labelledby", "consent-title");
  await expect(page.getByRole("heading", { name: "COOKIE-EINSTELLUNGEN" })).toBeVisible();

  const logo = dialog.locator(".consent-dialog__logo");
  await expect(logo).toHaveAttribute("src", "/images/logo-artbild-black.png");
  await expect(logo).toHaveAttribute("width", "1200");
  await expect(logo).toHaveAttribute("height", "480");
  expect(await logo.evaluate((element) => element.getBoundingClientRect().width)).toBe(160);

  const colors = await dialog.evaluate((element) => {
    const style = getComputedStyle(element);
    const textElement = element.querySelector("#consent-summary");
    if (!textElement) throw new Error("Consent summary missing");
    const text = getComputedStyle(textElement);
    return {
      background: style.backgroundColor,
      color: text.color,
      font: text.fontFamily,
    };
  });
  expect(colors).toEqual({
    background: "rgb(255, 255, 255)",
    color: "rgb(23, 23, 23)",
    font: expect.stringContaining("Playfair Display"),
  });

  await page.getByRole("button", { name: "EINSTELLUNGEN" }).click();
  const detailsPanel = page.locator("[data-consent-details]");
  await expect(detailsPanel.locator(".consent-card")).toHaveCount(3);
  await expect(detailsPanel).toContainText("Speichert eure Datenschutz-Auswahl für 180 Tage.");
  await expect(detailsPanel).toContainText("Google Analytics und Microsoft Clarity");
  await expect(detailsPanel).toContainText("Meta Pixel");
  await expect(detailsPanel).not.toContainText("Google Tag Manager");
  await expect(detailsPanel).not.toContainText("bunny.net");
  await expect(detailsPanel).not.toContainText("BunnyWay");
  await expect(detailsPanel).not.toContainText("Dunajska cesta");

  await page.getByText("DETAILS ANZEIGEN", { exact: true }).first().click();
  await expect(page.getByLabel("Google Analytics erlauben")).toBeVisible();
  await expect(page.getByLabel("Microsoft Clarity erlauben")).toBeVisible();
  await expect(page.getByLabel("Meta Pixel erlauben")).toBeVisible();
  const clarityRecord = detailsPanel.locator(".consent-service-choice").filter({
    has: page.getByLabel("Microsoft Clarity erlauben"),
  });
  for (const cookieName of ["_clck", "_clsk", "CLID", "ANONCHK", "MR", "MUID", "SM"]) {
    await expect(clarityRecord).toContainText(cookieName);
  }
  const legal = dialog.getByRole("navigation", { name: "Rechtliche Informationen" });
  await expect(legal.getByRole("link", { name: "Datenschutz" })).toHaveAttribute("href", "/datenschutz/");
  await expect(legal.getByRole("link", { name: "Impressum" })).toHaveAttribute("href", "/impressum/");
  await expect(page.getByRole("button", { name: "Zur kompakten Ansicht zurückkehren" }))
    .toBeVisible();
});
