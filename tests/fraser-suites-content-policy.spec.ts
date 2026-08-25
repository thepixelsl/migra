import { expect, test } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";

test("keeps one indexable Fraser Suites version", async ({ page }) => {
  await page.goto(`${baseUrl}/braut-fotoshooting-fraser-suites-hamburg/`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "index, follow, max-snippet:-1, max-video-preview:-1, max-image-preview:large",
  );
  await expect(
    page.getByText("Sie dokumentiert keine echte Hochzeit und keine Trauung."),
  ).toBeVisible();
  await expect(page.getByText("Ich friere Eure Momente für die Ewigkeit ein")).toHaveCount(0);

  for (const path of [
    "/gallery/hochzeitsfotos-hamburg/",
    "/gallery/elopement-hochzeit-fraser-suites-hamburg/",
  ]) {
    await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, follow, max-snippet:-1, max-video-preview:-1, max-image-preview:large",
    );
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
  }
});

test("labels the secondary Fraser series as an editorial", async ({ page }) => {
  await page.goto(`${baseUrl}/gallery/elopement-hochzeit-fraser-suites-hamburg/`, {
    waitUntil: "domcontentloaded",
  });

  await expect(
    page.getByRole("heading", { name: "Schillerndes Brautpaarshooting in Hamburg" }),
  ).toBeVisible();
  await expect(page.getByText(/nicht als vollständige Hochzeitsreportage oder Trauung/))
    .toBeVisible();
});

test("keeps the Fraser editorial intro inside its card", async ({ page }) => {
  for (const width of [1920, 901, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width > 900 ? 1080 : 844 });
    await page.goto(`${baseUrl}/gallery/elopement-hochzeit-fraser-suites-hamburg/`, {
      waitUntil: "domcontentloaded",
    });

    const intro = page.locator(".elopement-intro");
    const heading = intro.getByRole("heading", {
      name: "Schillerndes Brautpaarshooting in Hamburg",
    });
    await expect(intro).toBeVisible();
    expect(
      await intro.evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    expect(
      await heading.evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
  }
});
