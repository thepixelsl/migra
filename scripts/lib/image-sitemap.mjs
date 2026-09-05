import { stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const rasterImage = /\.(?:avif|webp|jpe?g|png|gif)$/i;
const interfaceImage = /(?:logo|favicon|icon|signature|instagram-glyph|pinterest-badge|social-cards|anker-york-augustin)/i;

export const xmlEscape = (value) => String(value)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&apos;");

/** The site emits ordinary URL + width/density descriptors, never data-URI srcsets. */
export function srcsetUrls(value = "") {
  return value.split(",").map((candidate) => candidate.trim().split(/\s+/)[0]).filter(Boolean);
}

/** One content image per motif, from actual final HTML (including existing carousel sources).
 * Never enumerate assets or copy the site's business/OG image onto unrelated pages.
 */
export async function collectPageImages($, canonical, { distDirectory, metadataCache = new Map() }) {
  const images = new Map();
  const origin = new URL(canonical).origin;
  for (const element of $("main img, article img").toArray()) {
    const img = $(element);
    if (img.closest("nav, footer, form, dialog, [hidden], .visually-hidden, .sr-only, [data-image-sitemap='exclude']").length) continue;
    if ([element, ...img.parents().toArray()].some((node) => /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(node.attribs?.style || ""))) continue;
    // Responsive carousel wrappers and aria-hidden previews are real user-facing
    // content. Their existing delayed loading is preserved, not activated here.
    const candidates = [img.attr("src"), img.attr("data-src"),
      ...srcsetUrls(img.attr("srcset")), ...srcsetUrls(img.attr("data-srcset"))].filter(Boolean);
    let best;
    for (const candidate of new Set(candidates)) {
      if (/^(?:data:|blob:)/i.test(candidate)) continue;
      const url = new URL(candidate, canonical);
      if (url.origin !== origin || !rasterImage.test(url.pathname) || interfaceImage.test(url.pathname)) continue;
      if (url.search || url.hash) throw new Error(`Unstable content image URL: ${url.href}`);
      const filename = path.resolve(distDirectory, `.${decodeURIComponent(url.pathname)}`);
      if (!filename.startsWith(path.resolve(distDirectory) + path.sep)) throw new Error(`Image outside build: ${url.href}`);
      if (!metadataCache.has(filename)) metadataCache.set(filename, (async () => {
        if (!(await stat(filename)).isFile()) throw new Error(`Missing image: ${url.href}`);
        return sharp(filename).metadata();
      })());
      const metadata = await metadataCache.get(filename);
      const { width, height } = metadata;
      // Exclude tiny UI/decorative resources, without inventing resolution.
      if (!width || !height || Math.max(width, height) < 300 || Math.min(width, height) < 150) continue;
      const intrinsicWidth = Number(img.attr("width"));
      if (intrinsicWidth > 0 && width > intrinsicWidth) continue;
      const image = { url: url.href, width, height, alt: img.attr("alt") || "" };
      if (!best || width * height > best.width * best.height) best = image;
    }
    if (!best) continue;
    // Astro's final transform suffix differs for responsive sizes of the same
    // imported source. Retain one largest emitted resource per source per page.
    const key = new URL(best.url).pathname.startsWith("/_astro/")
      ? best.url.replace(/(\.[\w-]+)_[\w-]+(\.(?:webp|avif|png|jpe?g))$/i, "$1$2") : best.url;
    const previous = images.get(key);
    if (!previous || best.width * best.height > previous.width * previous.height) images.set(key, best);
  }
  const result = [...images.values()];
  if (result.length > 1000) throw new Error(`Google image sitemap limit exceeded: ${canonical}`);
  return result;
}

export function renderImageSitemap(pages) {
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...pages.filter((page) => page.images.length).map(({ url, images }) => [
      `  <url><loc>${xmlEscape(url)}</loc>`,
      ...images.map((image) => `    <image:image><image:loc>${xmlEscape(image.url)}</image:loc></image:image>`),
      "  </url>",
    ].join("\n")),
    "</urlset>", "",
  ].join("\n");
  if (Buffer.byteLength(xml) > 50 * 1024 * 1024 || pages.length > 50000) throw new Error("Image sitemap needs splitting");
  return xml;
}
