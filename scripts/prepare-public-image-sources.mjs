import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const backupOption = readOption("--backup-dir");
const selection = readOption("--selection") ?? "untracked";
const maxEdge = Number(readOption("--max-edge") ?? 2560);
const quality = Number(readOption("--quality") ?? 88);

if (!backupOption || !path.isAbsolute(backupOption)) {
  throw new Error("--backup-dir muss als absoluter Pfad angegeben werden.");
}

if (!Number.isInteger(maxEdge) || maxEdge < 1200 || maxEdge > 4000) {
  throw new Error("--max-edge muss zwischen 1200 und 4000 Pixeln liegen.");
}

if (!Number.isInteger(quality) || quality < 70 || quality > 95) {
  throw new Error("--quality muss zwischen 70 und 95 liegen.");
}

if (!["untracked", "tracked-sensitive", "public-sensitive"].includes(selection)) {
  throw new Error("--selection muss untracked, tracked-sensitive oder public-sensitive sein.");
}

const repositoryRoot = process.cwd();
const backupRoot = path.resolve(backupOption);
const gitArguments = selection === "untracked"
  ? ["ls-files", "--others", "--exclude-standard", "--", "src/assets"]
  : selection === "tracked-sensitive"
    ? ["ls-files", "--", "src/assets"]
    : ["ls-files", "--cached", "--others", "--exclude-standard", "--", "public"];
const gitResult = spawnSync(
  "git",
  gitArguments,
  { cwd: repositoryRoot, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
);

if (gitResult.status !== 0) {
  throw new Error(gitResult.stderr || "Neue Bildquellen konnten nicht ermittelt werden.");
}

let sourcePaths = gitResult.stdout
  .split("\n")
  .map((value) => value.trim())
  .filter(Boolean)
  .filter((value) => /\.(?:jpe?g|png|webp)$/i.test(value));

if (selection !== "untracked") {
  const sensitivePaths = [];
  for (const relativePath of sourcePaths) {
    const metadata = await sharp(path.join(repositoryRoot, relativePath)).metadata();
    const hasEmbeddedMetadata = Boolean(metadata.exif || metadata.iptc || metadata.xmp);
    const exceedsWebSize = Math.max(metadata.width ?? 0, metadata.height ?? 0) > maxEdge;
    if (hasEmbeddedMetadata || exceedsWebSize) sensitivePaths.push(relativePath);
  }
  sourcePaths = sensitivePaths;
}

if (!sourcePaths.length) {
  console.log("Keine neuen Bildquellen gefunden.");
  process.exit(0);
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function prepareImage(relativePath) {
  if (!relativePath.startsWith("src/assets/") && !relativePath.startsWith("public/")) {
    throw new Error(`Ungültiger Bildpfad: ${relativePath}`);
  }

  const publicPath = path.join(repositoryRoot, relativePath);
  const backupPath = path.join(backupRoot, relativePath);
  const temporaryPath = `${publicPath}.web-source-${process.pid}`;

  await mkdir(path.dirname(backupPath), { recursive: true });

  let original;
  try {
    original = await readFile(backupPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    original = await readFile(publicPath);
    await copyFile(publicPath, backupPath);
  }

  const originalMetadata = await sharp(original).metadata();
  let pipeline = sharp(original)
    .rotate()
    .resize({
      width: maxEdge,
      height: maxEdge,
      fit: "inside",
      withoutEnlargement: true,
    })
    .withIccProfile("srgb");

  if (/\.webp$/i.test(relativePath)) {
    pipeline = pipeline.webp({ quality, effort: 5 });
  } else if (/\.png$/i.test(relativePath)) {
    pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
  } else {
    pipeline = pipeline.jpeg({
      quality,
      progressive: true,
      mozjpeg: true,
      chromaSubsampling: "4:4:4",
    });
  }

  try {
    await pipeline.toFile(temporaryPath);
    const preparedMetadata = await sharp(temporaryPath).metadata();
    const preparedBuffer = await readFile(temporaryPath);

    if (Math.max(preparedMetadata.width ?? 0, preparedMetadata.height ?? 0) > maxEdge) {
      throw new Error(`Webkopie überschreitet ${maxEdge} Pixel: ${relativePath}`);
    }

    await rename(temporaryPath, publicPath);

    return {
      path: relativePath,
      original: {
        bytes: original.length,
        width: originalMetadata.width,
        height: originalMetadata.height,
        sha256: sha256(original),
      },
      prepared: {
        bytes: preparedBuffer.length,
        width: preparedMetadata.width,
        height: preparedMetadata.height,
        sha256: sha256(preparedBuffer),
      },
    };
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

await mkdir(backupRoot, { recursive: true });
const results = [];

for (const [index, relativePath] of sourcePaths.entries()) {
  results.push(await prepareImage(relativePath));
  if ((index + 1) % 10 === 0 || index + 1 === sourcePaths.length) {
    console.log(`${index + 1}/${sourcePaths.length} Webkopien vorbereitet`);
  }
}

const manifestPath = path.join(backupRoot, `manifest-${selection}.json`);
const originalBytes = results.reduce((sum, item) => sum + item.original.bytes, 0);
const preparedBytes = results.reduce((sum, item) => sum + item.prepared.bytes, 0);

await writeFile(
  manifestPath,
  `${JSON.stringify({
    createdAt: new Date().toISOString(),
    repositoryRoot,
    selection,
    maxEdge,
    quality,
    originalBytes,
    preparedBytes,
    images: results,
  }, null, 2)}\n`,
  "utf8",
);

const backupStats = await stat(manifestPath);
console.log(
  `Fertig: ${results.length} Webkopien, ${Math.round(originalBytes / 1024 / 1024)} MiB → ${Math.round(preparedBytes / 1024 / 1024)} MiB.`,
);
console.log(`Originale und Manifest: ${backupRoot} (${backupStats.size} Byte Manifest)`);
