import fs from "node:fs/promises";
import sharp from "sharp";

// Exact neutral sRGB patches, rendered without JPEG compression or decoration.
const steps = [0, 26, 51, 77, 102, 128, 153, 179, 204, 230, 255];
const dark = [8, 16, 24, 32, 48];
const light = [247, 239, 231, 223, 207];
const fill = value => `rgb(${value},${value},${value})`;
const rect = (x, y, width, height, color) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${color}"/>`;
const text = (x, y, content, size = 24, color = "#171717", extra = "") => `<text x="${x}" y="${y}" fill="${color}" font-family="Arial, sans-serif" font-size="${size}" ${extra}>${content}</text>`;
const patchGroup = (x, values, background, foreground) => {
  let svg = rect(x, 605, 680, 215, background);
  values.forEach((value, i) => {
    const left = x + 34 + i * 128;
    svg += rect(left, 639, 100, 100, fill(value));
    svg += text(left + 50, 785, i + 1, 22, foreground, 'text-anchor="middle"');
  });
  return svg;
};
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">
${rect(0, 0, 1600, 1200, "#b8b8b8")}
${text(100, 94, "ARTBILD · FOTOGRAFIE", 24, "#171717", 'letter-spacing="5"')}
${text(100, 186, "Euer Bildschirm-Check", 62)}
${text(100, 244, "Für die hellen und dunklen Details in euren Hochzeitsfotos.", 28)}
${text(100, 324, "VON SCHWARZ BIS WEISS", 23, "#171717", 'letter-spacing="2"')}
${steps.map((value, i) => rect(100 + i * (1400 / 11), 355, 1400 / 11, 124, fill(value))).join("")}
${text(100, 519, "Die elf Stufen sollten voneinander unterscheidbar sein.", 24)}
${text(100, 581, "Dunkle Details · wie im Anzug", 29)}
${text(820, 581, "Helle Details · wie im Brautkleid", 29)}
${patchGroup(100, dark, "#000", "#fff")}
${patchGroup(820, light, "#fff", "#171717")}
${text(100, 870, "Schaut auf die Flächen, nicht nur auf die Zahlen.", 27)}
${text(100, 914, "Die Felder 2 bis 5 sollten sich vom Hintergrund abheben. Feld 1 ist sehr zart.", 24)}
${text(100, 986, "Ruhiges Raumlicht · gerade auf das Display schauen · Nacht- und Farbfilter aus", 23)}
${text(100, 1027, "Helligkeit angenehm einstellen: Weiß soll hell wirken, ohne zu blenden.", 23)}
${text(100, 1102, "Dieser Check ist eine Orientierung. Er misst keine Helligkeit oder Farbtreue", 21)}
${text(100, 1139, "und ersetzt keine Kalibrierung mit einem Messgerät. artbild-fotografie.de/bildschirm-check/", 21)}
</svg>`;
const directory = new URL("../public/downloads/", import.meta.url);
await fs.mkdir(directory, { recursive: true });
const output = new URL("artbild-bildschirm-check.png", directory);
await sharp(Buffer.from(svg)).withIccProfile("srgb").png().toFile(output.pathname);
const { data, info } = await sharp(output.pathname).removeAlpha().raw().toBuffer({ resolveWithObject: true });
for (const [x, y, expected] of [
  ...steps.map((value, i) => [Math.floor(100 + (i + .5) * (1400 / 11)), 400, value]),
  ...dark.map((value, i) => [184 + i * 128, 680, value]),
  ...light.map((value, i) => [904 + i * 128, 680, value]),
]) {
  const offset = (y * info.width + x) * info.channels;
  if (![0, 1, 2].every(channel => data[offset + channel] === expected)) throw new Error(`Test patch changed at ${x}, ${y}`);
}
console.log("Created sRGB PNG; all 21 neutral test patches verified.");
