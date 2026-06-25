import heroImage from "../assets/getting-ready-hamburg/getting_ready_hochzeitsfotograf_hamburg1567-2-scaled.jpg";
import type { ImageMetadata } from "astro";

const imageModules = import.meta.glob("../assets/getting-ready-hamburg/*.jpg", {
  eager: true,
  import: "default",
}) as Record<string, ImageMetadata>;

export const gettingReadyGalleryOrder = [
  "1564", "1530", "1776", "1659", "1664", "1671-2", "1737", "1686",
  "1673", "1675-2", "1759", "1779", "2938", "3470", "2135", "2128-2",
  "2122", "2123", "2027-2", "1885", "3356", "3143-Bearbeitet", "3444",
  "3472", "3356-Bearbeitet", "3248", "2950", "2927", "2921", "2797",
  "3458", "2900", "2898", "2894", "2872", "3000", "2851", "2755-2",
  "2573", "2572", "2507", "2530", "2371", "2349", "2350", "2324",
  "2240", "2221", "2205", "2169", "2098", "2100", "1851", "1837",
  "1829", "1730-Bearbeitet", "2372", "3292", "3098", "3032", "2835",
  "2831", "2772", "2725", "2696", "2643", "2624", "2440", "2465",
  "2397", "2385", "2073", "1931-2", "1929", "1895-2", "1888", "1821",
  "1816", "1820", "1757", "1567-2", "1683", "1243-2", "1349",
];

export const knownGettingReadyAltByStem: Record<string, string> = {
  "1564": "Braut Leoni sitzt mit frisch gelegten Locken beim Getting Ready in Hamburg",
  "1530": "Stylistin formt die Brautfrisur beim Getting Ready in Hamburg",
  "1776": "Lachende Braut in weißer Hochzeitswäsche nach dem Styling",
  "1659": "Stylistin richtet die Locken der Braut am Hochzeitsmorgen",
  "1664": "Natürliches Brautportrait während des Getting Ready in Hamburg",
  "1671-2": "Braut wird durch eine Fensterscheibe beim Make-up fotografiert",
  "1737": "Portrait der geschminkten Braut vor der Hochzeit",
  "1686": "Visagistin schminkt die Braut beim Getting Ready",
  "1673": "Nahaufnahme beim Make-up am Hochzeitsmorgen",
  "1675-2": "Braut wird beim Getting Ready in Hamburg geschminkt",
  "1759": "Brautstyling vor der Hochzeit in Hamburg",
  "1779": "Portrait der Braut während des Getting Ready",
  "2240": "Braut beim Schminken während des Getting Ready",
  "2397": "Visagistin Manija Biebow schminkt eine Braut in Hamburg",
  "2385": "Visagistin und Braut beim gemeinsamen Getting Ready",
  "2073": "Braut nimmt eine Bettdecke auf dem Weg zur Couch",
  "1931-2": "Braut am Hochzeitsmorgen im Bett",
  "1929": "Entspannter Moment der Braut am Hochzeitsmorgen",
  "1895-2": "Natürliches Portrait der Braut im Bett",
  "1888": "Braut beim ruhigen Start in den Hochzeitstag",
  "1821": "Getting Ready für eine Hochzeit in Hamburg",
  "1816": "Braut trinkt am Hochzeitsmorgen Kaffee im Bett",
  "1820": "Portrait der Braut mit Kaffee am Hochzeitsmorgen",
  "1567-2": "Kosmetik und Pinsel der Visagistin beim Getting Ready",
  "1683": "Visagistin begleitet die Braut vor der Hochzeit",
  "1243-2": "Visagistin schminkt eine Braut in Hamburg",
  "1349": "Visagistin gestaltet die Brautfrisur beim Getting Ready",
};

const fallbackAlts = [
  "Braut beim Styling am Hochzeitsmorgen in Hamburg",
  "Natürliches Portrait während der Brautvorbereitung",
  "Detail des Getting Ready vor der Hochzeit",
  "Visagistin begleitet das Brautstyling in Hamburg",
];

const normalizeGalleryStem = (path: string) =>
  (path.split("/").pop() ?? path)
    .replace(/-\d+x\d+(?=\.jpg$)/, "")
    .replace(/-scaled(?=\.jpg$)/, "")
    .replace(/^getting_ready_hochzeitsfotograf_hamburg/, "")
    .replace(/\.jpg$/, "");

const modulesByStem = Object.fromEntries(
  Object.entries(imageModules).map(([path, image]) => [
    normalizeGalleryStem(path),
    image,
  ]),
) as Record<string, ImageMetadata>;

export const gettingReadyHeroImage = heroImage;

export const gettingReadyGalleryImages = gettingReadyGalleryOrder.map((stem, index) => ({
  id: `getting-ready-${stem}`,
  image: modulesByStem[stem],
  alt: knownGettingReadyAltByStem[stem] ?? fallbackAlts[index % fallbackAlts.length],
  aspect: "natural" as const,
  eager: index === 0,
}));

const itemsPerColumn = Math.ceil(gettingReadyGalleryImages.length / 3);

export const gettingReadyGalleryColumns = [
  gettingReadyGalleryImages.slice(0, itemsPerColumn),
  gettingReadyGalleryImages.slice(itemsPerColumn, itemsPerColumn * 2),
  gettingReadyGalleryImages.slice(itemsPerColumn * 2),
];
