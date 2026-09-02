// Inspection-only contact sheets; never used as published page images.
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const label = process.argv[2] || "before";
const report = JSON.parse(await fs.readFile(`reports/serp-metadata-2026-09-02/${label}.json`, "utf8"));
const route = process.argv[3]?.startsWith("/") ? process.argv[3] : undefined;
const social = process.argv.includes("--social");
const pages = report.pages.filter((p) => p.indexable && (!route || p.route === route));
const entries = route ? pages[0].images.map((im, i) => ({ image: im.src, title: `${i}: ${path.basename(im.src)} | ${im.alt}` }))
  : pages.map((p, i) => ({ image: (social ? p.socialImage : p.currentImage).src, title: `${i}: ${p.route}` }));
const escape = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
const out = "output/playwright/serp-images";
await fs.mkdir(out, { recursive: true });
for (let start = 0; start < entries.length; start += 12) {
  const batch = entries.slice(start, start + 12);
  const tiles = [];
  for (const [i, entry] of batch.entries()) {
    const photo = await sharp(path.join("dist", entry.image)).resize(360, 235, { fit: "contain", background: "#e8e5df" }).toBuffer();
    const lines = entry.title.match(/.{1,49}/g)?.slice(0, 3) || [];
    const caption = Buffer.from(`<svg width="360" height="65"><rect width="360" height="65" fill="white"/>${lines.map((line, j) => `<text x="5" y="${17 + j * 18}" font-family="Arial" font-size="12">${escape(line)}</text>`).join("")}</svg>`);
    tiles.push({ input: photo, left: (i % 3) * 360, top: Math.floor(i / 3) * 300 });
    tiles.push({ input: caption, left: (i % 3) * 360, top: Math.floor(i / 3) * 300 + 235 });
  }
  const file = `${out}/${label}${social ? "-social" : ""}${route ? "-" + route.replaceAll("/", "_") : ""}-${start}.jpg`;
  await sharp({ create: { width: 1080, height: Math.ceil(batch.length / 3) * 300, channels: 3, background: "white" } }).composite(tiles).jpeg({ quality: 90 }).toFile(file);
  console.log(path.resolve(file));
}
