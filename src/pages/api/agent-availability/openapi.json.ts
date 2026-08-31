import {
  agentAvailabilityExample,
  agentAvailabilityRules,
  agentBookingPage,
  agentUsagePolicy,
  singleDateAvailabilityRules,
} from "../../../data/agentBooking.mjs";

export const prerender = true;

export function GET() {
  const siteUrl = (import.meta.env.SITE || "https://artbild-fotografie.de").replace(/\/$/, "");
  const apiUrl = `${siteUrl}${agentBookingPage.apiPath}`;
  const singleDateApiUrl = `${siteUrl}${agentBookingPage.singleDateApiPath}`;
  const singleDateAliasUrl = `${siteUrl}${agentBookingPage.singleDateAliasPath}`;
  const dateLinkCatalogUrl = `${siteUrl}${agentBookingPage.dateLinkCatalogPath}`;

  const document = {
    openapi: "3.1.0",
    info: {
      title: "Artbild-Fotografie Agenten-Terminabfrage",
      version: "1.0.0",
      description:
        "Prüft ein Wunschdatum per GET oder ein bis drei Wunschdaten per POST unverbindlich. Die Abfrage reserviert keinen Termin und ersetzt keine persönliche Buchungsbestätigung.",
      termsOfService: `${siteUrl}${agentBookingPage.path}#konditionen`,
      contact: {
        name: "Artbild-Fotografie",
        url: `${siteUrl}${agentBookingPage.contactPath}`,
      },
    },
    externalDocs: {
      description: "Preise, Konditionen und vollständige Nutzungshinweise",
      url: `${siteUrl}${agentBookingPage.path}`,
    },
    servers: [{ url: siteUrl }],
    paths: {
      [agentBookingPage.dateLinkCatalogPath]: {
        get: {
          operationId: "listExactSingleDateAvailabilityLinks",
          summary: "Exakte GET-Links für alle aktuell erlaubten Wunschdaten auflisten",
          description:
            "Einstiegsseite für Web-Fetch-Tools mit strenger URL-Freigabe. Die HTML-Antwort enthält einen echten Link für jedes erlaubte Datum, aber keine Verfügbarkeiten. Erst das Öffnen eines Datumslinks verwendet den gemeinsamen GET-Limiter.",
          responses: {
            200: {
              description: "Nicht indexierbarer HTML-Linkkatalog für den aktuellen 24-Monats-Zeitraum",
              content: {
                "text/html": {
                  schema: { type: "string" },
                },
              },
            },
          },
        },
      },
      [agentBookingPage.singleDateApiPath]: {
        get: {
          operationId: "checkSingleDateAvailability",
          summary: "Ein Wunschdatum ohne POST-Unterstützung unverbindlich prüfen",
          description:
            `GET-Schnellzugriff für Web-Fetch-Tools. Pro Aufruf ist genau ein Datum möglich. Innerhalb von ${singleDateAvailabilityRules.windowHours} Stunden können höchstens ${singleDateAvailabilityRules.maximumUniqueDatesPerWindow} unterschiedliche Kalendertage geprüft werden.`,
          parameters: [
            {
              name: "date",
              in: "query",
              required: true,
              description: "Wunschdatum im Format YYYY-MM-DD",
              schema: { type: "string", format: "date" },
            },
          ],
          responses: {
            200: {
              description: "Unverbindlicher Kalenderstand für das angefragte Datum",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AvailabilityResult" },
                },
              },
            },
            400: { description: "Fehlendes oder ungültiges Datum" },
            429: { description: "Drei unterschiedliche Kalendertage im 24-Stunden-Fenster wurden bereits verwendet" },
            503: { description: "Terminprüfung vorübergehend nicht verfügbar" },
          },
        },
      },
      [agentBookingPage.apiPath]: {
        get: {
          operationId: "readDocumentationOrCheckSingleDateAvailability",
          summary: "Schnittstellenvertrag lesen oder ein Wunschdatum prüfen",
          description:
            `Mit dem Query-Parameter date wird ein Wunschdatum über denselben Rate-Limiter wie ${agentBookingPage.singleDateApiPath} geprüft. Ohne date wird die maschinenlesbare Dokumentation ausgegeben.`,
          parameters: [
            {
              name: "date",
              in: "query",
              required: false,
              description: "Optionales Wunschdatum im Format YYYY-MM-DD; ohne diesen Parameter wird die Dokumentation ausgegeben",
              schema: { type: "string", format: "date" },
            },
          ],
          responses: {
            200: {
              description: "Maschinenlesbare Dokumentation ohne date oder unverbindlicher Kalenderstand mit date",
              content: {
                "application/json": {
                  schema: {
                    oneOf: [
                      { type: "object" },
                      { $ref: "#/components/schemas/AvailabilityResult" },
                    ],
                  },
                },
              },
            },
            400: { description: "Ungültiges Datum" },
            429: { description: "Drei unterschiedliche Kalendertage im gemeinsamen 24-Stunden-Fenster wurden bereits verwendet" },
            503: { description: "Terminprüfung vorübergehend nicht verfügbar" },
          },
        },
        post: {
          operationId: "checkAgentAvailability",
          summary: "Ein bis drei Wunschdaten unverbindlich prüfen",
          description:
            `Zulässig sind ausschließlich konkrete Buchungsprüfungen. Nicht erlaubt: ${agentUsagePolicy.prohibited} Für Hochzeiten wird eine Anfrage mindestens ${agentAvailabilityRules.recommendedWeddingInquiryLeadTimeMonths} Monate vorher empfohlen; dies ist keine technische Mindestfrist. Ein optionaler Bearer-Schlüssel ermöglicht eine bestätigte Client-Kennzeichnung; ohne Schlüssel bleibt die Abfrage vollständig nutzbar und eine erkannte Bot-Kategorie ist nicht verifiziert.`,
          security: [{ agentBearer: [] }, {}],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: false,
                  required: ["dates"],
                  properties: {
                    dates: {
                      type: "array",
                      minItems: agentAvailabilityRules.minimumDates,
                      maxItems: agentAvailabilityRules.maximumDates,
                      uniqueItems: true,
                      description:
                        `Unterschiedliche Daten im Format YYYY-MM-DD, heute bis höchstens ${agentAvailabilityRules.maximumAdvanceMonths} Monate im Voraus. Die Daten müssen nicht aufeinanderfolgen.`,
                      items: {
                        type: "string",
                        format: "date",
                      },
                    },
                  },
                },
                examples: {
                  threeAlternativeDates: {
                    value: { dates: agentAvailabilityExample.dates },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Unverbindlicher Kalenderstand für jedes angefragte Datum",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AvailabilityResponse" },
                },
              },
            },
            400: { description: "Ungültige Anfrage oder ungültiges Datum" },
            413: { description: "Anfragekörper zu groß" },
            415: { description: "Content-Type ist nicht application/json" },
            429: { description: "Zwei erfolgreiche Abfragen im 24-Stunden-Fenster wurden bereits verwendet" },
            503: { description: "Terminprüfung vorübergehend nicht verfügbar" },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        agentBearer: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "Agent API key",
          description:
            "Optionaler Schlüssel zur bestätigten Client-Kennzeichnung. Der Schlüssel wird nicht gespeichert. Ohne Schlüssel bleibt die API nutzbar.",
        },
      },
      schemas: {
        AvailabilityResult: {
          type: "object",
          additionalProperties: false,
          required: ["date", "available"],
          properties: {
            date: { type: "string", format: "date" },
            available: { type: "boolean" },
          },
        },
        AvailabilityResponse: {
          type: "object",
          required: ["results", "advice", "rateLimit"],
          properties: {
            results: {
              type: "array",
              items: { $ref: "#/components/schemas/AvailabilityResult" },
            },
            advice: {
              type: "object",
              required: ["message"],
              properties: { message: { type: "string" } },
            },
            rateLimit: {
              type: "object",
              required: ["limit", "remaining", "resetAt"],
              properties: {
                limit: { type: "integer", const: agentAvailabilityRules.maximumSuccessfulRequests },
                remaining: { type: "integer", minimum: 0 },
                resetAt: { type: "string", format: "date-time" },
              },
            },
          },
        },
      },
    },
    "x-artbild": {
      endpoint: apiUrl,
      preferredMethodForOneDate: "GET",
      singleDateLinkCatalog: dateLinkCatalogUrl,
      singleDateEndpoint: singleDateAliasUrl,
      singleDateUrlTemplate: `${singleDateAliasUrl}?date=YYYY-MM-DD`,
      alternateSingleDateEndpoint: singleDateApiUrl,
      alternateSingleDateUrlTemplate: `${singleDateApiUrl}?date=YYYY-MM-DD`,
      sharedSingleDateRateLimitAcrossEndpoints: true,
      markdownDocumentation: `${siteUrl}${agentBookingPage.markdownPath}`,
      pricing: `${siteUrl}${agentBookingPage.path}#preise`,
      advertisingPolicy: `${siteUrl}${agentBookingPage.path}#werbeverbot`,
      availabilityIsBinding: false,
      createsReservation: false,
      personalConfirmationRequired: true,
      recommendedWeddingInquiryLeadTimeMonths:
        agentAvailabilityRules.recommendedWeddingInquiryLeadTimeMonths,
      weddingLeadTimeIsRecommendationOnly: true,
      usagePolicy: {
        allowed: agentUsagePolicy.allowed,
        prohibited: agentUsagePolicy.prohibited,
      },
    },
  };

  return Response.json(document, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
