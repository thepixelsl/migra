import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import sharp from "sharp";
import {
  socialCardDefaults,
  socialCardOverrides,
} from "../src/data/socialCards.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(projectRoot, "dist");
const cardsDir = path.join(distDir, "social-cards");
const publicDir = path.join(projectRoot, "public");
const siteOrigin = normalizeOrigin(
  process.env.PUBLIC_SITE_URL || "https://artbild-fotografie.de",
);
const buildDate = new Date();

const fontFiles = {
  display: path.join(publicDir, "fonts/playfair-display/playfair-display.woff2"),
  sans: path.join(publicDir, "fonts/raleway/raleway.woff2"),
};

const excludedRoutePatterns = [
  /^\/404\/?$/,
  /^\/admin-termine(?:\/|$)/,
  /^\/api(?:\/|$)/,
  /^\/(?:danke|thank-you)(?:\/|$)/,
];

const excludedImagePattern =
  /(?:logo|favicon|icon-|apple-touch|manifest|signature|artbild-fab|contact|kontakt|arrow|social-cards)/i;

const focalPositions = {
  center: "centre",
  top: "north",
  bottom: "south",
  left: "west",
  right: "east",
  "top left": "northwest",
  "top right": "northeast",
  "bottom left": "southwest",
  "bottom right": "southeast",
  attention: "attention",
  entropy: "entropy",
};

