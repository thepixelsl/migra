import fs from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
import { normalizeStructuredData, readSchemaGraph } from "./lib/structured-data.mjs";

const dist = path.resolve("dist");
const manifest = JSON.parse(await fs.readFile(path.join(dist, "social-cards/manifest.json"), "utf8"));
const origin = new URL(manifest.siteOrigin).origin;
const home = load(await fs.readFile(path.join(dist, "index.html"), "utf8"));
const homepageImage = readSchemaGraph(home).find((node) => node["@id"] === `${origin}/#primaryimage`);
if (!homepageImage?.contentUrl) throw new Error("Homepage identity image missing");
const portraitImage = `${origin}/images/portrait-riverside.webp`;
await fs.access(path.join(dist, new URL(portraitImage).pathname));

for (const card of manifest.cards) {
  const file = path.join(dist, card.route, "index.html");
  const $ = load(await fs.readFile(file, "utf8"));
  normalizeStructuredData($, card.route, { origin, homepageImage, portraitImage });
  await fs.writeFile(file, $.html());
}
console.log(`Structured data: ${manifest.cards.length} pages; shared LocalBusiness, Person, WebSite and photo credits.`);
