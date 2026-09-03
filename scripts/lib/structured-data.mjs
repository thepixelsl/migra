import { createIdentityGraph, entityIds, primaryPhotoCredits } from "../../src/data/businessSeo.mjs";
import { pageSeo } from "../../src/data/pageSeo.mjs";
import { isDeepStrictEqual } from "node:util";

const types = (node) => [].concat(node?.["@type"] || []);
const articleTypes = new Set(["Article", "BlogPosting", "NewsArticle"]);
const pageTypes = new Set(["WebPage", "AboutPage", "ContactPage", "CollectionPage", "ProfilePage", "ItemPage"]);
export const serializeSchema = (value) => JSON.stringify(value).replaceAll("<", "\\u003c");

export function readSchemaGraph($) {
  return $("script[type='application/ld+json']").toArray().flatMap((element) => {
    const data = JSON.parse($(element).text());
    return data["@graph"] || (Array.isArray(data) ? data : [data]);
  });
}

export function schemaNodes(value, nodes = []) {
  if (Array.isArray(value)) value.forEach((item) => schemaNodes(item, nodes));
  else if (value && typeof value === "object") {
    if (value["@type"]) nodes.push(value);
    Object.values(value).forEach((item) => schemaNodes(item, nodes));
  }
  return nodes;
}

/** Consolidate only Artbild's identities; preserve venues, partners and content. */
export function normalizeStructuredData($, route, { origin, homepageImage, portraitImage }) {
  if (!pageSeo[route]) throw new Error(`No reviewed schema route: ${route}`);
  const canonical = $("link[rel=canonical]").attr("href");
  if (canonical !== `${origin}${route}`) throw new Error(`Unexpected canonical: ${route}`);
  const ids = entityIds(origin);
  const ownIds = new Set(Object.values(ids));
  const oldGraph = readSchemaGraph($);
  const ref = (id) => ({ "@id": id });
  const ownIdentity = (node) => {
    if (ownIds.has(node["@id"])) return node["@id"];
    if (types(node).includes("Person") && node.name === "York Augustin") return ids.person;
    return null;
  };
  function rewrite(value) {
    if (Array.isArray(value)) return value.map(rewrite);
    if (!value || typeof value !== "object") return value;
    const identity = ownIdentity(value);
    if (identity) return ref(identity);
    const node = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "@context").map(([key, item]) => [key, rewrite(item)]));
    if (types(node).some((type) => pageTypes.has(type)) && (node.url === canonical || node["@id"]?.split("#")[0] === canonical)) {
      node.isPartOf = ref(ids.website);
    }
    if (types(node).some((type) => articleTypes.has(type))) {
      node.publisher = ref(ids.business);
      // Dates, visible headlines and non-Artbild authors remain untouched.
    }
    // Offer ordering is already determined by itemListElement. `position` is
    // not an Offer property (it belongs on ListItem/CreativeWork).
    if (types(node).includes("Offer")) delete node.position;
    return node;
  }
  let graph = oldGraph.filter((node) => !ownIdentity(node)
    && !(route !== "/" && node["@id"] === homepageImage["@id"])).map(rewrite);
  const primary = graph.find((node) => node["@id"] === `${canonical}#primaryimage`);
  if (!primary?.contentUrl) throw new Error(`Primary photo missing: ${route}`);
  const portrait = pageSeo[route].image === "public/images/portrait-riverside.jpg";
  Object.assign(primary, primaryPhotoCredits(origin, { portrait }));

  // All pages refer to the same business image, never to an unrelated venue,
  // legal-page portrait or article illustration as the identity's main photo.
  if (route !== "/") graph.push({ ...homepageImage, ...primaryPhotoCredits(origin) });
  graph.push(...createIdentityGraph(origin, { homepageImage, portraitImage }));
  const seen = new Map();
  graph = graph.filter((node) => {
    const id = node["@id"];
    if (id && seen.has(id)) {
      if (isDeepStrictEqual(seen.get(id), node)) return false;
      throw new Error(`Conflicting top-level schema ID on ${route}: ${id}`);
    }
    if (id) seen.set(id, node);
    return true;
  });
  $("script[type='application/ld+json']").remove();
  $("head").append(`<script type="application/ld+json">${serializeSchema({ "@context": "https://schema.org", "@graph": graph })}</script>`);
  return graph;
}
