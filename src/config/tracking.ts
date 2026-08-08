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

export const trackingConfig = {
  environment,
  consentEnabled: environment !== "disabled",
  consentVersion: String(
    import.meta.env.PUBLIC_CONSENT_VERSION ?? "2026-07-29.1",
  ),
  allowedHosts: configuredHosts.length ? configuredHosts : defaultAllowedHosts,
  gtmContainerId: String(import.meta.env.PUBLIC_GTM_CONTAINER_ID ?? "").trim(),
  googleAnalyticsId: String(
    import.meta.env.PUBLIC_GA4_MEASUREMENT_ID ?? "",
  ).trim(),
  metaPixelId: String(import.meta.env.PUBLIC_META_PIXEL_ID ?? "").trim(),
} as const;
