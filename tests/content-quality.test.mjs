import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createHash } from "node:crypto";
import { load } from "cheerio";

const dist = path.resolve("dist");
const origin = "https://artbild-fotografie.de";

async function htmlFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory()
    ? htmlFiles(path.join(directory, entry.name))
    : entry.name.endsWith(".html") ? [path.join(directory, entry.name)] : []))).flat();
}

const pages = [];
for (const file of await htmlFiles(dist)) {
  const $ = load(await fs.readFile(file, "utf8"));
  const route = `/${path.relative(dist, file).replace(/index\.html$/, "")}`;
  // Verification files have no main content; administration is not a public page.
  if (!$("main").length || route.startsWith("/admin-") || $("meta[http-equiv=refresh]").length) continue;
  pages.push({ $, route });
}
assert.ok(pages.length > 80, "Expected the complete built public site, including archive pages");

test("public pages have one main heading and meaningful descriptions", () => {
  const errors = [];
  for (const { $, route } of pages) {
    if ($("h1").length !== 1) errors.push(`${route}: ${$("h1").length} main headings`);
    const description = $("meta[name=description]").attr("content")?.trim();
    if (!description || description === "%") errors.push(`${route}: missing or placeholder description`);
    const ids = $("[id]").map((_, node) => $(node).attr("id")).get();
    if (new Set(ids).size !== ids.length) errors.push(`${route}: duplicate element IDs`);
  }
  assert.deepEqual(errors, []);
});

test("inline text in paragraphs and headings keeps word separators", () => {
  const errors = [];
  for (const { $, route } of pages) {
    $("main a, main strong, main em, main b, main code, main cite, main q").each((_, element) => {
      // Cards, menus and labels use CSS gaps or separate block boxes. Check
      // actual text next to inline markup, not concatenated textContent of cards.
      if (!/^(p|h[1-6]|figcaption)$/.test(element.parent?.name || "")) return;
      if ($(element).parents("nav, [hidden], [aria-hidden=true]").length) return;
      const text = $(element).text();
      for (const side of ["prev", "next"]) {
        let sibling = element[side];
        while (sibling?.type === "comment") sibling = sibling[side];
        if (sibling?.type !== "text") continue;
        const [left, right] = side === "prev" ? [sibling.data, text] : [text, sibling.data];
        if (/[\p{L}\p{N}]$/u.test(left) && /^[\p{L}\p{N}]/u.test(right)) {
          errors.push(`${route}: ${left.slice(-55)}|${right.slice(0,65)}`);
        }
      }
    });
  }
  assert.deepEqual(errors, [], 'Separate inline words explicitly with {" "} across Astro source lines');
});

test("internal links, fragments and local page assets resolve", async () => {
  const errors = [];
  const byRoute = new Map(pages.map((page) => [page.route, page]));
  const existsCache = new Map();
  async function exists(file) {
    if (!existsCache.has(file)) existsCache.set(file, fs.access(file).then(() => true, () => false));
    return existsCache.get(file);
  }
  for (const { $, route } of pages) {
    for (const element of $("a[href], img[src], script[src], link[rel=stylesheet][href], source[src]").toArray()) {
      const href = $(element).attr("href") ?? $(element).attr("src");
      if (href === "" || href === "#") { errors.push(`${route}: empty link or asset target`); continue; }
      const url = new URL(href, `${origin}${route}`);
      if (url.origin !== origin) continue;
      // Public date-selection and API responses are served by the Bunny runtime.
      if (/^\/(?:api\/|agenten-test(?:\/|$)|admin-)/.test(url.pathname)) continue;
      const target = byRoute.get(url.pathname) || byRoute.get(`${url.pathname.replace(/\/$/, "")}/`);
      if (!target && !await exists(path.join(dist, decodeURIComponent(url.pathname)))) {
        errors.push(`${route}: missing ${href}`);
      }
      if (target && url.hash) {
        const id = decodeURIComponent(url.hash.slice(1));
        const anchors = target.$("[id], a[name]").toArray();
        if (!anchors.some((node) => node.attribs.id === id || node.attribs.name === id)) {
          errors.push(`${route}: missing fragment ${href}`);
        }
      }
    }
  }
  assert.deepEqual(errors, []);
});

test("archive pages keep working downloads and no unusable embed controls", async () => {
  const backup = byRoute("/wie-sollte-man-hochzeitsfotos-sichern/");
  assert.doesNotMatch(backup("main").text(), /Inhalt entsperren|Erforderlichen Service akzeptieren|Platzhalterinhalt/);
  const luminance = byRoute("/luminanzmasken-photoshop-aktion/");
  assert.doesNotMatch(luminance("main").text(), /Download.*derzeit nicht verfügbar/);
  const download = luminance("#download-luminanzmasken");
  assert.equal(download.length, 1);
  assert.equal(download.attr("href"), "/downloads/Luminanzen.atn");
  assert.equal(download.attr("download"), "Luminanzen.atn");
  const action = await fs.readFile(path.join(dist, "downloads/Luminanzen.atn"));
  assert.equal(createHash("sha256").update(action).digest("hex"), "89b1d17ce8132ecd48611dad1ab6c16cdb5c3ddb2e9d310211630a9f9ae5ebe3");
  assert.doesNotMatch(luminance("main").text(), /berarbeiten|Luninanzmasken|Dowload/);
  assert.doesNotMatch(luminance("main").text(), /Mallorca|Hochzeitsfotograf|Instagram|TFP|VON::|TEILEN:|over the TOP/);
  assert.equal(luminance("main form, main input[type=email], .migrated-gallery").length, 0);
  assert.equal(luminance(".migrated-content header, .migrated-content footer, .migrated-content nav").length, 0);
  assert.match(luminance(".migrated-hero").text(), /ohne E-Mail-Adresse/);
  assert.doesNotMatch(luminance("meta[name=robots]").attr("content"), /noindex/);
  const sitemap = await fs.readFile(path.join(dist, "sitemap.xml"), "utf8");
  assert.ok(sitemap.includes(`${origin}/luminanzmasken-photoshop-aktion/`));
  function byRoute(route) { return pages.find((page) => page.route === route).$; }
});
