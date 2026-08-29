import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { load } from "cheerio";

const DIST_DIRECTORY = path.resolve("dist");
const PRODUCTION_ORIGIN = "https://artbild-fotografie.de";

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(entryPath);
    return entry.isFile() && entry.name === "index.html" ? [entryPath] : [];
  }));
  return files.flat();
}

function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

const canonicalUrls = new Set();
for (const file of await htmlFiles(DIST_DIRECTORY)) {
  const html = await readFile(file, "utf8");
  const $ = load(html);
  const robots = String($("meta[name='robots']").attr("content") || "").toLowerCase();
  if (robots.split(",").some((directive) => directive.trim() === "noindex")) continue;

  const canonical = $("link[rel='canonical']").attr("href");
  if (!canonical) continue;

  const canonicalUrl = new URL(canonical, PRODUCTION_ORIGIN);
  if (canonicalUrl.origin !== PRODUCTION_ORIGIN) continue;
  canonicalUrl.hash = "";
  canonicalUrl.search = "";
  canonicalUrls.add(canonicalUrl.href);
}

const urls = [...canonicalUrls].sort((left, right) => {
  const leftPath = new URL(left).pathname;
  const rightPath = new URL(right).pathname;
  if (leftPath === "/") return -1;
  if (rightPath === "/") return 1;
  return leftPath.localeCompare(rightPath, "de");
});

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map((url) => `  <url><loc>${xmlEscape(url)}</loc></url>`),
  "</urlset>",
  "",
].join("\n");

const robots = [
  "User-agent: *",
  "Allow: /",
  "Disallow: /admin-login/",
  "Disallow: /admin-termine/",
  "Disallow: /api/admin/",
  `Sitemap: ${PRODUCTION_ORIGIN}/sitemap.xml`,
  "",
].join("\n");

await Promise.all([
  writeFile(path.join(DIST_DIRECTORY, "robots.txt"), robots),
  writeFile(path.join(DIST_DIRECTORY, "sitemap.xml"), sitemap),
]);

console.log(`Production SEO files: ${urls.length} indexable canonical URLs.`);
