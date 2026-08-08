import { expect, test } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";

const variants = [
  {
    path: "/gallery/steffi-dominik/",
    heading: "Möchtet ihr eure Hochzeit in dieser Bildsprache festhalten?",
  },
  {
    path: "/gallery/editorial-london/",
    heading: "Editorials und Portraitserien im Überblick",
  },
  {
    path: "/gallery/hamburg/",
    heading: "Mehr Orte und Landschaften entdecken",
  },
  {
    path: "/gallery/yildiz-duman-werner/",
    heading: "Brautstyling und Getting Ready",
  },
  {
    path: "/portfolio/",
    heading: "Welche Begleitung passt zu eurem Hochzeitstag?",
  },
];

for (const variant of variants) {
  test(`uses the route-specific CTA on ${variant.path}`, async ({ page }) => {
    const response = await page.goto(`${baseUrl}${variant.path}`, {
      waitUntil: "domcontentloaded",
    });

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: variant.heading })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Gefällt euch diese Bildsprache?" })).toHaveCount(0);
  });
}
