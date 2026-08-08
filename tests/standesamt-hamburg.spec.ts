import { expect, test, type Page } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const pageUrl = `${baseUrl}/standesamt-hamburg/`;

const settleLayout = async (page: Page) => {
  await page.evaluate(
    () => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }),
  );
};

const readFinderLayout = (page: Page) =>
  page.evaluate(() => {
    const outer = document.querySelector<HTMLElement>(".finder-interaction");
    const toolbar = document.querySelector<HTMLElement>(".finder-toolbar");
    const result = document.querySelector<HTMLElement>("[data-finder-result]");
    const content = document.querySelector<HTMLElement>("[data-finder-result-content]");
    const below = document.querySelector<HTMLElement>("[data-finder-directory]");
    const activeCard = result?.querySelector<HTMLElement>(
      "[data-finder-result-card][data-active]",
    );

    if (!outer || !toolbar || !result || !content || !below) {
      throw new Error("Finder layout is incomplete");
    }

    const pageY = window.scrollY;
    const rect = (element: HTMLElement) => {
      const bounds = element.getBoundingClientRect();
      return {
        left: bounds.left,
        documentTop: bounds.top + pageY,
        width: bounds.width,
        height: bounds.height,
        documentBottom: bounds.bottom + pageY,
        viewportTop: bounds.top,
        viewportBottom: bounds.bottom,
      };
    };

    return {
      scrollY: pageY,
      viewportHeight: window.innerHeight,
      outer: rect(outer),
      toolbar: rect(toolbar),
      result: rect(result),
      belowDocumentTop: rect(below).documentTop,
      pageOverflowX:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      outerOverflowX: outer.scrollWidth - outer.clientWidth,
      outerOverflowY: outer.scrollHeight - outer.clientHeight,
      resultOverflowX: result.scrollWidth - result.clientWidth,
      resultOverflowY: result.scrollHeight - result.clientHeight,
      contentOverflowX: content.scrollWidth - content.clientWidth,
      contentOverflowY: content.scrollHeight - content.clientHeight,
      activeCardOverflowX: activeCard
        ? activeCard.scrollWidth - activeCard.clientWidth
        : 0,
      activeCardOverflowY: activeCard
        ? activeCard.scrollHeight - activeCard.clientHeight
        : 0,
    };
  });

type FinderLayout = Awaited<ReturnType<typeof readFinderLayout>>;
type FinderRect = FinderLayout["outer"];

const expectSameRect = (actual: FinderRect, baseline: FinderRect) => {
  for (const key of [
    "left",
    "documentTop",
    "width",
    "height",
    "documentBottom",
  ] as const) {
    expect(Math.abs(actual[key] - baseline[key])).toBeLessThanOrEqual(1);
  }
};

const expectNoOverflow = (layout: FinderLayout) => {
  expect(layout.pageOverflowX).toBe(0);

  for (const overflow of [
    layout.outerOverflowX,
    layout.outerOverflowY,
    layout.resultOverflowX,
    layout.resultOverflowY,
    layout.contentOverflowX,
    layout.contentOverflowY,
    layout.activeCardOverflowX,
    layout.activeCardOverflowY,
  ]) {
    expect(overflow).toBeLessThanOrEqual(1);
  }
};

const expectStableFinder = (actual: FinderLayout, baseline: FinderLayout) => {
  expectSameRect(actual.outer, baseline.outer);
  expectSameRect(actual.toolbar, baseline.toolbar);
  expectSameRect(actual.result, baseline.result);
  expect(
    Math.abs(actual.belowDocumentTop - baseline.belowDocumentTop),
  ).toBeLessThanOrEqual(1);
  expect(actual.scrollY).toBe(baseline.scrollY);
  expect(actual.outer.viewportTop).toBeGreaterThanOrEqual(8);
  expect(actual.outer.viewportTop).toBeLessThanOrEqual(16);
  expect(actual.outer.viewportBottom).toBeLessThanOrEqual(
    actual.viewportHeight - 8,
  );
  expectNoOverflow(actual);
};

