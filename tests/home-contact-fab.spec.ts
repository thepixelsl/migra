import { expect, test } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";

test("home contact card opens the FAB and its availability check", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const contactCard = page.locator('[data-track-section="home_contact_options"]');
  const floatingAction = page.locator("[data-floating-action]");
  const toggle = floatingAction.locator("[data-floating-action-toggle]");
  const panel = floatingAction.locator("[data-floating-action-panel]");
  const contactView = floatingAction.locator("[data-floating-action-contact-view]");
  const availabilityView = floatingAction.locator("[data-floating-action-availability-view]");
  const availabilityDate = floatingAction.locator("[data-floating-action-date]");

  await contactCard.scrollIntoViewIfNeeded();
  await expect(contactCard).toContainText("Kontakt-Button unten rechts");
  await expect(contactCard.locator("[data-floating-action-external-open]")).toHaveCount(1);
  await expect(contactCard.locator("[data-floating-action-external-availability]")).toHaveCount(1);

  await contactCard.locator("[data-floating-action-external-open]").click();
  await expect(floatingAction).toHaveClass(/is-open/);
  await expect(panel).toHaveAttribute("aria-hidden", "false");
  await expect(contactView).toBeVisible();

  await toggle.click();
  await expect(floatingAction).not.toHaveClass(/is-open/);

  await contactCard.locator("[data-floating-action-external-availability]").click();
  await expect(floatingAction).toHaveClass(/is-open/);
  await expect(availabilityView).toBeVisible();
  await expect(availabilityView.getByRole("heading", { name: "Terminprüfung" })).toBeVisible();
  await expect(availabilityDate).toBeFocused();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
