import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
import { businessIdentity, entityIds } from "../src/data/businessSeo.mjs";
import { packagePriceSchema } from "../src/data/packagePriceSchema.mjs";
import { normalizeStructuredData, readSchemaGraph, schemaNodes, serializeSchema } from "../scripts/lib/structured-data.mjs";

const dist = path.resolve("dist");
const manifest = JSON.parse(await fs.readFile(path.join(dist, "social-cards/manifest.json"), "utf8"));
const origin = new URL(manifest.siteOrigin).origin;
const ids = entityIds(origin);
const pages = await Promise.all(manifest.cards.map(async (card) => {
  const $ = load(await fs.readFile(path.join(dist, card.route, "index.html"), "utf8"));
  const graph = readSchemaGraph($);
  return { card, $, graph, nodes: schemaNodes(graph) };
}));
const home = pages.find((page) => page.card.route === "/");
const homePhoto = home.graph.find((node) => node["@id"] === `${origin}/#primaryimage`);

test("every reviewed page has one consistent, complete local business identity", () => {
  const business = home.graph.find((node) => node["@id"] === ids.business);
  assert.equal(business["@type"], "LocalBusiness");
  assert.deepEqual(business.address, businessIdentity.address);
  assert.deepEqual(business.geo, businessIdentity.geo);
  assert.equal(business.hasMap, businessIdentity.mapsUrl);
  assert.ok(business.sameAs.includes(businessIdentity.mapsUrl));
  for (const page of pages) {
    assert.deepEqual(page.graph.find((node) => node["@id"] === ids.business), business, page.card.route);
    assert.equal(page.nodes.filter((node) => node["@id"] === ids.business).length, 1, page.card.route);
    assert.ok(!page.nodes.some((node) => node["@type"] === "ProfessionalService"), page.card.route);
    assert.equal(business.telephone, undefined, "Do not bypass phone reveal protection");
    assert.equal(business.openingHoursSpecification, undefined, "No unverified hours");
    assert.equal(business.serviceType, undefined, "serviceType belongs to Service");
    assert.doesNotMatch(JSON.stringify(page.graph), /"(?:aggregateRating|reviewRating|ratingValue)"/);
  }
});

test("WebSite is on the homepage and page/author references resolve consistently", () => {
  for (const page of pages) {
    const website = page.graph.find((node) => node["@id"] === ids.website);
    assert.equal(website["@type"], "WebSite");
    assert.equal(website.name, "Artbild-Fotografie");
    assert.equal(website.url, `${origin}/`);
    const person = page.graph.find((node) => node["@id"] === ids.person);
    assert.equal(person.url, `${origin}/about/`);
    assert.equal(person.name, "York Augustin");
    assert.equal(person.worksFor["@id"], ids.business);
    for (const article of page.nodes.filter((node) => ["Article", "BlogPosting"].includes(node["@type"]))) {
      const authors = [].concat(article.author || []);
      assert.ok(authors.some((author) => author["@id"] === ids.person), page.card.route);
      assert.equal(article.publisher["@id"], ids.business);
    }
    for (const webpage of page.graph.filter((node) => node.primaryImageOfPage)) {
      assert.equal(webpage.isPartOf?.["@id"], ids.website, page.card.route);
    }
  }
});

test("primary photos have truthful attribution, existing rights terms and unchanged URLs", async () => {
  for (const page of pages) {
    const photo = page.graph.find((node) => node["@id"] === `${page.card.canonicalUrl}#primaryimage`);
    assert.ok(photo.creditText, page.card.route);
    if (["/about/", "/datenschutz/", "/impressum/", "/kontakt/", "/sicherer-kontakt/"].includes(page.card.route)
      && photo.contentUrl.includes("portrait-riverside")) {
      assert.equal(photo.creator, undefined, "Unknown portrait photographer must not become York");
      assert.equal(photo.license, undefined);
    } else {
      assert.equal(photo.creator["@id"], ids.person, page.card.route);
      assert.equal(photo.license, `${origin}/impressum/#copyright-title`);
      assert.equal(photo.acquireLicensePage, `${origin}/kontakt/`);
      assert.match(photo.copyrightNotice, /York Augustin/);
    }
    const business = page.graph.find((node) => node["@id"] === ids.business);
    assert.equal(business.image["@id"], homePhoto["@id"]);
    assert.equal(page.graph.find((node) => node["@id"] === business.image["@id"]).contentUrl, homePhoto.contentUrl);
  }
  const legal = load(await fs.readFile(path.join(dist, "impressum/index.html"), "utf8"));
  assert.match(legal("#copyright-title").parent().text(), /vorherigen schriftlichen Zustimmung/);
});

test("both price and agent pages model hourly prices and minimum duration, not a false total", () => {
  for (const route of ["/hochzeitsfotograf-preise/", "/fuer-agenten/"]) {
    const page = pages.find((item) => item.card.route === route);
    const offers = page.nodes.filter((node) => node["@type"] === "Offer");
    assert.equal(offers.length, 3);
    const hourly = offers.find((offer) => offer.name === "Rundum-Sorglos-Paket");
    assert.equal(hourly.price, undefined);
    assert.equal(hourly.priceSpecification["@type"], "UnitPriceSpecification");
    assert.equal(hourly.priceSpecification.price, 249);
    assert.equal(hourly.priceSpecification.unitCode, "HUR");
    assert.equal(hourly.priceSpecification.referenceQuantity.value, 1);
    assert.equal(hourly.priceSpecification.billingIncrement, undefined, "No invented hourly rounding rule");
    assert.equal(hourly.eligibleQuantity.minValue, 3);
    assert.equal(hourly.eligibleQuantity.maxValue, 10);
    assert.equal(offers.find((offer) => offer.name === "Pure Moments").price, 299);
    assert.equal(offers.find((offer) => offer.name === "Standesamt Paket").price, 649);
    assert.ok(!page.nodes.some((node) => node.offers?.["@type"] === "OfferCatalog"));
  }
});

test("price schema follows supplied package facts rather than hard-coded prices", () => {
  const result = packagePriceSchema({ billingUnit: "hour", priceValue: 275, minimumHours: 4, maximumHours: 8, priceLabel: "275 € pro Stunde", duration: "4 bis 8 Stunden" });
  assert.equal(result.priceSpecification.price, 275);
  assert.equal(result.eligibleQuantity.minValue, 4);
  assert.equal(result.price, undefined);
});

test("normalization is idempotent and preserves partner entities, locations and visible content", () => {
  for (const page of pages) {
    const before = serializeSchema(page.graph);
    const body = page.$("body").text();
    const thirdParties = page.nodes.filter((node) => ["Hotel", "BeautySalon", "ClothingStore", "GovernmentOffice", "EventVenue"].includes(node["@type"]));
    const after = normalizeStructuredData(page.$, page.card.route, { origin, homepageImage: homePhoto, portraitImage: `${origin}/images/portrait-riverside.webp` });
    assert.equal(serializeSchema(after), before, page.card.route);
    assert.equal(page.$("body").text(), body, page.card.route);
    assert.deepEqual(schemaNodes(after).filter((node) => ["Hotel", "BeautySalon", "ClothingStore", "GovernmentOffice", "EventVenue"].includes(node["@type"])), thirdParties);
  }
});

test("schema serialization cannot close its HTML script element", () => {
  assert.ok(!serializeSchema({ name: '</script><img src=x onerror="alert(1)">' }).includes("<"));
});
