import { expect, test } from "@playwright/test";

const baseUrl = process.env.ASTRO_URL ?? "http://127.0.0.1:4321";

const viewports = [
  { width: 1440, height: 1000, columns: 3 },
  { width: 1024, height: 900, columns: 3 },
  { width: 820, height: 1080, columns: 3 },
  { width: 681, height: 900, columns: 3 },
  { width: 680, height: 900, columns: 1 },
  { width: 620, height: 900, columns: 1 },
  { width: 390, height: 844, columns: 1 },
  { width: 320, height: 720, columns: 1 },
];

for (const viewport of viewports) {
  test(`social section follows the homepage grid at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

    const section = page.locator(".social-section");
    const links = section.locator(".social-link");
    await section.scrollIntoViewIfNeeded();

    await expect(links).toHaveCount(3);
    await expect(section.locator(".social-link__external svg")).toHaveCount(3);
    await expect.poll(async () =>
      section.locator(".social-link__logo img").evaluateAll((images) =>
        images.every((image) => image.complete && image.naturalWidth > 0)
      )
    ).toBe(true);

    const layout = await section.evaluate((element) => {
      const contact = document.querySelector<HTMLElement>(".contact-note");
      const navigation = element.querySelector<HTMLElement>(".social-links");
      const cards = Array.from(element.querySelectorAll<HTMLElement>(".social-link"));
      const logo = element.querySelector<HTMLElement>(".social-link__logo");
      const external = element.querySelector<HTMLElement>(".social-link__external");
      const sectionStyle = getComputedStyle(element);
      const contactStyle = contact ? getComputedStyle(contact) : null;
      const cardStyle = cards[0] ? getComputedStyle(cards[0]) : null;
      const logoStyle = logo ? getComputedStyle(logo) : null;
      const externalStyle = external ? getComputedStyle(external) : null;
      const sectionBounds = element.getBoundingClientRect();
      const navigationBounds = navigation?.getBoundingClientRect();

      return {
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        sectionWidth: Math.round(sectionBounds.width),
        contactWidth: Math.round(contact?.getBoundingClientRect().width ?? 0),
        paddingTop: sectionStyle.paddingTop,
        paddingRight: sectionStyle.paddingRight,
        paddingBottom: sectionStyle.paddingBottom,
        paddingLeft: sectionStyle.paddingLeft,
        contactPaddingTop: contactStyle?.paddingTop,
        contactPaddingBottom: contactStyle?.paddingBottom,
        borderTopWidth: sectionStyle.borderTopWidth,
        borderRightWidth: sectionStyle.borderRightWidth,
        borderBottomWidth: sectionStyle.borderBottomWidth,
        borderLeftWidth: sectionStyle.borderLeftWidth,
        sectionRadius: sectionStyle.borderRadius,
        sectionBackgroundImage: sectionStyle.backgroundImage,
        cardRadius: cardStyle?.borderRadius,
        cardBackgroundImage: cardStyle?.backgroundImage,
        cardShadow: cardStyle?.boxShadow,
        cardMinHeights: cards.map((card) => card.getBoundingClientRect().height),
        logoRadius: logoStyle?.borderRadius,
        logoBackgroundImage: logoStyle?.backgroundImage,
        logoShadow: logoStyle?.boxShadow,
        externalRadius: externalStyle?.borderRadius,
        externalBackgroundImage: externalStyle?.backgroundImage,
        gridColumns: navigation
          ? getComputedStyle(navigation).gridTemplateColumns.split(/\s+/).filter(Boolean).length
          : 0,
        cardsInsideNavigation: cards.every((card) => {
          const bounds = card.getBoundingClientRect();
          return Boolean(
            navigationBounds
            && bounds.left >= navigationBounds.left - 1
            && bounds.right <= navigationBounds.right + 1
          );
        }),
      };
    });

    expect(layout.documentOverflow).toBeLessThanOrEqual(0);
    expect(layout.sectionWidth).toBe(layout.contactWidth);
    expect(layout.paddingTop).toBe(layout.contactPaddingTop);
    expect(layout.paddingBottom).toBe(layout.contactPaddingBottom);
    expect(layout.paddingRight).toBe("0px");
    expect(layout.paddingLeft).toBe("0px");
    expect(layout.borderTopWidth).toBe("1px");
    expect(layout.borderRightWidth).toBe("0px");
    expect(layout.borderBottomWidth).toBe("0px");
    expect(layout.borderLeftWidth).toBe("0px");
    expect(layout.sectionRadius).toBe("0px");
    expect(layout.sectionBackgroundImage).toBe("none");
    expect(layout.cardRadius).toBe("0px");
    expect(layout.cardBackgroundImage).toBe("none");
    expect(layout.cardShadow).toBe("none");
    expect(layout.logoRadius).toBe("0px");
    expect(layout.logoBackgroundImage).toBe("none");
    expect(layout.logoShadow).toBe("none");
    expect(layout.externalRadius).toBe("0px");
    expect(layout.externalBackgroundImage).toBe("none");
    expect(layout.gridColumns).toBe(viewport.columns);
    expect(layout.cardsInsideNavigation).toBe(true);
    expect(layout.cardMinHeights.every((height) => height >= 44)).toBe(true);

    const firstLink = links.first();
    await firstLink.focus();
    const focusStyle = await firstLink.evaluate((link) => {
      const style = getComputedStyle(link);
      return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
    });
    expect(focusStyle.outlineStyle).not.toBe("none");
    expect(Number.parseFloat(focusStyle.outlineWidth)).toBeGreaterThanOrEqual(2);
  });
}