test("mobile finder stays fixed while its result changes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(pageUrl, { waitUntil: "domcontentloaded" });

  const necessaryCookies = page.getByRole("button", { name: "Nur notwendige" });
  if (await necessaryCookies.isVisible()) await necessaryCookies.click();

  const finder = page.locator("[data-standesamt-finder]");
  const interaction = page.locator(".finder-interaction");
  const select = page.getByLabel("Wohnstadtteil", { exact: true });
  const clearButton = page.getByRole("button", { name: "Zurücksetzen" });
  const result = page.locator("[data-finder-result]");
  const resultHeading = page.locator("#standesamt-finder-result-heading");
  const resultState = page.locator("[data-finder-result-state]");
  const placeholder = page.locator("[data-finder-result-placeholder]");
  const resultContent = page.locator("[data-finder-result-content]");
  const resultCards = result.locator("[data-finder-result-card]");
  const activeResultCard = result.locator(
    "[data-finder-result-card][data-active]",
  );
  const status = page.locator("[data-finder-status]");
  const directory = page.locator("[data-finder-directory]");
  const sourceCards = directory.locator("[data-standesamt-card]");

  await expect(finder).toHaveAttribute("data-enhanced", "true");
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.documentElement.style.scrollBehavior = "auto";
  });

  await expect(page.locator("[data-floating-action]")).toHaveCount(0);
  await expect(select).toHaveAttribute("aria-controls", "standesamt-finder-result");
  await expect(status).toHaveAttribute("aria-live", "polite");
  await expect(status).toHaveAttribute("aria-atomic", "true");
  await expect(resultHeading).toHaveText("Zuständiges Standesamt");
  await expect(result).toHaveAttribute("data-state", "empty");
  await expect(resultState).toHaveText("Bitte wählen");
  await expect(placeholder).toHaveAttribute("aria-hidden", "false");
  await expect(placeholder).toBeVisible();
  await expect(resultContent).toBeVisible();
  await expect(resultCards).toHaveCount(8);
  await expect(activeResultCard).toHaveCount(0);
  await expect(status).toBeEmpty();
  await expect(clearButton).toBeHidden();
  await expect(directory).not.toHaveAttribute("open", "");
  await expect(sourceCards).toHaveCount(8);
  await expect(directory.locator("[data-standesamt-card][hidden]")).toHaveCount(0);

  const resultFollowsChooser = await result.evaluate((element) =>
    element.previousElementSibling?.querySelector("select")?.id === "standesamt-district"
  );
  expect(resultFollowsChooser).toBe(true);

  await interaction.evaluate((element) => {
    const documentTop = element.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, Math.max(0, documentTop - 12));
  });
  await settleLayout(page);

  const baseline = await readFinderLayout(page);
  expectNoOverflow(baseline);
  expect(baseline.outer.viewportTop).toBeGreaterThanOrEqual(8);
  expect(baseline.outer.viewportTop).toBeLessThanOrEqual(16);
  expect(baseline.outer.viewportBottom).toBeLessThanOrEqual(
    baseline.viewportHeight - 8,
  );

  await select.selectOption({ label: "Altona-Nord" });
  await expect(select).toHaveValue("altona");
  await expect(result).toHaveAttribute("data-state", "selected");
  await expect(resultState).toHaveText("Gefunden");
  await expect(placeholder).toHaveAttribute("aria-hidden", "true");
  await expect(placeholder).toBeHidden();
  await expect(activeResultCard).toHaveCount(1);
  await expect(
    activeResultCard.getByRole("heading", { name: "Standesamt Altona" }),
  ).toBeVisible();
  await expect(activeResultCard).toContainText("Platz der Republik 1");
  await expect(activeResultCard).toContainText("heirat@altona.hamburg.de");
  await expect(status).toContainText("Standesamt Altona");
  await expect(status).toContainText("Altona-Nord");
  await expect(clearButton).toBeVisible();
  await expect(directory).not.toHaveAttribute("open", "");
  await expect(sourceCards).toHaveCount(8);
  await settleLayout(page);

  const altonaLayout = await readFinderLayout(page);
  expectStableFinder(altonaLayout, baseline);

  await select.selectOption({ label: "Eppendorf" });
  await expect(select).toHaveValue("hamburg-nord");
  await expect(activeResultCard).toHaveCount(1);
  await expect(
    activeResultCard.getByRole("heading", { name: "Standesamt Hamburg-Nord" }),
  ).toBeVisible();
  await expect(activeResultCard).toContainText(
    "Kümmellstraße 5–7 / Robert-Koch-Straße 17",
  );
  await expect(activeResultCard.locator('a[href^="tel:"]')).toHaveText([
    "040 42804-5308",
    "040 42804-5310",
    "040 42804-2475",
  ]);
  await expect(activeResultCard).toContainText("heirat@hamburg-nord.hamburg.de");
  await expect(status).toContainText("Standesamt Hamburg-Nord");
  await expect(status).toContainText("Eppendorf");
  await settleLayout(page);

  const hamburgNordLayout = await readFinderLayout(page);
  expectStableFinder(hamburgNordLayout, baseline);

  await select.selectOption({ label: "Neuwerk" });
  await expect(select).toHaveValue("hamburg-mitte");
  await expect(activeResultCard).toHaveCount(1);
  await expect(
    activeResultCard.getByRole("heading", { name: "Standesamt Hamburg-Mitte" }),
  ).toBeVisible();
  await expect(activeResultCard).toContainText("Caffamacherreihe 1–3");
  await expect(status).toContainText("Standesamt Hamburg-Mitte");
  await expect(status).toContainText("Neuwerk");
  await settleLayout(page);

  const neuwerkLayout = await readFinderLayout(page);
  expectStableFinder(neuwerkLayout, baseline);

  await clearButton.click();
  await expect(select).toHaveValue("");
  await expect(select).toBeFocused();
  await expect(result).toHaveAttribute("data-state", "empty");
  await expect(resultState).toHaveText("Bitte wählen");
  await expect(placeholder).toHaveAttribute("aria-hidden", "false");
  await expect(placeholder).toBeVisible();
  await expect(activeResultCard).toHaveCount(0);
  await expect(status).toBeEmpty();
  await expect(clearButton).toBeHidden();
  await settleLayout(page);

  const resetLayout = await readFinderLayout(page);
  expectStableFinder(resetLayout, baseline);
  await expect(resultCards).toHaveCount(8);
  await expect(directory).not.toHaveAttribute("open", "");
  await expect(sourceCards).toHaveCount(8);
  await expect(directory.locator("[data-standesamt-card][hidden]")).toHaveCount(0);

  await directory.locator("summary").click();
  await expect(directory).toHaveAttribute("open", "");
  await expect(sourceCards).toHaveCount(8);

  const pageOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(pageOverflow).toBe(0);
});

