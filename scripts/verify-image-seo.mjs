import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { load } from "cheerio";
import { srcsetUrls } from "./lib/image-sitemap.mjs";

// Run after npm run build with the disposable Bunny runtime on --base.
// --live-images checks the same public resources on production without publishing.
const base = process.argv.find((arg) => arg.startsWith("--base="))?.slice(7) || "http://127.0.0.1:4342";
const liveImages = process.argv.includes("--live-images");
const origin = "https://artbild-fotografie.de";
const dist = path.resolve("dist");
const reportDirectory = path.resolve("reports/image-seo-2026-09-05");
const xml = await fs.readFile(path.join(dist, "image-sitemap.xml"), "utf8");
const $xml = load(xml, { xmlMode: true });
const sitemap = load(await fs.readFile(path.join(dist, "sitemap.xml"), "utf8"), { xmlMode: true });
const urls = sitemap("url > loc").toArray().map((e) => sitemap(e).text());
const imageUrls = [...new Set($xml("image\\:loc").toArray().map((e) => $xml(e).text()))];
const assetUrls = new Set(imageUrls);
const links = new Set();
const pages = [];
const failures = [];
const resolve = (src, url) => { try { const u = new URL(src, url); return u.origin === origin ? u : null; } catch { return null; } };

for (const url of urls) {
  const html = await fs.readFile(path.join(dist, new URL(url).pathname, "index.html"), "utf8");
  const $ = load(html);
  const canonical = $("link[rel=canonical]").attr("href");
  if (canonical !== url || $("link[rel=canonical]").length !== 1) failures.push(`canonical: ${url}`);
  const graph = $("script[type='application/ld+json']").toArray().flatMap((e) => {
    const data = JSON.parse($(e).text());
    return data["@graph"] || [].concat(data);
  });
  const ids = graph.map((node) => node["@id"]).filter(Boolean);
  if (ids.length !== new Set(ids).size) failures.push(`duplicate schema IDs: ${url}`);
  const primaries = new Set(graph.filter((node) => node.primaryImageOfPage).map((node) => node.primaryImageOfPage["@id"]));
  if (primaries.size !== 1) failures.push(`conflicting primary images: ${url}`);
  for (const e of $("img").toArray()) {
    for (const src of [e.attribs.src, e.attribs["data-src"], ...srcsetUrls(e.attribs.srcset), ...srcsetUrls(e.attribs["data-srcset"])].filter(Boolean)) {
      const u = resolve(src, url); if (u) assetUrls.add(u.href);
    }
  }
  for (const e of $("source[srcset], [data-full-src]").toArray()) {
    for (const src of [...srcsetUrls(e.attribs.srcset), e.attribs["data-full-src"]].filter(Boolean)) {
      const u = resolve(src, url); if (u) assetUrls.add(u.href);
    }
  }
  for (const e of $("a[href]").toArray()) {
    const u = resolve(e.attribs.href, url);
    if (u && !/^\/(?:api|admin)/.test(u.pathname)) { u.hash = ""; links.add(u.href); }
  }
  const og = $("meta[property='og:image']").attr("content");
  if (!og) failures.push(`missing og:image: ${url}`); else assetUrls.add(og);
  pages.push({ url, title: $("title").text(), description: $("meta[name=description]").attr("content"), og,
    imageElements: $("main img").length,
    contentImages: $xml("url").toArray().filter((e) => $xml(e).children("loc").text() === url).reduce((n, e) => n + $xml(e).find("image\\:loc").length, 0),
    schemaTypes: [...new Set(graph.flatMap((node) => [].concat(node["@type"] || [])))],
  });
}

async function checkUrls(urls, { targetBase = base, image = false, userAgent } = {}) {
  let next = 0;
  const results = [];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < urls.length) {
      const url = urls[next++];
      const target = new URL(url);
      const requestUrl = `${targetBase}${target.pathname}${target.search}`;
      let result;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await fetch(requestUrl, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(20000),
            headers: userAgent ? { "User-Agent": userAgent } : {} });
          result = { url, status: response.status, finalUrl: response.url, redirected: response.redirected,
            type: response.headers.get("content-type"), robots: response.headers.get("x-robots-tag") };
          if (response.status < 500) break;
        } catch (error) { result = { url, error: String(error) }; }
      }
      if (result.status !== 200 || (image && !result.type?.startsWith("image/"))) failures.push(result);
      if (targetBase === origin && /noindex|noimageindex/i.test(result.robots || "")) failures.push(result);
      results.push(result);
    }
  }));
  return results.sort((a, b) => a.url.localeCompare(b.url));
}

const endpoints = await checkUrls([`${origin}/robots.txt`, `${origin}/sitemap.xml`, `${origin}/image-sitemap.xml`]);
const pageChecks = await checkUrls(urls);
const localImages = await checkUrls([...assetUrls], { image: true });
const localLinks = await checkUrls([...links]);
const publicImages = liveImages ? await checkUrls(imageUrls, { targetBase: origin, image: true, userAgent: "Googlebot-Image/1.0" }) : [];
const robots = await fs.readFile(path.join(dist, "robots.txt"), "utf8");
const blocked = imageUrls.filter((url) => /^\/(?:admin-login|admin-termine|api\/admin)\//.test(new URL(url).pathname));
if (blocked.length) failures.push(...blocked);
const home = pages.find((page) => page.url === `${origin}/`);
const ogBytes = await fs.readFile(path.join(dist, new URL(home.og).pathname));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const baselineDist = "/tmp/artbild-image-seo-baseline-20260905";
let homepagePreservation;
try {
  const before = load(await fs.readFile(path.join(baselineDist, "index.html"), "utf8"));
  const after = load(await fs.readFile(path.join(dist, "index.html"), "utf8"));
  const text = ($) => { const main = $("main").clone(); main.find("script,style").remove(); return main.text(); };
  const beforeOg = before("meta[property='og:image']").attr("content");
  homepagePreservation = { ogUrlUnchanged: home.og === beforeOg,
    ogBytesUnchanged: hash(ogBytes) === hash(await fs.readFile(path.join(baselineDist, new URL(beforeOg).pathname))),
    visibleTextUnchanged: text(before) === text(after),
    imageCountUnchanged: before("main img").length === after("main img").length,
    styleLinksUnchanged: before("link[rel=stylesheet]").toArray().map((e) => e.attribs.href).join() === after("link[rel=stylesheet]").toArray().map((e) => e.attribs.href).join(),
  };
  if (Object.values(homepagePreservation).some((value) => !value)) failures.push(homepagePreservation);
} catch (error) { failures.push(`Homepage baseline check unavailable: ${error}`); }

const result = { at: new Date().toISOString(), base, liveImages,
  summary: { pages: pages.length, imageSitemapPages: $xml("url").length, imageReferences: $xml("image\\:loc").length,
    uniqueSitemapImages: imageUrls.length, allLocalImageResources: localImages.length, internalLinkTargets: localLinks.length,
    publicImageChecks: publicImages.length, failures: failures.length },
  homepagePreservation, robots, pages, endpoints, pageChecks, localImages, localLinks, publicImages, failures,
};
await fs.mkdir(reportDirectory, { recursive: true });
await fs.writeFile(path.join(reportDirectory, "verification.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ ...result.summary, homepagePreservation, failures }, null, 2));
if (failures.length) process.exitCode = 1;
