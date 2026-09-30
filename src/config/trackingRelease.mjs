// Release gates are evidence-based, not enabled merely by supplying an ID.
// See docs/tracking-privacy.md for account and transport acceptance.
export const trackingRelease = Object.freeze({
  googleAnalytics: false,
  googleAds: false,
  microsoftClarity: false,
  metaPixel: false,
  openaiAds: false,
});
