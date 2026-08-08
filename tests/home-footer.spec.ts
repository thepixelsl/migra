import { expect, test } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`footer uses an accessible FloThemes-style arrow at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

    const returnLink = page.getByRole("link", {
      name: "Zurück zum Seitenanfang",
    });
    const footer = page.locator(".site-footer");

    await returnLink.scrollIntoViewIfNeeded();
    await expect(returnLink).toBeVisible();
    await expect(returnLink).toHaveAttribute("href", "#top");
    await expect(returnLink.locator("svg")).toHaveAttribute("aria-hidden", "true");
    await expect(page.getByText("Nach oben", { exact: true })).toHaveCount(0);

    const layout = await page.evaluate(() => {
      const link = document.querySelector<HTMLElement>(".site-footer-return");
      const icon = link?.querySelector<SVGElement>("svg");
      const footer = document.querySelector<HTMLElement>(".site-footer");
      if (!link || !icon || !footer) return null;

      const linkBounds = link.getBoundingClientRect();
      const iconBounds = icon.getBoundingClientRect();
      const footerBounds = footer.getBoundingClientRect();

      return {
        linkWidth: linkBounds.width,
        linkHeight: linkBounds.height,
        iconWidth: iconBounds.width,
        iconHeight: iconBounds.height,
        footerGap: footerBounds.top - linkBounds.bottom,
        centerOffset: Math.abs(
          linkBounds.left + linkBounds.width / 2 - window.innerWidth / 2,
        ),
        pageOverflow:
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    expect(layout).not.toBeNull();
    expect(layout!.linkWidth).toBeGreaterThanOrEqual(44);
    expect(layout!.linkHeight).toBeGreaterThanOrEqual(44);
    expect(layout!.iconWidth).toBeGreaterThanOrEqual(10);
    expect(layout!.iconWidth).toBeLessThanOrEqual(20);
    expect(layout!.iconHeight).toBeGreaterThanOrEqual(20);
    expect(layout!.iconHeight).toBeLessThanOrEqual(28);
    expect(layout!.footerGap).toBeGreaterThanOrEqual(36);
    expect(layout!.centerOffset).toBeLessThanOrEqual(1);
    expect(layout!.pageOverflow).toBe(0);

    await returnLink.click();
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeLessThanOrEqual(1);
  });
}
