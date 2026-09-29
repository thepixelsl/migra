// OpenAI is an independent sink of Artbild's existing consent and event system.
// No SDK request, cookies, or event queue are created before its own consent.
(() => {
  if (window.artbildOpenAIAds) return;
  let config;
  try {
    config = JSON.parse(document.getElementById("artbild-tracking-config")?.textContent || "{}");
  } catch (_) {
    return;
  }
  if (!config.consentEnabled || !config.openaiAdsConfigured || config.environment === "disabled") return;
  const hostname = window.location.hostname.toLowerCase();
  const allowedHost = config.allowedHosts?.some((rule) => (
    rule.startsWith("*.") ? hostname.endsWith(rule.slice(1)) : hostname === rule
  ));
  if (!allowedHost) return;

  let requested = false;
  let failed = false;
  let pageSent = false;
  let leadSent = false;
  let bootstrapQueue;
  const granted = () => window.ArtbildConsent?.services?.openaiAds === true
    && window.artbildConsentApi?.isServiceAllowed?.("openaiAds") === true;

  const measure = (event, type) => {
    if (!granted()) {
      updateConsent();
      return false;
    }
    if (failed || typeof window.oaiq !== "function") return false;
    try {
      // No user object, form values, page URL, wedding date, or monetary value.
      // Account-level automatic advanced matching is separate; see setup report.
      // The consent text combines measurement permission with the visitor's
      // objection to future user-level ad personalization.
      window.oaiq("measure", event, { type }, { opt_out: true });
      return true;
    } catch (_) {
      return false;
    }
  };

  const updateConsent = () => {
    try {
      if (!granted()) {
        // Drop events still waiting for a download when consent is withdrawn.
        if (bootstrapQueue && window.oaiq === bootstrapQueue) bootstrapQueue.q.length = 0;
        if (requested && typeof window.oaiq === "function") window.oaiq("consent", false);
        return;
      }
      if (!requested) {
        requested = true;
        window.__artbildOpenAIAdsRequested = true;
        if (!window.oaiq) {
          bootstrapQueue = function () { bootstrapQueue.q.push(arguments); };
          bootstrapQueue.q = [];
          window.oaiq = bootstrapQueue;
        }
        // Loading is already gated. Grant before init so a stored SDK denial is
        // replaced without deleting an existing, consented attribution cookie.
        window.oaiq("consent", true);
        window.oaiq("init", { pixelId: config.openaiAdsPixelId });
        const script = document.createElement("script");
        script.async = true;
        script.src = "https://bzrcdn.openai.com/sdk/oaiq.min.js";
        script.dataset.artbildProvider = "openai-ads";
        script.onerror = () => {
          failed = true;
          if (bootstrapQueue && window.oaiq === bootstrapQueue) bootstrapQueue.q.length = 0;
          script.remove();
        };
        document.head.appendChild(script);
      } else if (!failed) {
        window.oaiq("consent", true);
      }
      if (!pageSent) pageSent = measure("page_viewed", "contents");
    } catch (_) {
      // Measurement must never block navigation, consent controls, or an inquiry.
      failed = true;
    }
  };

  window.artbildOpenAIAds = {
    updateConsent,
    track(payload) {
      if (
        !leadSent
        && payload?.event === "form_success"
        && payload.form_type === "contact_request"
        && payload.form_id === "kontakt_anfrage_form"
      ) {
        leadSent = measure("lead_created", "customer_action");
      }
    },
  };
  window.addEventListener("artbild:consent_update", updateConsent);
  updateConsent();
})();
