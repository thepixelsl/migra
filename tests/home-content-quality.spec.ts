import { expect, test } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";

test("homepage uses concrete copy and matching structured data", async ({ page }) => {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://artbild-fotografie.de/",
  );

  const pageText = (await page.locator("body").textContent()) ?? "";
  expect(pageText).toContain("Oldtimer, Ringtausch, Baumstammsägen");
  expect(pageText).toContain("greife möglichst wenig ein");
  expect(pageText).toContain("Standesamt Hamburg - Aussenlocations");
  expect(pageText).toContain(
    "Wusstet Ihr dass Ihr auch auf einem Alsterschiff, im Berner Schloss, im Hamburger Rathaus und in weiteren Hamburger Villen und Schlössern standesamtlich heiraten könnt?",
  );
  expect(pageText).toContain("Tipps & Tricks für Eure Hochzeit");
  expect(pageText).toContain(
    "Wer seinen Standesamt Termin online reserviert, kann seinen Wunschtermin vor allen anderen erhalten. Mehr Tipps & Tricks entdecken und Euer Budget für die Hochzeitsreportage planen",
  );
  expect(pageText).toContain("Hochzeiten und Editorial Shootings");
  expect(pageText).toContain("Hochzeitsdienstleister in Hamburg und Umgebung");
  expect(pageText).toContain("Folge mir auf Social Media");
  expect(pageText).not.toContain("Tipps & Tricks für tolle Hochzeitsfotos");
  expect(pageText).not.toContain("Aktuelle Arbeiten und Einblicke");
  expect(pageText).not.toContain("mit Blick für die kleinen Zwischentöne");
  expect(pageText).not.toContain("großen und kleinen Gänsehaut-Momente");
  expect(pageText).not.toContain("Vom hanseatischen Rathaus bis zum Ja-Wort");
  expect(pageText).not.toContain("After-Wedding-Shooting");

  const schemaText = (await page.locator('script[type="application/ld+json"]').allTextContents()).join("\n");
  expect(schemaText).not.toBeNull();
  expect(schemaText).not.toContain("After-Wedding-Shooting");
  expect(schemaText).toContain("Standesamtliche Trauungen in Hamburg");

  const socialLinks = page.locator(".social-section .social-link");
  await expect(socialLinks).toHaveCount(3);
  await expect(socialLinks.nth(0)).toHaveAttribute(
    "href",
    "https://www.facebook.com/artbildfotografie/",
  );
  await expect(socialLinks.nth(1)).toHaveAttribute(
    "href",
    "https://instagram.com/artbild",
  );
  await expect(socialLinks.nth(2)).toHaveAttribute(
    "href",
    "https://www.pinterest.de/artbild/",
  );
  await expect(page.locator(".social-link__logo img")).toHaveCount(3);
  await expect(page.locator(".social-link__external")).toHaveCount(3);
});
