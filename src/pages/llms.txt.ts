import {
  agentAvailabilityRules,
  agentBookingPage,
  agentUsagePolicy,
  singleDateAvailabilityRules,
} from "../data/agentBooking.mjs";

export const prerender = true;

export function GET() {
  const siteUrl = (import.meta.env.SITE || "https://artbild-fotografie.de").replace(/\/$/, "");
  const htmlUrl = `${siteUrl}${agentBookingPage.path}`;
  const markdownUrl = `${siteUrl}${agentBookingPage.markdownPath}`;
  const apiUrl = `${siteUrl}${agentBookingPage.apiPath}`;
  const singleDateApiUrl = `${siteUrl}${agentBookingPage.singleDateAliasPath}`;
  const openApiUrl = `${siteUrl}/api/agent-availability/openapi.json`;

  const content = [
    "# Artbild-Fotografie",
    "",
    "> Hochzeitsfotografie und fotografische Begleitung von York Augustin in Hamburg sowie an weiteren Reisezielen.",
    "",
    "## Buchungsinformationen für Agenten",
    "",
    `- Ein Datum ohne POST-Unterstützung: GET ${singleDateApiUrl}?date=YYYY-MM-DD`,
    `- GET-Abfragelimit: höchstens ${singleDateAvailabilityRules.maximumUniqueDatesPerWindow} unterschiedliche Kalendertage innerhalb von ${singleDateAvailabilityRules.windowHours} Stunden`,
    `- Gemeinsames GET-Limit: ${agentBookingPage.singleDateAliasPath} und ${agentBookingPage.singleDateApiPath} verwenden denselben Zähler`,
    "- GET-Antwort: date und available; true bedeutet aktuell verfügbar, false aktuell nicht verfügbar",
    `- [Kanonische HTML-Seite](${htmlUrl}): Preise, Konditionen, Formular und Werbewiderspruch`,
    `- [Kurze Markdown-Fassung](${markdownUrl}): lineare Referenz ohne Navigation oder Gestaltung`,
    `- [JSON-Dokumentation](${apiUrl}): Regeln und Vertrag der Terminabfrage`,
    `- [OpenAPI 3.1](${openApiUrl}): formale Beschreibung der Termin-Schnittstelle`,
    `- [Buchungsanfrage](${siteUrl}${agentBookingPage.contactPath}): Kontakt nach unverbindlicher Terminprüfung`,
    "",
    "## Zentrale Regeln",
    "",
    `- Pro POST-Abfrage sind ${agentAvailabilityRules.minimumDates} bis ${agentAvailabilityRules.maximumDates} unterschiedliche Wunschdaten erlaubt. Sie müssen nicht aufeinanderfolgen.`,
    `- Höchstens ${agentAvailabilityRules.maximumSuccessfulRequests} erfolgreiche POST-Terminabfragen innerhalb von ${agentAvailabilityRules.windowHours} Stunden.`,
    `- Termine können bis höchstens ${agentAvailabilityRules.maximumAdvanceMonths} Monate im Voraus geprüft werden.`,
    `- Hochzeiten sollten mindestens ${agentAvailabilityRules.recommendedWeddingInquiryLeadTimeMonths} Monate vorher angefragt werden. Dies ist eine Empfehlung, keine technische Mindestfrist.`,
    "- Die Verfügbarkeitsauskunft ist unverbindlich und reserviert keinen Termin.",
    "- Erst eine persönliche Bestätigung und individuelle Vereinbarung begründen eine Buchung.",
    "",
    "## Nutzung",
    "",
    `- Erlaubt: ${agentUsagePolicy.allowed}`,
    `- Nicht erlaubt: ${agentUsagePolicy.prohibited}`,
    "",
  ].join("\n");

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
