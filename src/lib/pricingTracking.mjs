export const PRICING_PATH = "/hochzeitsfotograf-preise/";
export const PRICING_MEASUREMENT = "hochzeitsfotograf_preise";
export const PRICING_STORAGE_KEY = "artbild_pricing_context_v1";
export const PACKAGE_NAMES = Object.freeze({
  "pure-moments": "pure_moments",
  "standesamt-paket": "standesamt",
  "rundum-sorglos-paket": "rundum_sorglos",
});
const packageValues = new Set(Object.values(PACKAGE_NAMES));
const channels = new Set(["contact_form", "secure_contact", "email", "phone", "whatsapp", "contact_section"]);
const events = new Set(["price_package_view", "price_package_click", "price_calculator_change", "price_contact_click", "generate_lead"]);

// This contract accepts enumerations and bounded numbers, never DOM text or form values.
export function pricingParameters(event, input = {}) {
  if (!events.has(event)) return null;
  const result = { measurement_page: PRICING_MEASUREMENT };
  if (packageValues.has(input.package_name)) result.package_name = input.package_name;
  if (Number.isInteger(input.hours) && input.hours >= 1 && input.hours <= 10) result.hours = input.hours;
  if (channels.has(input.contact_channel)) result.contact_channel = input.contact_channel;
  if (["package_card", "calculator", "example", "hero", "page_bottom", "navigation", "footer", "page"].includes(input.cta_position)) result.cta_position = input.cta_position;
  if (["price_package_view", "price_package_click", "price_calculator_change"].includes(event) && !result.package_name) return null;
  if (event === "price_calculator_change" && !result.hours) return null;
  return result;
}

