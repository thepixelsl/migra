export type StandesamtPhone = {
  label?: string;
  display: string;
  href: string;
};

export type Standesamt = {
  id: string;
  name: string;
  location: string;
  street: string;
  postalCode: string;
  city: string;
  phones: StandesamtPhone[];
  email: string;
  officialUrl: string;
  searchTerms?: string[];
};

export const standesaemter: Standesamt[] = [
  {
    id: "hamburg-nord",
    name: "Standesamt Hamburg-Nord",
    location: "Eppendorf",
    street: "Kümmellstraße 5–7 / Robert-Koch-Straße 17",
    postalCode: "20249",
    city: "Hamburg",
    phones: [
      {
        label: "Heiratsabteilung",
        display: "040 42804-5308",
        href: "tel:+4940428045308",
      },
      {
        label: "Heiratsabteilung",
        display: "040 42804-5310",
        href: "tel:+4940428045310",
      },
      {
        label: "Heiratsabteilung",
        display: "040 42804-2475",
        href: "tel:+4940428042475",
      },
    ],
    email: "heirat@hamburg-nord.hamburg.de",
    officialUrl:
      "https://www.hamburg.de/politik-und-verwaltung/bezirke/bezirksthemen/standesamt/hamburg-nord-1043838",
    searchTerms: ["nord", "eppendorf", "kümmellstrasse", "kuemmellstrasse"],
  },
  {
    id: "wandsbek",
    name: "Standesamt Wandsbek",
    location: "Wandsbek",
    street: "Schloßstraße 60",
    postalCode: "22041",
    city: "Hamburg",
    phones: [
      {
        label: "Heiratsabteilung",
        display: "040 42881-2062",
        href: "tel:+4940428812062",
      },
      {
        label: "Heiratsabteilung",
        display: "040 42881-2572",
        href: "tel:+4940428812572",
      },
    ],
    email: "heirat@wandsbek.hamburg.de",
    officialUrl:
      "https://www.hamburg.de/politik-und-verwaltung/bezirke/bezirksthemen/standesamt/wandsbek-76038",
    searchTerms: ["schlossstrasse"],
  },
  {
    id: "hamburg-mitte",
    name: "Standesamt Hamburg-Mitte",
    location: "Neustadt",
    street: "Caffamacherreihe 1–3",
    postalCode: "20355",
    city: "Hamburg",
    phones: [
      {
        label: "Heiratsabteilung",
        display: "040 42854-4500",
        href: "tel:+4940428544500",
      },
    ],
    email: "heirat@hamburg-mitte.hamburg.de",
    officialUrl:
      "https://www.hamburg.de/politik-und-verwaltung/bezirke/bezirksthemen/standesamt/hamburg-mitte-67110",
    searchTerms: ["mitte", "neustadt", "caffamacher reihe"],
  },
  {
    id: "eimsbuettel",
    name: "Standesamt Eimsbüttel",
    location: "Eimsbüttel",
    street: "Grindelberg 62–66",
    postalCode: "20144",
    city: "Hamburg",
    phones: [
      {
        label: "Heiratsabteilung",
        display: "040 42801-3809",
        href: "tel:+4940428013809",
      },
    ],
    email: "heirat@eimsbuettel.hamburg.de",
    officialUrl:
      "https://www.hamburg.de/politik-und-verwaltung/bezirke/bezirksthemen/standesamt/eimsbuettel-58392",
    searchTerms: ["eimsbuttel", "eimsbuettel", "grindelberg"],
  },
  {
    id: "altona",
    name: "Standesamt Altona",
    location: "Rathaus Altona",
    street: "Platz der Republik 1",
    postalCode: "22765",
    city: "Hamburg",
    phones: [
      {
        label: "Allgemeine Auskunft",
        display: "040 42828-0",
        href: "tel:+4940428280",
      },
    ],
    email: "heirat@altona.hamburg.de",
    officialUrl:
      "https://www.hamburg.de/politik-und-verwaltung/bezirke/bezirksthemen/standesamt/altona-49736",
    searchTerms: ["ottensen", "rathaus", "platz der republik"],
  },
  {
    id: "bergedorf",
    name: "Standesamt Bergedorf",
    location: "Haus im Park",
    street: "Gräpelweg 8",
    postalCode: "21029",
    city: "Hamburg",
    phones: [
      {
        label: "Heiratsabteilung",
        display: "040 42891-3425",
        href: "tel:+4940428913425",
      },
      {
        label: "Heiratsabteilung",
        display: "040 42891-2497",
        href: "tel:+4940428912497",
      },
    ],
    email: "heirat@bergedorf.hamburg.de",
    officialUrl:
      "https://www.hamburg.de/politik-und-verwaltung/bezirke/bezirksthemen/standesamt/bergedorf-56416",
    searchTerms: ["graepelweg", "grapelweg", "haus im park"],
  },
  {
    id: "norderstedt",
    name: "Standesamt Norderstedt",
    location: "Rathaus Norderstedt",
    street: "Rathausallee 50",
    postalCode: "22846",
    city: "Norderstedt",
    phones: [
      {
        label: "Zentrale",
        display: "040 53595-0",
        href: "tel:+4940535950",
      },
    ],
    email: "standesamt@norderstedt.de",
    officialUrl:
      "https://www.norderstedt.de/Soziales-und-Familie/Leben/Standesamt/",
    searchTerms: ["umland", "schleswig-holstein", "rathausallee"],
  },
  {
    id: "harburg",
    name: "Standesamt Harburg",
    location: "Rathausforum Harburg",
    street: "Harburger Rathausforum 3",
    postalCode: "21073",
    city: "Hamburg",
    phones: [
      {
        label: "Heiratsabteilung",
        display: "040 42871-2767",
        href: "tel:+4940428712767",
      },
    ],
    email: "heirat@harburg.hamburg.de",
    officialUrl:
      "https://www.hamburg.de/politik-und-verwaltung/bezirke/bezirksthemen/standesamt/harburg-63808",
    searchTerms: ["süderelbe", "suederelbe", "rathausforum"],
  },
];
