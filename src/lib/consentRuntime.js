/* Runs before any optional provider. Keep this bootstrap free of network I/O. */
(() => {
  if (window.__artbildConsentBootstrapped) return;
  window.__artbildConsentBootstrapped = true;
  let config;
  try { config = JSON.parse(document.getElementById("artbild-tracking-config")?.textContent || "{}"); }
  catch (_) { return; }
  const names = ["googleAnalytics", "googleAds", "microsoftClarity", "metaPixel", "openaiAds"];
  const empty = () => Object.fromEntries([...names, "googleTagManager"].map(name => [name, false]));
  const cookieName = "artbild_consent";
  const lifetime = 180 * 86400;
  const hostname = location.hostname.toLowerCase();
  const secure = location.protocol === "https:" ? "; Secure" : "";
  const hostAllowed = config.allowedHosts?.some(rule => rule.startsWith("*.") ? hostname.endsWith(rule.slice(1)) : hostname === rule);
  const providersEnabled = config.consentEnabled && config.environment !== "disabled" && hostAllowed;
  const configured = name => name === "openaiAds" ? config.openaiAdsConfigured
    : name === "googleAds" ? config.googleAdsConfigured
    : name === "metaPixel" ? /^\d+$/.test(config.metaPixelId || "")
    : name === "microsoftClarity" ? /^[a-z0-9]+$/.test(config.clarityProjectId || "") : config.googleTrackingConfigured;
  const available = name => Boolean(providersEnabled && configured(name) && config.providerRelease?.[name]);
  const readCookie = name => document.cookie.split(";").map(v => v.trim()).find(v => v.startsWith(`${name}=`))?.slice(name.length + 1) || "";
  const normalize = services => {
    const next = Object.fromEntries(names.map(name => [name, services?.[name] === true && available(name)]));
    next.googleTagManager = false;
    return next;
  };
  const readDecision = () => {
    try {
      const decision = JSON.parse(decodeURIComponent(readCookie(cookieName)));
      const timestamp = Date.parse(decision.updatedAt);
      if (decision.version !== config.consentVersion || !Number.isFinite(timestamp)
        || timestamp > Date.now() || Date.now() - timestamp >= lifetime * 1000
        || names.some(name => typeof decision.services?.[name] !== "boolean")
        || (decision.services.openaiAds && decision.openaiPersonalizationOptOut !== true)) return null;
      return { ...decision, services: normalize(decision.services) };
    } catch (_) { return null; }
  };
  const domains = ["", ...hostname.split(".").map((_, i, parts) => parts.slice(i).join(".")).filter(v => v.includes("."))];
  const paths = ["/", ...location.pathname.split("/").map((_, i, parts) => parts.slice(0, i + 1).join("/")).filter(Boolean)];
  const expireCookie = name => {
    for (const domain of domains) for (const path of paths) {
      document.cookie = `${name}=; Path=${path}; Max-Age=0; SameSite=Lax${domain ? `; Domain=${domain}` : ""}${secure}`;
    }
  };
  const prefixes = {
    googleAnalytics: ["_ga", "_gid", "_gat"], googleAds: ["_gcl_", "_gac_"],
    microsoftClarity: ["_clck", "_clsk"], metaPixel: ["_fbp", "_fbc", "lastExternalReferrer"], openaiAds: ["__oppref", "__obref"],
  };
  const clean = state => {
    const revoked = names.filter(name => !state[name]).flatMap(name => prefixes[name]);
    // Retire __obref even when measurement is allowed: opaque frame only.
    revoked.push("__obref");
    document.cookie.split(";").map(v => v.trim().split("=")[0])
      .filter(name => revoked.some(prefix => name.startsWith(prefix))).forEach(expireCookie);
    for (const storageName of ["localStorage", "sessionStorage"]) {
      try {
        const storage = window[storageName];
        Object.keys(storage).filter(key => revoked.some(prefix => key.startsWith(prefix))).forEach(key => storage.removeItem(key));
      } catch (_) {}
    }
  };
  const publicState = (services, hasDecision) => {
    const state = { enabled: Boolean(config.consentEnabled), hasDecision, services: { ...services },
      analytics: services.googleAnalytics, clarity: services.microsoftClarity, marketing: services.metaPixel,
      version: config.consentVersion, mode: "basic" };
    window.ArtbildConsent = window.artbildConsent = state;
    for (const [key, value] of Object.entries({ analytics: state.analytics, marketing: state.marketing,
      clarity: state.clarity, googleTagManager: services.googleTagManager, googleAds: services.googleAds })) {
      document.documentElement.dataset[`${key}Consent`] = value ? "granted" : "denied";
    }
    return state;
  };
  let current = readDecision();
  publicState(current?.services || empty(), Boolean(current));
  clean(window.ArtbildConsent.services);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  const googleConsent = state => ({
    analytics_storage: state.googleAnalytics ? "granted" : "denied",
    ad_storage: state.googleAds ? "granted" : "denied",
    ad_user_data: state.googleAds ? "granted" : "denied",
    ad_personalization: "denied", functionality_storage: "denied",
    personalization_storage: "denied", security_storage: "granted",
  });
  window.gtag("consent", "default", googleConsent(empty()));
  // All privacy controls precede every Google config, including restored choices.
  window.gtag("set", { allow_google_signals: false, allow_ad_personalization_signals: false,
    ads_data_redaction: true, url_passthrough: false });
  const pageLocation = location.origin + location.pathname;
  const referrer = (() => { try { return new URL(document.referrer).origin; } catch (_) { return ""; } })();
  window.gtag("set", { page_location: pageLocation, page_referrer: referrer });
  window.dataLayer.push({ event: "artbild_tracking_config", tracking_environment: config.environment,
    google_analytics_id: config.googleAnalyticsId, google_analytics_delivery: "direct",
    meta_delivery: "direct", clarity_delivery: "direct",
    consent_mode: "basic", consent_version: config.consentVersion });
  let channel;
  try { channel = new BroadcastChannel("artbild-consent"); } catch (_) {}
  const requested = new Set();
  let stopping = false;
  let lastStartedState = "";
  // Clarity records page/referrer URLs independently of DOM masking. Exclude
  // parameterized URLs and pages whose filters alter URLs without navigation.
  const safeClarityUrl = value => {
    if (!value) return true;
    try { const url = new URL(value); return !url.search && !url.hash; } catch (_) { return false; }
  };
  const clarityPageAllowed = safeClarityUrl(location.href) && safeClarityUrl(document.referrer)
    && !/^\/(portfolio|kirchenfinder-hamburg)(\/|$)/.test(location.pathname);
  // Meta reads URLs itself. Only its opaque click ID may accompany a page URL;
  // arbitrary query values, fragments and dynamic filter pages are excluded.
  const safeMetaUrl = value => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return !url.hash && [...url.searchParams].every(([key, value]) =>
        key === "fbclid" && /^[A-Za-z0-9_-]{1,512}$/.test(value));
    } catch (_) { return false; }
  };
  const metaPageAllowed = safeMetaUrl(location.href) && safeMetaUrl(document.referrer)
    && !/^\/(portfolio|kirchenfinder-hamburg)(\/|$)/.test(location.pathname);
  const isAllowed = name => !stopping && readDecision()?.services?.[name] === true
    && (name !== "microsoftClarity" || clarityPageAllowed)
    && (name !== "metaPixel" || (metaPageAllowed && safeMetaUrl(location.href)));
  const stop = () => {
    stopping = true;
    window[`ga-disable-${config.googleAnalyticsId}`] = true;
    window.artbildOpenAIAds?.stop?.();
    if (window.fbq) {
      if (window.fbq.queue) window.fbq.queue.length = 0;
      window.fbq("consent", "revoke");
    }
    // Discard locally queued work. Do not emit new denied/cookieless pings.
    window.dataLayer.length = 0;
    document.querySelectorAll("[data-artbild-provider]").forEach(element => element.remove());
    if (window.oaiq?.q) window.oaiq.q.length = 0;
  };
  const load = (key, src, permitted) => {
    if (stopping || requested.has(key) || !permitted()) return;
    requested.add(key);
    const script = document.createElement("script");
    script.async = true; script.src = src; script.referrerPolicy = "no-referrer";
    script.dataset.artbildProvider = key;
    script.onload = () => { if (!permitted()) sync(); };
    script.onerror = () => { script.remove(); };
    document.head.appendChild(script);
  };
  const emitState = state => {
    window.dataLayer.push({ event: "artbild_consent_update",
      consent_google_tag_manager: state.googleTagManager ? "granted" : "denied",
      consent_analytics: state.googleAnalytics ? "granted" : "denied",
      consent_marketing: state.metaPixel ? "granted" : "denied",
      consent_clarity: state.microsoftClarity ? "granted" : "denied",
      consent_google_analytics: state.googleAnalytics ? "granted" : "denied",
      consent_google_ads: state.googleAds ? "granted" : "denied",
      consent_microsoft_clarity: state.microsoftClarity ? "granted" : "denied",
      consent_meta_pixel: state.metaPixel ? "granted" : "denied",
      consent_openai_ads: state.openaiAds ? "granted" : "denied", consent_mode: "basic" });
  };
  const start = () => {
    if (stopping) return;
    const state = readDecision()?.services || empty();
    window[`ga-disable-${config.googleAnalyticsId}`] = !state.googleAnalytics;
    const signature = JSON.stringify(state);
    if (signature !== lastStartedState) {
      lastStartedState = signature;
      window.gtag("consent", "update", googleConsent(state));
      emitState(state);
    }
    for (const [name, id] of [["googleAnalytics", config.googleAnalyticsId], ["googleAds", config.googleAdsId]]) {
      if (!state[name] || requested.has(name)) continue;
      window.gtag("js", new Date());
      window.gtag("config", id, { send_page_view: name === "googleAnalytics",
        allow_google_signals: false, allow_ad_personalization_signals: false,
        cookie_expires: name === "googleAnalytics" ? lifetime : 90 * 86400,
        cookie_update: false, cookie_flags: `SameSite=Lax${secure ? ";Secure" : ""}`,
        page_location: pageLocation, page_referrer: referrer });
      load(name, `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`, () => isAllowed(name));
    }
    if (isAllowed("microsoftClarity") && !requested.has("microsoft-clarity")) {
      // Mask immediately, including while a stricter project setting propagates.
      document.documentElement.setAttribute("data-clarity-mask", "true");
      window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
      window.clarity("consentv2", { ad_Storage: "denied", analytics_Storage: "granted" });
      load("microsoft-clarity", `https://www.clarity.ms/tag/${config.clarityProjectId}`,
        () => isAllowed("microsoftClarity"));
    }
    if (isAllowed("metaPixel") && !requested.has("meta-pixel")) {
      const fbq = window.fbq = function () {
        if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments);
        else fbq.queue.push(arguments);
      };
      window._fbq = fbq;
      fbq.push = fbq; fbq.loaded = true; fbq.version = "2.0"; fbq.queue = [];
      fbq.disablePushState = true;
      fbq("consent", "grant");
      fbq("set", "autoConfig", false, config.metaPixelId);
      // No advanced matching user data; account-side automatic matching is off.
      fbq("init", config.metaPixelId);
      fbq("trackSingle", config.metaPixelId, "PageView");
      load("meta-pixel", "https://connect.facebook.net/en_US/fbevents.js", () => isAllowed("metaPixel"));
    }
  };
  function sync() {
    if (stopping) return;
    const next = readDecision();
    const services = next?.services || empty();
    const previous = window.ArtbildConsent.services;
    const revoked = names.some(name => previous[name] && !services[name]);
    publicState(services, Boolean(next));
    clean(services);
    current = next;
    if (revoked && (requested.size || window.__artbildOpenAIAdsRequested)) {
      stop();
      // End all loaded SDK execution contexts, also on partial/cross-tab revocation.
      location.reload();
      return;
    }
    window.artbildOpenAIAds?.updateConsent?.();
    if (next) start();
    window.dispatchEvent(new CustomEvent("artbild:consent_update", { detail: { ...window.ArtbildConsent } }));
  }
  function setConsent(request) {
    const old = readDecision()?.services || empty();
    const input = request?.services || request || {};
    const services = normalize(Object.fromEntries(names.map(name => [name,
      typeof input[name] === "boolean" ? input[name] : old[name]])));
    const decision = { version: config.consentVersion, necessary: true, services,
      analytics: services.googleAnalytics, clarity: services.microsoftClarity, marketing: services.metaPixel,
      updatedAt: new Date().toISOString(), openaiPersonalizationOptOut: services.openaiAds };
    document.cookie = `${cookieName}=${encodeURIComponent(JSON.stringify(decision))}; Path=/; Max-Age=${lifetime}; SameSite=Lax${secure}`;
    // Verify persistence: a blocked cookie never grants a tracker.
    sync();
    try { channel?.postMessage("changed"); } catch (_) {}
    try { localStorage.setItem("artbild_consent_signal", decision.updatedAt); localStorage.removeItem("artbild_consent_signal"); } catch (_) {}
    return { ...window.ArtbildConsent };
  }
  window.artbildConsentApi = { getState: () => ({ ...window.ArtbildConsent, services: { ...window.ArtbildConsent.services } }),
    isServiceAllowed: isAllowed, setConsent, sync,
    openSettings: () => window.dispatchEvent(new CustomEvent("artbild:consent_settings_open")) };
  if (channel) channel.onmessage = sync;
  window.addEventListener("storage", event => { if (event.key === "artbild_consent_signal") sync(); });
  window.addEventListener("focus", sync);
  window.addEventListener("pageshow", sync);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") sync(); });
  // Also enforce expiry during a long-lived foreground visit.
  window.setInterval(() => { if (current && !readDecision()) sync(); }, 1000);
  const leads = new Set();
  const successfulLead = payload => payload?.event === "form_success" && payload.form_type === "contact_request"
    && payload.form_id === "kontakt_anfrage_form" && typeof payload.event_id === "string"
    && /^[a-f0-9-]{36}$/.test(payload.event_id);
  window.artbildGoogleAds = { track(payload) {
    if (!successfulLead(payload) || !isAllowed("googleAds") || leads.has(payload.event_id)) return;
    leads.add(payload.event_id);
    window.gtag("event", "conversion", { send_to: `${config.googleAdsId}/${config.googleAdsConversionLabel}`,
      transaction_id: payload.event_id, page_location: pageLocation, page_referrer: referrer });
  } };
  const metaLeads = new Set();
  window.artbildMetaPixel = { track(payload) {
    if (!isAllowed("metaPixel") || typeof window.fbq !== "function") return;
    if (successfulLead(payload)) {
      if (metaLeads.has(payload.event_id)) return;
      metaLeads.add(payload.event_id);
      window.fbq("trackSingle", config.metaPixelId, "Lead", {}, { eventID: payload.event_id });
    }
    else if (payload?.event === "contact_click") window.fbq("trackSingle", config.metaPixelId, "Contact");
    else if (payload?.event === "view_pricing") window.fbq("trackSingle", config.metaPixelId, "ViewContent");
  } };
  if (current) start();
})();