async function main() {
  await assertDirectory(distDir, "Astro build output not found. Run `astro build` first.");
  await fs.mkdir(cardsDir, { recursive: true });

  const [displayFont, sansFont] = await Promise.all([
    fs.readFile(fontFiles.display),
    fs.readFile(fontFiles.sans),
  ]);
  const fonts = {
    display: displayFont.toString("base64"),
    sans: sansFont.toString("base64"),
  };

  const htmlFiles = await findHtmlFiles(distDir);
  const manifest = [];

  for (const htmlFile of htmlFiles) {
    const route = routeFromHtmlFile(htmlFile);
    const result = await processPage(htmlFile, route, fonts);
    if (result) manifest.push(result);
  }

  manifest.sort((a, b) => a.route.localeCompare(b.route, "de"));
  await fs.writeFile(
    path.join(cardsDir, "manifest.json"),
    `${JSON.stringify(
      {
        generatedAt: buildDate.toISOString(),
        siteOrigin,
        count: manifest.length,
        cards: manifest,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`Social cards: ${manifest.length} indexable pages processed.`);
}

async function processPage(htmlFile, route, fonts) {
  const html = await fs.readFile(htmlFile, "utf8");
  const $ = load(html);

  if (shouldSkipPage($, route)) return null;

  const override = socialCardOverrides[route] || {};
  const structured = readStructuredData($);
  const title = cleanTitle(
    override.title ||
      $("main h1").first().text() ||
      $("h1").first().text() ||
      readMeta($, "property", "og:title") ||
      $("title").text(),
  );
  const description = cleanText(
    override.subtitle ||
      readMeta($, "property", "og:description") ||
      readMeta($, "name", "description") ||
      "Fotografie von Artbild-Fotografie.",
  );
  const year = resolveYear(override.year);
  const displayTitle = appendYear(title, year);
  const image = await selectImage($, route, override.image);
  const label = cleanText(override.label || inferLabel(route, structured));
  const location = cleanText(override.location || structured.location || "");
  const venue = cleanText(override.venue || "");
  const couple = cleanText(override.couple || "");
  const updated = override.updated || structured.dateModified || "";
  const published = override.datePublished || structured.datePublished || "";
  const pageType = override.pageType || inferPageType(route);
  const focalPoint = override.focalPoint || socialCardDefaults.focalPoint;
  const cardPath = cardPathForRoute(route);
  const outputPath = path.join(distDir, cardPath.replace(/^\//, ""));

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await renderCard({
    outputPath,
    imagePath: image.file,
    title: displayTitle,
    subtitle: description,
    label,
    location,
    venue,
    couple,
    updated: override.updated ? updated : "",
    focalPoint,
    fonts,
  });

  const declaredCanonical = cleanText($("link[rel='canonical']").first().attr("href"));
  const canonicalUrl = declaredCanonical || `${siteOrigin}${route}`;
  const canonicalOrigin = new URL(canonicalUrl, siteOrigin).origin;
  const socialImageUrl = `${canonicalOrigin}${cardPath}`;
  const imageAlt = socialImageAlt({ title: displayTitle, location, venue, label });

  writeSocialMeta($, {
    title: displayTitle,
    description,
    canonicalUrl,
    socialImageUrl,
    imageAlt,
    pageType,
  });
  await fs.writeFile(htmlFile, $.html(), "utf8");

  return {
    route,
    title: displayTitle,
    description,
    image: cardPath,
    sourceImage: image.publicPath,
    pageType,
    label,
    location: location || undefined,
    venue: venue || undefined,
    couple: couple || undefined,
    year: year || undefined,
    datePublished: published || undefined,
    dateModified: updated || undefined,
    canonicalUrl,
    socialImageUrl,
  };
}

function shouldSkipPage($, route) {
  if (excludedRoutePatterns.some((pattern) => pattern.test(route))) return true;
  const robots = readMeta($, "name", "robots").toLowerCase();
  return robots.split(",").some((value) => value.trim() === "noindex");
}

async function renderCard({
  outputPath,
  imagePath,
  title,
  subtitle,
  label,
  location,
  venue,
  couple,
  updated,
  focalPoint,
  fonts,
}) {
  const colors = socialCardDefaults.colors;
  const titleLayout = fitText(title, {
    maxWidth: 488,
    maxLines: 3,
    initialSize: 61,
    minSize: 43,
    lineHeightRatio: 1.05,
    serif: true,
  });
  const subtitleLayout = fitText(subtitle, {
    maxWidth: 480,
    maxLines: 3,
    initialSize: 24,
    minSize: 19,
    lineHeightRatio: 1.38,
  });
  const titleTop = 158;
  const subtitleTop = titleTop + titleLayout.lines.length * titleLayout.lineHeight + 30;
  const context = [couple, venue, location].filter(Boolean).join(" · ");
  const updateLabel = updated ? formatUpdated(updated) : "";
  const lowerMeta = [context, updateLabel].filter(Boolean).join(" · ");
  const photoWidth = 556;
  const photoLeft = 644;

  const svg = `
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <style>
        @font-face {
          font-family: "CardDisplay";
          src: url("data:font/woff2;base64,${fonts.display}") format("woff2");
        }
        @font-face {
          font-family: "CardSans";
          src: url("data:font/woff2;base64,${fonts.sans}") format("woff2");
        }
        .display { font-family: "CardDisplay", Georgia, serif; }
        .sans { font-family: "CardSans", Arial, sans-serif; }
      </style>
      <rect width="1200" height="630" fill="${colors.paper}" />
      <rect x="0" y="0" width="12" height="630" fill="${colors.accent}" />
      <line x1="64" y1="112" x2="558" y2="112" stroke="${colors.line}" stroke-width="1" />
      <text x="64" y="78" class="sans" font-size="17" font-weight="700" letter-spacing="3.2" fill="${colors.accent}">${escapeXml(label.toUpperCase())}</text>
      ${titleLayout.lines
        .map(
          (line, index) =>
            `<text x="64" y="${titleTop + titleLayout.fontSize + index * titleLayout.lineHeight}" class="display" font-size="${titleLayout.fontSize}" fill="${colors.ink}">${escapeXml(line)}</text>`,
        )
        .join("\n")}
      ${subtitleLayout.lines
        .map(
          (line, index) =>
            `<text x="64" y="${subtitleTop + subtitleLayout.fontSize + index * subtitleLayout.lineHeight}" class="display" font-size="${subtitleLayout.fontSize}" fill="${colors.muted}">${escapeXml(line)}</text>`,
        )
        .join("\n")}
      <line x1="64" y1="534" x2="116" y2="534" stroke="${colors.accent}" stroke-width="2" />
      <text x="64" y="574" class="sans" font-size="15" font-weight="700" letter-spacing="2.4" fill="${colors.ink}">${escapeXml(socialCardDefaults.brandLine)}</text>
      ${
        lowerMeta
          ? `<text x="64" y="604" class="sans" font-size="13" letter-spacing="1.2" fill="${colors.muted}">${escapeXml(truncate(lowerMeta, 64))}</text>`
          : ""
      }
      <rect x="${photoLeft}" y="0" width="${photoWidth}" height="630" fill="#e8e2dc" />
    </svg>`;

  const photo = await sharp(imagePath)
    .rotate()
    .resize(photoWidth, 630, {
      fit: "cover",
      position: focalPositions[focalPoint] || "centre",
    })
    .png()
    .toBuffer();

  await sharp(Buffer.from(svg))
    .composite([{ input: photo, left: photoLeft, top: 0 }])
    .webp({ quality: 90, effort: 4, smartSubsample: true })
    .toFile(outputPath);
}

async function selectImage($, route, overrideImage) {
  const candidates = [
    overrideImage,
    readMeta($, "property", "og:image"),
    readMeta($, "name", "twitter:image"),
    ...$("main img, article img, body img")
      .toArray()
      .map((element) => $(element).attr("src")),
    socialCardDefaults.defaultImage,
  ].filter(Boolean);

  const seen = new Set();
  for (const candidate of candidates) {
    const resolved = resolveBuiltAsset(candidate, route);
    if (!resolved || seen.has(resolved.file)) continue;
    seen.add(resolved.file);
    if (excludedImagePattern.test(resolved.publicPath)) continue;

    try {
      const metadata = await sharp(resolved.file).metadata();
      if ((metadata.width || 0) < 500 || (metadata.height || 0) < 300) continue;
      return resolved;
    } catch {
      // Try the next local image when a candidate cannot be decoded.
    }
  }

  throw new Error(`No suitable local social-card image found for ${route}`);
}

function resolveBuiltAsset(value, route) {
  try {
    const url = new URL(value, `${siteOrigin}${route}`);
    const publicPath = decodeURIComponent(url.pathname);
    const file = path.join(distDir, publicPath.replace(/^\/+/, ""));
    if (!file.startsWith(distDir)) return null;
    return { file, publicPath };
  } catch {
    return null;
  }
}

function writeSocialMeta($, data) {
  $("meta[property^='og:'], meta[name^='twitter:']").remove();
  const tags = [
    ["property", "og:locale", "de_DE"],
    ["property", "og:type", data.pageType === "article" ? "article" : "website"],
    ["property", "og:title", data.title],
    ["property", "og:description", data.description],
    ["property", "og:url", data.canonicalUrl],
    ["property", "og:site_name", socialCardDefaults.siteName],
    ["property", "og:image", data.socialImageUrl],
    ["property", "og:image:secure_url", data.socialImageUrl],
    ["property", "og:image:width", "1200"],
    ["property", "og:image:height", "630"],
    ["property", "og:image:type", "image/webp"],
    ["property", "og:image:alt", data.imageAlt],
    ["name", "twitter:card", "summary_large_image"],
    ["name", "twitter:title", data.title],
    ["name", "twitter:description", data.description],
    ["name", "twitter:image", data.socialImageUrl],
    ["name", "twitter:image:alt", data.imageAlt],
  ];

  for (const [attribute, name, content] of tags) {
    $("head").append(
      `<meta ${attribute}="${escapeHtmlAttribute(name)}" content="${escapeHtmlAttribute(content)}">`,
    );
  }
}

function readStructuredData($) {
  const result = {};
  $("script[type='application/ld+json']").each((_, element) => {
    try {
      const parsed = JSON.parse($(element).text());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) walkStructuredData(item, result);
    } catch {
      // Existing malformed JSON-LD must not stop social-card generation.
    }
  });
  return result;
}

function walkStructuredData(value, result) {
  if (!value || typeof value !== "object") return;
  if (!result.datePublished && typeof value.datePublished === "string") {
    result.datePublished = value.datePublished;
  }
  if (!result.dateModified && typeof value.dateModified === "string") {
    result.dateModified = value.dateModified;
  }
  if (!result.location) {
    const location = value.contentLocation || value.location || value.address;
    if (typeof location === "string") result.location = location;
    if (location && typeof location === "object") {
      result.location =
        location.name || location.addressLocality || location.addressRegion || "";
    }
  }
  for (const child of Object.values(value)) {
    if (child && typeof child === "object") walkStructuredData(child, result);
  }
}

function fitText(text, options) {
  let fontSize = options.initialSize;
  while (fontSize >= options.minSize) {
    const lines = wrapText(text, options.maxWidth, fontSize, options.serif);
    if (lines.length <= options.maxLines) {
      return {
        lines,
        fontSize,
        lineHeight: Math.round(fontSize * options.lineHeightRatio),
      };
    }
    fontSize -= 2;
  }

  const lines = wrapText(text, options.maxWidth, options.minSize, options.serif);
  const visible = lines.slice(0, options.maxLines);
  visible[visible.length - 1] = truncate(visible[visible.length - 1], 34, true);
  return {
    lines: visible,
    fontSize: options.minSize,
    lineHeight: Math.round(options.minSize * options.lineHeightRatio),
  };
}

function wrapText(text, maxWidth, fontSize, serif = false) {
  const words = cleanText(text).split(" ").filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || estimatedTextWidth(candidate, fontSize, serif) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function estimatedTextWidth(value, fontSize, serif) {
  let units = 0;
  for (const character of value) {
    if (/[MWÄÖÜ]/.test(character)) units += 0.88;
    else if (/[ilI1.,'’]/.test(character)) units += 0.3;
    else if (/\s/.test(character)) units += 0.28;
    else if (/[A-Z]/.test(character)) units += 0.64;
    else units += serif ? 0.52 : 0.54;
  }
  return units * fontSize;
}

function resolveYear(value) {
  if (Number.isInteger(value)) return value;
  const currentYear = buildDate.getFullYear();
  if (value === "current") return currentYear;
  if (value === "next") return currentYear + 1;
  return null;
}

function appendYear(title, year) {
  if (!year || new RegExp(`\\b${year}\\b`).test(title)) return title;
  return `${title} ${year}`;
}

function formatUpdated(value) {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  return `Aktualisiert ${new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)}`;
}

function inferLabel(route, structured) {
  if (route.startsWith("/gallery/")) return "Galerie";
  if (route.startsWith("/portfolio")) return "Portfolio";
  if (route.startsWith("/blog/")) return "Journal";
  if (route.includes("ratgeber") || route.includes("trautermin")) return "Ratgeber";
  if (structured.datePublished) return "Journal";
  return "Artbild-Fotografie";
}

function inferPageType(route) {
  return route.startsWith("/gallery/") || route.startsWith("/blog/")
    ? "article"
    : "website";
}

function socialImageAlt({ title, location, venue, label }) {
  const context = [venue, location].filter(Boolean).join(", ");
  return cleanText(`${label}: ${title}${context ? ` – ${context}` : ""}`);
}

function cleanTitle(value) {
  const title = cleanText(value).replace(/\s*[|–—]\s*Artbild(?:-Fotografie| Fotografie).*$/i, "");
  return title || "Artbild-Fotografie";
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function readMeta($, attribute, name) {
  return cleanText($(`meta[${attribute}='${name}']`).first().attr("content"));
}

function truncate(value, maxLength, ellipsis = false) {
  const normalized = cleanText(value);
  if (normalized.length <= maxLength) return normalized;
  const suffix = ellipsis ? "…" : "";
  const limit = Math.max(1, maxLength - suffix.length);
  const candidate = normalized.slice(0, limit + 1);
  const wordBoundary = candidate.lastIndexOf(" ");
  const clipped =
    wordBoundary >= Math.floor(limit * 0.55)
      ? candidate.slice(0, wordBoundary)
      : normalized.slice(0, limit);

  return `${clipped.trimEnd()}${suffix}`;
}

function cardPathForRoute(route) {
  if (route === "/") return "/social-cards/home.webp";
  const cleanRoute = route.replace(/^\/+|\/+$/g, "");
  return `/social-cards/${cleanRoute}.webp`;
}

function routeFromHtmlFile(htmlFile) {
  const relative = path.relative(distDir, htmlFile).split(path.sep).join("/");
  if (relative === "index.html") return "/";
  if (relative.endsWith("/index.html")) {
    return `/${relative.slice(0, -"index.html".length)}`;
  }
  return `/${relative.replace(/\.html$/, "/")}`;
}

async function findHtmlFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (absolute === cardsDir) continue;
      files.push(...(await findHtmlFiles(absolute)));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(absolute);
    }
  }
  return files;
}

async function assertDirectory(directory, message) {
  try {
    const stat = await fs.stat(directory);
    if (!stat.isDirectory()) throw new Error(message);
  } catch {
    throw new Error(message);
  }
}

function normalizeOrigin(value) {
  return value.replace(/\/+$/, "");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function escapeHtmlAttribute(value) {
  return escapeXml(value);
}

main().catch((error) => {
  console.error(`Social-card generation failed: ${error.message}`);
  process.exitCode = 1;
});
