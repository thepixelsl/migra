import { homepageSeo } from "./homepageSeo.mjs";

/**
 * Central social-card metadata.
 *
 * The project currently uses Astro pages and JSON data rather than one shared
 * frontmatter schema. Route overrides provide the same maintainable data model
 * without duplicating metadata in every page. Values such as `next` are resolved
 * when `npm run build` runs; they are not updated between deployments.
 */
export const socialCardDefaults = {
  siteName: "Artbild-Fotografie",
  brandLine: "YORK AUGUSTIN · HAMBURG",
  defaultImage: "/images/cropped-hochzeitsreportage_hamburg_festpreis-scaled-1.jpg",
  layout: "editorial",
  focalPoint: "center",
  colors: {
    paper: "#f7f4ef",
    ink: "#171717",
    muted: "#6f6a64",
    accent: "#9b6f4f",
    line: "#d8cec3",
  },
};

export const socialCardOverrides = {
  "/": {
    title: homepageSeo.title,
    subtitle: homepageSeo.description,
    // Use the user-selected Mallorca photo from the page's og:image.
    layout: "photo",
    imageAlt: homepageSeo.imageAlt,
    location: "Hamburg",
    label: "Hochzeitsfotografie",
    focalPoint: "top",
  },
  "/trautermin-hamburg-online-reservieren/": {
    title: "Traukalender der Stadt Hamburg",
    subtitle: "Freie Trautermine können für alle Standesämter hamburgweit online reserviert werden.",
    location: "Hamburg",
    label: "Journal",
    pageType: "article",
    focalPoint: "center",
  },
  "/fuer-agenten/": {
    title: "Für Buchungsagenten & KI-Assistenten",
    subtitle: "Preise, Konditionen und Terminprüfung für konkrete Fotoaufträge.",
    location: "Hamburg",
    label: "Buchungsinformationen",
    updated: "2026-08-17",
    focalPoint: "center",
  },
  "/blog/": {
    pageType: "website",
  },
  "/nd-filter-tabelle/": {
    label: "Journal",
    pageType: "article",
  },
  "/standesamt-hamburg/": {
    title: "Standesamtfinder Hamburg",
    subtitle: "Adressen und Kontakte auf einen Blick",
    image: "/migrated-assets/standesamt-hamburg/rathaus-altona.jpg",
    location: "Hamburg",
    label: "Standesamtfinder",
    updated: "2026-07-31",
    focalPoint: "center",
  },
  "/sicherer-kontakt/": {
    title:
      "Sicherer E-Mail-Kontakt für Behörden und Organisationen mit Sicherheitsaufgaben",
    subtitle:
      "Geschützte Informationen nur dann übermitteln, wenn sie wirklich benötigt werden.",
    label: "Vertraulicher Kontakt",
    location: "Hamburg",
    updated: "2026-07-25",
    focalPoint: "center",
  },
};
