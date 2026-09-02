import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import { createBunnyRuntime } from "../server/bunny-server.mjs";
import { sanitizeMigratedHtml } from "../scripts/lib/sanitize-migrated-html.mjs";
import { legacyContentRedirect } from "../src/lib/legacyRedirects.mjs";
import worker from "../src/worker.js";

// Independent acceptance list from the approved migration report.
const REDIRECTS = [
  ["/freie-termine/", "/kontakt/"],
  ["/gallery-category/mallorca/", "/gallery/mallorca/"],
  ["/gallery-category/teneriffa/", "/gallery/teneriffa/"],
  ["/preisliste/", "/hochzeitsfotograf-preise/"],
  ["/hochzeitsfotograf-geld-sparen/", "/hochzeitsfotograf-ratgeber/"],
  ["/start/impressum/", "/impressum/"],
  ["/?page_id=13", "/about/"],
  ["/?p=13", "/about/"],
  ["/gallery/hamburg/amp/", "/gallery/hamburg/"],
  ["/gallery/lovebirds-am-elbstrand/amp/", "/gallery/lovebirds-am-elbstrand/"],
  ["/gallery/standesamtliche-trauung-standesamt-altona-hochzeitsfotograf-hamburg/amp/", "/gallery/standesamtliche-trauung-standesamt-altona-hochzeitsfotograf-hamburg/"],
  ["/gallery/steffi-dominik/amp/", "/gallery/steffi-dominik/"],
  ["/gallery/traumhochzeit-in-hamburg/amp/", "/gallery/traumhochzeit-in-hamburg/"],
  ["/gallery/traumhochzeit-in-paris/amp/", "/gallery/traumhochzeit-in-paris/"],
  ["/gallery/venedig/amp/", "/gallery/venedig/"],
  ["/nd-filter-tabelle/amp/", "/nd-filter-tabelle/"],
];

let directory;
let runtime;
let baseUrl;
const production = "https://artbild-fotografie.de";
const productionHeaders = { "X-Forwarded-Host": "artbild-fotografie.de" };

before(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "artbild-legacy-redirects-"));
  const assetDirectory = path.join(directory, "dist");
  const targets = new Set(["/", "/portfolio/", "/datenschutz/", ...REDIRECTS.map(([, target]) => target)]);
  for (const target of targets) {
    const targetDirectory = path.join(assetDirectory, target);
    await mkdir(targetDirectory, { recursive: true });
    await writeFile(path.join(targetDirectory, "index.html"), `<!doctype html><link rel="canonical" href="${production}${target}"><h1>${target}</h1>`);
  }
  await writeFile(path.join(assetDirectory, "404.html"), "<!doctype html><h1>Nicht gefunden</h1>");
  runtime = await createBunnyRuntime({
    assetDirectory,
    contactMailer: async () => { throw new Error("Redirect tests must not send mail"); },
    env: {
      BUNNY_DATABASE_URL: `file:${path.join(directory, "runtime.db")}`,
      DEV_NOINDEX: "false",
    },
  });
  const address = await runtime.listen({ host: "127.0.0.1", port: 0 });
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await runtime?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});

test("all 16 approved legacy URLs redirect once to working canonical destinations", async () => {
  assert.equal(REDIRECTS.length, 16);
  for (const [source, target] of REDIRECTS) {
    for (const method of ["GET", "HEAD"]) {
      const response = await fetch(baseUrl + source, { method, headers: productionHeaders, redirect: "manual" });
      assert.equal(response.status, 301, `${method} ${source}`);
      assert.equal(response.headers.get("location"), production + target, source);
      assert.match(response.headers.get("strict-transport-security"), /max-age=/);
      assert.equal(await response.text(), "");
    }
    const destination = await fetch(baseUrl + target, { headers: productionHeaders, redirect: "manual" });
    assert.equal(destination.status, 200, target);
    assert.equal(destination.headers.has("location"), false, target);
    assert.equal(destination.headers.has("x-robots-tag"), false, target);
    assert.ok((await destination.text()).includes(`href="${production}${target}"`), target);
  }
});

