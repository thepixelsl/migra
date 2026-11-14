import { expect, test, type Page } from '@playwright/test';

const baseUrl = process.env.ASTRO_URL ?? 'http://127.0.0.1:4321';
test.use({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });

async function openBook(page: Page) {
  await page.goto(`${baseUrl}/posing-guide/`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-posing-book]')).toHaveClass(/is-ready/);
  // Record real overlay creation rather than inferring animation from navigation.
  await page.evaluate(() => {
    (window as any).posingTurns = 0;
    new MutationObserver(records => {
      for (const record of records) if (record.attributeName === 'data-book-turning' && (record.target as Element).hasAttribute('data-book-turning')) (window as any).posingTurns++;
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-book-turning'] });
  });
}

async function showCorner(page: Page, direction = 'next') {
  const corner = page.locator(`[data-corner="top-${direction}"]`);
  await corner.evaluate(element => window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - 40, behavior: 'instant' }));
  return corner;
}

async function turns(page: Page) { return page.evaluate(() => (window as any).posingTurns as number); }

test('desktop navigation, mouse corner preview and corner click use the paper renderer', async ({ page }) => {
  await openBook(page);
  await page.locator('[data-book-stage]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-book-status]')).toHaveText(/^Seiten 2 und 3 von /);
  await expect(page.locator('.book-paper-overlay')).toHaveCount(0);
  const beforeHover = await turns(page), corner = await showCorner(page);
  const box = (await corner.boundingBox())!;
  await page.mouse.move(box.x + box.width - 8, box.y + 8);
  await expect(page.locator('[data-book-stage]')).toHaveAttribute('data-book-teasing', '');
  await expect.poll(() => turns(page)).toBeGreaterThan(beforeHover);
  await page.mouse.move(10, 10);
  await expect(page.locator('.book-paper-overlay')).toHaveCount(0);
  await expect(page.locator('[data-book-status]')).toHaveText(/^Seiten 2 und 3 von /);
  await corner.click({ position: { x: box.width - 8, y: 8 } });
  await expect(page.locator('[data-book-status]')).toHaveText(/^Seiten 4 und 5 von /);
  await expect(page.locator('.book-paper-overlay')).toHaveCount(0);
});

test('reduced system motion keeps static corners and permits an explicit animation opt-in', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openBook(page);
  const toggle = page.getByRole('button', { name: 'Animation einschalten', exact: true });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-book-motion-status]')).toHaveText('Deine Systemeinstellung reduziert Bewegung.');
  const corner = await showCorner(page);
  expect(await corner.evaluate(el => getComputedStyle(el, '::after').clipPath)).toMatch(/^polygon\(/);
  await page.locator('[data-book-next]').first().click();
  await expect(page.locator('[data-book-status]')).toHaveText(/^Seiten 2 und 3 von /);
  expect(await turns(page)).toBe(0);
  await toggle.click();
  await expect(page.getByRole('button', { name: 'Animation ausschalten', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => turns(page)).toBeGreaterThan(0);
  await expect(page.locator('.book-paper-overlay')).toHaveCount(0);
  const before = await turns(page);
  await page.locator('[data-book-next]').first().click();
  await expect(page.locator('[data-book-status]')).toHaveText(/^Seiten 4 und 5 von /);
  await expect.poll(() => turns(page)).toBeGreaterThan(before);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Animation ausschalten', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
});

test('explicit animation off survives system preference changes and leaves navigation usable', async ({ page }) => {
  await openBook(page);
  await page.getByRole('button', { name: 'Animation ausschalten', exact: true }).click();
  await expect(page.locator('.book-paper-overlay')).toHaveCount(0);
  const before = await turns(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.getByRole('button', { name: 'Animation einschalten', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.locator('[data-book-next]').first().click();
  await expect(page.locator('[data-book-status]')).toHaveText(/^Seiten 2 und 3 von /);
  expect(await turns(page)).toBe(before);
});

test('an unavailable paper renderer shows retry feedback without breaking navigation', async ({ page }) => {
  await page.route('**/posing-paper-turn*', route => route.abort());
  await openBook(page);
  await page.locator('[data-book-next]').first().click();
  await expect(page.locator('[data-book-status]')).toHaveText(/^Seiten 2 und 3 von /);
  await expect(page.getByRole('button', { name: 'Animation erneut versuchen', exact: true })).toBeVisible();
  await expect(page.locator('[data-book-motion-status]')).toContainText('Du kannst weiterblättern.');
  await expect(page.locator('.book-paper-overlay')).toHaveCount(0);
  // A repeated failed retry must keep its feedback instead of showing On.
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole('button', { name: 'Animation erneut versuchen', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Animation erneut versuchen', exact: true })).toBeVisible();
    await expect(page.locator('[data-book-motion-status]')).toContainText('Du kannst weiterblättern.');
  }
  await page.unroute('**/posing-paper-turn*');
  await page.getByRole('button', { name: 'Animation erneut versuchen', exact: true }).click();
  await expect.poll(() => turns(page)).toBeGreaterThan(0);
  await expect(page.locator('[data-book-status]')).toHaveText(/^Seiten 2 und 3 von /);
});

test('a real mouse can preview corners even when the primary pointer media query is coarse', async ({ page }) => {
  await page.addInitScript(() => {
    const original = matchMedia.bind(window);
    window.matchMedia = query => {
      const result = original(query);
      if (/^\((?:hover: hover|pointer: fine)\)$/.test(query)) Object.defineProperty(result, 'matches', { value: false });
      return result;
    };
  });
  await openBook(page);
  await page.locator('[data-book-stage]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-book-status]')).toHaveText(/^Seiten 2 und 3 von /);
  await expect(page.locator('.book-paper-overlay')).toHaveCount(0);
  const corner = await showCorner(page), box = (await corner.boundingBox())!;
  await page.mouse.move(box.x + box.width - 8, box.y + 8);
  await expect(page.locator('[data-book-stage]')).toHaveAttribute('data-book-teasing', '');
  await page.mouse.move(10, 10);
  await expect(page.locator('.book-paper-overlay')).toHaveCount(0);
});