export function initializePricingTracking(win = window, doc = document) {
  if (![PRICING_PATH, "/kontakt/"].includes(win.location.pathname) || win.__artbildPricingReady) return;
  win.__artbildPricingReady = true;
  const isPricing = win.location.pathname === PRICING_PATH;
  const granted = () => win.artbildConsentApi?.isServiceAllowed?.("googleAnalytics") === true;
  const clear = () => { try { win.sessionStorage.removeItem(PRICING_STORAGE_KEY); } catch {} };
  const read = () => {
    if (!granted()) { clear(); return null; }
    try {
      const value = JSON.parse(win.sessionStorage.getItem(PRICING_STORAGE_KEY));
      if (!value || value.source !== PRICING_MEASUREMENT || !Number.isFinite(value.at)
        || value.at > Date.now() || Date.now() - value.at > 30 * 60 * 1000) { clear(); return null; }
      return { ...pricingParameters("price_contact_click", value), at: value.at,
        pendingClick: value.pendingClick === true && Date.now() - value.at < 15000,
        pendingPackage: value.pendingPackage === true };
    } catch { return null; }
  };
  const save = (input, pendingClick = false, pendingPackage = false, at = Date.now()) => {
    if (!granted()) return false;
    try { win.sessionStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify({
      ...pricingParameters("price_contact_click", input), source: PRICING_MEASUREMENT, at, pendingClick, pendingPackage,
    })); return true; } catch { return false; }
  };
  const emit = (event, input) => {
    if (!granted()) return;
    const params = pricingParameters(event, input);
    if (params) win.artbildTracking?.track?.({ event, ...params });
  };
  // GA4 already derives generate_lead from the site's generic form_success.
  // The existing tracker uses this check to deliver exactly one direct,
  // attributed lead while retaining every non-pricing form's existing rule.
  win.artbildPricingTracking = { hasAttributedContact: () => !isPricing && read()?.contact_channel === "contact_form" };
  let chosen = {};
  const position = link => link.closest(".pricing-package") ? "package_card"
    : link.closest("[data-pricing-calculator]") ? "calculator"
    : link.closest(".pricing-example") ? "example"
    : link.closest(".pricing-hero") ? "hero" : link.closest("#anfrage") ? "page_bottom"
    : link.closest("footer") ? "footer" : link.closest("nav, header") ? "navigation" : "page";
  const channel = link => {
    const raw = link.getAttribute("href") || "";
    if (/^mailto:/i.test(raw)) return "email";
    if (/^tel:/i.test(raw)) return "phone";
    try {
      const url = new URL(raw, win.location.href);
      if (["wa.me", "api.whatsapp.com", "web.whatsapp.com"].includes(url.hostname)) return "whatsapp";
      if (url.origin !== win.location.origin) return undefined;
      if (url.pathname === "/kontakt/") return "contact_form";
      if (url.pathname === "/sicherer-kontakt/") return "secure_contact";
      if (url.pathname === PRICING_PATH && url.hash === "#anfrage") return "contact_section";
    } catch {}
  };
  if (isPricing) {
    // A fresh visit must never inherit an earlier package or a calculator default.
    clear();
    doc.addEventListener("change", event => {
      if (!granted() || !event.target.matches?.("[data-pricing-calculator] select")) return;
      const option = event.target.selectedOptions[0];
      chosen = { package_name: PACKAGE_NAMES[option?.dataset.packageId], hours: Number(option?.value) };
      emit("price_calculator_change", { ...chosen, cta_position: "calculator" });
    });
    doc.addEventListener("click", event => {
      const link = event.target.closest?.("a[href]");
      if (!link || !granted()) return;
      const card = link.closest("[data-pricing-package]");
      const linkedPackage = PACKAGE_NAMES[(link.getAttribute("href") || "").replace(/^#paket-/, "")];
      // Reading a card or the initial calculator output is never an explicit choice.
      const packageName = card?.dataset.pricingPackage || linkedPackage;
      const input = { ...(packageName ? { package_name: packageName } : chosen), cta_position: position(link) };
      if (card && packageName !== chosen.package_name) delete input.hours;
      if (card?.dataset.pricingHours) input.hours = Number(card.dataset.pricingHours);
      const contactChannel = channel(link);
      const nextDocument = contactChannel === "contact_form" && event.button === 0
        && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
        && (!link.target || link.target === "_self") && !link.hasAttribute("download");
      if (packageName) {
        chosen = { package_name: packageName, ...(input.hours ? { hours: input.hours } : {}) };
        if (!nextDocument) emit("price_package_click", input);
      }
      if (!contactChannel) return;
      input.contact_channel = contactChannel;
      const saved = ["contact_form", "secure_contact"].includes(contactChannel) && save(input, nextDocument, Boolean(packageName));
      // The Google SDK batches events. Carry only the bounded click categories
      // into the immediately following contact document so navigation cannot
      // discard the batch. Never send the same click in both documents.
      if (nextDocument && !saved && packageName) emit("price_package_click", input);
      if (!nextDocument || !saved) emit("price_contact_click", input);
    }, { capture: true });
  }
  if (!isPricing) {
    const context = read();
    if (context?.pendingClick) {
      save(context, false, false, context.at);
      if (context.pendingPackage) emit("price_package_click", context);
      emit("price_contact_click", context);
    }
  }
  const viewed = new WeakSet();
  const timers = new Map();
  let observer;
  const stopViews = () => { observer?.disconnect(); observer = undefined; for (const id of timers.values()) win.clearTimeout(id); timers.clear(); };
  const startViews = () => {
    stopViews();
    if (!isPricing || !granted() || doc.visibilityState !== "visible" || !win.IntersectionObserver) return;
    observer = new win.IntersectionObserver(entries => {
      for (const entry of entries) {
        const heading = entry.target;
        if (!entry.isIntersecting || entry.intersectionRatio < 0.5) {
          win.clearTimeout(timers.get(heading)); timers.delete(heading); continue;
        }
        if (viewed.has(heading) || timers.has(heading)) continue;
        timers.set(heading, win.setTimeout(() => {
          timers.delete(heading);
          if (!granted() || doc.visibilityState !== "visible") return;
          viewed.add(heading);
          emit("price_package_view", { package_name: heading.closest("[data-pricing-package]")?.dataset.pricingPackage, cta_position: "package_card" });
          observer?.unobserve(heading);
        }, 1000));
      }
    }, { threshold: [0, 0.5] });
    doc.querySelectorAll("[data-pricing-package] h3").forEach(heading => { if (!viewed.has(heading)) observer.observe(heading); });
  };
  win.addEventListener("artbild:consent_update", () => {
    if (!granted()) { clear(); chosen = {}; }
    startViews();
  });
  doc.addEventListener("visibilitychange", startViews);
  win.addEventListener("pagehide", stopViews);
  const leads = new Set();
  win.addEventListener("artbild:form_success", event => {
    if (isPricing || !granted() || event.detail?.formType !== "contact_request" || event.detail?.formId !== "kontakt_anfrage_form"
      || !/^[a-f0-9-]{36}$/.test(event.detail?.eventId || "") || leads.has(event.detail.eventId)) return;
    const context = read();
    if (!context || context.contact_channel !== "contact_form") return;
    leads.add(event.detail.eventId);
    emit("generate_lead", context);
    clear();
  });
  if (!granted()) clear();
  startViews();
}
