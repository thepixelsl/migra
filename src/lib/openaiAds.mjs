// Only confirmed contact submissions reach OpenAI. Its SDK runs in an opaque
// sandbox, never in the document containing the visitor's form fields.
(() => {
  if (window.artbildOpenAIAds) return;
  let config;
  try {
    config = JSON.parse(document.getElementById("artbild-tracking-config")?.textContent || "{}");
  } catch (_) { return; }
  if (!config.consentEnabled || !config.providerRelease?.openaiAds || !config.openaiAdsConfigured || config.environment === "disabled") return;
  const hostname = window.location.hostname.toLowerCase();
  if (!config.allowedHosts?.some(rule => rule.startsWith("*.")
    ? hostname.endsWith(rule.slice(1)) : hostname === rule)) return;

  // Retire identifiers from the former in-page SDK, including domain cookies.
  const domains = ["", ...hostname.split(".").map((_, index, parts) => parts.slice(index).join(".")).filter(value => value.includes("."))];
  for (const domain of domains) {
    document.cookie = `__obref=; Path=/; Max-Age=0; SameSite=Lax${domain ? `; Domain=${domain}` : ""}${location.protocol === "https:" ? "; Secure" : ""}`;
  }

  const frames = new Set();
  const stop = () => {
    for (const frame of frames) {
      frame.contentWindow?.postMessage({ type: "artbild:openai:revoke" }, "*");
      frame.remove();
    }
    frames.clear();
  };
  const sentLeads = new Set();
  let capturedLanding = false;
  const granted = () => window.ArtbildConsent?.services?.openaiAds === true
    && window.artbildConsentApi?.isServiceAllowed?.("openaiAds") === true;
  const attribution = () => {
    try {
      const stored = document.cookie.split("; ").find(value => value.startsWith("__oppref="));
      return stored ? decodeURIComponent(stored.slice("__oppref=".length)) : "";
    } catch (_) { return ""; }
  };
  const updateConsent = () => {
    if (!granted()) {
      // Removing the entire sandbox also discards a pending SDK download/queue.
      stop();
      return;
    }
    if (!capturedLanding) {
      capturedLanding = true;
      // Preserve only the documented advertising reference across site pages.
      // No SDK, page-view event, form listener, or browser identifier is needed.
      const reference = new URL(window.location.href).searchParams.get("oppref");
      if (reference && reference.length <= 2048) {
        document.cookie = `__oppref=${encodeURIComponent(reference)}; Path=/; Max-Age=2592000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
      }
    }
  };
  window.artbildOpenAIAds = {
    updateConsent,
    stop,
    track(payload) {
      if (!granted() || payload?.event !== "form_success"
        || payload.form_type !== "contact_request" || payload.form_id !== "kontakt_anfrage_form"
        || !/^[a-f0-9-]{36}$/.test(payload.event_id || "") || sentLeads.has(payload.event_id)) return;
      try {
        sentLeads.add(payload.event_id);
        updateConsent();
        const url = new URL("/openai-conversion.html", window.location.origin);
        const reference = attribution();
        if (reference && reference.length <= 2048) url.searchParams.set("oppref", reference);
        const frame = document.createElement("iframe");
        frames.add(frame);
        frame.hidden = true;
        frame.title = "Anzeigenmessung";
        frame.dataset.artbildProvider = "openai-ads";
        // Do not add allow-same-origin: the browser must deny parent DOM/storage.
        frame.setAttribute("sandbox", "allow-scripts");
        frame.referrerPolicy = "no-referrer";
        frame.onload = () => {
          if (granted() && frame?.isConnected) {
            // An opaque sandbox requires '*'. The receiver verifies the sender;
            // this message contains only a public pixel ID and a fixed event.
            frame.contentWindow?.postMessage({ type: "artbild:openai:lead", pixelId: config.openaiAdsPixelId }, "*");
          } else updateConsent();
        };
        frame.src = url.href;
        window.__artbildOpenAIAdsRequested = true;
        document.body.appendChild(frame);
      } catch (_) {
        // An inquiry must succeed even when measurement is blocked or fails.
      }
    },
  };
  window.addEventListener("artbild:consent_update", updateConsent);
  updateConsent();
})();
