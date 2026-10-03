import { expect, test, type Page } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";

test.use({
  storageState: {
    cookies: [],
    origins: [],
  },
});

// These availability fixtures use September 2026 dates; keep them in the future.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-01T10:00:00Z"));
});

const providerRequest = /https:\/\/(?:www\.googletagmanager\.com|www\.google-analytics\.com|www\.clarity\.ms|connect\.facebook\.net|bzrcdn\.openai\.com|bzr\.openai\.com)\//;

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

// Consent v2026-09-30 is covered by privacy-acceptance.spec.ts and privacy-release.spec.ts.
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
