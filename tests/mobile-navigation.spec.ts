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
  await toggle.click();

  const navigation = page.getByRole("navigation", { name: "Mobile Hauptnavigation" });
  await expect(navigation).toBeVisible();
  await expect(toggleState).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: /Freie Termine & Anfrage/ })).toBeVisible();
  await page.waitForTimeout(350);

  const linkHeights = await page.locator(".mobile-navigation__link").evaluateAll((links) =>
    links.map((link) => link.getBoundingClientRect().height),
  );
  expect(Math.min(...linkHeights)).toBeGreaterThanOrEqual(48);

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

  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: `${screenshotDirectory}/desktop-navigation.png`,
    fullPage: false,
  });
});