test("approved path aliases handle missing and repeated slashes plus www/http in one hop", async () => {
  for (const [source, target] of REDIRECTS.filter(([source]) => !source.includes("?"))) {
    for (const variant of [source.slice(0, -1), source.replace(/\//g, "//")]) {
      // Exercise the shared worker directly: a Node HTTP server treats // as a
      // network-path reference, unlike the already parsed platform Request URL.
      const response = await worker.fetch(new Request(`http://www.artbild-fotografie.de${variant}?utm_source=legacy`), {}, {});
      assert.equal(response.status, 301, variant);
      assert.equal(response.headers.get("location"), `${production}${target}?utm_source=legacy`, variant);
    }
  }
});

test("query cleanup is limited to matched aliases and preserves other parameters and fragments", () => {
  const original = new URL(`${production}/?page_id=13&wpamp&cookie-state-change=&utm_source=legacy&date=2026-12-20#portrait`);
  const unchanged = original.href;
  const result = legacyContentRedirect(original);
  assert.equal(result.href, `${production}/about/?utm_source=legacy&date=2026-12-20#portrait`);
  assert.equal(original.href, unchanged, "do not mutate the input URL");
  const gallery = legacyContentRedirect(new URL(`${production}/gallery/venedig/amp?amp&category=travel&a=1&a=2#bilder`));
  assert.equal(gallery.href, `${production}/gallery/venedig/?category=travel&a=1&a=2#bilder`);
  assert.equal(legacyContentRedirect(new URL(`${production}/?p=13&page_id=13`)).href, `${production}/about/`);
});

test("unknown or conflicting IDs and existing query functions do not become redirects", async () => {
  for (const source of [
    "/?page_id=999", "/?p=13&p=99", "/?page_id=13&p=99", "/?page_id=13x",
    "/?page_id=", "/?s=hochzeit", "/?wpamp", "/about/?p=13",
    "/portfolio/?category=peoplefotografie", "/portfolio/?cat=travel", "/about/?amp",
    "/api/contact?page_id=13", "/gallery-category/hamburg-travel/", "/gallery/unknown/amp/",
  ]) {
    assert.equal(legacyContentRedirect(new URL(production + source)), null, source);
  }
  for (const source of ["/?page_id=999", "/?page_id=13&p=99", "/portfolio/?category=peoplefotografie"]) {
    const response = await fetch(baseUrl + source, { headers: productionHeaders, redirect: "manual" });
    assert.equal(response.status, 200, source);
    assert.equal(response.headers.has("location"), false, source);
    await response.body?.cancel();
  }
});

test("retired taxonomies, feeds, unapproved archives and downloads remain genuine 404s", async () => {
  for (const source of [
    "/tag/hochzeitsfotograf/", "/gallery-tag/bilder/", "/gallery/traumhochzeit-in-paris/feed/",
    "/gallery-category/hamburg-travel/", "/portfolio/page/2/", "/web-stories/hochzeit-hamburg-mitte/",
    "/wp-content/uploads/2020/05/tfp-vertrag-dsgvo.pdf", "/gallery/unknown/amp/",
  ]) {
    const response = await fetch(baseUrl + source, { headers: productionHeaders, redirect: "manual" });
    assert.equal(response.status, 404, source);
    assert.equal(response.headers.has("location"), false, source);
    await response.body?.cancel();
  }
});

test("legacy redirects do not change POST or API request routing", async () => {
  for (const source of ["/freie-termine/", "/?page_id=13", "/gallery/venedig/amp/"]) {
    let assetRequest;
    const response = await worker.fetch(new Request(production + source, { method: "POST", body: "unchanged" }), {
      ASSETS: { fetch(request) { assetRequest = request; return new Response("method preserved", { status: 405 }); } },
    }, {});
    assert.equal(response.status, 405, source);
    assert.equal(assetRequest.method, "POST");
    assert.equal(await assetRequest.text(), "unchanged");
    assert.equal(response.headers.has("location"), false);
  }
});

test("migrated internal links use the same reviewed targets without changing external links or copy", () => {
  for (const [source, target] of [...REDIRECTS, ["/datenschutzerklaerung/", "/datenschutz/"]]) {
    const separator = source.includes("?") ? "&amp;" : "?";
    const html = sanitizeMigratedHtml(`<p>Bleibt exakt. <a href="https://www.artbild-fotografie.de${source}${separator}utm_source=legacy#ziel">Linktext bleibt.</a></p>`);
    assert.equal(html, `<p>Bleibt exakt. <a href="${target}?utm_source=legacy#ziel">Linktext bleibt.</a></p>`);
  }
  const external = sanitizeMigratedHtml('<a href="https://example.com/preisliste/">Extern</a>');
  assert.match(external, /href="https:\/\/example.com\/preisliste\/"/);
  const activeFilter = sanitizeMigratedHtml('<a href="/portfolio/?category=peoplefotografie">People</a>');
  assert.match(activeFilter, /href="\/portfolio\/\?category=peoplefotografie"/);
});
