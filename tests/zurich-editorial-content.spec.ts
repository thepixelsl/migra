import { expect, test } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";

test("describes the Zurich series as an editorial rather than a wedding service", async ({ page }) => {
  await page.goto(`${baseUrl}/brautpaar-in-zuerich/`, {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { level: 1, name: "Styled Editorial in Zürich" }))
    .toBeVisible();
  await expect(
    page.getByText("Es handelt sich um eine inszenierte Produktion und nicht um die Dokumentation einer Trauung oder eines Hochzeitstags."),
  ).toBeVisible();
  await expect(page.getByText("After-Wedding-Shooting in der Schweiz")).toHaveCount(0);

  const schemaText = (await page.locator('script[type="application/ld+json"]').allTextContents()).join("\n");
  expect(schemaText).not.toContain("Destination Wedding Fotografie");
  expect(schemaText).not.toContain('"areaServed"');
});
