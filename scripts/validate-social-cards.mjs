import fs from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
import sharp from "sharp";

const root = process.cwd();
const distDir = path.join(root, "dist");
const manifestPath = path.join(distDir, "social-cards", "manifest.json");

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const errors = [];

const requiredOpenGraph = [
  "og:locale",
  "og:type",
  "og:title",
  "og:description",
  "og:url",
  "og:site_name",
  "og:image",
  "og:image:secure_url",
  "og:image:width",
  "og:image:height",
  "og:image:type",
  "og:image:alt",
];

const requiredTwitter = [
  "twitter:card",
  "twitter:title",
  "twitter:description",
  "twitter:image",
  "twitter:image:alt",
];

function routeHtmlPath(route) {
  if (route === "/") return path.join(distDir, "index.html");
  return path.join(distDir, route.replace(/^\/+|\/+$/g, ""), "index.html");
}

function metaValues($, attribute, value) {
  return $(`meta[${attribute}="${value}"]`)
    .map((_, element) => $(element).attr("content")?.trim() ?? "")
    .get();
}

function assertSingleMeta($, attribute, name, route) {
  const values = metaValues($, attribute, name);
  if (values.length !== 1) {
    errors.push(`${route}: ${name} ist ${values.length}-mal vorhanden (erwartet: 1).`);
    return "";
  }
  if (!values[0]) errors.push(`${route}: ${name} hat keinen Inhalt.`);
  return values[0];
}

if (!Array.isArray(manifest.cards)) {
  throw new Error("Social-Card-Manifest enthält keine Kartenliste.");
}

if (manifest.count !== manifest.cards.length) {
  errors.push(`Manifest-Anzahl ${manifest.count} stimmt nicht mit ${manifest.cards.length} Karten überein.`);
}

for (const card of manifest.cards) {
  const route = card.route;
  const htmlPath = routeHtmlPath(route);
  const cardPath = path.join(distDir, card.image.replace(/^\//, ""));
  const expectedUrl = card.canonicalUrl || `${manifest.siteOrigin}${route}`;
  const expectedImage = card.socialImageUrl || `${new URL(expectedUrl).origin}${card.image}`;

  let html;
  try {
    html = await fs.readFile(htmlPath, "utf8");
  } catch {
    errors.push(`${route}: gebaute HTML-Datei fehlt.`);
    continue;
  }

  try {
    const image = await sharp(cardPath).metadata();
    if (image.width !== 1200 || image.height !== 630) {
      errors.push(`${route}: Social Card hat ${image.width} x ${image.height} statt 1200 x 630 px.`);
    }
    if (image.format !== "webp") {
      errors.push(`${route}: Social Card ist ${image.format ?? "unbekannt"} statt WebP.`);
    }
  } catch {
    errors.push(`${route}: Social-Card-Datei fehlt oder ist nicht lesbar.`);
  }

  if (/logo|favicon|icon-/i.test(card.image)) {
    errors.push(`${route}: unzulässiges Logo- oder Icon-Bild als Social Preview.`);
  }

  const $ = load(html);
  const openGraph = Object.fromEntries(
    requiredOpenGraph.map((name) => [name, assertSingleMeta($, "property", name, route)]),
  );
  const twitter = Object.fromEntries(
    requiredTwitter.map((name) => [name, assertSingleMeta($, "name", name, route)]),
  );

  if (openGraph["og:url"] !== expectedUrl) {
    errors.push(`${route}: og:url stimmt nicht mit der kanonischen Route überein.`);
  }
  if (openGraph["og:image"] !== expectedImage || openGraph["og:image:secure_url"] !== expectedImage) {
    errors.push(`${route}: Open-Graph-Bild verweist nicht auf die erzeugte Social Card.`);
  }
  if (twitter["twitter:image"] !== expectedImage) {
    errors.push(`${route}: Twitter-Bild verweist nicht auf die erzeugte Social Card.`);
  }
  if (openGraph["og:image:width"] !== "1200" || openGraph["og:image:height"] !== "630") {
    errors.push(`${route}: Open-Graph-Bildmaße sind nicht korrekt ausgezeichnet.`);
  }
  if (openGraph["og:image:type"] !== "image/webp") {
    errors.push(`${route}: Open-Graph-Bildtyp ist nicht image/webp.`);
  }
  if (twitter["twitter:card"] !== "summary_large_image") {
    errors.push(`${route}: Twitter Card ist nicht summary_large_image.`);
  }
}

if (errors.length > 0) {
  console.error(`Social-Card-Prüfung fehlgeschlagen (${errors.length} Fehler):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Social cards validated: ${manifest.cards.length} pages, all images 1200 x 630 px.`);
