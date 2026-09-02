// Explicitly reviewed in the 2026-09-02 WordPress migration audit.
// Do not add catch-all taxonomy, AMP, or WordPress-ID redirects here.
const PATH_REDIRECTS = new Map([
  ["/freie-termine/", "/kontakt/"],
  ["/gallery-category/mallorca/", "/gallery/mallorca/"],
  ["/gallery-category/teneriffa/", "/gallery/teneriffa/"],
  ["/preisliste/", "/hochzeitsfotograf-preise/"],
  ["/hochzeitsfotograf-geld-sparen/", "/hochzeitsfotograf-ratgeber/"],
  ["/start/impressum/", "/impressum/"],
  ["/gallery/hamburg/amp/", "/gallery/hamburg/"],
  ["/gallery/lovebirds-am-elbstrand/amp/", "/gallery/lovebirds-am-elbstrand/"],
  [
    "/gallery/standesamtliche-trauung-standesamt-altona-hochzeitsfotograf-hamburg/amp/",
    "/gallery/standesamtliche-trauung-standesamt-altona-hochzeitsfotograf-hamburg/",
  ],
  ["/gallery/steffi-dominik/amp/", "/gallery/steffi-dominik/"],
  ["/gallery/traumhochzeit-in-hamburg/amp/", "/gallery/traumhochzeit-in-hamburg/"],
  ["/gallery/traumhochzeit-in-paris/amp/", "/gallery/traumhochzeit-in-paris/"],
  ["/gallery/venedig/amp/", "/gallery/venedig/"],
  ["/nd-filter-tabelle/amp/", "/nd-filter-tabelle/"],
  // Existing redirect, also used to keep migrated internal links direct.
  ["/datenschutzerklaerung/", "/datenschutz/"],
]);

/** Return a new same-origin URL for a reviewed legacy alias, or null. */
export function legacyContentRedirect(url) {
  const pathname = url.pathname.replace(/\/{2,}/g, "/");
  const slashPath = pathname.endsWith("/") ? pathname : `${pathname}/`;
  let target = PATH_REDIRECTS.get(slashPath);

  // Only the homepage query form belonged to WordPress. Never interpret an
  // unrelated page/API parameter as a post ID, or guess an unknown post's home.
  const ids = [
    ...url.searchParams.getAll("p"),
    ...url.searchParams.getAll("page_id"),
  ];
  const aboutId = pathname === "/" && ids.length > 0 && ids.every((id) => id === "13");
  if (aboutId) target = "/about/";
  if (!target) return null;

  const destination = new URL(url.href);
  destination.pathname = target;
  if (aboutId) {
    destination.searchParams.delete("p");
    destination.searchParams.delete("page_id");
  }
  // Drop obsolete UI/AMP flags only on a matched legacy redirect. Preserve
  // tracking, dates, current category filters and all other query parameters.
  for (const parameter of ["amp", "wpamp", "cookie-state-change"]) {
    destination.searchParams.delete(parameter);
  }
  return destination;
}
