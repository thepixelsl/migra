import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, "dist");
const siteOrigin = new URL(
  process.env.PUBLIC_SITE_URL || "https://artbild-fotografie.de",
).origin;
const localHosts = new Set([
  new URL(siteOrigin).hostname,
  "artbild-fotografie.de",
  "www.artbild-fotografie.de",
  "artbild-fotografie.ch",
  "www.artbild-fotografie.ch",
]);
const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".txt",
  ".xml",
]);
const jpegReferencePattern = /(?:https?:\/\/|\/)[^"'<>\s]*?\.jpe?g/gi;
const jpegFilePattern = /\.jpe?g$/i;
const passthroughVerificationFiles = new Set([
  path.join(distDir, "pinterest-78b70.html"),
  path.join(distDir, "pinterest-e6785.html"),
]);

await assertDirectory(distDir);

const initialFiles = await listFiles(distDir);
const textFiles = initialFiles.filter(
  (file) => textExtensions.has(path.extname(file)) && !passthroughVerificationFiles.has(file),
);
const jpegFiles = initialFiles.filter((file) => jpegFilePattern.test(file));
const textByFile = new Map(
  await Promise.all(
    textFiles.map(async (file) => [file, await fs.readFile(file, "utf8")]),
  ),
);
const literalReplacements = new Map();
const conversionsBySource = new Map();
const invalidReferences = [];

for (const [file, content] of textByFile) {
  for (const match of content.matchAll(jpegReferencePattern)) {
    const literal = match[0];
    let url;

    try {
      url = new URL(literal, siteOrigin);
    } catch {
      invalidReferences.push(`${relative(file)}: ungültige JPEG-URL ${literal}`);
      continue;
    }

    const isRootRelative = literal.startsWith("/") && !literal.startsWith("//");
    if (!isRootRelative && !localHosts.has(url.hostname)) {
      invalidReferences.push(`${relative(file)}: externe JPEG-URL ${literal}`);
      continue;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      invalidReferences.push(`${relative(file)}: nicht dekodierbare JPEG-URL ${literal}`);
      continue;
    }

    const source = resolveDistPath(pathname);
    const target = source.replace(jpegFilePattern, ".webp");
    const targetLiteral = literal.replace(jpegFilePattern, ".webp");

    literalReplacements.set(literal, targetLiteral);
    conversionsBySource.set(source, target);
  }
}

for (const source of conversionsBySource.keys()) {
  if (!(await isFile(source))) {
    invalidReferences.push(`Datei für ausgelieferte JPEG-URL fehlt: ${relative(source)}`);
  }
}

if (invalidReferences.length > 0) {
  throw new Error(
    `JPEG-Auslieferung kann nicht sicher konvertiert werden:\n${invalidReferences
      .slice(0, 40)
      .map((entry) => `- ${entry}`)
      .join("\n")}`,
  );
}

const conversionEntries = [...conversionsBySource.entries()];
const conversionResults = await runWithConcurrency(conversionEntries, 6, convertImage);
let rewrittenFiles = 0;

for (const [file, original] of textByFile) {
  const rewritten = original
    .replace(jpegReferencePattern, (literal) => literalReplacements.get(literal) ?? literal)
    .replace(
      /(<meta\b[^>]*\bproperty=["']og:image:type["'][^>]*\bcontent=["'])image\/jpeg(["'][^>]*>)/gi,
      "$1image/webp$2",
    );

  if (rewritten !== original) {
    await fs.writeFile(file, rewritten, "utf8");
    rewrittenFiles += 1;
  }
}

await Promise.all(jpegFiles.map((file) => fs.unlink(file)));

const finalFiles = await listFiles(distDir);
const remainingJpegFiles = finalFiles.filter((file) => jpegFilePattern.test(file));
const remainingReferences = [];
const remainingMimeTypes = [];

for (const file of finalFiles.filter(
  (entry) => textExtensions.has(path.extname(entry)) && !passthroughVerificationFiles.has(entry),
)) {
  const content = await fs.readFile(file, "utf8");
  const jpegReferences = [...content.matchAll(jpegReferencePattern)].map((match) => match[0]);

  if (jpegReferences.length > 0) {
    remainingReferences.push(`${relative(file)}: ${jpegReferences.slice(0, 3).join(", ")}`);
  }
  if (/<meta\b[^>]*\bproperty=["']og:image:type["'][^>]*\bcontent=["']image\/jpeg["']/i.test(content)) {
    remainingMimeTypes.push(relative(file));
  }
}

if (remainingJpegFiles.length > 0 || remainingReferences.length > 0 || remainingMimeTypes.length > 0) {
  throw new Error([
    "JPEG-Auslieferungsprüfung fehlgeschlagen.",
    ...remainingJpegFiles.slice(0, 20).map((file) => `- JPEG-Datei: ${relative(file)}`),
    ...remainingReferences.slice(0, 20).map((entry) => `- JPEG-Referenz: ${entry}`),
    ...remainingMimeTypes.slice(0, 20).map((file) => `- JPEG-MIME-Typ: ${file}`),
  ].join("\n"));
}

const originalBytes = conversionResults.reduce((sum, result) => sum + result.originalBytes, 0);
const webpBytes = conversionResults.reduce((sum, result) => sum + result.webpBytes, 0);
const removedUnreferenced = jpegFiles.length - conversionEntries.length;
const savingPercent = originalBytes > 0
  ? ((1 - webpBytes / originalBytes) * 100).toFixed(1)
  : "0.0";

console.log([
  `WebP-Auslieferung: ${conversionEntries.length} referenzierte JPEG-Dateien konvertiert oder wiederverwendet.`,
  `${removedUnreferenced} nicht referenzierte JPEG-Kopien aus dist entfernt.`,
  `${rewrittenFiles} Textdateien aktualisiert.`,
  `Referenzierte Bilder: ${formatMiB(originalBytes)} MiB -> ${formatMiB(webpBytes)} MiB (${savingPercent} % kleiner).`,
  "Prüfung: keine JPEG-Dateien, JPEG-URLs oder ausgehenden image/jpeg-Metatypen in dist.",
].join("\n"));

async function convertImage([source, target], index) {
  const [sourceStat, sourceMetadata] = await Promise.all([
    fs.stat(source),
    sharp(source).metadata(),
  ]);

  if (await isFile(target)) {
    const [targetStat, targetMetadata] = await Promise.all([
      fs.stat(target),
      sharp(target).metadata(),
    ]);

    if (
      targetMetadata.format !== "webp" ||
      targetMetadata.width !== sourceMetadata.width ||
      targetMetadata.height !== sourceMetadata.height
    ) {
      throw new Error(`Vorhandenes WebP passt nicht zur JPEG-Quelle: ${relative(target)}`);
    }

    return {
      originalBytes: sourceStat.size,
      webpBytes: targetStat.size,
      reused: true,
    };
  }

  const temporary = `${target}.tmp-${process.pid}-${index}.webp`;

  try {
    const info = await sharp(source)
      .keepIccProfile()
      .webp({ quality: 85, effort: 4, smartSubsample: true })
      .toFile(temporary);
    await fs.rename(temporary, target);

    return {
      originalBytes: sourceStat.size,
      webpBytes: info.size,
      reused: false,
    };
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
}

async function runWithConcurrency(entries, concurrency, worker) {
  const results = new Array(entries.length);
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(concurrency, entries.length) }, async () => {
    while (nextIndex < entries.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(entries[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}

async function listFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  }));

  return nested.flat();
}

async function assertDirectory(directory) {
  const stat = await fs.stat(directory).catch(() => null);
  if (!stat?.isDirectory()) {
    throw new Error(`Build-Ausgabe fehlt: ${directory}. Zuerst Astro bauen.`);
  }
}

async function isFile(file) {
  const stat = await fs.stat(file).catch(() => null);
  return Boolean(stat?.isFile());
}

function resolveDistPath(pathname) {
  const resolved = path.resolve(distDir, `.${pathname}`);
  if (resolved !== distDir && !resolved.startsWith(`${distDir}${path.sep}`)) {
    throw new Error(`JPEG-Pfad verlässt dist: ${pathname}`);
  }
  return resolved;
}

function relative(file) {
  return path.relative(projectRoot, file).split(path.sep).join("/");
}

function formatMiB(bytes) {
  return (bytes / 1024 / 1024).toFixed(1);
}
