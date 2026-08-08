export type TrackingEnvironment = "disabled" | "staging" | "test" | "production";

const requestedEnvironment = String(
  import.meta.env.PUBLIC_TRACKING_ENV ?? "staging",
).toLowerCase();

const environment: TrackingEnvironment = [
  "disabled",
  "staging",
  "test",
  "production",
].includes(requestedEnvironment)
  ? requestedEnvironment as TrackingEnvironment
  : "disabled";

const defaultAllowedHosts = environment === "production"
  ? ["artbild-fotografie.de", "www.artbild-fotografie.de"]
  : ["127.0.0.1", "localhost"];

const configuredHosts = String(
  import.meta.env.PUBLIC_TRACKING_ALLOWED_HOSTS ?? "",
)
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

const gtmContainerId = String(
  import.meta.env.PUBLIC_GTM_CONTAINER_ID ?? "",
).trim();
const googleAnalyticsId = String(
  import.meta.env.PUBLIC_GA4_MEASUREMENT_ID ?? "",
).trim();
const metaPixelId = String(
  import.meta.env.PUBLIC_META_PIXEL_ID ?? "",
).trim();
const clarityProjectId = String(
  import.meta.env.PUBLIC_CLARITY_PROJECT_ID ?? "",
).trim();
const ga4DataRetentionMonths = String(
  import.meta.env.PUBLIC_GA4_DATA_RETENTION_MONTHS ?? "2",
).trim() === "14" ? 14 : 2;

const googleTrackingConfigured = /^GTM-[A-Z0-9]{4,}$/i.test(gtmContainerId)
  && /^G-[A-Z0-9]{6,}$/i.test(googleAnalyticsId);
const metaTrackingConfigured = /^\d{5,20}$/.test(metaPixelId);
const clarityTrackingConfigured = /^[a-z0-9]{5,32}$/i.test(clarityProjectId);
const consentEnabled = environment !== "disabled"
  && (
    googleTrackingConfigured
    || metaTrackingConfigured
    || clarityTrackingConfigured
  );

export const trackingConfig = {
  environment,
  consentEnabled,
  consentVersion: String(
    import.meta.env.PUBLIC_CONSENT_VERSION ?? "2026-08-08.1",
  ),
  allowedHosts: configuredHosts.length ? configuredHosts : defaultAllowedHosts,
  gtmContainerId,
  googleAnalyticsId,
  metaPixelId,
  clarityProjectId,
  ga4DataRetentionMonths,
  googleTrackingConfigured,
  metaTrackingConfigured,
  clarityTrackingConfigured,
} as const;
