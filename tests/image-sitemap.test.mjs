import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { load } from "cheerio";
import sharp from "sharp";
import { collectPageImages, renderImageSitemap, srcsetUrls } from "../scripts/lib/image-sitemap.mjs";

test("content extraction preserves real deferred pictures, excludes UI/hidden assets and deduplicates responsive motifs", async () => {
  const distDirectory = await mkdtemp(path.join(os.tmpdir(), "artbild-image-sitemap-"));
  try {
    await mkdir(path.join(distDirectory, "_astro"));
    for (const [name, width] of [["wedding.hash_small.webp", 400], ["wedding.hash_large.webp", 800], ["party.hash_image.webp", 800], ["logo.webp", 800]]) {
      await sharp({ create: { width, height: width / 2, channels: 3, background: "white" } }).webp().toFile(path.join(distDirectory, "_astro", name));
    }
    const $ = load(`<main>
      <img src="/_astro/wedding.hash_small.webp" srcset="/_astro/wedding.hash_small.webp 400w, /_astro/wedding.hash_large.webp 800w" width="800" alt="Brautpaar">
      <img src="/_astro/wedding.hash_large.webp" width="800" alt="Brautpaar">
      <figure aria-hidden="true"><img data-srcset="/_astro/party.hash_image.webp 800w" width="800" alt="Feier"></figure>
      <img src="/_astro/logo.webp" alt="Logo">
      <img src="https://external.example/portrait.webp" alt="Partner">
      <img src="data:image/gif;base64,AA" alt="">
      <div hidden><img src="/_astro/missing-hidden.webp" alt="Unsichtbar"></div>
      <div style="display: none"><img src="/_astro/missing-css.webp" alt="Unsichtbar"></div>
      <dialog><img src="/_astro/missing-dialog.webp" alt="Lightbox-Platzhalter"></dialog>
      <nav><img src="/_astro/missing-nav.webp" alt="Navigation"></nav>
    </main>`);
    const images = await collectPageImages($, "https://artbild-fotografie.de/gallery/example/", { distDirectory });
    assert.deepEqual(images.map((image) => image.url), [
      "https://artbild-fotografie.de/_astro/wedding.hash_large.webp",
      "https://artbild-fotografie.de/_astro/party.hash_image.webp",
    ]);
    assert.equal(images[0].width, 800);
    await assert.rejects(collectPageImages(load('<main><img src="/_astro/missing.webp"></main>'), "https://artbild-fotografie.de/", { distDirectory }));
  } finally { await rm(distDirectory, { recursive: true, force: true }); }
});

test("XML escapes URLs and omits pages without content images", () => {
  const xml = renderImageSitemap([
    { url: "https://example.test/a&b/", images: [{ url: "https://example.test/a&b.webp" }] },
    { url: "https://example.test/contact/", images: [] },
  ]);
  assert.match(xml, /http:\/\/www.google.com\/schemas\/sitemap-image\/1.1/);
  assert.match(xml, /a&amp;b/);
  const $ = load(xml, { xmlMode: true });
  assert.equal($("url").length, 1);
  assert.equal($("image\\:loc").text(), "https://example.test/a&b.webp");
});

test("built sitemap references only final emitted content resources on indexable canonical landing pages", async () => {
  const dist = path.resolve("dist");
  const $xml = load(await readFile(path.join(dist, "image-sitemap.xml"), "utf8"), { xmlMode: true });
  const $pages = load(await readFile(path.join(dist, "sitemap.xml"), "utf8"), { xmlMode: true });
  const canonicals = new Set($pages("url > loc").toArray().map((e) => $pages(e).text()));
  const seenPages = new Set();
  for (const element of $xml("url").toArray()) {
    const canonical = $xml(element).children("loc").text();
    assert.ok(canonicals.has(canonical), canonical);
    assert.ok(!seenPages.has(canonical), canonical);
    seenPages.add(canonical);
    const $ = load(await readFile(path.join(dist, new URL(canonical).pathname, "index.html"), "utf8"));
    assert.equal($("link[rel=canonical]").attr("href"), canonical);
    assert.doesNotMatch($("meta[name=robots]").attr("content"), /noindex|noimageindex|\bnone\b/);
    const emitted = new Set($("main img, article img").toArray().flatMap((e) => [
      e.attribs.src, e.attribs["data-src"], ...srcsetUrls(e.attribs.srcset), ...srcsetUrls(e.attribs["data-srcset"]),
    ]).filter(Boolean).map((src) => new URL(src, canonical).href));
    const urls = $xml(element).find("image\\:loc").toArray().map((e) => $xml(e).text());
    assert.equal(new Set(urls).size, urls.length);
    assert.ok(urls.length <= 1000);
    for (const url of urls) {
      assert.ok(emitted.has(url), `${canonical}: not an emitted content resource: ${url}`);
      assert.doesNotMatch(url, /logo|icon|social-cards|anker-york-augustin/i);
      const meta = await sharp(path.join(dist, new URL(url).pathname)).metadata();
      assert.ok(meta.width && meta.height, url);
    }
    if (new URL(canonical).pathname === "/") {
      assert.ok(urls.length > 20);
      for (const motif of ["ART0783-1", "paris_braut_fotoshooting-17", "getting-ready", "standesamt-altona", "barberhouse"]) {
        assert.ok(urls.some((url) => url.includes(motif)), `Homepage motif missing: ${motif}`);
      }
    }
  }
  assert.ok(seenPages.has("https://artbild-fotografie.de/gallery/traumhochzeit-in-hamburg/"));
  const robots = await readFile(path.join(dist, "robots.txt"), "utf8");
  assert.match(robots, /Sitemap: https:\/\/artbild-fotografie.de\/image-sitemap.xml/);
});
