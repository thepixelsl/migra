import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
import { businessIdentity, entityIds, photoCredits } from "../src/data/businessSeo.mjs";
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
    assert.equal(photo.creator["@id"], ids.person, page.card.route);
    assert.equal(photo.license, `${origin}/impressum/#copyright-title`);
    assert.equal(photo.acquireLicensePage, `${origin}/kontakt/`);
    assert.match(photo.copyrightNotice, /York Augustin/);
    const business = page.graph.find((node) => node["@id"] === ids.business);
    assert.equal(business.image["@id"], homePhoto["@id"]);
    assert.equal(page.graph.find((node) => node["@id"] === business.image["@id"]).contentUrl, homePhoto.contentUrl);
  }
  const legal = load(await fs.readFile(path.join(dist, "impressum/index.html"), "utf8"));
  assert.match(legal("#copyright-title").parent().text(), /vorherigen schriftlichen Zustimmung/);
});

test("all reviewed image occurrences, including galleries and the confirmed self-portrait, have complete credits", async () => {
  let count = 0;
  const imageUrls = new Set();
  for (const page of pages) {
    for (const photo of page.nodes.filter((node) => [].concat(node["@type"]).includes("ImageObject"))) {
      count++;
      assert.ok(photo.contentUrl, `${page.card.route}: missing image URL`);
      assert.equal(new URL(photo.contentUrl).origin, origin);
      imageUrls.add(photo.contentUrl);
      for (const [key, value] of Object.entries(photoCredits(origin))) {
        assert.deepEqual(photo[key], value, `${page.card.route}: ${photo.contentUrl || photo.url}: ${key}`);
      }
    }
  }
  assert.ok(count >= 1074, "Regression: check nested images, not only primary photos");
  await Promise.all([...imageUrls].map((url) => fs.access(path.join(dist, new URL(url).pathname))));
});

test("gallery credits preserve foreign rights and do not claim arbitrary images or unreviewed galleries", () => {
  const own = { "@type": "ImageObject", contentUrl: `${origin}/_astro/own-photo.webp`, caption: "Unchanged caption", width: 1200 };
  const external = { ...own, contentUrl: "https://example.com/photo.webp" };
  const otherCreator = { ...own, creator: { "@type": "Person", name: "Another photographer" } };
  const otherLicense = { ...own, license: "https://example.com/license" };
  const logo = { ...own, contentUrl: `${origin}/images/partner-logo.png` };
  const fixture = [structuredClone(homePhoto), {
    "@type": "ImageGallery", "@id": `${origin}/gallery/paarshooting-mallorca/#test-gallery`,
    image: [own, external, otherCreator, otherLicense, logo],
  }, {
    "@type": "ImageGallery", url: `${origin}/unreviewed-gallery/`, image: structuredClone(own),
  }, {
    "@type": "ImageGallery", url: `${origin}/gallery/paarshooting-mallorca/`,
    author: { "@type": "Person", name: "Another photographer" }, image: structuredClone(own),
  }, { "@type": "Organization", name: "Partner", logo: structuredClone(own) }];
  const $ = load(`<html><head><link rel="canonical" href="${origin}/"><script type="application/ld+json">${serializeSchema(fixture)}</script></head><body></body></html>`);
  const result = normalizeStructuredData($, "/", { origin, homepageImage: homePhoto, portraitImage: `${origin}/images/portrait-riverside.webp` });
  assert.deepEqual(result[1].image[0], { ...own, ...photoCredits(origin) });
  assert.deepEqual(result[1].image.slice(1), [external, otherCreator, otherLicense, logo]);
  assert.deepEqual(result.slice(2, 5), fixture.slice(2, 5));
});

