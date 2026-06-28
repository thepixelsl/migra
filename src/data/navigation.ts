export type NavigationItem = {
  label: string;
  href: string;
  description?: string;
  seoContext?: string;
  badge?: string;
  external?: boolean;
  emphasis?: "primary" | "cta";
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
  secondary?: boolean;
};

export const mobileNavigationGroups: NavigationGroup[] = [
  {
    label: "Entdecken",
    items: [
      {
        label: "Start",
        href: "/",
        description: "Artbild-Fotografie und aktuelle Hochzeitsgeschichten",
      },
      {
        label: "Portfolio",
        href: "/portfolio/",
        description: "Hochzeiten, Paarshootings und Editorials",
        emphasis: "primary",
      },
    ],
  },
  {
    label: "Hochzeit",
    items: [
      {
        label: "Hochzeitsfotograf Hamburg",
        href: "/#hochzeitsfotograf-hamburg",
        description: "Natürliche Hochzeitsreportagen in Hamburg und Norddeutschland",
        seoContext: "Hochzeitsfotograf Hamburg",
        emphasis: "primary",
      },
      {
        label: "Preise & Pakete",
        href: "/hochzeitsfotograf-preise/",
        description: "Leistungen und Preise für Eure Hochzeitsreportage",
        seoContext: "Preise für Hochzeitsreportagen in Hamburg",
      },
      {
        label: "Standesamtliche Trauung",
        href: "https://artbild-fotografie.de/standesamt-hamburg/",
        description: "Begleitung im Standesamt Hamburg und in Altona",
        seoContext: "Standesamtliche Trauung Hamburg",
        external: true,
      },
      {
        label: "Getting Ready",
        href: "/das-perfekte-getting-ready-fuer-deine-hochzeit-in-hamburg/",
        description: "Inspiration für den Hochzeitsmorgen in Hamburg",
        seoContext: "Getting Ready Hochzeit Hamburg",
      },
    ],
  },
  {
    label: "Anfragen",
    items: [
      {
        label: "Freie Termine & Anfrage",
        href: "https://artbild-fotografie.de/kontakt/",
        description: "Erzählt mir von Eurer Hochzeit und Euren Wünschen",
        seoContext: "Hochzeitsfotograf Hamburg anfragen",
        badge: "2026/2027",
        external: true,
        emphasis: "cta",
      },
      {
        label: "Kontakt",
        href: "https://artbild-fotografie.de/kontakt/",
        description: "Direkter Kontakt zu Artbild-Fotografie in Hamburg",
        external: true,
      },
      {
        label: "Sicherer Kontakt",
        href: "/sicherer-kontakt/",
        description: "PGP, S/MIME und datensparsame Kontaktaufnahme",
        seoContext: "Sicherer E-Mail-Kontakt Hamburg",
      },
    ],
  },
  {
    label: "Inspiration",
    secondary: true,
    items: [
      {
        label: "Blog",
        href: "https://artbild-fotografie.de/blog/",
        description: "Planungstipps und Geschichten rund um Hochzeiten",
        external: true,
      },
      {
        label: "Über mich",
        href: "https://artbild-fotografie.de/about/",
        description: "Fotograf York Augustin aus Hamburg",
        external: true,
      },
      {
        label: "Newsletter",
        href: "https://artbild-fotografie.de/newsletter/",
        description: "Neuigkeiten und ausgewählte Fotogeschichten",
        external: true,
      },
    ],
  },
];

export const mobileSearchItem: NavigationItem = {
  label: "Suche",
  href: "https://artbild-fotografie.de/?s=",
  description: "Website durchsuchen",
  external: true,
};
