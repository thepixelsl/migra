import { expect, test } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";

test("home reveal keeps every target visible for reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const targets = page.locator("[data-home-reveal]");
  expect(await targets.count()).toBeGreaterThan(10);

  await expect(targets.first()).not.toHaveClass(/is-reveal-ready/);

  const hiddenTargets = await targets.evaluateAll((elements) =>
    elements.filter((element) => {
      const styles = window.getComputedStyle(element);
      return Number.parseFloat(styles.opacity) < .99 || styles.translate !== "none";
    }).length
  );

  expect(hiddenTargets).toBe(0);
});

test("home reveal content remains visible when JavaScript is disabled", async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1280, height: 720 },
  });

  try {
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

    const targets = page.locator("[data-home-reveal]");
    expect(await targets.count()).toBeGreaterThan(10);

    const revealState = await targets.evaluateAll((elements) =>
      elements.map((element) => {
        const styles = window.getComputedStyle(element);
        return {
          ready: element.classList.contains("is-reveal-ready"),
          visible: Number.parseFloat(styles.opacity) >= .99,
          stationary: styles.translate === "none",
        };
      })
    );

    expect(revealState.every(({ ready }) => !ready)).toBe(true);
    expect(revealState.every(({ visible }) => visible)).toBe(true);
    expect(revealState.every(({ stationary }) => stationary)).toBe(true);
  } finally {
    await context.close();
  }
});

test("home reveal fades a normal offscreen target in when it is scrolled into view", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const target = page.locator("#desktop_featured_links[data-home-reveal]");
  await expect(target).toHaveCount(1);
  await expect(target).toHaveClass(/is-reveal-ready/);
  await expect(target).not.toHaveClass(/is-reveal-visible/);

  await expect
    .poll(() => target.evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity)))
    .toBeLessThan(.05);

  await target.scrollIntoViewIfNeeded();

  await expect
    .poll(() => target.evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity)))
    .toBeGreaterThan(.95);
  await expect(target).not.toHaveClass(/is-reveal-ready/);
  await expect(target).not.toHaveClass(/is-reveal-visible/);
});
