import fs from "node:fs/promises";
import sharp from "sharp";
import { fineTones, scaleTones } from "../src/data/monitor-test-tones.mjs";

// Exact neutral sRGB patches, rendered without JPEG compression or decoration.
const canvasWidth = 1600;
const canvasHeight = 1110;
const inset = 100;
const stripWidth = canvasWidth - inset * 2;
const stripHeight = 126;
const patches = [];
const fill = value => `rgb(${value},${value},${value})`;
const rect = (x, y, width, height, color) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${color}"/>`;
const text = (x, y, content, size, anchor = "start") => `<text x="${x}" y="${y}" fill="#171717" font-family="Arial, sans-serif" font-size="${size}" text-anchor="${anchor}">${content}</text>`;

function patch(x, y, width, height, value) {
  patches.push({ x, y, width, height, value });
  return rect(x, y, width, height, fill(value));
}

function strip(y, values, showValues = false) {
  // Use the same whole-pixel boundary for the end of each field and the
  // start of the next. Fractional edges can let the lighter surround show.
  const edge = index => inset + Math.floor(index * stripWidth / values.length);
  return values.map((value, index) => {
    const start = edge(index);
    const end = edge(index + 1);
    const field = patch(start, y, end - start, stripHeight, value);
    const label = showValues
      ? text((start + end) / 2, y + stripHeight + 46, value, 36, "middle")
      : "";
    return field + label;
  }).join("");
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">
${rect(0, 0, canvasWidth, canvasHeight, "#b8b8b8")}
${text(inset, 106, "Bildschirm-Check", 64)}
${text(inset, 168, "Schaut gerade auf den Bildschirm und vermeidet Spiegelungen.", 38)}
${text(inset, 215, "Welche Nachbarfelder könnt ihr unterscheiden?", 38)}
${text(inset, 316, "Von Schwarz bis Weiß", 44)}
${strip(342, scaleTones)}
${text(inset, 558, "Nahe Schwarz", 44)}
${strip(584, fineTones.dark, true)}
${text(inset, 846, "Nahe Weiß", 44)}
${strip(872, fineTones.light, true)}
</svg>`;

const directory = new URL("../public/downloads/", import.meta.url);
const output = new URL("artbild-bildschirm-check.png", directory);
const checkOnly = process.argv.includes("--check");
const png = checkOnly
  ? await fs.readFile(output)
  : await sharp(Buffer.from(svg)).withIccProfile("srgb").png().toBuffer();
const { format, width, height, space, icc } = await sharp(png).metadata();
if (format !== "png" || width !== canvasWidth || height !== canvasHeight || space !== "srgb" || !icc?.length) {
  throw new Error("Monitor test PNG has an unexpected format, size or colour profile");
}
const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (const patch of patches) {
  for (let y = patch.y; y < patch.y + patch.height; y++) {
    for (let x = patch.x; x < patch.x + patch.width; x++) {
      const offset = (y * info.width + x) * info.channels;
      if (data[offset] !== patch.value || data[offset + 1] !== patch.value
        || data[offset + 2] !== patch.value || data[offset + 3] !== 255) {
        throw new Error(`Expected opaque RGB ${patch.value} at ${x}, ${y}`);
      }
    }
  }
}
if (!checkOnly) {
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(output, png);
}
console.log(`${checkOnly ? "Checked" : "Created"} sRGB PNG. All ${patches.length} test fields match at every pixel.`);
