import { loadEnv } from "vite";

const fileEnvironment = loadEnv("production", process.cwd(), "");
const buildEnvironment = {
  ...fileEnvironment,
  ...process.env,
};

const environment = String(
  buildEnvironment.PUBLIC_TRACKING_ENV ?? "staging",
).toLowerCase();

const allowedEnvironments = new Set([
  "disabled",
  "staging",
  "test",
  "production",
]);

const values = {
  gtm: String(buildEnvironment.PUBLIC_GTM_CONTAINER_ID ?? "").trim(),
  ga4: String(buildEnvironment.PUBLIC_GA4_MEASUREMENT_ID ?? "").trim(),
  meta: String(buildEnvironment.PUBLIC_META_PIXEL_ID ?? "").trim(),
  clarity: String(buildEnvironment.PUBLIC_CLARITY_PROJECT_ID ?? "").trim(),
};
const configuredGa4DataRetentionMonths = String(
  buildEnvironment.PUBLIC_GA4_DATA_RETENTION_MONTHS ?? "",
).trim();
const ga4DataRetentionMonths = configuredGa4DataRetentionMonths || "2";

const fail = (message) => {
  console.error(`Tracking-Konfiguration ungültig: ${message}`);
  process.exit(1);
};

if (!allowedEnvironments.has(environment)) {
  fail(
    `PUBLIC_TRACKING_ENV muss disabled, staging, test oder production sein; erhalten: ${environment}`,
  );
}

if (!["2", "14"].includes(ga4DataRetentionMonths)) {
  fail("PUBLIC_GA4_DATA_RETENTION_MONTHS muss 2 oder 14 sein.");
}

if (environment === "production" && !configuredGa4DataRetentionMonths) {
  fail("PUBLIC_GA4_DATA_RETENTION_MONTHS muss im Production-Modus ausdrücklich gesetzt sein.");
}

const configuredProviderCount = Object.values(values).filter(Boolean).length;
if (configuredProviderCount > 0 && configuredProviderCount < 4) {
  fail(
    "GTM-Container, GA4-Measurement-ID, Meta-Pixel-ID und Clarity-Projekt-ID müssen gemeinsam gesetzt oder gemeinsam leer gelassen werden.",
  );
}

if (configuredProviderCount === 4) {
  if (!/^GTM-[A-Z0-9]{4,}$/i.test(values.gtm)) {
    fail("PUBLIC_GTM_CONTAINER_ID hat nicht das erwartete Format GTM-…");
  }
  if (!/^G-[A-Z0-9]{6,}$/i.test(values.ga4)) {
    fail("PUBLIC_GA4_MEASUREMENT_ID hat nicht das erwartete Format G-…");
  }
  if (!/^\d{5,20}$/.test(values.meta)) {
    fail("PUBLIC_META_PIXEL_ID muss eine fünf- bis zwanzigstellige Zahl sein.");
  }
  if (!/^[a-z0-9]{5,32}$/i.test(values.clarity)) {
    fail("PUBLIC_CLARITY_PROJECT_ID muss aus fünf bis 32 Buchstaben oder Zahlen bestehen.");
  }
}

if (environment === "production") {
  if (configuredProviderCount !== 4) {
    fail("Im Production-Modus müssen alle vier Tracking-Kennungen gesetzt sein.");
  }

  const placeholders = /TEST|DEMO|EXAMPLE|PLACEHOLDER|XXXX/i;
  if (Object.values(values).some((value) => placeholders.test(value))) {
    fail("Im Production-Modus sind Test- oder Platzhalter-Kennungen nicht erlaubt.");
  }

  const configuredHosts = String(
    buildEnvironment.PUBLIC_TRACKING_ALLOWED_HOSTS
      ?? "artbild-fotografie.de,www.artbild-fotografie.de",
  )
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  if (
    !configuredHosts.includes("artbild-fotografie.de")
    && !configuredHosts.includes("www.artbild-fotografie.de")
  ) {
    fail(
      "Der Production-Modus muss für artbild-fotografie.de oder www.artbild-fotografie.de freigegeben sein.",
    );
  }
}

console.log(
  `Tracking-Konfiguration: ${environment}, Anbieter ${
    configuredProviderCount === 4 ? "konfiguriert" : "deaktiviert"
  }.`,
);
