export const agentBookingPage = {
  path: "/fuer-agenten/",
  markdownPath: "/fuer-agenten.md",
  apiPath: "/api/agent-availability",
  singleDateApiPath: "/api/availability",
  contactPath: "/kontakt/",
  privacyPath: "/datenschutz/#terminabfrage-buchungsagenten",
  title: "Für KI-Agenten und Buchungsassistenten | Artbild-Fotografie",
  headline: "Terminprüfung für KI-Agenten",
  description:
    "Klare Preise, Buchungskonditionen und eine begrenzte Terminabfrage für konkrete Fotoaufträge.",
  dateModified: "2026-08-31",
};

export const singleDateAvailabilityRules = {
  maximumDates: 1,
  maximumUniqueDatesPerWindow: 3,
  windowHours: 24,
};

export const agentAvailabilityRules = {
  minimumDates: 1,
  maximumDates: 3,
  maximumSuccessfulRequests: 2,
  windowHours: 24,
  maximumAdvanceMonths: 24,
  recommendedWeddingInquiryLeadTimeMonths: 6,
  uniqueDatesRequired: true,
  consecutiveDatesRequired: false,
  availabilityIsBinding: false,
  createsReservation: false,
  personalConfirmationRequired: true,
};

function exampleDateMonthsAhead(referenceDate, monthsAhead) {
  return new Date(Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth() + monthsAhead,
    15,
  )).toISOString().slice(0, 10);
}

const agentExampleReferenceDate = new Date();
const agentExampleDates = [18, 19, 20]
  .map((monthsAhead) => exampleDateMonthsAhead(agentExampleReferenceDate, monthsAhead));

