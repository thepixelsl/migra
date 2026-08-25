import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";

const distDirectory = path.resolve("dist");
const trackingSourcePath = path.resolve("src/components/TrackingDataLayer.astro");

const walkHtml = (directory) => fs.readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkHtml(entryPath);
    return entry.name.endsWith(".html") ? [entryPath] : [];
  });

const routeFor = (filePath) => {
  const relative = path.relative(distDirectory, filePath).replaceAll(path.sep, "/");
  if (relative === "index.html") return "/";
  return `/${relative.replace(/index\.html$/, "")}`;
};

const normalizePath = (pathname) => pathname.replace(/\/+$/, "") || "/";

const businessKind = (href) => {
  const normalizedHref = String(href || "").trim();
  if (!normalizedHref || normalizedHref.startsWith("#")) return null;
  if (normalizedHref.toLowerCase().startsWith("mailto:")) return "email";
  if (normalizedHref.toLowerCase().startsWith("tel:")) return "phone";

  let url;
  try {
    url = new URL(normalizedHref, "https://artbild-fotografie.de/");
  } catch {
    return null;
  }

  const pathname = normalizePath(url.pathname);
  const isInternal = ["artbild-fotografie.de", "www.artbild-fotografie.de"].includes(url.hostname);
  if (isInternal && pathname === "/hochzeitsfotograf-preise") return "pricing";
  if (isInternal && pathname === "/kontakt") return "contact";
  if (isInternal && pathname === "/sicherer-kontakt") return "secure_contact";
  if (["wa.me", "api.whatsapp.com", "web.whatsapp.com"].includes(url.hostname)) {
    return "whatsapp";
  }
  return null;
};

if (!fs.existsSync(distDirectory)) {
  console.error("Tracking-Audit: dist fehlt. Bitte zuerst Astro bauen.");
  process.exit(1);
}

const trackingSource = fs.readFileSync(trackingSourcePath, "utf8");
const requiredRuntimeMarkers = [
  "const prepareBusinessLinks",
  'event: "view_pricing"',
  'event: "contact_click"',
  'link.dataset.ctaId = `business_',
];
const missingRuntimeMarkers = requiredRuntimeMarkers.filter(
  (marker) => !trackingSource.includes(marker),
);

const findings = {
  pages: 0,
  businessLinks: 0,
  businessLinksExplicitlyMarked: 0,
  businessLinksPreparedAtRuntime: 0,
  trackedInteractiveElements: 0,
  duplicatePayloads: [],
  privacyViolations: [],
  requiredFormsMissing: [],
};

for (const filePath of walkHtml(distDirectory)) {
  const route = routeFor(filePath);
  if (route === "/404.html" || route === "/404/" || route.startsWith("/admin-termine/")) {
    continue;
  }

  findings.pages += 1;
  const $ = cheerio.load(fs.readFileSync(filePath, "utf8"));

  $("a[href]").each((_, element) => {
    const link = $(element);
    if (!businessKind(link.attr("href"))) return;
    findings.businessLinks += 1;
    if (
      link.is("[data-track-event]")
      || link.is("[data-cta-id]")
      || link.is("[data-resource-id]")
    ) {
      findings.businessLinksExplicitlyMarked += 1;
    } else {
      findings.businessLinksPreparedAtRuntime += 1;
    }
  });

  const signatures = new Map();
  $("a[data-track-event], button[data-track-event], details[data-track-event]").each(
    (_, element) => {
      findings.trackedInteractiveElements += 1;
      const tracked = $(element);
      const signature = [
        tracked.attr("data-track-event"),
        tracked.attr("data-section-id"),
        tracked.attr("data-content-topic"),
        tracked.attr("data-user-intent"),
        tracked.attr("data-journey-stage"),
        tracked.attr("data-cta-id"),
        tracked.attr("data-cta-type"),
        tracked.attr("data-resource-id"),
        tracked.attr("data-resource-type"),
        tracked.attr("data-position"),
        tracked.attr("data-slider-id"),
        tracked.attr("data-slider-action"),
        tracked.attr("data-gallery-action"),
        tracked.attr("data-slider-index"),
        tracked.attr("data-gallery-index"),
        tracked.attr("data-faq-id"),
      ].join("|");
      signatures.set(signature, (signatures.get(signature) || 0) + 1);
    },
  );

  for (const [signature, count] of signatures) {
    if (count > 1) findings.duplicatePayloads.push({ route, count, signature });
  }

  $("input, textarea, select").each((_, element) => {
    const field = $(element);
    if (field.is("[data-track-event], [data-cta-id], [data-resource-id]")) {
      findings.privacyViolations.push({
        route,
        element: element.tagName,
        name: field.attr("name") || field.attr("id") || "unnamed",
      });
    }
  });

  const requiredFormSelectors = [];
  if (route === "/kontakt/") requiredFormSelectors.push("form[data-contact-form]");
  if (route === "/gallery/lovebirds-am-elbstrand/") {
    requiredFormSelectors.push("form.lovebirds-form");
  }
  if (route === "/fuer-agenten/") requiredFormSelectors.push("form.agent-check");

  for (const selector of requiredFormSelectors) {
    const form = $(selector);
    if (
      form.length !== 1
      || !form.is("[data-track-form][data-form-id][data-form-type][data-clarity-mask]")
    ) {
      findings.requiredFormsMissing.push({ route, selector });
    }
  }
}

const failures = missingRuntimeMarkers.length
  + findings.duplicatePayloads.length
  + findings.privacyViolations.length
  + findings.requiredFormsMissing.length;

console.log(`Tracking-Audit: ${findings.pages} öffentliche HTML-Seiten.`);
console.log(
  `Geschäftslinks: ${findings.businessLinks} vollständig abgedeckt `
  + `(${findings.businessLinksExplicitlyMarked} explizit, `
  + `${findings.businessLinksPreparedAtRuntime} zentral vorbereitet).`,
);
console.log(`Explizit getrackte interaktive Elemente: ${findings.trackedInteractiveElements}.`);
console.log(`Doppelte Ereignissignaturen: ${findings.duplicatePayloads.length}.`);
console.log(`Tracking an Eingabefeldern: ${findings.privacyViolations.length}.`);
console.log(`Fehlende Pflichtformular-Kennzeichnungen: ${findings.requiredFormsMissing.length}.`);

if (missingRuntimeMarkers.length) {
  console.error(`Fehlende Laufzeit-Markierungen: ${missingRuntimeMarkers.join(", ")}`);
}
if (findings.duplicatePayloads.length) {
  console.error(JSON.stringify(findings.duplicatePayloads.slice(0, 20), null, 2));
}
if (findings.privacyViolations.length) {
  console.error(JSON.stringify(findings.privacyViolations, null, 2));
}
if (findings.requiredFormsMissing.length) {
  console.error(JSON.stringify(findings.requiredFormsMissing, null, 2));
}

process.exit(failures ? 1 : 0);
