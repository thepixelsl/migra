export type TrauortRegion = "hamburg" | "umland";

export type TrauortCategory =
  | "schloss"
  | "rathaus"
  | "museum"
  | "villa"
  | "schiff"
  | "muehle"
  | "gut"
  | "sonstiges";

export type TrauortStatus =
  | "regular"
  | "seasonal"
  | "on-request"
  | "restricted"
  | "sold-out";

export type TrauortBookingMode =
  | "standesamt"
  | "standesamt-and-venue"
  | "individual-approval";

export type BookingStep = {
  actor: "standesamt" | "venue";
  label: string;
  description: string;
  url?: string;
};

export type TrauortAddress = {
  street: string;
  postalCode: string;
  city: string;
};

export type TrauortSource = {
  label: string;
  url: string;
};

export type Trauort = {
  id: string;
  name: string;
  region: TrauortRegion;
  category: TrauortCategory;
  officeName: string;
  address?: TrauortAddress;
  meetingPoint?: string;
  bookingMode: TrauortBookingMode;
  bookingModeLabel: string;
  status: TrauortStatus;
  statusLabel: string;
  bookingSteps: BookingStep[];
  reservationWindow?: string;
  ceremonyDays?: string;
  eligibilityNote?: string;
  authorityFee?: string;
  venueFee?: string;
  feeValidThrough?: string;
  capacityNote?: string;
  accessibilityNote?: string;
  officialAuthorityUrl: string;
  officialVenueUrl?: string;
  bookingUrl?: string;
  sources: TrauortSource[];
  lastVerified: string;
  schemaType: "EventVenue" | "Place";
  includeInSchema: boolean;
};

const hamburgCalendarUrl = "https://standesamtstermine.hamburg.de/";
const wandsbekVenueUrl =
  "https://www.hamburg.de/politik-und-verwaltung/bezirke/bezirksthemen/standesamt/heiraten-in-wandsbek-66094";
const bergedorfVenueUrl =
  "https://www.hamburg.de/politik-und-verwaltung/bezirke/bergedorf/buergerservice/besondere-heiratsorte-56420";
const bergedorfOfficeUrl =
  "https://www.hamburg.de/politik-und-verwaltung/bezirke/bezirksthemen/standesamt/trauzimmer-bergedorf-1019482";
const reinbekMarriageUrl =
  "https://www.reinbek.de/buergerservice-und-politik/buergerservice/was-erledige-ich-wo/detail/heirat-anmelden-565";

