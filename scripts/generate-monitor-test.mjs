import fs from "node:fs/promises";
import sharp from "sharp";
import { detailTones, fineTones, scaleTones } from "../src/data/monitor-test-tones.mjs";

// Exact neutral sRGB patches, rendered without JPEG compression or decoration.
const canvasWidth = 1600;
const canvasHeight = 1540;
const patches = [];
const fill = value => `rgb(${value},${value},${value})`;
const rect = (x, y, width, height, color) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${color}"/>`;
const text = (x, y, content, size = 24, color = "#171717", extra = "") => `<text x="${x}" y="${y}" fill="${color}" font-family="Arial, sans-serif" font-size="${size}" ${extra}>${content}</text>`;

function patch(x, y, width, height, value) {
  patches.push({ x, y, width, height, value });
  return rect(x, y, width, height, fill(value));
}

function strip(x, y, width, height, values, labelY) {
  // Use the same whole-pixel boundary for the end of each field and the
  // start of the next. Fractional edges can let the lighter surround show.
  const edge = index => x + Math.floor(index * width / values.length);
  return values.map((value, index) => {
    const start = edge(index);
    const end = edge(index + 1);
    const field = patch(start, y, end - start, height, value);
    const label = labelY
      ? text((start + end) / 2, labelY, value, 22, "#171717", 'text-anchor="middle"')
      : "";
    return field + label;
  }).join("");
}

function patchGroup(x, values, background, foreground) {
  let svg = rect(x, 605, 680, 215, background);
  values.forEach((value, i) => {
    const left = x + 34 + i * 128;
    svg += patch(left, 639, 100, 100, value);
    svg += text(left + 50, 785, i + 1, 22, foreground, 'text-anchor="middle"');
  });
  return svg;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">
${rect(0, 0, canvasWidth, canvasHeight, "#b8b8b8")}
${text(100, 94, "ARTBILD · FOTOGRAFIE", 24, "#171717", 'letter-spacing="5"')}
${text(100, 186, "Euer Bildschirm-Check", 62)}
${text(100, 244, "Für die hellen und dunklen Details in euren Hochzeitsfotos.", 28)}
${text(100, 324, "VON SCHWARZ BIS WEISS", 23, "#171717", 'letter-spacing="2"')}
${strip(100, 355, 1400, 124, scaleTones)}
${text(100, 519, "Die elf Stufen sollten voneinander unterscheidbar sein.", 24)}
${text(100, 581, "Dunkle Details · wie im Anzug", 29)}
${text(820, 581, "Helle Details · wie im Brautkleid", 29)}
${patchGroup(100, detailTones.dark, "#000", "#fff")}
${patchGroup(820, detailTones.light, "#fff", "#171717")}
${text(100, 870, "Schaut auf die Flächen, nicht nur auf die Zahlen.", 27)}
${text(100, 914, "Die Felder 2 bis 5 sollten sich vom Hintergrund abheben. Feld 1 ist sehr zart.", 24)}
${text(100, 983, "Feine Details", 34)}
${text(100, 1028, "Welche benachbarten Flächen könnt ihr noch unterscheiden? Die feinsten Stufen können verschmelzen.", 24)}
${text(100, 1082, "Nahe Schwarz", 26)}
${text(820, 1082, "Nahe Weiß", 26)}
${strip(100, 1100, 680, 100, fineTones.dark, 1233)}
${strip(820, 1100, 680, 100, fineTones.light, 1233)}
${text(100, 1305, "Ruhiges Raumlicht · gerade auf das Display schauen · Nacht- und Farbfilter aus", 23)}
${text(100, 1346, "Stellt die Helligkeit so ein, dass Weiß hell wirkt, ohne zu blenden.", 23)}
${text(100, 1417, "Dieser Check ist eine Orientierung. Für eine genaue Kalibrierung braucht ihr ein Messgerät.", 21)}
${text(100, 1454, "artbild-fotografie.de/bildschirm-check/", 21)}
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
