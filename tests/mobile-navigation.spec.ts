import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";
const screenshotDirectory = "screenshots/qa-mobile-navigation";

test("mobile navigation is accessible, touch friendly and stable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/portfolio/`, { waitUntil: "domcontentloaded" });

  const toggle = page.getByRole("button", { name: "Menü öffnen" });
  const toggleState = page.locator("[data-mobile-navigation-toggle]");
  await expect(toggle).toBeVisible();
  await expect(page.locator(".mobile-navigation__toggle-icon span")).toHaveCount(3);

  const toggleBox = await toggle.boundingBox();
  expect(toggleBox?.width).toBeGreaterThanOrEqual(48);
  expect(toggleBox?.height).toBeGreaterThanOrEqual(48);

  await toggle.click();

  const navigation = page.getByRole("navigation", { name: "Mobile Hauptnavigation" });
  await expect(navigation).toBeVisible();
  await expect(toggleState).toHaveAttribute("aria-expanded", "true");
  await expect(navigation.getByRole("link", { name: "Kontakt", exact: true })).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Standesämter & Trauorte", exact: true }),
  ).toHaveAttribute("href", "/standesamt-hamburg/");
  await expect(
    navigation.getByRole("link", { name: "Trautermin Hamburg", exact: true }),
  ).toHaveAttribute("href", "/trautermin-hamburg-online-reservieren/");
  await page.waitForTimeout(350);

  const linkHeights = await page.locator(
    ".mobile-navigation__group:not(.is-secondary) .mobile-navigation__link",
  ).evaluateAll((links) =>
    links.map((link) => link.getBoundingClientRect().height),
  );
  expect(Math.min(...linkHeights)).toBeGreaterThanOrEqual(44);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);

  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: `${screenshotDirectory}/mobile-menu-open.png`,
    fullPage: false,
  });

  await page.locator(".mobile-navigation__close").press("Escape");
  await expect(toggleState).toHaveAttribute("aria-expanded", "false");
  await expect(navigation).toBeHidden();
});

test("desktop navigation remains active", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${baseUrl}/portfolio/`, { waitUntil: "domcontentloaded" });

  await expect(page.locator(".gallery-nav")).toBeVisible();
  await expect(page.locator(".mobile-navigation")).toBeHidden();
  await expect(page.locator(".gallery-search")).toHaveCount(0);
  await expect(page.locator('.gallery-nav a[href="/?s="]')).toHaveCount(0);

  const navigationAlignment = await page.locator(".gallery-nav").evaluate((navigation) => {
    const navigationBounds = navigation.getBoundingClientRect();
    const menuItems = Array.from(
      navigation.querySelectorAll<HTMLElement>(".gallery-nav__group--home > li"),
    );
    const firstBounds = menuItems[0]?.getBoundingClientRect();
    const lastBounds = menuItems.at(-1)?.getBoundingClientRect();

    return {
      itemCount: menuItems.length,
      centerDifference: Math.abs(
        (navigationBounds.left + navigationBounds.width / 2)
        - (((firstBounds?.left ?? 0) + (lastBounds?.right ?? 0)) / 2),
      ),
    };
  });

  expect(navigationAlignment.itemCount).toBe(6);
  expect(navigationAlignment.centerDifference).toBeLessThanOrEqual(1);

  const importantDestinations = [
    "/standesamt-hamburg/",
    "/hochzeitsfotograf-preise/",
    "/kontakt/",
    "/sicherer-kontakt/",
    "/impressum/",
    "/datenschutz/",
    "/portfolio/",
    "/gallery-category/hochzeit/",
    "/gallery-category/travel/",
  ];

  for (const destination of importantDestinations) {
    await expect(page.locator(`.gallery-nav__submenu a[href="${destination}"]`)).toHaveCount(1);
  }

  const contactItem = page.locator(".gallery-nav__item", {
    has: page.getByRole("link", { name: "Kontakt", exact: true }),
  }).first();
  const contactSubmenu = contactItem.locator(".gallery-nav__submenu");

  await expect(contactSubmenu).toHaveCSS("visibility", "hidden");
  await contactItem.hover();
  await expect(contactSubmenu).toBeVisible();
  await expect(contactSubmenu).toHaveCSS("opacity", "1");
  await expect(contactSubmenu.getByRole("link", { name: "Preise & Pakete" })).toBeVisible();

  const submenuBounds = await contactSubmenu.boundingBox();
  expect(submenuBounds?.x).toBeGreaterThanOrEqual(0);
  expect((submenuBounds?.x ?? 0) + (submenuBounds?.width ?? 0)).toBeLessThanOrEqual(1280);

  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: `${screenshotDirectory}/desktop-navigation.png`,
    fullPage: false,
  });

  await page.mouse.move(0, 799);

  const planningItem = page.locator(".gallery-nav__item", {
    has: page.getByRole("link", { name: "Planung", exact: true }),
  }).first();
  const planningTrigger = planningItem.getByRole("link", { name: "Planung", exact: true });
  const planningSubmenu = planningItem.locator(".gallery-nav__submenu");

  await planningTrigger.focus();
  await expect(planningSubmenu).toBeVisible();
  await expect(
    planningSubmenu.getByRole("link", { name: "Standesämter & Trauorte" }),
  ).toHaveAttribute("href", "/standesamt-hamburg/");
  await page.keyboard.press("Tab");
  await expect(planningSubmenu.getByRole("link", { name: "Planung & Ratgeber" })).toBeFocused();
});
