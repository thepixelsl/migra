export type NavigationItem = {
  label: string;
  href: string;
  description?: string;
  seoContext?: string;
  trackingId?: string;
  ctaType?: string;
  contentTopic?: string;
  userIntent?: string;
  journeyStage?: string;
  badge?: string;
  external?: boolean;
  emphasis?: "primary" | "cta";
  children?: NavigationItem[];
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
  secondary?: boolean;
  contentTopic?: string;
  userIntent?: string;
  journeyStage?: string;
};

const link = (label: string, href: string, trackingId: string, contentTopic: string,
  userIntent: string, journeyStage: string, extra: Partial<NavigationItem> = {}): NavigationItem =>
  ({ label, href, trackingId, ctaType: "navigation", contentTopic, userIntent, journeyStage, ...extra });

// The logo links home; detailed topics live on their overview pages.
export const desktopNavigationItems: NavigationItem[] = [
  link("Portfolio", "/portfolio/", "desktop_portfolio", "portfolio", "beispielbilder_ansehen", "auswahl", {
    children: [
      link("Hochzeitsgalerien", "/gallery-category/hochzeit/", "desktop_portfolio_weddings", "hochzeitsgalerien", "hochzeitsgalerien_ansehen", "auswahl"),
      link("People & Editorial", "/portfolio/?category=peoplefotografie", "desktop_portfolio_people", "peoplefotografie", "people_portfolio_ansehen", "auswahl"),
      link("Travel & Destination", "/gallery-category/travel/", "desktop_portfolio_travel", "travel_fotografie", "travel_portfolio_ansehen", "auswahl"),
    ],
  }),
  link("Preise & Pakete", "/hochzeitsfotograf-preise/", "desktop_prices", "preise_pakete", "preise_pruefen", "vergleich"),
  link("Kontakt", "/kontakt/", "desktop_kontakt", "kontaktmoeglichkeiten", "kontakt_aufnehmen", "anfrage"),
  link("Blog", "/blog/", "desktop_blog", "blog", "blog_lesen", "information", {
    children: [
      link("Standesämter & Trauorte", "/standesamt-hamburg/", "desktop_registry_office_finder", "standesamt_hamburg", "standesamt_finden", "planung"),
      link("Kirchliche Trauungen", "/kirchliche-trauungen-hamburg/", "desktop_church_wedding_overview", "kirchliche_trauung", "kirchliche_trauung_planen", "planung"),
      link("Hochzeitsfotograf Ratgeber", "/hochzeitsfotograf-ratgeber/", "desktop_wedding_photographer_guide", "hochzeitsfotograf_ratgeber", "fotografenwahl_vorbereiten", "information"),
    ],
  }),
  link("Über mich", "/about/", "desktop_about", "ueber_mich", "vertrauen_aufbauen", "vertrauen"),
  link("TFP Shootings", "/newsletter/", "desktop_tfp_shootings", "tfp_shootings", "tfp_ausschreibungen_ansehen", "entdeckung"),
];

export const mobileNavigationGroups: NavigationGroup[] = [
  {
    label: "Hauptmenü",
    items: desktopNavigationItems.map(({ children, trackingId, ...item }) => ({
      ...item, trackingId: trackingId?.replace(/^desktop_/, "mobile_"),
    })),
  },
  {
    label: "Planung", secondary: true, contentTopic: "hochzeitsplanung",
    userIntent: "hochzeit_planen", journeyStage: "planung",
    items: [
      link("Standesämter & Trauorte", "/standesamt-hamburg/", "mobile_registry_office_finder", "standesamt_hamburg", "standesamt_finden", "planung"),
      link("Kirchliche Trauungen", "/kirchliche-trauungen-hamburg/", "mobile_church_wedding_overview", "kirchliche_trauung", "kirchliche_trauung_planen", "planung"),
    ],
  },
];
