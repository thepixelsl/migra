import { weddingPackages } from "../data/weddingPackages";
import {
  agentAdvertisingPolicy,
  agentAvailabilityExample,
  agentAvailabilityRules,
  agentBookingPage,
  agentBookingTerms,
  agentInquiryRequirements,
  agentPrivacySummary,
  agentQuickFacts,
  agentUsagePolicy,
  agentWorkflow,
} from "../data/agentBooking.mjs";

export const prerender = true;

function packageMarkdown(item: (typeof weddingPackages)[number]) {
  return [
    `### ${item.name}`,
    "",
    `- Preis: ${item.priceLabel}`,
    `- Dauer: ${item.duration}`,
    "- Leistungsumfang:",
    ...item.features.map((feature) => `  - ${feature}`),
  ].join("\n");
}

export function GET() {
  const siteUrl = (import.meta.env.SITE || "https://artbild-fotografie.de").replace(/\/$/, "");
  const htmlUrl = `${siteUrl}${agentBookingPage.path}`;
  const apiUrl = `${siteUrl}${agentBookingPage.apiPath}`;
  const openApiUrl = `${siteUrl}/api/agent-availability/openapi.json`;
  const contactUrl = `${siteUrl}${agentBookingPage.contactPath}`;
  const privacyUrl = `${siteUrl}${agentBookingPage.privacyPath}`;

  const markdown = [
    `# ${agentBookingPage.headline}`,
    "",
    `> Kanonische HTML-Seite: ${htmlUrl}`,
    "> Sprache: Deutsch",
    `> Stand: ${agentBookingPage.dateModified}`,
    "",
    "Diese Seite ist eine kurze Referenz für konkrete Anfragen zur Buchung fotografischer Leistungen. Sie ist keine Erlaubnis für Werbung oder Akquise.",
    "",
    "## Kurzfassung",
    "",
    ...agentQuickFacts.map(([term, description]) => `- ${term}: ${description}`),
    "",
    "## Vorgehen",
    "",
    ...agentWorkflow.map((step, index) => `${index + 1}. ${step}`),
    "",
    "## Terminprüfung per API",
    "",
    `- Dokumentation: GET ${apiUrl}`,
    `- OpenAPI 3.1: ${openApiUrl}`,
    `- Terminprüfung: POST ${apiUrl}`,
    "- Content-Type: application/json",
    `- Wunschdaten: ${agentAvailabilityRules.minimumDates} bis ${agentAvailabilityRules.maximumDates}`,
    "- Datumsformat: YYYY-MM-DD",
    "- Daten müssen eindeutig sein: Ja",
    "- Daten müssen aufeinanderfolgen: Nein",
    `- Abfragelimit: ${agentAvailabilityRules.maximumSuccessfulRequests} erfolgreiche Abfragen innerhalb von ${agentAvailabilityRules.windowHours} Stunden`,
    `- Prüfzeitraum: heute bis höchstens ${agentAvailabilityRules.maximumAdvanceMonths} Monate im Voraus`,
    "- Ergebnis verbindlich: Nein",
    "- Reservierung durch die Abfrage: Nein",
    "",
    "### Beispielanfrage",
    "",
    "```json",
    JSON.stringify({ dates: agentAvailabilityExample.dates }),
    "```",
    "",
    "### Beispielantwort",
    "",
    "```json",
    JSON.stringify(agentAvailabilityExample.response, null, 2),
    "```",
    "",
    "## Preise",
    "",
    "Preiszusätze wie „ab“, „Festpreis“ und „pro Stunde“ sind Bestandteil der jeweiligen Angabe. Maßgeblich sind das individuelle Angebot und die darin bestätigten Vereinbarungen.",
    "",
    ...weddingPackages.flatMap((item, index) => [
      packageMarkdown(item),
      ...(index < weddingPackages.length - 1 ? [""] : []),
    ]),
    "",
    "## Buchungskonditionen",
    "",
    ...agentBookingTerms.map((term) => `- ${term}`),
    "",
    "## Erforderliche Angaben für eine Buchungsanfrage",
    "",
    ...agentInquiryRequirements.map((requirement) => `- ${requirement}`),
    "",
    `Buchungsanfrage: ${contactUrl}`,
    "",
    "## Erlaubte und nicht erlaubte Nutzung",
    "",
    `- Erlaubt: ${agentUsagePolicy.allowed}`,
    `- Nicht erlaubt: ${agentUsagePolicy.prohibited}`,
    "",
    `## ${agentAdvertisingPolicy.heading}`,
    "",
    ...agentAdvertisingPolicy.paragraphs.flatMap((paragraph) => [paragraph, ""]),
    "Rechtsgrundlagen und Verfahren richten sich nach dem Einzelfall. Siehe insbesondere § 7 UWG und § 13 UWG.",
    "",
    "## Datenschutz",
    "",
    agentPrivacySummary,
    "",
    `Vollständige Hinweise: ${privacyUrl}`,
    "",
  ].join("\n");

  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      Link: `<${htmlUrl}>; rel=\"canonical\", <${apiUrl}>; rel=\"service-doc\"; type=\"application/json\", <${openApiUrl}>; rel=\"service-desc\"; type=\"application/json\"`,
    },
  });
}
