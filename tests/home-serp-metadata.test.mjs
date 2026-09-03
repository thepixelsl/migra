import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { load } from "cheerio";
import sharp from "sharp";
import { homepageSeo } from "../src/data/homepageSeo.mjs";

// Run after npm run build: verifies the final, post-processed HTML, not just Astro.
const dist = path.resolve("dist");
const $ = load(await readFile(path.join(dist, "index.html"), "utf8"));
const graph = $("script[type='application/ld+json']").toArray().flatMap((element) => {
  const data = JSON.parse($(element).text());
  return data["@graph"] || [data];
});
const webpage = graph.find((node) => node["@type"] === "WebPage");
const photo = graph.find((node) => node["@id"] === webpage?.primaryImageOfPage?.["@id"]);
const localAsset = (url) => path.join(dist, new URL(url).pathname);

test("homepage has one consistent Hamburg title and description", () => {
  assert.equal($("title").length, 1);
  assert.equal($("title").text(), homepageSeo.title);
  assert.equal($("meta[name='description']").length, 1);
  assert.equal($("meta[name='description']").attr("content"), homepageSeo.description);
  assert.match(homepageSeo.description, /^Hochzeitsfotograf Hamburg:/);
  for (const [attribute, name, expected] of [
    ["property", "og:title", "Hochzeitsfotograf Hamburg"],
    ["property", "og:description", homepageSeo.description],
    ["name", "twitter:title", "Hochzeitsfotograf Hamburg"],
    ["name", "twitter:description", homepageSeo.description],
  ]) {
    assert.equal($(`meta[${attribute}='${name}']`).length, 1);
    assert.equal($(`meta[${attribute}='${name}']`).attr("content"), expected);
  }
  assert.equal(webpage.description, homepageSeo.description);
  assert.equal($("link[rel='canonical']").attr("href"), webpage.url);
  assert.match($("meta[name='robots']").attr("content"), /max-image-preview:large/);
  assert.doesNotMatch($("meta[name='robots']").attr("content"), /noindex|noimageindex|(?:^|,\s*)nosnippet/);
});

test("footer stays accessible but cannot supply snippets", () => {
  const footer = $("footer.site-footer");
  assert.equal(footer.length, 1);
  assert.equal(footer.parents("div[data-nosnippet]").length, 1);
  assert.match(footer.text(), /Rahlstedter Bahnhofstraße 27/);
  assert.equal(footer.find("a[href='/kontakt/']").length, 1);
  assert.equal(footer.find("a[href='/fuer-agenten/']").length, 1);
  assert.equal($("main").parents("[data-nosnippet]").length, 0);
  assert.equal($("main [data-nosnippet]").length, 0);
});

test("primary image is the user-selected original Mallorca photograph", async () => {
  assert.equal(photo["@type"], "ImageObject");
  assert.equal(photo.url, photo.contentUrl);
  assert.match(photo.url, /ART0783-1/);
  assert.doesNotMatch(photo.url, /logo|social-cards/);
  const metadata = await sharp(localAsset(photo.url)).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(photo.width, metadata.width);
  assert.equal(photo.height, metadata.height);
  assert.ok(metadata.width >= 1200);
  assert.equal(metadata.width, 1384);
  assert.equal(metadata.height, 924);
  assert.ok($("main img[src*='ART0783-1']").length > 0);
  const business = graph.find((node) => node["@type"] === "LocalBusiness");
  assert.equal(business.image["@id"], photo["@id"]);
  assert.match(business.logo, /logo-artbild/);
});

test("homepage preview uses the Mallorca photo without Instagram UI or text overlays", async () => {
  const card = $("meta[property='og:image']").attr("content");
  assert.equal($("meta[name='twitter:image']").attr("content"), card);
  const actual = await readFile(localAsset(card));
  const expected = await sharp(localAsset(photo.url))
    .rotate()
    .resize(1200, 630, { fit: "cover", position: "north" })
    .webp({ quality: 90, effort: 4, smartSubsample: true })
    .toBuffer();
  assert.deepEqual(actual, expected);
  assert.equal($("meta[property='og:image:alt']").attr("content"), homepageSeo.imageAlt);
});

test("genuine Google review links remain without self-serving star markup", () => {
  assert.ok($("a[href^='https://maps.app.goo.gl/']").length > 0);
  assert.doesNotMatch(JSON.stringify(graph), /"(?:aggregateRating|reviewRating|ratingValue)"/);
});
