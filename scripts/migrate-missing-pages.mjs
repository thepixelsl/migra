import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const siteUrl = "https://artbild-fotografie.de";
const dataFile = "src/data/migratedPages.json";
const publicAssetRoot = "public/migrated-assets";
const ignoredPaths = new Set(["/404-2/", "/locations.kml"]);
const existingExtraPaths = new Set();

const decodeEntities = (value = "") =>
  value
    .replace(/&#8211;/g, "-")
    .replace(/&#8212;/g, "-")
    .replace(/&#038;/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8216;|&#8217;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&auml;/g, "ä")
    .replace(/&ouml;/g, "ö")
    .replace(/&uuml;/g, "ü")
    .replace(/&Auml;/g, "Ä")
    .replace(/&Ouml;/g, "Ö")
    .replace(/&Uuml;/g, "Ü")
    .replace(/&szlig;/g, "ß")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

const stripTags = (html = "") =>
  decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );

const slugFromPath = (urlPath) =>
  urlPath.replace(/^\/|\/$/g, "").replace(/\//g, "__") || "start";

const fileNameFromUrl = (url) => {
  const clean = new URL(url).pathname.split("/").pop() || "asset";
  return decodeURIComponent(clean).replace(/[^\w.-]+/g, "-");
};

const fetchText = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
};

const fetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
};

const getLocalRoutes = async () => {
  const pages = [];
  const walk = async (dir) => {
    const entries = await import("node:fs/promises").then((fs) =>
      fs.readdir(dir, { withFileTypes: true }),
    );
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith(".astro")) pages.push(full.replace(/^src\/pages\//, ""));
    }
  };

  await walk("src/pages");

  const routes = new Set();
  for (const file of pages) {
    if (file.includes("[")) continue;
    if (file === "index.astro") routes.add("/");
    else if (file === "404.astro") routes.add("/404.html");
    else if (file.endsWith("/index.astro")) {
      routes.add(`/${file.replace(/\/index\.astro$/, "")}/`);
    } else {
      routes.add(`/${file.replace(/\.astro$/, "")}/`);
    }
  }

  const travelData = await readFile("src/data/travelGalleries.ts", "utf8");
  for (const match of travelData.matchAll(/slug:\s*"([^"]+)"/g)) {
    routes.add(`/gallery/${match[1]}/`);
  }

  for (const existingPath of existingExtraPaths) routes.add(existingPath);

  return routes;
};