const readTrauortLayout = (page: Page) =>
  page.evaluate(() => {
    const outer = document.querySelector<HTMLElement>("[data-trauort-finder]");
    const result = document.querySelector<HTMLElement>("[data-trauort-result]");
    const directory = document.querySelector<HTMLElement>("[data-trauort-directory]");
    const wohnstadtteilFinder = document.querySelector<HTMLElement>(
      ".finder-interaction",
    );
    const activeCard = Array.from(
      result?.querySelectorAll<HTMLElement>("[data-trauort-result-card]") ?? [],
    ).find((card) => {
      const bounds = card.getBoundingClientRect();
      const style = getComputedStyle(card);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        bounds.width > 0 &&
        bounds.height > 0
      );
    });

    if (!outer || !result || !directory || !wohnstadtteilFinder) {
      throw new Error("Trauort finder layout is incomplete");
    }

    const pageY = window.scrollY;
    const rect = (element: HTMLElement) => {
      const bounds = element.getBoundingClientRect();
      return {
        left: bounds.left,
        documentTop: bounds.top + pageY,
        width: bounds.width,
        height: bounds.height,
        documentBottom: bounds.bottom + pageY,
        viewportTop: bounds.top,
        viewportBottom: bounds.bottom,
      };
    };

    return {
      outer: rect(outer),
      result: rect(result),
      wohnstadtteilFinder: rect(wohnstadtteilFinder),
      directoryDocumentTop: rect(directory).documentTop,
      pageOverflowX:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      outerOverflowX: outer.scrollWidth - outer.clientWidth,
      resultOverflowX: result.scrollWidth - result.clientWidth,
      resultOverflowY: result.scrollHeight - result.clientHeight,
      activeCardOverflowX: activeCard
        ? activeCard.scrollWidth - activeCard.clientWidth
        : 0,
      activeCardOverflowY: activeCard
        ? activeCard.scrollHeight - activeCard.clientHeight
        : 0,
    };
  });