// Research notes are intentionally kept separate from the data that is rendered.
// Prices, capacities, fixed ceremony days and reservation windows change too
// often to be presented as current booking facts without a fresh editorial check.
const researchedTrauorte: Trauort[] = [
  {
    id: "berner-schloss",
    name: "Berner Schloss",
    region: "hamburg",
    category: "schloss",
    officeName: "Standesamt Wandsbek",
    address: {
      street: "Berner Allee 31a",
      postalCode: "22159",
      city: "Hamburg",
    },
    bookingMode: "standesamt",
    bookingModeLabel: "Trautermin über das Standesamt",
    status: "seasonal",
    statusLabel: "Saisonal",
    bookingSteps: [
      {
        actor: "standesamt",
        label: "Trautermin reservieren",
        description:
          "Freien Termin beim Standesamt Wandsbek beziehungsweise im Hamburger Traukalender wählen.",
        url: hamburgCalendarUrl,
      },
      {
        actor: "venue",
        label: "Zusatzleistungen abstimmen",
        description:
          "Nur eine anschließende Feier oder weitere Leistungen werden separat mit dem Berner Schloss abgestimmt.",
        url: "https://www.gartenstadt-hamburg.de/mehr-als-wohnen/berner-schloss/infos-und-bilder/",
      },
    ],
    ceremonyDays:
      "Ausgewählte Freitage von Mitte April bis Mitte Oktober.",
    authorityFee: "430 € für den Außentrauungsservice, zusätzlich zu den regulären Gebühren.",
    capacityNote:
      "Die aktuellen amtlichen Angaben zur zulässigen Personenzahl sind nicht einheitlich; Kapazität vor der Reservierung bestätigen lassen.",
    officialAuthorityUrl: wandsbekVenueUrl,
    officialVenueUrl:
      "https://www.gartenstadt-hamburg.de/mehr-als-wohnen/berner-schloss/infos-und-bilder/",
    bookingUrl: hamburgCalendarUrl,
    sources: [
      { label: "Standesamt Wandsbek", url: wandsbekVenueUrl },
      {
        label: "Berner Schloss",
        url: "https://www.gartenstadt-hamburg.de/mehr-als-wohnen/berner-schloss/infos-und-bilder/",
      },
    ],
    lastVerified: "2026-07-31",
    schemaType: "EventVenue",
    includeInSchema: true,
  },
  {
    id: "museumsdorf-volksdorf",
    name: "Museumsdorf Volksdorf",
    region: "hamburg",
    category: "museum",
    officeName: "Standesamt Wandsbek",
    address: {
      street: "Im Alten Dorfe 46–48",
      postalCode: "22359",
      city: "Hamburg",
    },
    bookingMode: "standesamt-and-venue",
    bookingModeLabel: "Standesamt plus optionale Locationleistungen",
    status: "seasonal",
    statusLabel: "Saisonal",
    bookingSteps: [
      {
        actor: "standesamt",
        label: "Trautermin reservieren",
        description:
          "Freien Termin im Wagnerhof beim Standesamt Wandsbek beziehungsweise im Hamburger Traukalender wählen.",
        url: hamburgCalendarUrl,
      },
      {
        actor: "venue",
        label: "Empfang oder Feier anfragen",
        description:
          "Einen Sektempfang oder eine anschließende Feier separat mit dem Museumsdorf abstimmen.",
        url: "https://museumsdorf-volksdorf.de/Raumvermietung/Heiraten-im-Museumsdorf/",
      },
    ],
    ceremonyDays:
      "Ausgewählte Freitage von Mitte April bis Mitte Oktober; der Betreiber nennt für sein Angebot einzelne Freitage von Juni bis September.",
    authorityFee: "430 € für den Außentrauungsservice, zusätzlich zu den regulären Gebühren.",
    venueFee: "Empfang und Feier nach individuellem Angebot des Museumsdorfs.",
    capacityNote:
      "Veröffentlichte Kapazitätsangaben beziehen sich teils auf Trauung, teils auf Feier; zulässige Traugäste vorab bestätigen lassen.",
    officialAuthorityUrl: wandsbekVenueUrl,
    officialVenueUrl:
      "https://museumsdorf-volksdorf.de/Raumvermietung/Heiraten-im-Museumsdorf/",
    bookingUrl: hamburgCalendarUrl,
    sources: [
      { label: "Standesamt Wandsbek", url: wandsbekVenueUrl },
      {
        label: "Museumsdorf Volksdorf",
        url: "https://museumsdorf-volksdorf.de/Raumvermietung/Heiraten-im-Museumsdorf/",
      },
    ],
    lastVerified: "2026-07-31",
    schemaType: "EventVenue",
    includeInSchema: true,
  },
  {
    id: "ohlendorffsche-villa",
    name: "Ohlendorff’sche Villa",
    region: "hamburg",
    category: "villa",
    officeName: "Standesamt Wandsbek",
    address: {
      street: "Im Alten Dorfe 28",
      postalCode: "22359",
      city: "Hamburg",
    },
    bookingMode: "standesamt-and-venue",
    bookingModeLabel: "Standesamt plus optionale Locationleistungen",
    status: "seasonal",
    statusLabel: "Saisonal",
    bookingSteps: [
      {
        actor: "standesamt",
        label: "Trautermin reservieren",
        description:
          "Freien Trautermin beim Standesamt Wandsbek beziehungsweise im Hamburger Traukalender wählen.",
        url: hamburgCalendarUrl,
      },
      {
        actor: "venue",
        label: "Feier und Bewirtung abstimmen",
        description:
          "Besichtigung, Bewirtung oder eine anschließende Feier separat mit der Villa vereinbaren.",
        url: "https://ohlendorffsche.de/hochzeit-in-der-ohlendorffschen-villa/",
      },
    ],
    reservationWindow:
      "Die Location nennt sechs Monate Vorlauf; ausschlaggebend ist die aktuelle Verfügbarkeit des Standesamts.",
    ceremonyDays:
      "Ausgewählte Freitage von Mitte April bis Mitte Oktober.",
    authorityFee: "430 € für den Außentrauungsservice, zusätzlich zu den regulären Gebühren.",
    venueFee: "Bewirtung und Feier nach individuellem Angebot der Location.",
    capacityNote:
      "Kleine Traugesellschaft; amtlich sind bis zu 20 Personen einschließlich Standesbeamtin oder Standesbeamtem genannt.",
    officialAuthorityUrl: wandsbekVenueUrl,
    officialVenueUrl:
      "https://ohlendorffsche.de/hochzeit-in-der-ohlendorffschen-villa/",
    bookingUrl: hamburgCalendarUrl,
    sources: [
      { label: "Standesamt Wandsbek", url: wandsbekVenueUrl },
      {
        label: "Ohlendorff’sche Villa",
        url: "https://ohlendorffsche.de/hochzeit-in-der-ohlendorffschen-villa/",
      },
    ],
    lastVerified: "2026-07-31",
    schemaType: "EventVenue",
    includeInSchema: true,
  },
  {
    id: "bergedorfer-schloss",
    name: "Bergedorfer Schloss",
    region: "hamburg",
    category: "schloss",
    officeName: "Standesamt Bergedorf",
    address: {
      street: "Bergedorfer Schloßstraße 4",
      postalCode: "21029",
      city: "Hamburg",
    },
    bookingMode: "standesamt",
    bookingModeLabel: "Trautermin über das Standesamt",
    status: "seasonal",
    statusLabel: "Aktuelle Terminlage prüfen",
    bookingSteps: [
      {
        actor: "standesamt",
        label: "Aktuelle Termine prüfen",
        description:
          "Verfügbare Termine beim Standesamt Bergedorf beziehungsweise im Hamburger Traukalender prüfen.",
        url: "https://standesamtstermine.hamburg.de/de/Schloss-Bergedorf-177.html",
      },
    ],
    ceremonyDays:
      "Trauungen an ausgewählten Terminen; freie Termine zeigt der Hamburger Traukalender.",
    authorityFee: "250 € Außentrauungsgebühr, zusätzlich zu den regulären Gebühren.",
    capacityNote: "Bis zu 50 Gäste laut aktueller Terminbeschreibung.",
    officialAuthorityUrl: bergedorfOfficeUrl,
    officialVenueUrl: bergedorfVenueUrl,
    bookingUrl:
      "https://standesamtstermine.hamburg.de/de/Schloss-Bergedorf-177.html",
    sources: [
      { label: "Standesamt Bergedorf", url: bergedorfOfficeUrl },
      { label: "Besondere Heiratsorte in Bergedorf", url: bergedorfVenueUrl },
    ],
    lastVerified: "2026-07-31",
    schemaType: "EventVenue",
    includeInSchema: true,
  },
  {
    id: "spiegelsaal-rathaus-bergedorf",
    name: "Spiegelsaal im Rathaus Bergedorf",
    region: "hamburg",
    category: "rathaus",
    officeName: "Standesamt Bergedorf",
    address: {
      street: "Wentorfer Straße 38",
      postalCode: "21029",
      city: "Hamburg",
    },
    bookingMode: "standesamt",
    bookingModeLabel: "Trautermin über das Standesamt",
    status: "seasonal",
    statusLabel: "Ausgewählte Termine",
    bookingSteps: [
      {
        actor: "standesamt",
        label: "Trautermin reservieren",
        description:
          "Termin direkt beim Standesamt Bergedorf beziehungsweise im Hamburger Traukalender wählen.",
        url: "https://standesamtstermine.hamburg.de/de/Spiegelsaal-Rathaus-Bergedorf-176.html",
      },
    ],
    ceremonyDays: "An ausgewählten Terminen des Standesamts Bergedorf.",
    authorityFee: "250 € Außentrauungsgebühr, zusätzlich zu den regulären Gebühren.",
    capacityNote: "Bis zu 30 Gäste laut aktueller Terminbeschreibung.",
    officialAuthorityUrl: bergedorfOfficeUrl,
    bookingUrl:
      "https://standesamtstermine.hamburg.de/de/Spiegelsaal-Rathaus-Bergedorf-176.html",
    sources: [{ label: "Standesamt Bergedorf", url: bergedorfOfficeUrl }],
    lastVerified: "2026-07-31",
    schemaType: "EventVenue",
    includeInSchema: true,
  },
  {
    id: "rieck-haus",
    name: "Rieck Haus",
    region: "hamburg",
    category: "museum",
    officeName: "Standesamt Bergedorf",
    address: {
      street: "Curslacker Deich 284",
      postalCode: "21039",
      city: "Hamburg",
    },
    bookingMode: "individual-approval",
    bookingModeLabel: "Amtliche Einzelfreigabe plus Locationabstimmung",
    status: "on-request",
    statusLabel: "Nur auf Anfrage",
    bookingSteps: [
      {
        actor: "standesamt",
        label: "Einzelfreigabe anfragen",
        description:
          "Zuerst beim Standesamt Bergedorf klären, ob Ort und Wunschtermin übernommen werden können.",
        url: bergedorfOfficeUrl,
      },
      {
        actor: "venue",
        label: "Location abstimmen",
        description:
          "Erst nach der amtlichen Rückmeldung Verfügbarkeit und Nutzung mit dem Rieck Haus abstimmen.",
        url: bergedorfVenueUrl,
      },
    ],
    ceremonyDays: "Keine regelmäßig buchbaren Standardtermine veröffentlicht.",
    authorityFee: "450 € für die externe Eheschließung, zusätzlich zu den regulären Gebühren.",
    venueFee: "Mögliche Locationkosten werden separat erhoben.",
    officialAuthorityUrl: bergedorfOfficeUrl,
    officialVenueUrl: bergedorfVenueUrl,
    sources: [
      { label: "Standesamt Bergedorf", url: bergedorfOfficeUrl },
      { label: "Besondere Heiratsorte in Bergedorf", url: bergedorfVenueUrl },
    ],
    lastVerified: "2026-07-31",
    schemaType: "EventVenue",
    includeInSchema: true,
  },
  {
    id: "rathaus-stellingen",
    name: "Rathaus Stellingen",
    region: "hamburg",
    category: "rathaus",
    officeName: "Standesamt Eimsbüttel",
    address: {
      street: "Basselweg 73",
      postalCode: "22527",
      city: "Hamburg",
    },
    bookingMode: "standesamt",
    bookingModeLabel: "Direkte Anfrage beim Standesamt",
    status: "on-request",
    statusLabel: "Termin auf Anfrage",
    bookingSteps: [
      {
        actor: "standesamt",
        label: "Verfügbarkeit erfragen",
        description:
          "Termin, Buchungsfrist und aktuelle Konditionen direkt beim Standesamt Eimsbüttel erfragen.",
        url: "https://www.hamburg.de/politik-und-verwaltung/bezirke/bezirksthemen/standesamt/trauzimmer-eimsbuettel-1019584",
      },
    ],
    ceremonyDays: "Keine belastbaren aktuellen Trautage veröffentlicht.",
    capacityNote: "Aktuelle Personenzahl vor der Reservierung beim Standesamt bestätigen lassen.",
    officialAuthorityUrl:
      "https://www.hamburg.de/politik-und-verwaltung/bezirke/bezirksthemen/standesamt/trauzimmer-eimsbuettel-1019584",
    sources: [
      {
        label: "Standesamt Eimsbüttel",
        url: "https://www.hamburg.de/politik-und-verwaltung/bezirke/bezirksthemen/standesamt/trauzimmer-eimsbuettel-1019584",
      },
    ],
    lastVerified: "2026-07-31",
    schemaType: "EventVenue",
    includeInSchema: true,
  },
  {
    id: "hamburger-rathaus-phoenixsaal",
    name: "Phönixsaal im Hamburger Rathaus",
    region: "hamburg",
    category: "rathaus",
    officeName: "Standesamt Hamburg-Mitte",
    address: {
      street: "Rathausmarkt 1",
      postalCode: "20095",
      city: "Hamburg",
    },
    bookingMode: "standesamt-and-venue",
    bookingModeLabel: "Standesamt plus RathausService",
    status: "on-request",
    statusLabel: "Besondere Termine",
    bookingSteps: [
      {
        actor: "standesamt",
        label: "Trautermin anfragen",
        description:
          "Verfügbarkeit ausschließlich beim Standesamt Hamburg-Mitte prüfen.",
        url: "https://www.hamburg.de/politik-und-verwaltung/senat/rathaus-hamburg/heiraten-im-rathaus-238502",
      },
      {
        actor: "venue",
        label: "Raumnutzung abrechnen",
        description:
          "Nach Terminbestätigung wird die Nutzung des Phönixsaals über den RathausService abgerechnet.",
        url: "https://www.hamburg.de/politik-und-verwaltung/senat/rathaus-hamburg/heiraten-im-rathaus-238502",
      },
    ],
    ceremonyDays:
      "Trauungen finden nur an besonders veröffentlichten Terminen statt; aktuelle Verfügbarkeit beim Standesamt Hamburg-Mitte prüfen.",
    authorityFee: "300 € für die Trauung, zusätzlich zu den regulären Gebühren.",
    venueFee: "200 € für die Raumnutzung durch den RathausService.",
    officialAuthorityUrl:
      "https://www.hamburg.de/politik-und-verwaltung/senat/rathaus-hamburg/heiraten-im-rathaus-238502",
    bookingUrl:
      "https://www.hamburg.de/politik-und-verwaltung/senat/rathaus-hamburg/heiraten-im-rathaus-238502",
    sources: [
      {
        label: "Hamburger Rathaus",
        url: "https://www.hamburg.de/politik-und-verwaltung/senat/rathaus-hamburg/heiraten-im-rathaus-238502",
      },
    ],
    lastVerified: "2026-07-31",
    schemaType: "EventVenue",
    includeInSchema: true,
  },
  {
    id: "landhaus-walter",
    name: "Landhaus Walter",
    region: "hamburg",
    category: "sonstiges",
    officeName: "Standesamt Hamburg-Nord",
    address: {
      street: "Otto-Wels-Straße 2",
      postalCode: "22303",
      city: "Hamburg",
    },
    bookingMode: "standesamt-and-venue",
    bookingModeLabel: "Standesamt und Location separat reservieren",
    status: "on-request",
    statusLabel: "Freitags auf Anfrage",
    bookingSteps: [
      {
        actor: "standesamt",
        label: "Standesperson reservieren",
        description:
          "Außer-Haus-Termin beim Standesamt Hamburg-Nord anfragen; Termine sind auf den Tag genau ein Jahr im Voraus reservierbar.",
        url: "https://www.hamburg.de/politik-und-verwaltung/bezirke/bezirksthemen/standesamt/trauzimmer-hamburg-nord-1021476",
      },
      {
        actor: "venue",
        label: "Raum separat reservieren",
        description:
          "Verfügbarkeit und Raummiete unabhängig davon mit dem Landhaus Walter abstimmen.",
        url: "https://landhaus-walter.de/kontakt/",
      },
    ],
    reservationWindow: "Beim Standesamt auf den Tag genau bis zu ein Jahr im Voraus.",
    ceremonyDays: "Außer-Haus-Trauungen des Standesamts Hamburg-Nord freitags.",
    authorityFee: "300 € Außentrauungszuschlag, zusätzlich zu den regulären Gebühren.",
    venueFee: "Individuelle Raummiete der Location.",
    officialAuthorityUrl:
      "https://www.hamburg.de/politik-und-verwaltung/bezirke/bezirksthemen/standesamt/trauzimmer-hamburg-nord-1021476",
    officialVenueUrl: "https://landhaus-walter.de/kontakt/",
    bookingUrl: hamburgCalendarUrl,
    sources: [
      {
        label: "Standesamt Hamburg-Nord",
        url: "https://www.hamburg.de/politik-und-verwaltung/bezirke/bezirksthemen/standesamt/trauzimmer-hamburg-nord-1021476",
      },
      { label: "Landhaus Walter", url: "https://landhaus-walter.de/kontakt/" },
    ],
    lastVerified: "2026-07-31",
    schemaType: "EventVenue",
    includeInSchema: true,
  },
  {
    id: "atg-alsterschiffe",
    name: "ATG-Alsterschiffe",
    region: "hamburg",
    category: "schiff",
    officeName: "Örtlich zuständiges Hamburger Standesamt",
    meetingPoint: "Schiff und Anleger werden individuell mit dem Betreiber festgelegt.",
    bookingMode: "individual-approval",
    bookingModeLabel: "Schiff plus amtliche Zuständigkeitsbestätigung",
    status: "on-request",
    statusLabel: "Nur nach Bestätigung",
    bookingSteps: [
      {
        actor: "venue",
        label: "Schiff und Termin anfragen",
        description:
          "Passendes Schiff, Anleger und Wunschtermin zunächst mit der Alster-Touristik abstimmen.",
        url: "https://alstertouristik.de/hochzeit-und-feiern/",
      },
      {
        actor: "standesamt",
        label: "Zuständigkeit bestätigen lassen",
        description:
          "Vor einer verbindlichen Buchung schriftlich klären, welches Standesamt für Schiff, Anleger und Termin die Eheschließung übernimmt.",
        url: hamburgCalendarUrl,
      },
    ],
    ceremonyDays: "Individuell und nur nach Bestätigung durch Betreiber und zuständiges Standesamt.",
    authorityFee: "Amtliche Gebühren abhängig vom bestätigten Standesamt.",
    venueFee: "Schiff und Leistungen nach individuellem Angebot der Alster-Touristik.",
    officialAuthorityUrl: hamburgCalendarUrl,
    officialVenueUrl: "https://alstertouristik.de/hochzeit-und-feiern/",
    sources: [
      { label: "Hamburger Traukalender", url: hamburgCalendarUrl },
      {
        label: "Alster-Touristik",
        url: "https://alstertouristik.de/hochzeit-und-feiern/",
      },
    ],
    lastVerified: "2026-07-31",
    schemaType: "Place",
    includeInSchema: true,
  },
  {
    id: "schloss-ahrensburg",
    name: "Schloss Ahrensburg",
    region: "umland",
    category: "schloss",
    officeName: "Standesamt Ahrensburg",
    address: {
      street: "Lübecker Straße 1",
      postalCode: "22926",
      city: "Ahrensburg",
    },
    bookingMode: "standesamt",
    bookingModeLabel: "Termin und Trauraum über das Standesamt",
    status: "regular",
    statusLabel: "Termine jahresweise",
    bookingSteps: [
      {
        actor: "standesamt",
        label: "Termin und Raum reservieren",
        description:
          "Trautermin und gewünschten Schlossraum ausschließlich beim Standesamt Ahrensburg vereinbaren.",
        url: "https://www.schloss-ahrensburg.de/angebote/trauungen/anmeldung/",
      },
      {
        actor: "venue",
        label: "Organisatorische Fragen klären",
        description:
          "Die Schlossverwaltung beantwortet Fragen zu Räumen, Zugang und Ablauf, vergibt aber keine standesamtlichen Termine.",
        url: "https://www.schloss-ahrensburg.de/angebote/trauungen/",
      },
    ],
    reservationWindow:
      "Termine werden jahresweise freigegeben; aktuellen Buchungsstart und zulässigen Kontaktweg beim Standesamt Ahrensburg prüfen.",
    ceremonyDays: "Standesamtliche Trauungen nach den veröffentlichten Jahresterminen.",
    authorityFee: "Reguläre Gebühren des Standesamts kommen zur Raumnutzung hinzu.",
    venueFee:
      "Raumnutzungsentgelt abhängig vom gewählten Schlossraum; aktuelle Preisliste prüfen.",
    capacityNote:
      "Kapazität abhängig vom gewählten Schlossraum; aktuelle Raumangaben prüfen.",
    accessibilityNote:
      "Der Gartensaal liegt im Erdgeschoss; Salon Louis Seize und Bibliothek liegen im zweiten Stock ohne Aufzug.",
    officialAuthorityUrl:
      "https://www.schloss-ahrensburg.de/angebote/trauungen/anmeldung/",
    officialVenueUrl: "https://www.schloss-ahrensburg.de/angebote/trauungen/",
    bookingUrl:
      "https://www.schloss-ahrensburg.de/angebote/trauungen/anmeldung/",
    sources: [
      {
        label: "Anmeldung zur Trauung",
        url: "https://www.schloss-ahrensburg.de/angebote/trauungen/anmeldung/",
      },
      {
        label: "Schloss Ahrensburg",
        url: "https://www.schloss-ahrensburg.de/angebote/trauungen/",
      },
    ],
    lastVerified: "2026-07-31",
    schemaType: "EventVenue",
    includeInSchema: true,
  },
  {
    id: "schloss-reinbek",
    name: "Schloss Reinbek",
    region: "umland",
    category: "schloss",
    officeName: "Standesamt Reinbek",
    address: {
      street: "Schloßstraße 5",
      postalCode: "21465",
      city: "Reinbek",
    },
    bookingMode: "standesamt",
    bookingModeLabel: "Fristgenaue Reservierung beim Standesamt",
    status: "restricted",
    statusLabel: "Wohnsitz erforderlich",
    bookingSteps: [
      {
        actor: "standesamt",
        label: "Vorsprachetermin buchen",
        description:
          "Die Terminreservierung ist an die sechsmonatige Frist der Anmeldung gebunden; aktuellen Freischaltzeitpunkt im offiziellen Buchungssystem prüfen.",
        url: reinbekMarriageUrl,
      },
      {
        actor: "standesamt",
        label: "Originalunterlagen vorlegen",
        description:
          "Alle erforderlichen Unterlagen vollständig im Original mitbringen; nur dann wird der Trautermin reserviert.",
        url: reinbekMarriageUrl,
      },
    ],
    reservationWindow:
      "Die Reservierung ist an die sechsmonatige Frist der Anmeldung gebunden; aktuellen Freischaltzeitpunkt offiziell prüfen.",
    ceremonyDays: "Freitags im Gottorfzimmer des Schlosses.",
    eligibilityNote:
      "Mindestens eine Person muss mit Haupt- oder Nebenwohnsitz in Reinbek, Glinde, Barsbüttel oder Wentorf bei Hamburg gemeldet sein.",
    authorityFee: "Aktuell 450 € Zusatzkosten für die Trauung im Schloss.",
    capacityNote:
      "30 Gäste zusätzlich zu Paar, Standesbeamtin oder Standesbeamtem und gegebenenfalls zwei Trauzeugen.",
    officialAuthorityUrl: reinbekMarriageUrl,
    bookingUrl: reinbekMarriageUrl,
    sources: [{ label: "Standesamt Reinbek", url: reinbekMarriageUrl }],
    lastVerified: "2026-07-31",
    schemaType: "EventVenue",
    includeInSchema: true,
  },
  {
    id: "gutshaus-glinde",
    name: "Gutshaus Glinde",
    region: "umland",
    category: "gut",
    officeName: "Standesamt Reinbek",
    address: {
      street: "Möllner Landstraße 53",
      postalCode: "21509",
      city: "Glinde",
    },
    bookingMode: "standesamt",
    bookingModeLabel: "Fristgenaue Reservierung beim Standesamt",
    status: "restricted",
    statusLabel: "Wohnsitz und Sondertermin",
    bookingSteps: [
      {
        actor: "standesamt",
        label: "Vorsprachetermin buchen",
        description:
          "Die Terminreservierung ist an die sechsmonatige Frist der Anmeldung gebunden; aktuellen Freischaltzeitpunkt im offiziellen Buchungssystem prüfen.",
        url: reinbekMarriageUrl,
      },
      {
        actor: "standesamt",
        label: "Originalunterlagen vorlegen",
        description:
          "Alle erforderlichen Unterlagen vollständig im Original mitbringen; nur dann wird reserviert.",
        url: reinbekMarriageUrl,
      },
    ],
    reservationWindow:
      "Die Reservierung ist an die sechsmonatige Frist der Anmeldung gebunden; aktuellen Freischaltzeitpunkt offiziell prüfen.",
    ceremonyDays:
      "Nur an einzelnen, vom Standesamt veröffentlichten Sonderterminen.",
    eligibilityNote:
      "Mindestens eine Person muss mit Haupt- oder Nebenwohnsitz in Reinbek, Glinde, Barsbüttel oder Wentorf bei Hamburg gemeldet sein.",
    authorityFee: "Aktuell 300 € Zusatzkosten für die Trauung im Gutshaus.",
    capacityNote:
      "30 Gäste zusätzlich zu Paar, Standesbeamtin oder Standesbeamtem und gegebenenfalls zwei Trauzeugen.",
    officialAuthorityUrl: reinbekMarriageUrl,
    bookingUrl: reinbekMarriageUrl,
    sources: [{ label: "Standesamt Reinbek", url: reinbekMarriageUrl }],
    lastVerified: "2026-07-31",
    schemaType: "EventVenue",
    includeInSchema: true,
  },
  {
    id: "gut-basthorst",
    name: "Gut Basthorst",
    region: "umland",
    category: "gut",
    officeName: "Standesamt Schwarzenbek-Land",
    address: {
      street: "Auf dem Gut 3",
      postalCode: "21493",
      city: "Basthorst",
    },
    bookingMode: "standesamt-and-venue",
    bookingModeLabel: "Standesamt und Gut abstimmen",
    status: "seasonal",
    statusLabel: "Freitage und ausgewählte Samstage",
    bookingSteps: [
      {
        actor: "standesamt",
        label: "Wunschtermin abstimmen",
        description:
          "Trautermin zuerst beim Standesamt Schwarzenbek-Land reservieren beziehungsweise bestätigen lassen.",
        url: "https://www.amt-schwarzenbek-land.de/Service/Standesamt/",
      },
      {
        actor: "venue",
        label: "Trauzimmer und Zusatzleistungen klären",
        description:
          "Raum, Empfang und weitere Leistungen anschließend direkt mit Gut Basthorst abstimmen.",
        url: "https://www.gut-basthorst.de/",
      },
    ],
    ceremonyDays: "Freitags um 11 und 13 Uhr sowie an ausgewählten Samstagen zu diesen Uhrzeiten.",
    authorityFee:
      "150 € innerhalb der Dienstzeit beziehungsweise 200 € außerhalb der Dienstzeit, zusätzlich zu den regulären Gebühren.",
    venueFee: "Aktuell 195 € zuzüglich Umsatzsteuer für die Bereitstellung des Trauzimmers.",
    capacityNote:
      "Kaminzimmer: Paar plus 10 Gäste. Jagdzimmer: Paar plus 30 Gäste.",
    officialAuthorityUrl:
      "https://www.amt-schwarzenbek-land.de/Service/Standesamt/",
    officialVenueUrl: "https://www.gut-basthorst.de/",
    bookingUrl: "https://www.amt-schwarzenbek-land.de/Service/Standesamt/",
    sources: [
      {
        label: "Standesamt Schwarzenbek-Land",
        url: "https://www.amt-schwarzenbek-land.de/Service/Standesamt/",
      },
      { label: "Gut Basthorst", url: "https://www.gut-basthorst.de/" },
    ],
    lastVerified: "2026-07-31",
    schemaType: "EventVenue",
    includeInSchema: true,
  },
  {
    id: "wassermuehle-karoxbostel",
    name: "Wassermühle Karoxbostel",
    region: "umland",
    category: "muehle",
    officeName: "Standesamt Seevetal–Neu Wulmstorf",
    address: {
      street: "Karoxbosteler Chaussee 51",
      postalCode: "21218",
      city: "Seevetal",
    },
    bookingMode: "standesamt-and-venue",
    bookingModeLabel: "Standesamt plus Mühlenverein",
    status: "seasonal",
    statusLabel: "Monatlicher Termin",
    bookingSteps: [
      {
        actor: "standesamt",
        label: "Trautermin reservieren",
        description:
          "Verfügbarkeit beim Standesamt Seevetal–Neu Wulmstorf erfragen und Trautermin dort reservieren.",
        url: "https://www.seevetal.de/portal/seiten/sie-wollen-heiraten--10000764-20200.html",
      },
      {
        actor: "venue",
        label: "Nutzung mit dem Verein abstimmen",
        description:
          "Raumnutzung und einen möglichen Empfang separat mit dem Mühlenverein vereinbaren.",
        url: "https://www.wassermuehle-karoxbostel.de/heiraten-in-der-muehle/",
      },
    ],
    ceremonyDays: "In der Regel am letzten Freitag eines Monats.",
    venueFee:
      "Eine veröffentlichte Angabe nennt 160 € Raumnutzung; den aktuellen Betrag vor der Buchung bestätigen lassen.",
    capacityNote: "Für kleine Gesellschaften; veröffentlichte Angabe: bis zu 25 Gäste.",
    officialAuthorityUrl:
      "https://www.seevetal.de/portal/seiten/sie-wollen-heiraten--10000764-20200.html",
    officialVenueUrl:
      "https://www.wassermuehle-karoxbostel.de/heiraten-in-der-muehle/",
    bookingUrl:
      "https://www.seevetal.de/portal/seiten/sie-wollen-heiraten--10000764-20200.html",
    sources: [
      {
        label: "Gemeinde Seevetal",
        url: "https://www.seevetal.de/portal/seiten/sie-wollen-heiraten--10000764-20200.html",
      },
      {
        label: "Wassermühle Karoxbostel",
        url: "https://www.wassermuehle-karoxbostel.de/heiraten-in-der-muehle/",
      },
    ],
    lastVerified: "2026-07-31",
    schemaType: "EventVenue",
    includeInSchema: true,
  },
  {
    id: "freilichtmuseum-kiekeberg",
    name: "Freilichtmuseum am Kiekeberg",
    region: "umland",
    category: "museum",
    officeName: "Standesamt Rosengarten",
    address: {
      street: "Am Kiekeberg 1",
      postalCode: "21224",
      city: "Rosengarten",
    },
    bookingMode: "standesamt-and-venue",
    bookingModeLabel: "Standesamt plus Museum",
    status: "seasonal",
    statusLabel: "Ein Termin pro Monat",
    bookingSteps: [
      {
        actor: "standesamt",
        label: "Trautermin reservieren",
        description:
          "Freien Termin und passenden saisonalen Trauraum beim Standesamt Rosengarten erfragen.",
        url: "https://www.gemeinde-rosengarten.de/portal/seiten/trauung-in-unseren-aussentraustellen-900000120-20170.html",
      },
      {
        actor: "venue",
        label: "Empfang oder Feier abstimmen",
        description:
          "Empfang, Bewirtung und Feier separat mit dem Freilichtmuseum vereinbaren.",
        url: "https://www.kiekeberg-museum.de/ihren-besuch-planen/mieten-feiern/heiraten-am-kiekeberg",
      },
    ],
    ceremonyDays:
      "Ein Termin monatlich; Pattenser Schmiede von Mai bis September, historischer Tanzsaal von Oktober bis April.",
    authorityFee: "40 € zusätzliche Gebühr für die Außentrauung.",
    venueFee: "330 € für den Trauraum.",
    capacityNote:
      "Je nach Saison etwa 40 Personen in der Schmiede oder bis zu 100 Personen im historischen Tanzsaal.",
    officialAuthorityUrl:
      "https://www.gemeinde-rosengarten.de/portal/seiten/trauung-in-unseren-aussentraustellen-900000120-20170.html",
    officialVenueUrl:
      "https://www.kiekeberg-museum.de/ihren-besuch-planen/mieten-feiern/heiraten-am-kiekeberg",
    bookingUrl:
      "https://www.gemeinde-rosengarten.de/portal/seiten/trauung-in-unseren-aussentraustellen-900000120-20170.html",
    sources: [
      {
        label: "Standesamt Rosengarten",
        url: "https://www.gemeinde-rosengarten.de/portal/seiten/trauung-in-unseren-aussentraustellen-900000120-20170.html",
      },
      {
        label: "Freilichtmuseum am Kiekeberg",
        url: "https://www.kiekeberg-museum.de/ihren-besuch-planen/mieten-feiern/heiraten-am-kiekeberg",
      },
    ],
    lastVerified: "2026-07-31",
    schemaType: "EventVenue",
    includeInSchema: true,
  },
  {
    id: "schlosskapelle-winsen",
    name: "Schlosskapelle Winsen",
    region: "umland",
    category: "schloss",
    officeName: "Standesamt Winsen (Luhe)",
    address: {
      street: "Schloßplatz 4",
      postalCode: "21423",
      city: "Winsen (Luhe)",
    },
    bookingMode: "standesamt",
    bookingModeLabel: "Reservierung beim Standesamt",
    status: "on-request",
    statusLabel: "Ausgewählte Termine",
    bookingSteps: [
      {
        actor: "standesamt",
        label: "Termine und Kapazität erfragen",
        description:
          "Aktuelle Trautage, freie Uhrzeiten und zulässige Gästezahl direkt beim Standesamt Winsen erfragen.",
        url: "https://www.winsen.de/portal/seiten/anmeldung-der-eheschliessung-902000071-20260.html",
      },
    ],
    ceremonyDays: "Ausgewählte Termine; der aktuelle Turnus ist nicht verlässlich veröffentlicht.",
    capacityNote: "Aktuelle Kapazität vor der Reservierung beim Standesamt bestätigen lassen.",
    officialAuthorityUrl:
      "https://www.winsen.de/portal/seiten/anmeldung-der-eheschliessung-902000071-20260.html",
    bookingUrl:
      "https://www.winsen.de/portal/seiten/anmeldung-der-eheschliessung-902000071-20260.html",
    sources: [
      {
        label: "Standesamt Winsen",
        url: "https://www.winsen.de/portal/seiten/anmeldung-der-eheschliessung-902000071-20260.html",
      },
    ],
    lastVerified: "2026-07-31",
    schemaType: "EventVenue",
    includeInSchema: true,
  },
  {
    id: "drostei-pinneberg",
    name: "Drostei Pinneberg",
    region: "umland",
    category: "sonstiges",
    officeName: "Standesamt Pinneberg",
    address: {
      street: "Dingstätte 23",
      postalCode: "25421",
      city: "Pinneberg",
    },
    bookingMode: "standesamt-and-venue",
    bookingModeLabel: "Prüfung beim Standesamt plus Locationleistungen",
    status: "regular",
    statusLabel: "Nach Prüfung buchbar",
    bookingSteps: [
      {
        actor: "standesamt",
        label: "Eheschließung anmelden",
        description:
          "Unterlagen beim Standesamt Pinneberg prüfen lassen und anschließend den Drostei-Termin vereinbaren.",
        url: "https://www.pinneberg.de/rathaus/anliegen/standesamt/hochzeitslocations",
      },
      {
        actor: "venue",
        label: "Gastronomie separat abstimmen",
        description:
          "Bewirtung oder Feier bei Bedarf unabhängig vom Trautermin mit dem Gastronomieanbieter vereinbaren.",
        url: "https://www.drostei.de/",
      },
    ],
    reservationWindow: "Die Trauung muss innerhalb von sechs Monaten nach der Prüfung stattfinden.",
    authorityFee: "50–80 € für die Prüfung und 150 € für die Trauung.",
    venueFee: "170 € Raummiete; Gastronomie zusätzlich nach Angebot.",
    capacityNote: "Der Betreiber nennt eine Kapazität von bis zu 40 Personen.",
    officialAuthorityUrl:
      "https://www.pinneberg.de/rathaus/anliegen/standesamt/hochzeitslocations",
    officialVenueUrl: "https://www.drostei.de/",
    bookingUrl:
      "https://www.pinneberg.de/rathaus/anliegen/standesamt/hochzeitslocations",
    sources: [
      {
        label: "Standesamt Pinneberg",
        url: "https://www.pinneberg.de/rathaus/anliegen/standesamt/hochzeitslocations",
      },
      { label: "Drostei Pinneberg", url: "https://www.drostei.de/" },
    ],
    lastVerified: "2026-07-31",
    schemaType: "EventVenue",
    includeInSchema: true,
  },
  {
    id: "schloss-agathenburg",
    name: "Schloss Agathenburg",
    region: "umland",
    category: "schloss",
    officeName: "Standesamt Horneburg",
    address: {
      street: "Hauptstraße 45",
      postalCode: "21684",
      city: "Agathenburg",
    },
    bookingMode: "standesamt-and-venue",
    bookingModeLabel: "Standesamt plus optionale Schlossleistungen",
    status: "seasonal",
    statusLabel: "April bis Oktober",
    bookingSteps: [
      {
        actor: "standesamt",
        label: "Trautermin reservieren",
        description:
          "Jahrestermine und freie Uhrzeiten beim Standesamt Horneburg erfragen und dort reservieren.",
        url: "https://www.horneburg.de/portal/seiten/herzlich-willkommen-im-standesamt-900000009-20450.html",
      },
      {
        actor: "venue",
        label: "Schlossleistungen abstimmen",
        description:
          "Sektempfang oder Feier im Gewölbekeller beziehungsweise Pferdestall separat mit dem Schloss vereinbaren.",
        url: "https://www.schlossagathenburg.de/",
      },
    ],
    reservationWindow: "Termine des Folgejahres werden nach veröffentlichter Regel ab 1. November vergeben.",
    ceremonyDays: "Ein festgelegter Termin pro Monat von April bis Oktober.",
    venueFee: "Aktuelle Gebühren für Raum und Zusatzleistungen sind nur auf Anfrage belastbar.",
    capacityNote: "Im Konzertsaal ist Platz für 30 Gäste.",
    officialAuthorityUrl:
      "https://www.horneburg.de/portal/seiten/herzlich-willkommen-im-standesamt-900000009-20450.html",
    officialVenueUrl: "https://www.schlossagathenburg.de/",
    bookingUrl:
      "https://www.horneburg.de/portal/seiten/herzlich-willkommen-im-standesamt-900000009-20450.html",
    sources: [
      {
        label: "Standesamt Horneburg",
        url: "https://www.horneburg.de/portal/seiten/herzlich-willkommen-im-standesamt-900000009-20450.html",
      },
      { label: "Schloss Agathenburg", url: "https://www.schlossagathenburg.de/" },
    ],
    lastVerified: "2026-07-31",
    schemaType: "EventVenue",
    includeInSchema: true,
  },
  {
    id: "ovelgoenner-wassermuehle",
    name: "Ovelgönner Wassermühle",
    region: "umland",
    category: "muehle",
    officeName: "Standesamt Buxtehude",
    meetingPoint: "Ortsteil Ovelgönne, Hemberg, zwischen B3 und B73.",
    bookingMode: "standesamt",
    bookingModeLabel: "Sondertermin beim Standesamt",
    status: "seasonal",
    statusLabel: "Wenige Termine pro Jahr",
    bookingSteps: [
      {
        actor: "standesamt",
        label: "Sondertermin reservieren",
        description:
          "Aktuelle Jahrestermine und Uhrzeiten telefonisch beim Standesamt Buxtehude erfragen und dort reservieren.",
        url: "https://www.buxtehude.de/buergerservice/verwaltung/standesamt-900000354-20351.html",
      },
    ],
    reservationWindow: "Die formelle Anmeldung ist frühestens sechs Monate vor der Eheschließung möglich.",
    ceremonyDays:
      "Wenige besondere Samstage; aktuelle Jahrestermine beim Standesamt Buxtehude erfragen.",
    authorityFee:
      "Für den Sondertermin fällt eine zusätzliche Gebühr an; aktuellen Betrag beim Standesamt erfragen.",
    capacityNote: "Aktuelle Veröffentlichung: rund 20 Sitzplätze; vor der Reservierung bestätigen lassen.",
    officialAuthorityUrl:
      "https://www.buxtehude.de/buergerservice/verwaltung/standesamt-900000354-20351.html",
    bookingUrl:
      "https://www.buxtehude.de/buergerservice/verwaltung/standesamt-900000354-20351.html",
    sources: [
      {
        label: "Standesamt Buxtehude",
        url: "https://www.buxtehude.de/buergerservice/verwaltung/standesamt-900000354-20351.html",
      },
    ],
    lastVerified: "2026-07-31",
    schemaType: "EventVenue",
    includeInSchema: true,
  },
  {
    id: "ms-klostersande",
    name: "MS Klostersande",
    region: "umland",
    category: "schiff",
    officeName: "Standesamt Elmshorn",
    meetingPoint: "Der aktuelle Liegeplatz muss vor der Buchung bestätigt werden.",
    bookingMode: "standesamt-and-venue",
    bookingModeLabel: "Traukalender und Schiff separat abstimmen",
    status: "on-request",
    statusLabel: "Nach Verfügbarkeit",
    bookingSteps: [
      {
        actor: "standesamt",
        label: "Trautermin reservieren",
        description:
          "Termin bis zu zwölf Monate im Voraus im Elmshorner Traukalender reservieren.",
        url: "https://www.elmshorn.de/Stadtportr%C3%A4t/Leben-in-Elmshorn/Standesamt/Heiraten-in-Elmshorn/Trauorte/",
      },
      {
        actor: "venue",
        label: "Schiffsbelegung bestätigen",
        description:
          "Parallel Verfügbarkeit, Liegeplatz und Nutzung direkt mit der MS Klostersande abstimmen.",
        url: "https://www.elmshorn.de/Stadtportr%C3%A4t/Leben-in-Elmshorn/Standesamt/Heiraten-in-Elmshorn/Trauorte/",
      },
    ],
    reservationWindow: "Bis zu zwölf Monate im Voraus im Traukalender.",
    ceremonyDays: "Nach veröffentlichten Terminen und Schiffsverfügbarkeit.",
    authorityFee: "150 € Zusatzgebühr für die Außentrauung.",
    venueFee: "200 € für das Schiff; weitere Leistungen nach Absprache.",
    accessibilityNote: "Das historische Schiff ist nicht barrierefrei.",
    officialAuthorityUrl:
      "https://www.elmshorn.de/Stadtportr%C3%A4t/Leben-in-Elmshorn/Standesamt/Heiraten-in-Elmshorn/Trauorte/",
    bookingUrl:
      "https://www.elmshorn.de/Stadtportr%C3%A4t/Leben-in-Elmshorn/Standesamt/Heiraten-in-Elmshorn/Trauorte/",
    sources: [
      {
        label: "Standesamt Elmshorn",
        url: "https://www.elmshorn.de/Stadtportr%C3%A4t/Leben-in-Elmshorn/Standesamt/Heiraten-in-Elmshorn/Trauorte/",
      },
      {
        label: "MS Klostersande im Trauortverzeichnis Elmshorn",
        url: "https://www.elmshorn.de/Stadtportr%C3%A4t/Leben-in-Elmshorn/Standesamt/Heiraten-in-Elmshorn/Trauorte/",
      },
    ],
    lastVerified: "2026-07-31",
    schemaType: "Place",
    includeInSchema: true,
  },
];

