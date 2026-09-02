import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { pageSeo } from "../src/data/pageSeo.mjs";

const directory = "reports/serp-metadata-2026-09-02";
const before = JSON.parse(await fs.readFile(`${directory}/before.json`, "utf8"));
const after = JSON.parse(await fs.readFile(`${directory}/after.json`, "utf8"));
const oldPages = new Map(before.pages.map((p) => [p.route, p]));
const pages = after.pages.filter((p) => p.indexable);
const changed = pages.filter((p) => p.description !== oldPages.get(p.route)?.description);
const titleChanges = pages.filter((p) => p.title !== oldPages.get(p.route)?.title);

assert.equal(before.pages.length, after.pages.length, "Unexpected page creation/deletion");
for (const page of after.pages) {
  const old = oldPages.get(page.route);
  assert.ok(old, page.route);
  assert.equal(page.indexable, old.indexable, `Indexability changed: ${page.route}`);
  assert.equal(page.canonical, old.canonical, `Canonical changed: ${page.route}`);
  assert.equal(page.robots, old.robots, `Robots changed: ${page.route}`);
  // The API documentation intentionally emits a fresh illustrative reset timestamp at build time.
  const normalizeExample = (text) => page.route === "/fuer-agenten/"
    ? text.replace(/"resetAt":\s*"[^\"]+"/g, '"resetAt":"[build-time-example]"') : text;
  assert.equal(normalizeExample(page.text), normalizeExample(old.text), `Visible page copy changed: ${page.route}`);
  assert.deepEqual(page.images, old.images, `Visible page images changed: ${page.route}`);
}

const escape = (s) => String(s || "").replaceAll("|", "\\|").replaceAll("\n", " ");
const lines = [
  "# SERP-Metadaten und Bildauswahl – Artbild-Fotografie", "",
  "Stand: 2. September 2026. Diese Datei dokumentiert den geprüften Build, nicht die von Google tatsächlich ausgewählten Suchergebnisse.", "",
  `- ${pages.length} indexierbare Seiten geprüft; ${changed.length} Meta-Descriptions verbessert, ${pages.length - changed.length} passende Beschreibungen beibehalten.`,
  `- ${titleChanges.length} Seitentitel präzisiert, 56 bevorzugte Hauptbilder ausgezeichnet. Die Startseite behält das ausdrücklich gewählte Mallorca-Kussbild.`,
  "- Vorschaubilder aus vorhandenen Originalaufnahmen; keine KI-Bilder, Screenshots, künstlichen Bewertungen oder vorgetäuschten Aktualisierungen.",
  "- Einzigartige Beschreibungen, konsistente Open-Graph-/Twitter-/WebPage-Angaben, eindeutige ImageObjects und Bilder-Sitemap.",
  "- Footer bleiben sichtbar und bedienbar, liefern aber keine Snippet-Texte. Sichtbare Seitentexte, Bilder, Canonicals, Weiterleitungen und Indexierungsregeln bleiben unverändert.",
  "- Volles Foto als Hauptbild; Social-Vorschauen 1200 × 630. Hochformate und kleine Originale erhalten Platz um das Bild, statt Gesichter abzuschneiden oder Auflösung vorzutäuschen.",
  "- Der Einstiegspreis wird aus dem tatsächlichen Ein-Stunden-Paket der gebauten Preisseite übernommen; der Build stoppt bei unpassend geänderten Konditionen.", "",
  "## Prioritäten aus der Search Console", "",
  "Gelesen am 2. September 2026, drei Monate (1. Juni bis 31. August), Property https://artbild-fotografie.de/.",
  "575 Klicks, 68.300 Impressionen, 0,8 % CTR, durchschnittliche Position 22,5. Dies ist keine vollständige Query-zu-Seite-Auswertung.", "",
  "| Suchanfrage | Klicks | Impressionen |", "|---|---:|---:|",
  "| hochzeitsfotograf hamburg | 4 | 1.925 |",
  "| standesamt hamburg | 4 | 1.834 |",
  "| standesamt hamburg mitte | 4 | 1.709 |",
  "| hochzeitsfotograf preise | 0 | 1.340 |",
  "| ella deck | 1 | 1.203 |",
  "| hochzeitsfotograf kosten | 0 | 907 |",
  "| hochzeitsfotograf hamburg preise | 4 | 900 |",
  "| hochzeitsfotografie preise | 0 | 692 |",
  "| was kostet ein hochzeitsfotograf | 1 | 645 |",
  "| hochzeitsreportage hamburg | 0 | 645 |",
  "| nd-filter tabelle pdf | 64 | 304 |", "",
  "Preis- und Kostenintentionen sowie der vorhandene PDF-Download werden konkreter beantwortet. Der allgemeine kommerzielle Hamburg-Schwerpunkt bleibt auf der Startseite; Ortsgalerien erhalten keine unpassenden Hamburg-Keywords.", "",
  "## Seitenprüfung", "",
  "| Seite | Suchschwerpunkt | Beschreibung | Ergebnis | Titelbild-Original |", "|---|---|---|---|---|",
  ...pages.map((p) => {
    const c = pageSeo[p.route];
    return `| [${escape(p.route)}](${p.canonical}) | ${escape(c.keyword)} | ${escape(p.description)} | ${p.description === oldPages.get(p.route).description ? "Beibehalten" : "Verbessert"} | ${escape(c.image ? path.basename(c.image) : "ART0783-1.jpg (unverändert)")} |`;
  }), "",
  "## Präzisierte Seitentitel", "",
  ...titleChanges.map((p) => `- ${p.route}: ${p.title}`), "",
  "## Grenzen und offene redaktionelle Hinweise", "",
  "Google kann Beschreibungen umschreiben, andere Bilder wählen oder Bildvorschauen auslassen. Eine gute Meta-Description ist vor allem ein Relevanz- und Klickargument, keine Ranking-Garantie. Eigene Unternehmensbewertungen dürfen nicht als selbstvergebene Bewertungssterne ausgezeichnet werden.",
  "Einige ältere Originalbilder sind kleiner als 1200 Pixel. Die Auswahl bleibt authentisch; neue hochauflösende Originale könnten später die technische Bildbasis verbessern.",
  "Der ältere Altona-Landingpage-Text enthält weiterhin einen Corona-/2021-Abschnitt. Der Backup-Artikel enthält ältere technische/rechtliche Aussagen. Diese wurden nicht in neue Snippets übernommen; eine gesonderte inhaltliche Aktualisierung ist sinnvoll. Keine stillschweigende Änderung am vom Nutzer erhaltenen Seitentext.", "",
  "## Google-Dokumentation", "",
  "- [Snippets und data-nosnippet](https://developers.google.com/search/docs/appearance/snippet?hl=de)",
  "- [Bevorzugte Bilder und primaryImageOfPage](https://developers.google.com/search/docs/appearance/google-images)",
  "- [Bilder-Sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps)",
  "- [Richtlinien für strukturierte Daten](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)",
  "- [Spamrichtlinien](https://developers.google.com/search/docs/essentials/spam-policies)", "",
];
await fs.writeFile(`${directory}/audit.md`, lines.join("\n"));
console.log(JSON.stringify({ indexable: pages.length, descriptionsImproved: changed.length,
  descriptionsKept: pages.length - changed.length, titlesImproved: titleChanges.length,
  visibleContentUnchanged: after.pages.length, report: `${directory}/audit.md` }, null, 2));
