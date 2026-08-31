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

export const desktopNavigationItems: NavigationItem[] = [
  {
    label: "Start",
    href: "/",
    seoContext: "Hochzeitsfotograf Hamburg Startseite",
    trackingId: "desktop_start",
    ctaType: "navigation",
    contentTopic: "startseite",
    userIntent: "orientieren",
    journeyStage: "orientierung",
  },
  {
    label: "Portfolio",
    href: "/portfolio/",
    description: "Ausgewählte Hochzeitsreportagen und Shootings",
    seoContext: "Portfolio Hochzeitsfotografie Hamburg",
    trackingId: "desktop_portfolio",
    ctaType: "navigation",
    contentTopic: "portfolio",
    userIntent: "beispielbilder_ansehen",
    journeyStage: "auswahl",
    children: [
      {
        label: "Portfolio Übersicht",
        href: "/portfolio/",
        trackingId: "desktop_portfolio_overview",
        ctaType: "navigation",
        contentTopic: "portfolio",
        userIntent: "beispielbilder_ansehen",
        journeyStage: "auswahl",
      },
      {
        label: "Hochzeitsgalerien",
        href: "/gallery-category/hochzeit/",
        trackingId: "desktop_portfolio_weddings",
        ctaType: "portfolio_category",
        contentTopic: "hochzeitsgalerien",
        userIntent: "hochzeitsgalerien_ansehen",
        journeyStage: "auswahl",
      },
      {
        label: "People & Editorial",
        href: "/portfolio/?category=peoplefotografie",
        trackingId: "desktop_portfolio_people",
        ctaType: "portfolio_filter",
        contentTopic: "peoplefotografie",
        userIntent: "people_portfolio_ansehen",
        journeyStage: "auswahl",
      },
      {
        label: "Travel & Destination",
        href: "/gallery-category/travel/",
        trackingId: "desktop_portfolio_travel",
        ctaType: "portfolio_category",
        contentTopic: "travel_fotografie",
        userIntent: "travel_portfolio_ansehen",
        journeyStage: "auswahl",
      },
    ],
  },
  {
    label: "Kontakt",
    href: "/kontakt/",
    description: "Anfrage und Terminverfügbarkeit",
    seoContext: "Hochzeitsfotograf Hamburg anfragen",
    trackingId: "desktop_kontakt",
    ctaType: "navigation",
    contentTopic: "kontaktmoeglichkeiten",
    userIntent: "kontakt_aufnehmen",
    journeyStage: "anfrage",
    children: [
      {
        label: "Kontakt & Anfrage",
        href: "/kontakt/",
        trackingId: "desktop_contact_request",
        ctaType: "navigation",
        contentTopic: "kontaktmoeglichkeiten",
        userIntent: "kontakt_aufnehmen",
        journeyStage: "anfrage",
      },
      {
        label: "Sicherer Kontakt",
        href: "/sicherer-kontakt/",
        trackingId: "desktop_secure_contact",
        ctaType: "navigation",
        contentTopic: "sicherer_kontakt",
        userIntent: "sicher_kontakt_aufnehmen",
        journeyStage: "anfrage",
      },
      {
        label: "Preise & Pakete",
        href: "/hochzeitsfotograf-preise/",
        trackingId: "desktop_prices",
        ctaType: "navigation",
        contentTopic: "preise_pakete",
        userIntent: "preise_pruefen",
        journeyStage: "vergleich",
      },
    ],
  },
  {
    label: "Planung",
    href: "/blog/",
    description: "Standesämter, Trautermine und Hochzeitsratgeber",
    seoContext: "Hochzeitsratgeber Hamburg",
    trackingId: "desktop_planning",
    ctaType: "navigation",
    contentTopic: "hochzeitsplanung",
    userIntent: "hochzeit_planen",
    journeyStage: "planung",
    children: [
      {
        label: "Planung & Ratgeber",
        href: "/blog/",
        trackingId: "desktop_planning_overview",
        ctaType: "navigation",
        contentTopic: "hochzeitsratgeber",
        userIntent: "ratgeber_lesen",
        journeyStage: "information",
      },
      {
        label: "Standesämter & Trauorte",
        href: "/standesamt-hamburg/",
        trackingId: "desktop_registry_office_finder",
        ctaType: "navigation",
        contentTopic: "standesamt_hamburg",
        userIntent: "standesamt_finden",
        journeyStage: "planung",
      },
      {
        label: "Trautermin Hamburg",
        href: "/trautermin-hamburg-online-reservieren/",
        trackingId: "desktop_ceremony_date_hamburg",
        ctaType: "navigation",
        contentTopic: "trautermin_hamburg",
        userIntent: "trautermin_planen",
        journeyStage: "planung",
      },
      {
        label: "Hochzeitsfotograf Ratgeber",
        href: "/hochzeitsfotograf-ratgeber/",
        trackingId: "desktop_wedding_photographer_guide",
        ctaType: "navigation",
        contentTopic: "hochzeitsfotograf_ratgeber",
        userIntent: "fotografenwahl_vorbereiten",
        journeyStage: "information",
      },
    ],
  },
  {
    label: "Über mich",
    href: "/about/",
    description: "Über York Augustin, Hochzeitsfotograf aus Hamburg",
    seoContext: "Hochzeitsfotograf Hamburg York Augustin",
    trackingId: "desktop_about",
    ctaType: "navigation",
    contentTopic: "ueber_mich",
    userIntent: "vertrauen_aufbauen",
    journeyStage: "vertrauen",
    children: [
      {
        label: "Über York Augustin",
        href: "/about/",
        trackingId: "desktop_about_york",
        ctaType: "navigation",
        contentTopic: "ueber_mich",
        userIntent: "vertrauen_aufbauen",
        journeyStage: "vertrauen",
      },
      {
        label: "Impressum",
        href: "/impressum/",
        trackingId: "desktop_legal_notice",
        ctaType: "navigation",
        contentTopic: "impressum",
        userIntent: "anbieterinformationen_lesen",
        journeyStage: "vertrauen",
      },
      {
        label: "Datenschutz",
        href: "/datenschutz/",
        trackingId: "desktop_privacy",
        ctaType: "navigation",
        contentTopic: "datenschutz",
        userIntent: "datenschutz_lesen",
        journeyStage: "vertrauen",
      },
    ],
  },
  {
    label: "TFP Shootings",
    href: "/newsletter/",
    description: "Aktuelle TFP-Ausschreibungen von Artbild-Fotografie",
    trackingId: "desktop_tfp_shootings",
    ctaType: "navigation",
    contentTopic: "tfp_shootings",
    userIntent: "tfp_ausschreibungen_ansehen",
    journeyStage: "entdeckung",
  },
];

