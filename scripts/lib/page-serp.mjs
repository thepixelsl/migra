import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { pageSeo } from "../../src/data/pageSeo.mjs";

const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
const imageCache = new Map();
const webpageTypes = new Set(["WebPage", "AboutPage", "ContactPage", "CollectionPage", "ProfilePage", "ItemPage"]);
const articleTypes = new Set(["Article", "BlogPosting", "NewsArticle"]);
const types = (node) => [].concat(node?.["@type"] || []);

/** Apply the reviewed metadata to final HTML without rewriting visible copy. */
export async function preparePageSeo($, route, { projectRoot, distDir, siteOrigin }) {
  const config = pageSeo[route];
  if (!config) throw new Error(`Indexable page lacks a reviewed SEO entry: ${route}`);
  if (config.preserveHomepage) return { keyword: config.keyword };

  let description = config.description || clean($("meta[name=description]").attr("content"));
  if (config.pricePackage) {
    const packageNode = $(`#paket-${config.pricePackage}`);
    const price = clean(packageNode.find("h3").text());
    const count = $("article.pricing-package").length;
    if (!/^\d+(?:[.,]\d+)?\s*€$/.test(price) || !count || !/1 Stunde/.test(packageNode.text())) {
      throw new Error("Pricing SEO requires the displayed one-hour fixed-price package; review changed pricing first.");
    }
    description = `Hochzeitsfotograf Hamburg: ${count} Pakete ab ${price} für 1 Stunde. Bildbearbeitung inklusive, klare Leistungen für Standesamt und Reportage. Preise vergleichen.`;
  }
  if (!description) throw new Error(`Missing page description: ${route}`);
  $("meta[name=description]").remove();
  $("head").append($("<meta>").attr({ name: "description", content: description }));
  if (config.title) $("title").text(config.title);

  // Google's data-nosnippet supports div/span/section, not footer itself.
  // display:contents avoids introducing a layout box around the existing footer.
  // Editorial quote citations use footer too; those are content, not boilerplate.
  $("footer.site-footer, footer.gallery-footer, footer.migrated-footer, footer.contact-footer").each((_, footer) => {
    if (!$(footer).parents("[data-nosnippet]").length) {
      $(footer).wrap('<div data-nosnippet style="display:contents"></div>');
    }
  });

  const image = await publishOriginal(config.image, { projectRoot, distDir });
  const canonicalUrl = $("link[rel=canonical]").attr("href") || `${siteOrigin}${route}`;
  const imageUrl = new URL(image.publicPath, canonicalUrl).href;
  const imageId = `${canonicalUrl}#primaryimage`;
  const imageNode = {
    "@type": "ImageObject", "@id": imageId, url: imageUrl, contentUrl: imageUrl,
    width: image.width, height: image.height, caption: config.alt,
  };

  const scripts = $("script[type='application/ld+json']").toArray().map((element) => {
    // Invalid existing JSON-LD is a build failure, not silently hidden.
    const json = JSON.parse($(element).text());
    const nodes = json["@graph"] || (Array.isArray(json) ? json : [json]);
    return { element, json, nodes };
  });
  const allNodes = scripts.flatMap((script) => script.nodes);
  const isLocalPage = (node) => {
    if (!types(node).some((t) => webpageTypes.has(t))) return false;
    const url = node.url || node["@id"]?.split("#")[0];
    return !url || url === canonicalUrl;
  };
  let pageNode = allNodes.find(isLocalPage);
  const added = [];
  if (!pageNode) {
    pageNode = { "@type": "WebPage", "@id": `${canonicalUrl}#webpage`, url: canonicalUrl, inLanguage: "de" };
    added.push(pageNode);
  }
  pageNode["@id"] ||= `${canonicalUrl}#webpage`;
  pageNode.url = canonicalUrl;
  pageNode.name = clean($("title").text());
  pageNode.description = description;
  pageNode.primaryImageOfPage = { "@id": imageId };

  const existingImage = allNodes.find((node) => node["@id"] === imageId);
  if (existingImage) {
    // Do not retain old captions/locations when an unrelated fallback is replaced.
    for (const key of Object.keys(existingImage)) delete existingImage[key];
    Object.assign(existingImage, imageNode);
  } else added.push(imageNode);

  for (const node of allNodes) {
    if (node !== pageNode && isLocalPage(node)) {
      node.description = description;
      node.primaryImageOfPage = { "@id": imageId };
    }
    if (types(node).some((t) => articleTypes.has(t))) {
      node.description = description;
      node.image = { "@id": imageId };
      node.mainEntityOfPage = { "@id": pageNode["@id"] };
      // Keep the existing headline and publication dates tied to visible editorial content.
    }
    if (types(node).includes("ImageGallery")) node.description = description;
  }
  for (const { element, json } of scripts) $(element).text(serializeJson(json));
  if (added.length) {
    $("head").append(`<script type="application/ld+json">${serializeJson({ "@context": "https://schema.org", "@graph": added })}</script>`);
  }
  return { ...config, description, image, primaryImageUrl: imageUrl,
    fit: config.fit || (image.width < image.height || image.width < 1200 ? "contain" : "cover") };
}

function serializeJson(json) {
  return JSON.stringify(json).replaceAll("<", "\\u003c");
}

async function publishOriginal(source, { projectRoot, distDir }) {
  if (!source || !/^(?:src\/assets|public)\//.test(source)) throw new Error(`Invalid SEO image source: ${source}`);
  const file = path.resolve(projectRoot, source);
  if (!file.startsWith(projectRoot + path.sep)) throw new Error("Image source outside project");
  const cacheKey = `${distDir}:${file}`;
  if (!imageCache.has(cacheKey)) imageCache.set(cacheKey, (async () => {
    const original = await fs.readFile(file);
    // Preserve the complete photograph and never manufacture image resolution.
    const { data, info } = await sharp(original).rotate()
      .resize({ width: 1600, height: 2560, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 90, effort: 4, smartSubsample: true }).toBuffer({ resolveWithObject: true });
    const hash = createHash("sha256").update(data).digest("hex").slice(0, 16);
    const basename = path.parse(source).name.replace(/[^a-zA-Z0-9_-]/g, "-");
    const publicPath = `/serp-images/${basename}-${hash}.webp`;
    const output = path.join(distDir, publicPath);
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, data);
    return { file: output, publicPath, width: info.width, height: info.height };
  })());
  return imageCache.get(cacheKey);
}
