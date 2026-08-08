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
};

const fail = (message) => {
  console.error(`Tracking-Konfiguration ungültig: ${message}`);
  process.exit(1);
};

if (!allowedEnvironments.has(environment)) {
  fail(
    `PUBLIC_TRACKING_ENV muss disabled, staging, test oder production sein; erhalten: ${environment}`,
  );
}

const configuredProviderCount = Object.values(values).filter(Boolean).length;
if (configuredProviderCount > 0 && configuredProviderCount < 3) {
  fail(
    "GTM-Container, GA4-Measurement-ID und Meta-Pixel-ID müssen gemeinsam gesetzt oder gemeinsam leer gelassen werden.",
  );
}

if (configuredProviderCount === 3) {
  if (!/^GTM-[A-Z0-9]{4,}$/i.test(values.gtm)) {
    fail("PUBLIC_GTM_CONTAINER_ID hat nicht das erwartete Format GTM-…");
  }
  if (!/^G-[A-Z0-9]{6,}$/i.test(values.ga4)) {
    fail("PUBLIC_GA4_MEASUREMENT_ID hat nicht das erwartete Format G-…");
  }
  if (!/^\d{5,20}$/.test(values.meta)) {
    fail("PUBLIC_META_PIXEL_ID muss eine fünf- bis zwanzigstellige Zahl sein.");
  }
}

if (environment === "production") {
  if (configuredProviderCount !== 3) {
    fail("Im Production-Modus müssen alle drei Tracking-Kennungen gesetzt sein.");
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
    configuredProviderCount === 3 ? "konfiguriert" : "deaktiviert"
  }.`,
);
