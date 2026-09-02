// Read-only production verification: exact HTML metadata, image bytes and health.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { load } from "cheerio";

const origin = "https://artbild-fotografie.de";
const dist = path.resolve("dist");
const manifest = JSON.parse(await fs.readFile(path.join(dist, "social-cards/manifest.json"), "utf8"));
const diagnostic = process.argv.find((arg) => arg.startsWith("--diagnostic="))?.split("=")[1];
const skipImages = process.argv.includes("--skip-images");
const report = { checkedAt: new Date().toISOString(), origin, diagnostic: diagnostic || null, pages: [], assets: [], errors: [] };
const assetPaths = new Set(["/sitemap.xml"]);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const request = (pathname) => fetch(`${origin}${pathname}${diagnostic ? `?serp-release=${encodeURIComponent(diagnostic)}` : ""}`, { signal: AbortSignal.timeout(30000) });

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
  const differences = Object.keys(local).filter((key) => JSON.stringify(local[key]) !== JSON.stringify(actual[key]));
  if (response.status !== 200 || /noindex/i.test(response.headers.get("x-robots-tag") || "") || differences.length) {
    report.errors.push({ route: card.route, status: response.status, differences });
  }
  report.pages.push({ route: card.route, status: response.status, cache: response.headers.get("cdn-cache"), differences });
  assetPaths.add(card.image);
  if (local.primary?.contentUrl) assetPaths.add(new URL(local.primary.contentUrl).pathname);
});
await pool(skipImages ? ["/sitemap.xml"] : [...assetPaths], async (pathname) => {
  const expected = await fs.readFile(path.join(dist, pathname));
  const response = await request(pathname);
  const actual = Buffer.from(await response.arrayBuffer());
  const matches = hash(actual) === hash(expected);
  if (response.status !== 200 || !matches) report.errors.push({ asset: pathname, status: response.status, matches });
  report.assets.push({ path: pathname, status: response.status, cache: response.headers.get("cdn-cache"), matches, sha256: hash(actual) });
});
for (const [pathname, expectedStatus] of [["/readyz", 200], ["/healthz", 200], ["/admin-termine/", 401], ["/serp-verification-not-a-page-20260902/", 404]]) {
  const response = await request(pathname);
  if (response.status !== expectedStatus) report.errors.push({ route: pathname, expectedStatus, status: response.status });
}
const directory = "reports/serp-metadata-2026-09-02";
await fs.mkdir(directory, { recursive: true });
await fs.writeFile(`${directory}/live${diagnostic ? "-diagnostic" : ""}.json`, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ pages: report.pages.length, assets: report.assets.length, diagnostic: report.diagnostic, errors: report.errors }, null, 2));
if (report.errors.length) process.exitCode = 1;
