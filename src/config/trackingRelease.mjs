// Release gates are evidence-based, not enabled merely by supplying an ID.
// See docs/tracking-privacy.md for account and transport acceptance.
export const trackingRelease = Object.freeze({
  googleAnalytics: true,
  googleAds: true,
  microsoftClarity: true,
  metaPixel: true,
  openaiAds: true,
});
