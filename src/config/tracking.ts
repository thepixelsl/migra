import { productionTrackingDefaults } from "./trackingDefaults.mjs";
import { trackingRelease } from "./trackingRelease.mjs";

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
const openaiAdsPixelId = String(
  import.meta.env.PUBLIC_OPENAI_ADS_PIXEL_ID
    ?? (environment === "production" ? productionTrackingDefaults.openaiAdsPixelId : ""),
).trim();
const openaiAdsConfigured = /^[A-Za-z0-9_-]{8,100}$/.test(openaiAdsPixelId);
const googleAdsId = String(import.meta.env.PUBLIC_GOOGLE_ADS_ID ?? productionTrackingDefaults.googleAdsId).trim();
const googleAdsConversionLabel = String(import.meta.env.PUBLIC_GOOGLE_ADS_CONVERSION_LABEL ?? productionTrackingDefaults.googleAdsConversionLabel).trim();
const googleAdsConfigured = /^AW-\d+$/.test(googleAdsId) && /^[A-Za-z0-9_-]+$/.test(googleAdsConversionLabel);
// Tests exercise the same provider availability as the released build.
const providerRelease = trackingRelease;
const consentEnabled = environment !== "disabled"
  && (googleTrackingConfigured || googleAdsConfigured || openaiAdsConfigured);

export const trackingConfig = {
  environment,
  consentEnabled,
  consentVersion: String(
    environment === "test" ? (import.meta.env.PUBLIC_CONSENT_VERSION || productionTrackingDefaults.consentVersion)
      : productionTrackingDefaults.consentVersion,
  ),
  allowedHosts: configuredHosts.length ? configuredHosts : defaultAllowedHosts,
  gtmContainerId,
  googleAnalyticsId,
  clarityProjectId: productionTrackingDefaults.clarityProjectId,
  metaPixelId: productionTrackingDefaults.metaPixelId,
  googleAdsId,
  googleAdsConversionLabel,
  googleAdsConfigured,
  providerRelease,
  googleAnalyticsDelivery: "direct",
  ga4DataRetentionMonths,
  googleTrackingConfigured,
  openaiAdsPixelId,
  openaiAdsConfigured,
  metaViaTagManager: false,
  clarityViaTagManager: false,
} as const;