export const mobileNavigationGroups: NavigationGroup[] = [
  {
    label: "Hauptmenü",
    items: [
      {
        label: "Start",
        href: "/",
        trackingId: "mobile_start",
        ctaType: "navigation",
        contentTopic: "startseite",
        userIntent: "orientieren",
        journeyStage: "orientierung",
      },
      {
        label: "Portfolio",
        href: "/portfolio/",
        emphasis: "primary",
        trackingId: "mobile_portfolio",
        ctaType: "navigation",
        contentTopic: "portfolio",
        userIntent: "beispielbilder_ansehen",
        journeyStage: "auswahl",
      },
      {
        label: "Preise & Pakete",
        href: "/hochzeitsfotograf-preise/",
        seoContext: "Preise für Hochzeitsreportagen in Hamburg",
        trackingId: "mobile_preise_pakete",
        ctaType: "navigation",
        contentTopic: "preise_pakete",
        userIntent: "preise_pruefen",
        journeyStage: "vergleich",
      },
      {
        label: "Kontakt",
        href: "/kontakt/",
        seoContext: "Kontakt Hochzeitsfotograf Hamburg",
        trackingId: "mobile_kontakt",
        ctaType: "navigation",
        contentTopic: "kontaktmoeglichkeiten",
        userIntent: "kontakt_aufnehmen",
        journeyStage: "anfrage",
      },
      {
        label: "Blog",
        href: "/blog/",
        trackingId: "mobile_blog",
        ctaType: "navigation",
        contentTopic: "hochzeitsratgeber",
        userIntent: "ratgeber_lesen",
        journeyStage: "information",
      },
      {
        label: "Über mich",
        href: "/about/",
        trackingId: "mobile_about",
        ctaType: "navigation",
        contentTopic: "ueber_mich",
        userIntent: "vertrauen_aufbauen",
        journeyStage: "vertrauen",
      },
      {
        label: "TFP Shootings",
        href: "/newsletter/",
        description: "Aktuelle TFP-Ausschreibungen in Hamburg",
        trackingId: "mobile_tfp_shootings",
        ctaType: "navigation",
        contentTopic: "tfp_shootings",
        userIntent: "tfp_ausschreibungen_ansehen",
        journeyStage: "entdeckung",
      },
    ],
  },
  {
    label: "Galerien",
    contentTopic: "hochzeitsgalerien",
    userIntent: "hochzeitsgalerien_ansehen",
    journeyStage: "auswahl",
    items: [
      {
        label: "Hochzeitsgalerien",
        href: "/portfolio/?category=hochzeit",
        seoContext: "Hochzeitsgalerien Hamburg Standesamt Elopement Destination Wedding",
        trackingId: "mobile_hochzeitsgalerien",
        ctaType: "portfolio_filter",
        contentTopic: "hochzeitsgalerien",
        userIntent: "hochzeitsgalerien_ansehen",
        journeyStage: "auswahl",
      },
    ],
  },
  {
    label: "Planung",
    secondary: true,
    contentTopic: "hochzeitsplanung",
    userIntent: "hochzeit_planen",
    journeyStage: "planung",
    items: [
      {
        label: "Standesämter & Trauorte",
        href: "/standesamt-hamburg/",
        seoContext: "Hamburger Standesämter und besondere Trauorte",
        trackingId: "mobile_registry_office_finder",
        ctaType: "planning_tool",
        contentTopic: "standesamt_hamburg",
        userIntent: "standesamt_finden",
        journeyStage: "planung",
      },
      {
        label: "Trautermin Hamburg",
        href: "/trautermin-hamburg-online-reservieren/",
        seoContext: "Trautermin in Hamburg online reservieren",
        trackingId: "mobile_ceremony_date_hamburg",
        ctaType: "planning_tool",
        contentTopic: "trautermin_hamburg",
        userIntent: "trautermin_planen",
        journeyStage: "planung",
      },
    ],
  },
];
