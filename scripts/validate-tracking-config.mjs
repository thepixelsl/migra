import { loadEnv } from "vite";
import { productionTrackingDefaults } from "../src/config/trackingDefaults.mjs";

const fileEnvironment = loadEnv("production", process.cwd(), "");
const buildEnvironment = {
  ...fileEnvironment,
  ...process.env,
};

const environment = String(
  buildEnvironment.PUBLIC_TRACKING_ENV || productionTrackingDefaults.environment,
).toLowerCase();

const allowedEnvironments = new Set([
  "disabled",
  "staging",
  "test",
  "production",
]);

const values = {
  gtm: String(
    buildEnvironment.PUBLIC_GTM_CONTAINER_ID
      || (environment === "production" ? productionTrackingDefaults.gtmContainerId : ""),
  ).trim(),
  ga4: String(
    buildEnvironment.PUBLIC_GA4_MEASUREMENT_ID
      || (environment === "production" ? productionTrackingDefaults.googleAnalyticsId : ""),
  ).trim(),
};
const configuredGa4DataRetentionMonths = String(
  buildEnvironment.PUBLIC_GA4_DATA_RETENTION_MONTHS
    || (environment === "production" ? productionTrackingDefaults.ga4DataRetentionMonths : ""),
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

const configuredProviderCount = Object.values(values).filter(Boolean).length;
if (configuredProviderCount === 1) {
  fail(
    "GTM-Container und GA4-Measurement-ID müssen gemeinsam gesetzt oder gemeinsam leer gelassen werden.",
  );
}

if (configuredProviderCount === 2) {
  if (!/^GTM-[A-Z0-9]{4,}$/i.test(values.gtm)) {
    fail("PUBLIC_GTM_CONTAINER_ID hat nicht das erwartete Format GTM-…");
  }
  if (!/^G-[A-Z0-9]{6,}$/i.test(values.ga4)) {
    fail("PUBLIC_GA4_MEASUREMENT_ID hat nicht das erwartete Format G-…");
  }
}

if (environment === "production") {
  if (configuredProviderCount !== 2) {
    fail("Im Production-Modus müssen GTM-Container und GA4-Measurement-ID gesetzt sein.");
  }

  const placeholders = /TEST|DEMO|EXAMPLE|PLACEHOLDER|XXXX/i;
  if (Object.values(values).some((value) => placeholders.test(value))) {
    fail("Im Production-Modus sind Test- oder Platzhalter-Kennungen nicht erlaubt.");
  }

  const configuredHosts = String(
    buildEnvironment.PUBLIC_TRACKING_ALLOWED_HOSTS
      || productionTrackingDefaults.allowedHosts.join(","),
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
    configuredProviderCount === 2 ? "konfiguriert" : "deaktiviert"
  }.`,
);