type TrauortLayout = Awaited<ReturnType<typeof readTrauortLayout>>;

const expectNoTrauortOverflow = (layout: TrauortLayout) => {
  expect(layout.pageOverflowX).toBe(0);

  for (const overflow of [
    layout.outerOverflowX,
    layout.resultOverflowX,
    layout.resultOverflowY,
    layout.activeCardOverflowX,
    layout.activeCardOverflowY,
  ]) {
    expect(overflow).toBeLessThanOrEqual(1);
  }
};

const expectStableTrauortFinder = (
  actual: TrauortLayout,
  baseline: TrauortLayout,
) => {
  expectSameRect(actual.outer, baseline.outer);
  expectSameRect(actual.result, baseline.result);
  expectSameRect(actual.wohnstadtteilFinder, baseline.wohnstadtteilFinder);
  expect(
    Math.abs(actual.directoryDocumentTop - baseline.directoryDocumentTop),
  ).toBeLessThanOrEqual(1);
  expectNoTrauortOverflow(actual);
};

test("mobile special venue finder keeps its result region fixed", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(pageUrl, { waitUntil: "domcontentloaded" });

  const necessaryCookies = page.getByRole("button", { name: "Nur notwendige" });
  if (await necessaryCookies.isVisible()) await necessaryCookies.click();

  const finder = page.locator("[data-trauort-finder]");
  const select = page.getByLabel("Besonderen Trauort auswählen", {
    exact: true,
  });
  const result = page.locator("[data-trauort-result]");
  const placeholder = page.locator("[data-trauort-placeholder]");
  const resultCards = result.locator("[data-trauort-result-card]");
  const visibleResultCards = result.locator(
    "[data-trauort-result-card]:visible",
  );
  const status = page.locator("[data-trauort-status]");
  const directory = page.locator("[data-trauort-directory]");

  await page.evaluate(async () => {
    await document.fonts.ready;
    document.documentElement.style.scrollBehavior = "auto";
  });

  await expect(finder).toBeVisible();
  await expect(select).toBeVisible();
  await expect(placeholder).toBeVisible();
  await expect(visibleResultCards).toHaveCount(0);
  await expect(status).toHaveAttribute("aria-live", "polite");
  await expect(status).toHaveAttribute("aria-atomic", "true");
  await expect(status).toBeEmpty();
  await expect(directory).not.toHaveAttribute("open", "");

  const optionCount = await select.locator('option:not([value=""])').count();
  expect(optionCount).toBeGreaterThan(1);
  await expect(resultCards).toHaveCount(optionCount);

  await result.evaluate((element) => {
    const documentTop = element.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, Math.max(0, documentTop - 12));
  });
  await settleLayout(page);

  const baseline = await readTrauortLayout(page);
  expectNoTrauortOverflow(baseline);

  await select.selectOption({ label: "Berner Schloss" });
  await expect(placeholder).toBeHidden();
  await expect(visibleResultCards).toHaveCount(1);
  await expect(
    visibleResultCards.getByRole("heading", { name: "Berner Schloss" }),
  ).toBeVisible();
  await expect(visibleResultCards).toContainText("Berner Allee 31a");
  await expect(status).toContainText("Berner Schloss");
  await settleLayout(page);

  const bernerSchlossLayout = await readTrauortLayout(page);
  expectStableTrauortFinder(bernerSchlossLayout, baseline);

  await select.selectOption({ label: "Schloss Reinbek" });
  await expect(placeholder).toBeHidden();
  await expect(visibleResultCards).toHaveCount(1);
  await expect(
    visibleResultCards.getByRole("heading", { name: "Schloss Reinbek" }),
  ).toBeVisible();
  await expect(visibleResultCards).toContainText(/Schlo(?:ss|ß)straße 5/);
  await expect(status).toContainText("Schloss Reinbek");
  await settleLayout(page);

  const schlossReinbekLayout = await readTrauortLayout(page);
  expectStableTrauortFinder(schlossReinbekLayout, baseline);

  await select.selectOption({ label: "Landhaus Walter" });
  await expect(placeholder).toBeHidden();
  await expect(visibleResultCards).toHaveCount(1);
  await expect(
    visibleResultCards.getByRole("heading", { name: "Landhaus Walter" }),
  ).toBeVisible();
  await expect(visibleResultCards).toContainText("Standesamt Hamburg-Nord");
  await expect(status).toContainText("Landhaus Walter");
  await settleLayout(page);

  const landhausWalterLayout = await readTrauortLayout(page);
  expectStableTrauortFinder(landhausWalterLayout, baseline);

  const factsAreSeparated = await visibleResultCards
    .locator(".trauort-compact-card__facts > div")
    .evaluateAll((rows) =>
      rows.map((row) => {
        const label = row.querySelector("dt");
        const value = row.querySelector("dd");
        if (!label || !value) return false;

        const labelRange = document.createRange();
        labelRange.selectNodeContents(label);
        const labelBounds = labelRange.getBoundingClientRect();
        const valueBounds = value.getBoundingClientRect();

        return (
          labelBounds.bottom <= valueBounds.top + 1 ||
          labelBounds.right <= valueBounds.left + 1
        );
      }),
    );
  expect(factsAreSeparated).toEqual([true, true, true]);
});