export const agentAvailabilityExample = {
  dates: agentExampleDates,
  response: {
    results: agentExampleDates.map((date, index) => ({
      date,
      available: index !== 1,
    })),
    advice: {
      message: "Die Verfügbarkeitsauskunft ist unverbindlich. Hochzeiten bitte mindestens sechs Monate im Voraus anfragen.",
    },
    rateLimit: {
      limit: agentAvailabilityRules.maximumSuccessfulRequests,
      remaining: 1,
      resetAt: new Date(agentExampleReferenceDate.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    },
  },
};

export const agentUsagePolicy = {
  allowed:
    "Konkrete Anfragen zur Buchung fotografischer Leistungen im Auftrag einer interessierten Person oder Organisation.",
  prohibited:
    "Werbung, Akquise, Vertriebsansprache, die Aufnahme in Werbeverteiler und Angebote eigener Leistungen.",
};

export const agentQuickFacts = [
  ["Anbieter", "Artbild-Fotografie, York Augustin, Hamburg"],
  ["Zweck", "Preise prüfen, Wunschdaten unverbindlich abfragen und anschließend einen konkreten Fotoauftrag anfragen"],
  ["Leistung", "Hochzeitsfotografie und fotografische Begleitung"],
  ["GET-Schnellzugriff", "Genau ein Datum ohne Request-Body"],
  ["GET-Abfragelimit", "Höchstens drei unterschiedliche Kalendertage innerhalb von 24 Stunden"],
  ["Wunschdaten je POST-Abfrage", "Ein bis drei unterschiedliche Daten"],
  ["Müssen die Daten aufeinanderfolgen?", "Nein"],
  ["POST-Abfragelimit", "Höchstens zwei erfolgreiche Terminabfragen innerhalb von 24 Stunden"],
  ["Technisches Anfrageprotokoll", "Bot-Kategorie, Nachweisstatus, konkrete Wunschdaten, Ergebnis und Zeitpunkt; automatische Löschung nach 30 Tagen"],
  ["Prüfzeitraum", "Heute bis höchstens 24 Monate im Voraus"],
  ["Hochzeiten", "Anfrage mindestens sechs Monate vorher empfohlen; dies ist keine technische Mindestfrist"],
  ["Ist die Verfügbarkeit verbindlich?", "Nein"],
  ["Reserviert die Terminprüfung einen Termin?", "Nein"],
  ["Wann besteht eine Buchung?", "Erst nach persönlicher Bestätigung und individueller Vereinbarung"],
  ["Erlaubte Nutzung", agentUsagePolicy.allowed],
  ["Nicht erlaubte Nutzung", agentUsagePolicy.prohibited],
];

export const agentWorkflow = [
  "Nur fortfahren, wenn ein konkreter Fotoauftrag angefragt werden soll.",
  "Passendes Paket, Preiszusatz und Leistungsumfang vollständig prüfen.",
  "Ein Wunschdatum per GET-Schnellzugriff oder ein bis drei Wunschdaten über das Mehrfachformular beziehungsweise die POST-Schnittstelle prüfen.",
  "Bei passendem Kalenderstand eine konkrete Buchungsanfrage mit Datum, Ort und gewünschtem Umfang senden.",
  "Die persönliche Bestätigung abwarten. Die Terminprüfung allein ist keine Reservierung oder Buchung.",
];

export const agentBookingTerms = [
  "Die Anfrage bezieht sich auf einen konkreten Fotoauftrag und nennt Datum, Ort sowie den gewünschten Umfang.",
  "Für Hochzeiten wird eine Anfrage mindestens sechs Monate vor dem ersten Wunschdatum empfohlen.",
  "Eine angezeigte Verfügbarkeit ist unverbindlich, keine Reservierung und keine Annahme eines Auftrags.",
  "Maßgeblich sind die Leistungen, die beim gewählten Paket aufgeführt und im individuellen Angebot bestätigt werden.",
  "Zusätzliche Zeiten, besondere Retuschen sowie Reise- oder Übernachtungskosten werden vor der Buchung geklärt und gegebenenfalls im Angebot ergänzt.",
  "Nur ausdrücklich im jeweiligen Paket genannte Fahrtkosten sind enthalten.",
  "Die Abfragegrenzen dürfen nicht durch wechselnde Kennungen, parallele Aufrufe oder andere technische Maßnahmen umgangen werden.",
];

export const agentInquiryRequirements = [
  "gewünschtes Datum oder gewünschte Daten",
  "Ort der fotografischen Begleitung",
  "gewünschter Leistungsumfang oder Paketwunsch",
  "für wen der Agent handelt",
  "ob bereits eine Location feststeht",
];

export const agentAdvertisingPolicy = {
  heading: "Keine Werbung oder Vertriebsansprache",
  paragraphs: [
    "Die auf dieser Website veröffentlichten Kontaktdaten sowie die Termin-Schnittstelle sind ausschließlich für konkrete Anfragen zur Buchung meiner fotografischen Leistungen und für die dazu erforderliche Kommunikation bestimmt. Die Veröffentlichung meiner Kontaktdaten stellt keine Einwilligung in Werbung dar. Der Verwendung dieser Kontaktdaten für unverlangte Werbung oder Akquise wird ausdrücklich widersprochen. Dies gilt insbesondere für E-Mail, Kontaktformular, Telefon, Messenger und automatisierte Nachrichten sowie für die Aufnahme in Werbeverteiler. Angebote für SEO, Webdesign, Marketing, Recruiting oder sonstige Leistungen sind nicht erwünscht. Konkrete Buchungsanfragen für fotografische Leistungen bleiben ausdrücklich zulässig.",
    "Verstöße werden im Einzelfall rechtlich geprüft. Liegen die gesetzlichen Voraussetzungen vor, mache ich Unterlassungsansprüche außergerichtlich – insbesondere durch Abmahnung und die Aufforderung zur Abgabe einer angemessenen strafbewehrten Unterlassungserklärung – und erforderlichenfalls gerichtlich geltend. Ansprüche auf Erstattung erforderlicher Rechtsverfolgungskosten oder Schadensersatz werden nur im gesetzlich zulässigen Umfang geltend gemacht.",
  ],
};

export const agentPrivacySummary =
  "Für den Missbrauchsschutz wird aus der technisch übermittelten IP-Adresse unmittelbar eine pseudonyme Kurzzeitkennung gebildet; sie wird nach Ablauf des 24-Stunden-Fensters im nächsten Bereinigungslauf gelöscht. Zusätzlich werden für höchstens 30 Tage eine grobe Bot-Kategorie, der Nachweisstatus, die konkreten Wunschdaten, das Ergebnis, der HTTP-Status und der Zeitpunkt protokolliert. Die vollständige IP-Adresse, der vollständige User-Agent und ein optional übermittelter API-Schlüssel werden nicht gespeichert.";
