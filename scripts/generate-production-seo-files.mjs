import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { load } from "cheerio";

const DIST_DIRECTORY = path.resolve("dist");
const PRODUCTION_ORIGIN = "https://artbild-fotografie.de";

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(entryPath);
    return entry.isFile() && entry.name === "index.html" ? [entryPath] : [];
  }));
  return files.flat();
}

function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

const canonicalUrls = new Set();
for (const file of await htmlFiles(DIST_DIRECTORY)) {
  const html = await readFile(file, "utf8");
  const $ = load(html);
  const robots = String($("meta[name='robots']").attr("content") || "").toLowerCase();
  if (robots.split(",").some((directive) => directive.trim() === "noindex")) continue;

  const canonical = $("link[rel='canonical']").attr("href");
  if (!canonical) continue;

  const canonicalUrl = new URL(canonical, PRODUCTION_ORIGIN);
  if (canonicalUrl.origin !== PRODUCTION_ORIGIN) continue;
  canonicalUrl.hash = "";
  canonicalUrl.search = "";
  canonicalUrls.add(canonicalUrl.href);
}

const urls = [...canonicalUrls].sort((left, right) => {
  const leftPath = new URL(left).pathname;
  const rightPath = new URL(right).pathname;
  if (leftPath === "/") return -1;
  if (rightPath === "/") return 1;
  return leftPath.localeCompare(rightPath, "de");
});

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map((url) => `  <url><loc>${xmlEscape(url)}</loc></url>`),
  "</urlset>",
  "",
].join("\n");

const sitemapStylesheet = `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet
  version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9"
>
  <xsl:output method="html" encoding="UTF-8" indent="yes" />

  <xsl:template match="/">
    <html lang="de">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>XML-Sitemap | Artbild-Fotografie</title>
        <style>
          :root {
            color-scheme: light;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color: #27302e;
            background: #f4f0eb;
          }

          * { box-sizing: border-box; }

          body {
            margin: 0;
            background: #f4f0eb;
          }

          header {
            padding: clamp(2rem, 7vw, 5rem) clamp(1.25rem, 6vw, 5rem);
            color: #fffaf4;
            background: #26312f;
          }

          .eyebrow {
            margin: 0 0 0.7rem;
            color: #d9b6a2;
            font-size: 0.75rem;
            font-weight: 700;
            letter-spacing: 0.16em;
            text-transform: uppercase;
          }

          h1 {
            margin: 0;
            font-family: Georgia, "Times New Roman", serif;
            font-size: clamp(2rem, 6vw, 4.2rem);
            font-weight: 400;
            line-height: 1.05;
          }

          header p {
            max-width: 44rem;
            margin: 1rem 0 0;
            color: #e8e0d7;
            line-height: 1.65;
          }

          main {
            width: min(72rem, calc(100% - 2rem));
            margin: clamp(1rem, 4vw, 3rem) auto;
          }

          .summary {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            margin-bottom: 1rem;
          }

          .summary p { margin: 0; }

          .count {
            flex: none;
            padding: 0.45rem 0.75rem;
            border-radius: 999px;
            color: #6b3f30;
            background: #ead3c7;
            font-size: 0.85rem;
            font-weight: 700;
          }

          .table-wrap {
            overflow: hidden;
            border: 1px solid #ded6cd;
            border-radius: 0.75rem;
            background: #fff;
            box-shadow: 0 1rem 3rem rgba(50, 40, 33, 0.07);
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          th {
            padding: 0.9rem 1rem;
            color: #fffaf4;
            background: #9b6652;
            font-size: 0.75rem;
            letter-spacing: 0.08em;
            text-align: left;
            text-transform: uppercase;
          }

          th:first-child,
          td:first-child {
            width: 4.5rem;
            text-align: center;
          }

          td {
            padding: 0.85rem 1rem;
            border-top: 1px solid #eee8e2;
            vertical-align: top;
          }

          tbody tr:nth-child(even) { background: #fbf8f5; }
          tbody tr:hover { background: #f3e8e1; }

          a {
            color: #77503f;
            text-decoration-thickness: 1px;
            text-underline-offset: 0.2em;
            overflow-wrap: anywhere;
          }

          a:hover { color: #3e2c24; }

          footer {
            padding: 0 1rem 2.5rem;
            color: #716b65;
            font-size: 0.8rem;
            text-align: center;
          }

          @media (max-width: 640px) {
            main { width: min(100% - 1rem, 72rem); }
            .summary { align-items: flex-start; flex-direction: column; }
            th:first-child,
            td:first-child { width: 3.25rem; }
            th,
            td { padding: 0.75rem 0.65rem; }
          }
        </style>
      </head>
      <body>
        <header>
          <p class="eyebrow">Artbild-Fotografie</p>
          <h1>XML-Sitemap</h1>
          <p>Diese Übersicht enthält alle Seiten, die Suchmaschinen auf der neuen Website entdecken und indexieren dürfen.</p>
        </header>

        <main>
          <div class="summary">
            <p>Die Sitemap wird automatisch aus den indexierbaren kanonischen Seiten erzeugt.</p>
            <span class="count"><xsl:value-of select="count(sm:urlset/sm:url)" /> URLs</span>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Nr.</th>
                  <th scope="col">URL</th>
                </tr>
              </thead>
              <tbody>
                <xsl:for-each select="sm:urlset/sm:url">
                  <xsl:sort select="sm:loc" data-type="text" order="ascending" />
                  <tr>
                    <td><xsl:value-of select="position()" /></td>
                    <td><a href="{sm:loc}"><xsl:value-of select="sm:loc" /></a></td>
                  </tr>
                </xsl:for-each>
              </tbody>
            </table>
          </div>
        </main>

        <footer>Für Suchmaschinen bleibt dies eine standardkonforme XML-Sitemap.</footer>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
`;

const robots = [
  "User-agent: *",
  "Allow: /",
  "Disallow: /admin-login/",
  "Disallow: /admin-termine/",
  "Disallow: /api/admin/",
  `Sitemap: ${PRODUCTION_ORIGIN}/sitemap.xml`,
  "",
].join("\n");

await Promise.all([
  writeFile(path.join(DIST_DIRECTORY, "robots.txt"), robots),
  writeFile(path.join(DIST_DIRECTORY, "sitemap.xml"), sitemap),
  writeFile(path.join(DIST_DIRECTORY, "sitemap.xsl"), sitemapStylesheet),
]);

console.log(`Production SEO files: ${urls.length} indexable canonical URLs.`);
