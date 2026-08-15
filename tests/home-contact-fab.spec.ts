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
  const contactTrigger = contactCard.locator("[data-floating-action-external-open]");
  const availabilityTrigger = contactCard.locator("[data-floating-action-external-availability]");
  const actionCards = contactCard.locator(".contact-note__action");
  const actionIcons = actionCards.locator("img");

  await expect(contactTrigger).toHaveCount(1);
  await expect(availabilityTrigger).toHaveCount(1);
  await expect(contactTrigger).toHaveAttribute("href", "/kontakt/");
  await expect(availabilityTrigger).toHaveAttribute("href", "/kontakt/");
  await expect(actionCards).toHaveCount(2);
  await expect(actionIcons).toHaveCount(2);
  await expect(actionIcons.nth(0)).toHaveAttribute("alt", "");
  await expect(actionIcons.nth(1)).toHaveAttribute("alt", "");
  await expect(actionIcons.nth(0)).toHaveAttribute("src", /email-icon/);
  await expect(actionIcons.nth(1)).toHaveAttribute("src", /weekly-planner-icon/);
  await expect(actionIcons.nth(0)).toBeVisible();
  await expect(actionIcons.nth(1)).toBeVisible();

  const mobileActionLayout = await actionCards.first().evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const styles = getComputedStyle(element);
    return {
      height: Math.round(bounds.height),
      columns: styles.gridTemplateColumns.split(" ").length,
      shadow: styles.boxShadow,
    };
  });

  expect(mobileActionLayout.height).toBeGreaterThanOrEqual(112);
  expect(mobileActionLayout.columns).toBe(3);
  expect(mobileActionLayout.shadow).not.toBe("none");

  await contactTrigger.click();
  await expect(floatingAction).toHaveClass(/is-open/);
  await expect(panel).toHaveAttribute("aria-hidden", "false");
  await expect(contactView).toBeVisible();

  await toggle.click();
  await expect(floatingAction).not.toHaveClass(/is-open/);

  await availabilityTrigger.click();
  await expect(floatingAction).toHaveClass(/is-open/);
  await expect(availabilityView).toBeVisible();
  await expect(availabilityView.getByRole("heading", { name: "Terminprüfung" })).toBeVisible();
  await expect(availabilityDate).toBeFocused();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test("home contact actions use two matching icon cards on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const contactCard = page.locator('[data-track-section="home_contact_options"]');
  const actions = contactCard.locator(".contact-note__actions");
  const actionCards = actions.locator(".contact-note__action");

  await contactCard.scrollIntoViewIfNeeded();
  await expect(actionCards).toHaveCount(2);

  const layout = await actions.evaluate((element) => {
    const styles = getComputedStyle(element);
    const cards = Array.from(element.querySelectorAll<HTMLElement>(".contact-note__action"));
    return {
      display: styles.display,
      columns: styles.gridTemplateColumns.split(" ").length,
      cardHeights: cards.map((card) => Math.round(card.getBoundingClientRect().height)),
    };
  });

  expect(layout.display).toBe("grid");
  expect(layout.columns).toBe(2);
  expect(layout.cardHeights.every((height) => height >= 224)).toBe(true);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
