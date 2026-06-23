import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

type VisualViewport = {
  name: string;
  width: number;
  height: number;
};

const viewports: VisualViewport[] = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 1200 },
];

const referenceUrlInput = process.env.REFERENCE_URL ?? process.env.WP_URL;
const astroUrlInput = process.env.ASTRO_URL ?? "http://localhost:4321";
const pagePath = process.env.PAGE_PATH;
const pageLabel = process.env.PAGE_LABEL;
const outputRoot = process.env.SCREENSHOT_DIR ?? "screenshots";
const captureDelayMs = Number(process.env.CAPTURE_DELAY_MS ?? 1200);
const fullPage = process.env.FULL_PAGE !== "false";
const hiddenSelectors = (process.env.HIDE_SELECTORS ?? "")
  .split(",")
  .map((selector) => selector.trim())
  .filter(Boolean);

function resolveUrl(input: string, pathSuffix?: string) {
  if (!pathSuffix) {
    return input;
  }

  return new URL(pathSuffix, input.endsWith("/") ? input : `${input}/`).href;
}

function safeName(value: string) {
  return value
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

async function preparePage(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
      html {
        scroll-behavior: auto !important;
      }
      ${hiddenSelectors.map((selector) => `${selector} { visibility: hidden !important; }`).join("\n")}
    `,
  });

  await page.evaluate(() => document.fonts?.ready).catch(() => undefined);
  await page.waitForTimeout(captureDelayMs);
}

test.describe("visual page comparison", () => {
  test.skip(!referenceUrlInput, "Set REFERENCE_URL or WP_URL to the WordPress reference page.");

  for (const viewport of viewports) {
    test(`captures reference and Astro page at ${viewport.name}`, async ({ browser }, testInfo) => {
      const referenceUrl = resolveUrl(referenceUrlInput!, pagePath);
      const astroUrl = resolveUrl(astroUrlInput, pagePath);
      const resolvedPath = pagePath ?? new URL(referenceUrl).pathname;
      const labelSource = pageLabel ?? (resolvedPath || "home");
      const label = safeName(labelSource);

      const referencePath = path.join(outputRoot, "reference", label, `${viewport.name}.png`);
      const astroPath = path.join(outputRoot, "astro", label, `${viewport.name}.png`);
      mkdirSync(path.dirname(referencePath), { recursive: true });
      mkdirSync(path.dirname(astroPath), { recursive: true });

      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
      });

      const referencePage = await context.newPage();
      await preparePage(referencePage, referenceUrl);
      await referencePage.screenshot({ path: referencePath, fullPage });

      const astroPage = await context.newPage();
      await preparePage(astroPage, astroUrl);
      await astroPage.screenshot({ path: astroPath, fullPage });

      await testInfo.attach(`reference-${viewport.name}`, {
        path: referencePath,
        contentType: "image/png",
      });
      await testInfo.attach(`astro-${viewport.name}`, {
        path: astroPath,
        contentType: "image/png",
      });

      await context.close();

      expect(referencePath).toContain(path.join("reference", label));
      expect(astroPath).toContain(path.join("astro", label));
    });
  }
});
