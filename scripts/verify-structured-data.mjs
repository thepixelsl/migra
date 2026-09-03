import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { load } from "cheerio";
import { readSchemaGraph } from "./lib/structured-data.mjs";

const directory = path.resolve("reports/structured-data-2026-09-03");
const dist = path.resolve("dist");
const manifest = JSON.parse(await fs.readFile(path.join(dist, "social-cards/manifest.json"), "utf8"));
const base = path.join(directory, "baseline.json");
const normalize = (value) => JSON.parse(JSON.stringify(value).replace(/(\/(?:serp-images|social-cards)\/[^"\s]+)-[a-f0-9]{12,16}\.webp/g, "$1-[hash].webp"));
function visibleSnapshot(html, route) {
  const $ = load(html);
  $("script,style,noscript").remove();
  let text = $("body").text().replace(/\s+/g, " ").trim();
  if (route === "/fuer-agenten/") text = text.replace(/"resetAt":\s*"[^\"]+"/g, '"resetAt":"[build-example]"');
  return {
    text, title: $("title").text(), canonical: $("link[rel=canonical]").attr("href"),
    meta: $("meta[name=description],meta[name=robots],meta[property^='og:'],meta[name^='twitter:']").toArray().map((el) => ({ ...$(el).attr() })),
    images: $("body img").toArray().map((el) => Object.fromEntries(["src", "srcset", "alt", "width", "height", "sizes"].map((key) => [key, $(el).attr(key) || null]))),
    links: $("body a[href]").toArray().map((el) => $(el).attr("href")),
  };
}
const localPages = await Promise.all(manifest.cards.map(async (card) => ({ route: card.route, html: await fs.readFile(path.join(dist, card.route, "index.html"), "utf8") })));
await fs.mkdir(directory, { recursive: true });
if (process.argv.includes("--baseline")) {
  await fs.writeFile(base, JSON.stringify(localPages.map(({ route, html }) => ({ route, snapshot: visibleSnapshot(html, route) })), null, 2) + "\n");
  console.log(`Recorded visible-content baseline for ${localPages.length} pages.`);
} else if (process.argv.includes("--live")) {
  const results = []; let cursor = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (cursor < localPages.length) {
      const { route, html } = localPages[cursor++];
      const response = await fetch(`https://artbild-fotografie.de${route}`, { signal: AbortSignal.timeout(30000) });
      const liveHtml = await response.text();
      const result = { route, status: response.status, cache: response.headers.get("cdn-cache") };
      try {
        assert.equal(response.status, 200);
        assert.deepEqual(normalize(readSchemaGraph(load(liveHtml))), normalize(readSchemaGraph(load(html))));
        assert.deepEqual(normalize(visibleSnapshot(liveHtml, route)), normalize(visibleSnapshot(html, route)));
        result.matches = true;
      } catch (error) { result.matches = false; result.error = error.message.slice(0, 1000); }
      results.push(result);
    }
  }));
  const report = { checkedAt: new Date().toISOString(), pages: results.sort((a, b) => a.route.localeCompare(b.route)), errors: results.filter((result) => !result.matches) };
  await fs.writeFile(path.join(directory, "live.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ pages: results.length, errors: report.errors }, null, 2));
  if (report.errors.length) process.exitCode = 1;
} else {
  const before = new Map(JSON.parse(await fs.readFile(base, "utf8")).map((entry) => [entry.route, entry.snapshot]));
  assert.equal(before.size, localPages.length);
  for (const { route, html } of localPages) assert.deepEqual(visibleSnapshot(html, route), before.get(route), `Visible content or existing metadata changed: ${route}`);
  console.log(`PASS: text, links, displayed images, titles, descriptions, canonicals and robots unchanged on ${localPages.length} pages.`);
}
