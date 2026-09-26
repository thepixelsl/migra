import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
import sharp from "sharp";
import amphtmlValidator from "amphtml-validator";

const dist = path.resolve("dist");
const origin = "https://artbild-fotografie.de";
const directory = path.join(dist, "web-stories");
const validator = await amphtmlValidator.getInstance();
const sitemap = await fs.readFile(path.join(dist, "sitemap.xml"), "utf8");
const storySitemap = load(await fs.readFile(path.join(dist, "web-story-sitemap.xml"), "utf8"), { xmlMode: true });
const storyUrls = storySitemap("url > loc").toArray().map((element) => storySitemap(element).text());
const robots = await fs.readFile(path.join(dist, "robots.txt"), "utf8");
assert.ok(robots.includes(`Sitemap: ${origin}/web-story-sitemap.xml`), "robots.txt must advertise the story sitemap");
let count = 0;
for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const file = path.join(directory, entry.name, "index.html");
  const html = await fs.readFile(file, "utf8");
  const result = validator.validateString(html);
  assert.equal(result.status, "PASS", `${entry.name}: ${result.errors.map((e) => `${e.line}:${e.col} ${e.message}`).join("\n")}`);
  const $ = load(html);
  const canonical = `${origin}/web-stories/${entry.name}/`;
  assert.equal($("link[rel=canonical]").attr("href"), canonical);
  assert.ok(sitemap.includes(`<loc>${canonical}</loc>`), "Story must be discoverable in the sitemap");
  assert.ok(storyUrls.includes(canonical), "Story must appear in the dedicated story sitemap");
  assert.equal($("h1").length, 1);
  assert.ok($("meta[name=description]").attr("content")?.trim());
  const ids = $("[id]").toArray().map((el) => el.attribs.id);
  assert.equal(new Set(ids).size, ids.length, "Page IDs must be unique for story navigation");
  const story = $("amp-story");
  for (const attribute of ["title", "publisher", "publisher-logo-src", "poster-portrait-src"]) {
    assert.ok(story.attr(attribute)?.trim(), `Missing story ${attribute}`);
  }
  const localFile = (url) => {
    const parsed = new URL(url, canonical);
    assert.equal(parsed.origin, origin, "Story media must remain on the Artbild site");
    return path.join(dist, decodeURIComponent(parsed.pathname));
  };
  const poster = await sharp(localFile(story.attr("poster-portrait-src"))).metadata();
  assert.ok(poster.width >= 640 && poster.height >= 853 && Math.abs(poster.width / poster.height - 0.75) < 0.001);
  const logo = await sharp(localFile(story.attr("publisher-logo-src"))).metadata();
  assert.ok(logo.width >= 96 && logo.width === logo.height && !logo.hasAlpha);
  for (const image of $("amp-img").toArray()) {
    assert.ok(image.attribs.alt?.trim(), "Every photograph needs an accessible description");
    await fs.access(localFile(image.attribs.src));
  }
  for (const anchor of $("a[href]").toArray()) {
    const target = localFile(anchor.attribs.href);
    await fs.access(path.extname(target) ? target : path.join(target, "index.html"));
  }
  console.log(`${canonical}: AMP PASS; ${$("amp-story-page").length} pages, images, metadata, links and sitemap verified.`);
  count++;
}
assert.ok(count > 0, "No built Web Stories found");
assert.equal(storyUrls.length, count, "The story sitemap must contain exactly the published stories");
