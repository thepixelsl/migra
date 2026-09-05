import { productionTrackingDefaults } from "./trackingDefaults.mjs";

export type TrackingEnvironment = "disabled" | "staging" | "test" | "production";

const requestedEnvironment = String(
  import.meta.env.PUBLIC_TRACKING_ENV ?? productionTrackingDefaults.environment,
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
  ? productionTrackingDefaults.allowedHosts
  : ["127.0.0.1", "localhost"];

const configuredHosts = String(
  import.meta.env.PUBLIC_TRACKING_ALLOWED_HOSTS ?? "",
)
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

const gtmContainerId = String(
  import.meta.env.PUBLIC_GTM_CONTAINER_ID
    || (environment === "production" ? productionTrackingDefaults.gtmContainerId : ""),
).trim();
const googleAnalyticsId = String(
  import.meta.env.PUBLIC_GA4_MEASUREMENT_ID
    || (environment === "production" ? productionTrackingDefaults.googleAnalyticsId : ""),
).trim();
const ga4DataRetentionMonths = String(
  import.meta.env.PUBLIC_GA4_DATA_RETENTION_MONTHS
    || productionTrackingDefaults.ga4DataRetentionMonths,
).trim() === "14" ? 14 : 2;

const googleTrackingConfigured = /^GTM-[A-Z0-9]{4,}$/i.test(gtmContainerId)
  && /^G-[A-Z0-9]{6,}$/i.test(googleAnalyticsId);
const consentEnabled = environment !== "disabled"
  && googleTrackingConfigured;

export const trackingConfig = {
  environment,
  consentEnabled,
  consentVersion: String(
    import.meta.env.PUBLIC_CONSENT_VERSION
      || productionTrackingDefaults.consentVersion,
  ),
  allowedHosts: configuredHosts.length ? configuredHosts : defaultAllowedHosts,
  gtmContainerId,
  googleAnalyticsId,
  googleAnalyticsDelivery: "direct",
  ga4DataRetentionMonths,
  googleTrackingConfigured,
  metaViaTagManager: true,
  clarityViaTagManager: true,
} as const;
