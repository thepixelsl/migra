import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createHash } from "node:crypto";
import { load } from "cheerio";
import sharp from "sharp";
import { pageSeo } from "../src/data/pageSeo.mjs";

const dist = path.resolve("dist");
const manifest = JSON.parse(await fs.readFile(path.join(dist, "social-cards/manifest.json"), "utf8"));
const pages = await Promise.all(manifest.cards.map(async (card) => {
  const $ = load(await fs.readFile(path.join(dist, card.route, "index.html"), "utf8"));
  const graph = $("script[type='application/ld+json']").toArray().flatMap((el) => {
    const json = JSON.parse($(el).text());
    return json["@graph"] || (Array.isArray(json) ? json : [json]);
  });
  return { card, $, graph, config: pageSeo[card.route] };
}));

test("every indexable canonical page has a reviewed, unique and consistent description", () => {
  assert.deepEqual(new Set(pages.map((p) => p.card.route)), new Set(Object.keys(pageSeo)));
  const descriptions = new Set();
  for (const { card, $, config, graph } of pages) {
    const description = $("meta[name=description]").attr("content");
    assert.equal($("meta[name=description]").length, 1, card.route);
    assert.ok(description.length >= 90 && description.length <= 170, card.route);
    assert.doesNotMatch(description, /\.\.\.|…/, card.route);
    assert.ok(!descriptions.has(description), `Duplicate: ${card.route}`);
    descriptions.add(description);
    if (config.description) assert.equal(description, config.description, card.route);
    for (const selector of ["meta[property='og:description']", "meta[name='twitter:description']"]) {
      assert.equal($(selector).length, 1, card.route);
      assert.equal($(selector).attr("content"), description, card.route);
    }
    assert.equal($("title").length, 1, card.route);
    if (config.title) assert.equal($("title").text(), config.title, card.route);
    assert.equal($("link[rel=canonical]").attr("href"), card.canonicalUrl);
    assert.match($("meta[name=robots]").attr("content"), /max-image-preview:large/);
    assert.doesNotMatch($("meta[name=robots]").attr("content"), /noindex|noimageindex/);
    const primaryPages = graph.filter((node) => node.primaryImageOfPage);
    assert.ok(primaryPages.length, card.route);
    for (const node of primaryPages) assert.equal(node.description, description, card.route);
  }
});

test("preferred images are real, complete originals with truthful dimensions and immutable URLs", async () => {
  for (const { card, $, graph, config } of pages) {
    const image = graph.find((node) => node["@id"] === `${card.canonicalUrl}#primaryimage`);
    assert.equal(image?.["@type"], "ImageObject", card.route);
    const localImage = path.join(dist, new URL(image.contentUrl).pathname);
    const info = await sharp(localImage).metadata();
    assert.equal(image.width, info.width, card.route);
    assert.equal(image.height, info.height, card.route);
    assert.equal(info.format, "webp");
    assert.equal(image.url, image.contentUrl);
    assert.doesNotMatch(image.url, /logo|icon|screenshot|social-cards/i, card.route);
    assert.equal($("meta[property='og:image:alt']").attr("content"), config.alt || image.caption);
    if (config.preserveHomepage) continue;
    assert.match(image.url, /\/serp-images\/[^/]+-[a-f0-9]{16}\.webp$/);
    assert.match(card.image, /-[a-f0-9]{12}\.webp$/);
    const original = await fs.readFile(path.resolve(config.image));
    const expected = await sharp(original).rotate()
      .resize({ width: 1600, height: 2560, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 90, effort: 4, smartSubsample: true }).toBuffer();
    assert.deepEqual(await fs.readFile(localImage), expected, `Wrong photo: ${card.route}`);
    assert.ok(image.url.includes(createHash("sha256").update(expected).digest("hex").slice(0, 16)));
  }
});

test("image sitemap covers exactly the canonical pages and their selected primary image", async () => {
  const $xml = load(await fs.readFile(path.join(dist, "sitemap.xml"), "utf8"), { xmlMode: true });
  assert.equal($xml("url").length, pages.length);
  for (const { card, graph } of pages) {
    const url = $xml("url").toArray().find((node) => $xml(node).children("loc").text() === card.canonicalUrl);
    const image = graph.find((node) => node["@id"] === `${card.canonicalUrl}#primaryimage`);
    assert.ok(url, card.route);
    assert.equal($xml(url).find("image\\:loc").text(), image.url, card.route);
  }
});

test("footer boilerplate is excluded from snippets but remains visible and linked", () => {
  for (const { card, $ } of pages) {
    for (const footer of $("footer.site-footer, footer.gallery-footer, footer.migrated-footer, footer.contact-footer").toArray()) {
      assert.ok($(footer).parents("div[data-nosnippet]").length, card.route);
      assert.equal($(footer).parents("[hidden], [aria-hidden=true]").length, 0, card.route);
    }
    assert.equal($("main").parents("[data-nosnippet]").length, 0, card.route);
    assert.equal($("blockquote footer").parents("[data-nosnippet]").length, 0, card.route);
    assert.equal($("meta[name=keywords]").length, 0, card.route);
  }
});

test("attention hooks remain backed by the page: package price, PDF and official-calendar link", () => {
  const pricing = pages.find((p) => p.card.route === "/hochzeitsfotograf-preise/");
  assert.ok(pricing.card.description.includes(pricing.$("#paket-pure-moments-title").text().trim()));
  assert.match(pricing.card.description, /für 1 Stunde/);
  const table = pages.find((p) => p.card.route === "/nd-filter-tabelle/");
  assert.equal(table.$("a[href='/wp-content/uploads/2019/08/ND-Filter-Tabelle.pdf']").length, 1);
  const calendar = pages.find((p) => p.card.route === "/trautermin-hamburg-online-reservieren/");
  assert.match(calendar.card.description, /Link zum offiziellen Traukalender/);
  assert.doesNotMatch(calendar.card.description, /^Offizieller/);
  // No self-serving review-star schema or deceptive product reclassification was added.
  for (const { card, graph } of pages) {
    assert.doesNotMatch(JSON.stringify(graph), /"(?:aggregateRating|reviewRating|ratingValue)"/, card.route);
  }
});