test("reviewed Hub galleries retain their primary photo, website reference and existing foreign image credits", () => {
  const route='/gallery/paarshooting-mallorca/';
  const own={"@type":"ImageObject",contentUrl:`${origin}/hub-assets/b99f6814-ec77-468e-969a-3ce735527164/photo.webp`,creator:{"@type":"Person",name:"York Augustin"}};
  const foreign={...own,creator:{"@type":"Person",name:"Another photographer"}};
  const fixture=[{...structuredClone(homePhoto),'@id':`${origin}${route}#primaryimage`},{'@type':'ImageGallery','@id':`${origin}${route}#gallery`,url:origin+route,
    author:{'@type':'Person',name:'York Augustin'},publisher:{'@type':'Organization',name:'Artbild-Fotografie',url:origin+'/'},
    primaryImageOfPage:structuredClone(own),hasPart:[structuredClone(own),foreign]}];
  const $=load(`<html><head><link rel="canonical" href="${origin}${route}"><script type="application/ld+json">${serializeSchema(fixture)}</script></head><body></body></html>`);
  const result=normalizeStructuredData($,route,{origin,homepageImage:homePhoto,portraitImage:`${origin}/images/portrait-riverside.webp`});
  const gallery=result.find(node=>node['@type']==='ImageGallery');
  assert.deepEqual(gallery.isPartOf,{'@id':ids.website});assert.deepEqual(gallery.publisher,{'@id':ids.business});
  assert.deepEqual(gallery.primaryImageOfPage.creator,photoCredits(origin).creator);
  assert.equal(gallery.primaryImageOfPage.creditText,photoCredits(origin).creditText);
  assert.equal(gallery.hasPart[0].creditText,photoCredits(origin).creditText);
  assert.deepEqual(gallery.hasPart[1],foreign);
});

test("reviewed gallery category covers receive credits inside portfolio lists without claiming unrelated collections", () => {
  const own = {
    "@type": "ImageObject", contentUrl: `${origin}/_astro/ART_4632.new-build-hash.webp`,
    thumbnailUrl: `${origin}/_astro/ART_4632.responsive-hash.webp`, caption: "Brautpaar mit Schleier", width: 1600,
  };
  const foreignCreator = { ...own, creator: { "@type": "Person", name: "Another photographer" } };
  const foreignLicense = { ...own, license: "https://example.com/license" };
  const external = { ...own, contentUrl: "https://example.com/cover.webp" };
  const logo = { ...own, contentUrl: `${origin}/images/partner-logo.png` };
  const collection = (url, image, extra = {}) => ({
    "@type": "CollectionPage", url, provider: { "@id": ids.business }, image, ...extra,
  });
  const nested = collection(`${origin}/gallery-category/hochzeit/`, [own, foreignCreator, foreignLicense, external, logo]);
  const single = collection(`${origin}/gallery-category/travel/`, own);
  const unreviewed = collection(`${origin}/gallery-category/unreviewed/`, own);
  const unrelated = collection(`${origin}/impressum/`, own);
  const foreignCollection = collection(`${origin}/gallery-category/hochzeit/`, own, { author: { "@type": "Person", name: "Another photographer" } });
  const otherType = { ...single, "@type": "WebPage" };
  const fixture = [structuredClone(homePhoto), {
    "@type": "ItemList", itemListElement: [{ "@type": "ListItem", position: 1, item: nested }],
  }, single, unreviewed, unrelated, foreignCollection, otherType];
  const $ = load(`<html><head><link rel="canonical" href="${origin}/"><script type="application/ld+json">${serializeSchema(fixture)}</script></head><body></body></html>`);
  const result = normalizeStructuredData($, "/", { origin, homepageImage: homePhoto, portraitImage: `${origin}/images/portrait-riverside.webp` });
  assert.deepEqual(result[1].itemListElement[0].item.image[0], { ...own, ...photoCredits(origin) });
  assert.deepEqual(result[1].itemListElement[0].item.image.slice(1), [foreignCreator, foreignLicense, external, logo]);
  assert.deepEqual(result[2].image, { ...own, ...photoCredits(origin) });
  assert.deepEqual(result.slice(3, 7), fixture.slice(3, 7));
  assert.deepEqual(normalizeStructuredData($, "/", { origin, homepageImage: homePhoto, portraitImage: `${origin}/images/portrait-riverside.webp` }), result);
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
