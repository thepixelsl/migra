import { googleClient, GoogleAccessError } from "./lib/pricing-google.mjs";

// Read-only unless --apply is explicitly provided. Separate short-lived editor credentials
// from the read-only credentials used by the unattended reporting service.
const propertyId = process.env.PRICING_GA4_PROPERTY_ID;
if (!/^\d+$/.test(propertyId || "")) throw new GoogleAccessError("ga4_property_id_missing");
const apply = process.argv.includes("--apply");
const api = await googleClient(process.env.PRICING_GOOGLE_ADMIN_CREDENTIALS || process.env.PRICING_GOOGLE_CREDENTIALS,
  ["https://www.googleapis.com/auth/analytics.readonly", ...(apply ? ["https://www.googleapis.com/auth/analytics.edit"] : [])]);
const base = `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}`;
async function list(url, field) {
  const all = []; let pageToken;
  do { const result = await api(`${url}${pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : ""}`); all.push(...(result[field] || [])); pageToken = result.nextPageToken; } while (pageToken);
  return all;
}
const dimensions = await list(`${base}/customDimensions`, "customDimensions");
const required = { measurement_page: "Messbereich Preisseite", package_name: "Preispaket", hours: "Begleitungsstunden", contact_channel: "Kontaktkanal", cta_position: "CTA Position" };
for (const [parameterName, displayName] of Object.entries(required)) {
  const exists = dimensions.some(x => x.parameterName === parameterName && x.scope === "EVENT");
  if (!exists && apply) await api(`${base}/customDimensions`, { parameterName, displayName, scope: "EVENT", description: "Preisseitenmessung; ausschließlich definierte Werte, keine Formulardaten." });
  console.log(`${parameterName}: ${exists ? "vorhanden" : apply ? "angelegt" : "fehlt"}`);
}
const keyBase = `https://analyticsadmin.googleapis.com/v1alpha/properties/${propertyId}/keyEvents`;
const keys = await list(keyBase, "keyEvents");
if (!keys.some(x => x.eventName === "generate_lead") && apply) await api(keyBase, { eventName: "generate_lead", countingMethod: "ONCE_PER_EVENT" });
console.log(`generate_lead: ${keys.some(x => x.eventName === "generate_lead") ? "Schlüsselereignis vorhanden" : apply ? "Schlüsselereignis angelegt" : "Schlüsselereignis fehlt"}`);
if (apply) console.log("Anschließend Read-back und Data-API-Metadaten prüfen; neue Dimensionen benötigen Verarbeitungszeit.");
