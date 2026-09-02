// Read-only production verification: exact HTML metadata, image bytes and health.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { load } from "cheerio";
import sharp from "sharp";

const origin = "https://artbild-fotografie.de";
const dist = path.resolve("dist");
const manifest = JSON.parse(await fs.readFile(path.join(dist, "social-cards/manifest.json"), "utf8"));
const diagnostic = process.argv.find((arg) => arg.startsWith("--diagnostic="))?.split("=")[1];
const skipImages = process.argv.includes("--skip-images");
const report = { checkedAt: new Date().toISOString(), origin, diagnostic: diagnostic || null, pages: [], assets: [], health: [], errors: [] };
const assetPairs = new Map();
const livePageImages = new Map();
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const request = (pathname) => fetch(`${origin}${pathname}${diagnostic ? `?serp-release=${encodeURIComponent(diagnostic)}` : ""}`, { signal: AbortSignal.timeout(30000) });
const normalizeBuildHashes = (value) => value === undefined ? null : JSON.parse(JSON.stringify(value).replace(
  /(https:\/\/artbild-fotografie\.de\/(?:serp-images|social-cards)\/[^"\s]+)-[a-f0-9]{12,16}\.webp/g, "$1-[content-hash].webp"));

async function compareImages(actual, expected) {
  const [a, e] = await Promise.all([sharp(actual).removeAlpha().raw().toBuffer({ resolveWithObject: true }), sharp(expected).removeAlpha().raw().toBuffer({ resolveWithObject: true })]);
  if (a.info.width !== e.info.width || a.info.height !== e.info.height || a.info.channels !== e.info.channels) return { matches: false, reason: "dimensions" };
  const meanDifference = (left, right) => {
    let sum = 0; for (let i = 0; i < left.length; i++) sum += Math.abs(left[i] - right[i]);
    return sum / left.length;
  };
  const pixelDifference = meanDifference(a.data, e.data);
  const [smallA, smallE] = await Promise.all([sharp(actual).resize(32, 32, { fit: "fill" }).removeAlpha().raw().toBuffer(), sharp(expected).resize(32, 32, { fit: "fill" }).removeAlpha().raw().toBuffer()]);
  const compositionDifference = meanDifference(smallA, smallE);
  // Cross-platform libvips/libwebp rounding can alter content hashes. Verify the
  // actual pixels as well: <=2/255 average error plus <=1/255 at composition scale.
  return { matches: pixelDifference <= 2 && compositionDifference <= 1, pixelDifference, compositionDifference, width: a.info.width, height: a.info.height };
}

function metadata($) {
  const graph = $("script[type='application/ld+json']").toArray().flatMap((el) => {
    const json = JSON.parse($(el).text()); return json["@graph"] || (Array.isArray(json) ? json : [json]);
  });
  return {
    title: $("title").text(), canonical: $("link[rel=canonical]").attr("href"),
    description: $("meta[name=description]").attr("content"), robots: $("meta[name=robots]").attr("content"),
    social: $("meta[property^='og:'],meta[name^='twitter:']").toArray().map((el) => [$(el).attr("property") || $(el).attr("name"), $(el).attr("content")]),
    primary: graph.find((node) => /#primaryimage$/.test(node["@id"] || "")),
    pageImages: graph.filter((node) => node.primaryImageOfPage).map((node) => ({ id: node["@id"], description: node.description, primaryImageOfPage: node.primaryImageOfPage })),
    snippetFooters: $("footer.site-footer,footer.gallery-footer,footer.migrated-footer,footer.contact-footer").toArray().map((el) => $(el).parents("[data-nosnippet]").length > 0),
  };
}
async function pool(items, task) {
  let cursor = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      try { await task(item); } catch (error) { report.errors.push({ item: typeof item === "string" ? item : item.route, error: error.message }); }
    }
  }));
}
await pool(manifest.cards, async (card) => {
  const local = metadata(load(await fs.readFile(path.join(dist, card.route, "index.html"), "utf8")));
  const response = await request(card.route);
  const actual = metadata(load(await response.text()));
  const differences = Object.keys(local).filter((key) => JSON.stringify(normalizeBuildHashes(local[key])) !== JSON.stringify(normalizeBuildHashes(actual[key])));
  if (response.status !== 200 || /noindex/i.test(response.headers.get("x-robots-tag") || "") || differences.length) {
    report.errors.push({ route: card.route, status: response.status, differences });
  }
  report.pages.push({ route: card.route, status: response.status, cache: response.headers.get("cdn-cache"), differences });
  const actualSocial = actual.social.find(([key]) => key === "og:image")?.[1];
  if (actualSocial) assetPairs.set(new URL(actualSocial).pathname, card.image);
  if (local.primary?.contentUrl && actual.primary?.contentUrl) {
    assetPairs.set(new URL(actual.primary.contentUrl).pathname, new URL(local.primary.contentUrl).pathname);
    livePageImages.set(card.canonicalUrl, actual.primary.contentUrl);
  }
});
await pool(skipImages ? [] : [...assetPairs.keys()], async (pathname) => {
  const expected = await fs.readFile(path.join(dist, assetPairs.get(pathname)));
  const response = await request(pathname);
  const actual = Buffer.from(await response.arrayBuffer());
  const exactBytes = hash(actual) === hash(expected);
  const comparison = exactBytes ? { matches: true } : await compareImages(actual, expected);
  const declaredHash = pathname.match(/-([a-f0-9]{12,16})\.webp$/)?.[1];
  const validContentHash = !declaredHash || hash(actual).startsWith(declaredHash);
  const crawlable = response.headers.get("content-type")?.startsWith("image/webp") && !/noindex|noimageindex/i.test(response.headers.get("x-robots-tag") || "");
  if (response.status !== 200 || !comparison.matches || !validContentHash || !crawlable) report.errors.push({ asset: pathname, status: response.status, ...comparison, validContentHash, crawlable });
  report.assets.push({ path: pathname, status: response.status, cache: response.headers.get("cdn-cache"), exactBytes, ...comparison, validContentHash, crawlable, sha256: hash(actual) });
});
const sitemapResponse = await request("/sitemap.xml");
const xml = load(await sitemapResponse.text(), { xmlMode: true });
const entries = xml("url").toArray().map((node) => [xml(node).children("loc").text(), xml(node).find("image\\:loc").text()]);
const sitemapMatches = sitemapResponse.status === 200 && entries.length === manifest.cards.length && new Set(entries.map(([url]) => url)).size === manifest.cards.length && entries.every(([url, image]) => livePageImages.get(url) === image);
report.sitemap = { status: sitemapResponse.status, entries: entries.length, matches: sitemapMatches };
if (!sitemapMatches) report.errors.push({ asset: "/sitemap.xml", ...report.sitemap });
for (const [pathname, expectedStatus] of [["/readyz", 200], ["/healthz", 200], ["/api/admin/availability", 401], ["/serp-verification-not-a-page-20260902/", 404]]) {
  const response = await request(pathname);
  report.health.push({ path: pathname, expectedStatus, status: response.status });
  if (response.status !== expectedStatus) report.errors.push({ route: pathname, expectedStatus, status: response.status });
}
const directory = "reports/serp-metadata-2026-09-02";
await fs.mkdir(directory, { recursive: true });
await fs.writeFile(`${directory}/live${diagnostic ? "-diagnostic" : ""}.json`, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ pages: report.pages.length, assets: report.assets.length, sitemap: report.sitemap, diagnostic: report.diagnostic, errors: report.errors }, null, 2));
if (report.errors.length) process.exitCode = 1;