const getMissingSitemapUrls = async () => {
  const localRoutes = await getLocalRoutes();
  const sitemapIndex = await fetchText(`${siteUrl}/sitemap.xml`);
  const sitemapUrls = [...sitemapIndex.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  const urls = [];

  for (const sitemapUrl of sitemapUrls) {
    const xml = await fetchText(sitemapUrl);
    for (const match of xml.matchAll(/<loc>(.*?)<\/loc>/g)) {
      const url = match[1];
      const urlPath = new URL(url).pathname;
      if (urlPath.includes("/web-stories/") || urlPath.includes("/web-story/")) continue;
      if (ignoredPaths.has(urlPath)) continue;
      if (localRoutes.has(urlPath)) continue;

      urls.push({
        sitemap: sitemapUrl.replace(`${siteUrl}/`, ""),
        path: urlPath,
        url,
      });
    }
  }

  return urls;
};

const collectImageUrls = (html = "") => {
  const urls = new Set();
  for (const match of html.matchAll(/https?:\/\/artbild-fotografie\.de\/wp-content\/uploads\/[^"' <>)]+\.(?:jpg|jpeg|png|webp|gif|pdf)(?:\?[^"' <>)]+)?/gi)) {
    urls.add(match[0].replace(/&amp;/g, "&"));
  }
  for (const match of html.matchAll(/(?:src|href)=["'](\/wp-content\/uploads\/[^"']+\.(?:jpg|jpeg|png|webp|gif|pdf)(?:\?[^"']+)?)["']/gi)) {
    urls.add(`${siteUrl}${match[1]}`.replace(/&amp;/g, "&"));
  }
  return [...urls];
};

const getJpegSize = (buffer) => {
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  return {};
};

const getImageSize = (buffer, fileName) => {
  const lower = fileName.toLowerCase();
  if ((lower.endsWith(".jpg") || lower.endsWith(".jpeg")) && buffer[0] === 0xff) {
    return getJpegSize(buffer);
  }
  if (lower.endsWith(".png") && buffer.toString("ascii", 1, 4) === "PNG") {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  return {};
};

const downloadAsset = async (url, pagePath) => {
  const slug = slugFromPath(pagePath);
  const folder = path.join(publicAssetRoot, slug);
  await mkdir(folder, { recursive: true });

  const cleanUrl = url.split("?")[0];
  const fileName = fileNameFromUrl(cleanUrl);
  const localFile = path.join(folder, fileName);
  const publicPath = `/migrated-assets/${slug}/${fileName}`;

  let buffer;
  if (existsSync(localFile)) {
    buffer = await readFile(localFile);
  } else {
    const response = await fetch(cleanUrl);
    if (!response.ok) throw new Error(`Asset ${response.status} ${cleanUrl}`);
    buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(localFile, buffer);
  }

  const dimensions = getImageSize(buffer, fileName);
  return {
    original: url,
    src: publicPath,
    fileName,
    width: dimensions.width,
    height: dimensions.height,
    isPdf: fileName.toLowerCase().endsWith(".pdf"),
  };
};

const normalizeInternalLinks = (html) =>
  html
    .replace(/https:\/\/artbild-fotografie\.de(\/(?!wp-content\/uploads\/)[^"' <)]*)/g, "$1")
    .replace(/http:\/\/artbild-fotografie\.de(\/(?!wp-content\/uploads\/)[^"' <)]*)/g, "$1");

const sanitizeContent = (html = "", assetMap = new Map()) => {
  let content = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/<figure[\s\S]*?<\/figure>/gi, "")
    .replace(/<img\b[^>]*>/gi, "");

  content = normalizeInternalLinks(content);

  for (const [original, local] of assetMap.entries()) {
    content = content.replaceAll(original, local);
    content = content.replaceAll(original.replace(/&/g, "&amp;"), local);
  }

  content = content
    .replace(/\s(?:class|style|id|data-[\w-]+|sizes|srcset|loading|decoding|fetchpriority)="[^"]*"/gi, "")
    .replace(/\s(?:class|style|id|data-[\w-]+|sizes|srcset|loading|decoding|fetchpriority)='[^']*'/gi, "")
    .replace(/<a\b([^>]*)>/gi, (tag, attrs) => {
      const href = attrs.match(/\shref=["']([^"']+)["']/i)?.[1];
      const rel = href && !href.startsWith("/") && !href.startsWith("#") ? ' rel="noopener"' : "";
      const target = href && !href.startsWith("/") && !href.startsWith("#") ? ' target="_blank"' : "";
      return href ? `<a href="${href}"${rel}${target}>` : "<a>";
    })
    .replace(/<(\/?)(span|div|font|center)[^>]*>/gi, "")
    .replace(/<p>\s*<\/p>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return content;
};

const extractMetaFromHtml = (html) => {
  const title =
    html.match(/<meta property=["']og:title["'] content=["']([^"']+)["']/i)?.[1] ||
    html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ||
    "Artbild-Fotografie";
  const description =
    html.match(/<meta name=["']description["'] content=["']([^"']+)["']/i)?.[1] ||
    html.match(/<meta property=["']og:description["'] content=["']([^"']+)["']/i)?.[1] ||
    "";
  return {
    title: stripTags(title.replace(/\s*\|\s*Artbild.*$/i, "")),
    description: stripTags(description),
  };
};

const extractMainHtml = (html) => {
  const candidates = [
    /<div[^>]+class=["'][^"']*entry-content[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
  ];
  for (const pattern of candidates) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return "";
};

const restItemFor = async (missing) => {
  if (missing.sitemap === "post-sitemap.xml") {
    const slug = missing.path.replace(/^\/|\/$/g, "");
    const items = await fetchJson(`${siteUrl}/wp-json/wp/v2/posts?slug=${slug}&_embed=1`);
    return items[0];
  }
  if (missing.sitemap === "page-sitemap.xml") {
    const slug = missing.path.replace(/^\/|\/$/g, "");
    const items = await fetchJson(`${siteUrl}/wp-json/wp/v2/pages?slug=${slug}&_embed=1`);
    return items[0];
  }
  return null;
};

const makeExcerpt = (content, fallback = "") => {
  const text = stripTags(fallback || content);
  if (text.length <= 190) return text;
  return `${text.slice(0, 187).replace(/\s+\S*$/, "")}...`;
};

const migrateOne = async (missing) => {
  const html = await fetchText(missing.url);
  const restItem = await restItemFor(missing).catch(() => null);
  const meta = extractMetaFromHtml(html);
  const rawContent = restItem?.content?.rendered || extractMainHtml(html);
  const rawTitle = restItem?.title?.rendered || meta.title;
  const title = stripTags(rawTitle);
  const eyebrow =
    missing.path.startsWith("/gallery/")
      ? "Galerie"
      : missing.sitemap === "post-sitemap.xml"
        ? "Journal"
        : "Seite";
  const assetUrls = new Set(collectImageUrls(rawContent));

  if (missing.sitemap === "gallery-sitemap.xml") {
    for (const assetUrl of collectImageUrls(html)) assetUrls.add(assetUrl);
  }

  const featured = restItem?._embedded?.["wp:featuredmedia"]?.[0]?.source_url;
  if (featured) assetUrls.add(featured);

  const assets = [];
  const assetMap = new Map();
  for (const assetUrl of [...assetUrls]) {
    try {
      const asset = await downloadAsset(assetUrl, missing.path);
      assets.push(asset);
      assetMap.set(assetUrl, asset.src);
      assetMap.set(assetUrl.split("?")[0], asset.src);
    } catch (error) {
      console.warn(`Asset skipped: ${assetUrl} (${error.message})`);
    }
  }

  const imageAssets = assets.filter((asset) => !asset.isPdf);
  const pdfAssets = assets.filter((asset) => asset.isPdf);
  let contentHtml = sanitizeContent(rawContent, assetMap);

  if (missing.sitemap === "gallery-sitemap.xml") {
    const galleryIntro = meta.description || makeExcerpt(rawContent, title);
    contentHtml = `<p>${galleryIntro}</p>`;
  }

  if (!contentHtml || stripTags(contentHtml).length < 80) {
    const fallbackDescription = meta.description || title;
    contentHtml = `<p>${fallbackDescription}</p>`;
  }

  if (pdfAssets.length) {
    const links = pdfAssets
      .map((asset) => `<p><a href="${asset.src}">Download: ${asset.fileName}</a></p>`)
      .join("");
    contentHtml = `${contentHtml}\n${links}`;
  }

  const galleryImages = imageAssets.map((asset, index) => ({
    src: asset.src,
    alt: title,
    width: asset.width,
    height: asset.height,
    eager: index === 0,
  }));

  const heroImage = galleryImages[0];
  const description = makeExcerpt(contentHtml, restItem?.excerpt?.rendered || meta.description);
  const keywords = [
    title,
    "Artbild-Fotografie",
    title.toLowerCase().includes("hamburg") ? "Hamburg" : "",
    missing.path.includes("hochzeit") ? "Hochzeitsfotograf Hamburg" : "",
    missing.path.includes("standesamt") ? "Standesamt Hamburg" : "",
  ].filter(Boolean);

  return {
    path: missing.path,
    sourceUrl: missing.url,
    type: missing.sitemap.replace("-sitemap.xml", ""),
    title,
    metaTitle: `${title} | Artbild-Fotografie`,
    description,
    eyebrow,
    datePublished: restItem?.date || undefined,
    dateModified: restItem?.modified || undefined,
    heroImage,
    contentHtml,
    galleryImages,
    keywords,
  };
};

const makeBlogIndex = (pages) => {
  const posts = pages
    .filter((page) => page.type === "post")
    .sort((a, b) => String(b.datePublished || "").localeCompare(String(a.datePublished || "")));
  const contentHtml = `<p>Planungstipps, Fotogeschichten und technische Notizen aus dem Archiv von Artbild-Fotografie.</p>
<ul>${posts
    .map((post) => `<li><a href="${post.path}">${post.title}</a></li>`)
    .join("")}</ul>`;
  return {
    path: "/blog/",
    sourceUrl: `${siteUrl}/blog/`,
    type: "archive",
    title: "Blog",
    metaTitle: "Blog | Artbild-Fotografie",
    description:
      "Blog von Artbild-Fotografie mit Planungstipps, Hochzeitsreportagen und Fotografie-Archiv aus Hamburg.",
    eyebrow: "Journal",
    contentHtml,
    galleryImages: [],
    keywords: ["Artbild-Fotografie Blog", "Hochzeitsfotograf Hamburg", "Hochzeitsplanung Hamburg"],
  };
};

const run = async () => {
  const missing = await getMissingSitemapUrls();
  const pages = [];

  for (const item of missing.filter((entry) => entry.path !== "/blog/")) {
    console.log(`Migrating ${item.path}`);
    pages.push(await migrateOne(item));
  }

  if (missing.some((entry) => entry.path === "/blog/")) {
    pages.push(makeBlogIndex(pages));
  }

  pages.sort((a, b) => a.path.localeCompare(b.path));
  await writeFile(dataFile, `${JSON.stringify(pages, null, 2)}\n`);
  console.log(`Wrote ${pages.length} migrated pages to ${dataFile}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
