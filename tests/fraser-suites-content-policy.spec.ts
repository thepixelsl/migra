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
    page.getByRole("heading", { name: "Editorial statt Hochzeitsreportage" }),
  ).toBeVisible();
  await expect(page.getByText("Sie dokumentiert keinen vollständigen Hochzeitstag und keine Trauung."))
    .toBeVisible();
});