const publicBookingModeLabel: Record<TrauortBookingMode, string> = {
  standesamt: "Buchungsweg beim zuständigen Standesamt prüfen",
  "standesamt-and-venue": "Standesamt und Location getrennt bestätigen",
  "individual-approval": "Amtliche Bestätigung vor der Locationbuchung einholen",
};

export const trauorte: Trauort[] = researchedTrauorte.map((venue) => ({
  ...venue,
  bookingModeLabel: publicBookingModeLabel[venue.bookingMode],
  status: "on-request",
  statusLabel: "Aktuell offiziell prüfen",
  bookingSteps: [
    {
      actor: "standesamt",
      label: "Amtlichen Buchungsweg prüfen",
      description: `Verfügbarkeit, Zuständigkeit und Buchungsweg direkt bei ${venue.officeName} prüfen.`,
      url: venue.officialAuthorityUrl,
    },
    ...(venue.officialVenueUrl && venue.officialVenueUrl !== venue.officialAuthorityUrl
      ? [{
          actor: "venue" as const,
          label: "Location separat anfragen",
          description:
            "Nutzung, Zugang und mögliche Zusatzleistungen direkt mit der Location abstimmen.",
          url: venue.officialVenueUrl,
        }]
      : []),
  ],
  bookingUrl: venue.officialAuthorityUrl,
  reservationWindow: undefined,
  ceremonyDays: undefined,
  eligibilityNote: undefined,
  authorityFee: undefined,
  venueFee: undefined,
  feeValidThrough: undefined,
  capacityNote: undefined,
  accessibilityNote: undefined,
  includeInSchema: false,
}));