test("special venue directory keeps changing booking facts out of page copy and schema", async ({
  page,
}) => {
  await page.goto(pageUrl, { waitUntil: "domcontentloaded" });

  const select = page.getByLabel("Besonderen Trauort auswählen", {
    exact: true,
  });
  const resultCards = page.locator(
    "[data-trauort-result] [data-trauort-result-card]",
  );
  const directory = page.locator("[data-trauort-directory]");

  const optionLabels = await select
    .locator('option:not([value=""])')
    .evaluateAll((options) =>
      options.map((option) => option.textContent?.trim() ?? ""),
    );

  expect(optionLabels.length).toBeGreaterThan(1);
  expect(optionLabels.every(Boolean)).toBe(true);
  await expect(resultCards).toHaveCount(optionLabels.length);
  await expect(directory).not.toHaveAttribute("open", "");

  const directoryText = (await directory.textContent())?.replace(/\s+/g, " ") ?? "";
  for (const venueName of optionLabels) {
    expect(directoryText).toContain(venueName);
  }

  const itemListIds = await page.evaluate(() => {
    const parsedDocuments = Array.from(
      document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'),
    ).flatMap((script) => {
      try {
        const parsed = JSON.parse(script.textContent ?? "null");
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
    });

    const candidates = parsedDocuments.flatMap((document) => {
      if (!document || typeof document !== "object") return [];
      return [
        document,
        ...(Array.isArray(document["@graph"]) ? document["@graph"] : []),
      ];
    });
    return candidates
      .map((candidate) => candidate?.["@id"])
      .filter((id): id is string => typeof id === "string");
  });

  expect(itemListIds.some((id) => id.endsWith("#aussentrauorte"))).toBe(false);

  const mainText = await page.locator("main").innerText();
  expect(mainText).toContain(
    "Diese Seite nennt bewusst keine Preise, Kapazitäten oder festen Trautage.",
  );
  expect(mainText).not.toContain("430 €");
  expect(mainText).not.toContain("250 € Außentrauungsgebühr");
  expect(mainText).not.toContain("Bis zu 50 Gäste");
  expect(mainText).not.toContain("bis zu ein Jahr im Voraus");
});
