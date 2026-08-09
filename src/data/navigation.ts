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
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
  secondary?: boolean;
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
  },
  {
    label: "Blog",
    href: "/blog/",
    description: "Ratgeber für Hochzeit, Standesamt und Planung",
    seoContext: "Hochzeitsratgeber Hamburg",
    trackingId: "desktop_blog",
    ctaType: "navigation",
    contentTopic: "hochzeitsratgeber",
    userIntent: "ratgeber_lesen",
    journeyStage: "information",
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
  },
  {
    label: "Newsletter",
    href: "/newsletter/",
    description: "Neuigkeiten und Inspiration von Artbild-Fotografie",
    trackingId: "desktop_newsletter",
    ctaType: "navigation",
    contentTopic: "newsletter",
    userIntent: "inspiration_abonnieren",
    journeyStage: "bindung",
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
    ],
  },
  {
    label: "Galerien",
    secondary: true,
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
];
