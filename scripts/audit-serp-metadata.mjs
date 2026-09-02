import fs from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
import sharp from "sharp";

const root = process.cwd();
const dist = path.join(root, "dist");
const reportDir = path.join(root, "reports/serp-metadata-2026-09-02");
const live = process.argv.includes("--live");
const label = process.argv.find((arg) => arg.startsWith("--label="))?.split("=")[1] || "before";
if (!/^[a-z0-9-]+$/.test(label)) throw new Error("Invalid report label");
const manifest = JSON.parse(await fs.readFile(path.join(dist, "social-cards/manifest.json"), "utf8"));
const cards = new Map(manifest.cards.map((card) => [card.route, card]));
const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
const imageCache = new Map();

async function imageInfo(src) {
  if (!src) return null;
  const pathname = new URL(src, "https://artbild-fotografie.de").pathname;
  if (!imageCache.has(pathname)) imageCache.set(pathname, (async () => {
    try {
      const file = path.join(dist, decodeURIComponent(pathname));
      const info = await sharp(file).metadata();
      return { src: pathname, width: info.width, height: info.height, format: info.format };
    } catch { return null; }
  })());
  return imageCache.get(pathname);
}

async function walk(directory) {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(file));
    else if (entry.name.endsWith(".html")) result.push(file);
  }
  return result;
}

const files = await walk(dist);
const pages = [];
for (const file of files.sort()) {
  const relative = path.relative(dist, file).replaceAll(path.sep, "/");
  const route = relative === "index.html" ? "/" : "/" + relative.replace(/index\.html$/, "").replace(/\.html$/, "/");
  const $ = load(await fs.readFile(file, "utf8"));
  const canonical = $("link[rel=canonical]").attr("href") || "";
  const robots = $("meta[name=robots]").attr("content") || "";
  const indexable = cards.has(route);
  const descriptions = $("meta[name=description]").toArray().map((el) => clean($(el).attr("content")));
  const graph = $("script[type='application/ld+json']").toArray().flatMap((el) => {
    try { const json = JSON.parse($(el).text()); return json["@graph"] || (Array.isArray(json) ? json : [json]); }
    catch { return [{ malformed: true }]; }
  });
  const images = [];
  const seen = new Set();
  for (const el of $("main img, article img").toArray()) {
    const img = $(el);
    const info = await imageInfo(img.attr("src"));
    if (!info || seen.has(info.src) || info.width < 500 || info.height < 300 || /logo|icon|signature|favicon|artbild-fab/i.test(info.src)) continue;
    seen.add(info.src);
    images.push({ ...info, alt: clean(img.attr("alt")) });
  }
  const main = $("main").length ? $("main").clone() : $("body").clone();
  main.find("script,style,nav,footer,form,button,svg").remove();
  const description = descriptions[0] || "";
  const issues = [];
  if (indexable && descriptions.length !== 1) issues.push("missing-or-duplicate-description");
  if (indexable && description.length < 90) issues.push("short-description-review");
  if (indexable && description.length > 170) issues.push("long-description-review");
  if (/\.\.\.|…/.test(description)) issues.push("truncated-excerpt");
  const socialDescription = $("meta[property='og:description']").attr("content");
  if (indexable && socialDescription !== description) issues.push("inconsistent-social-description");
  if (indexable && !/max-image-preview:large/.test(robots)) issues.push("large-image-preview-not-explicit");
  if (indexable && !graph.some((n) => n.primaryImageOfPage)) issues.push("no-primary-image-declaration");
  pages.push({
    route, indexable, canonical, robots, title: clean($("title").text()), description,
    socialDescription, issues, headings: main.find("h1,h2,h3").toArray().map((el) => clean($(el).text())),
    text: clean(main.text()), images,
    currentImage: await imageInfo(cards.get(route)?.sourceImage),
    socialImage: await imageInfo($("meta[property='og:image']").attr("content")),
    schema: graph.map((n) => ({ type: n["@type"], id: n["@id"], image: n.image, primaryImageOfPage: n.primaryImageOfPage })),
  });
}

if (live) {
  const queue = pages.filter((page) => page.indexable);
  let cursor = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (cursor < queue.length) {
      const page = queue[cursor++];
      const response = await fetch(page.canonical, { signal: AbortSignal.timeout(20000) });
      const $ = load(await response.text());
      page.live = { status: response.status, cache: response.headers.get("cdn-cache"),
        title: clean($("title").text()), description: $("meta[name=description]").attr("content"),
        image: $("meta[property='og:image']").attr("content"), robots: response.headers.get("x-robots-tag") };
      if (page.live.title !== page.title || page.live.description !== page.description) page.issues.push("live-build-mismatch");
    }
  }));
}

const duplicates = new Map();
for (const page of pages.filter((page) => page.indexable)) {
  const same = duplicates.get(page.description) || [];
  same.push(page.route); duplicates.set(page.description, same);
}
const report = { auditedAt: new Date().toISOString(), label, live, total: pages.length,
  indexable: pages.filter((page) => page.indexable).length,
  duplicateDescriptions: [...duplicates.values()].filter((routes) => routes.length > 1), pages };
await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(path.join(reportDir, `${label}.json`), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ total: report.total, indexable: report.indexable,
  duplicateDescriptions: report.duplicateDescriptions,
  findings: pages.filter((page) => page.indexable && page.issues.length).map(({ route, issues }) => ({ route, issues })) }, null, 2));
