export type HamburgerStandesamtId =
  | "altona"
  | "bergedorf"
  | "eimsbuettel"
  | "hamburg-mitte"
  | "hamburg-nord"
  | "harburg"
  | "wandsbek";

export type HamburgStadtteil = {
  name: string;
  officeId: HamburgerStandesamtId;
};

// Amtliche Gebietsgliederung: sieben Bezirke, 104 Stadtteile.
// Quellen:
// https://www.statistik-nord.de/zahlen-fakten/gebiet-flaeche/gebietsgliederung-hamburg
// https://www.hamburg.de/leben-in-hamburg/bezirke-hamburg
export const hamburgStadtteile = [
  // Hamburg-Mitte
  { name: "Billbrook", officeId: "hamburg-mitte" },
  { name: "Billstedt", officeId: "hamburg-mitte" },
  { name: "Borgfelde", officeId: "hamburg-mitte" },
  { name: "Finkenwerder", officeId: "hamburg-mitte" },
  { name: "HafenCity", officeId: "hamburg-mitte" },
  { name: "Hamburg-Altstadt", officeId: "hamburg-mitte" },
  { name: "Hamm", officeId: "hamburg-mitte" },
  { name: "Hammerbrook", officeId: "hamburg-mitte" },
  { name: "Horn", officeId: "hamburg-mitte" },
  { name: "Kleiner Grasbrook", officeId: "hamburg-mitte" },
  { name: "Neustadt", officeId: "hamburg-mitte" },
  // Amtlich gegengeprüft: Das frühere Standesamt Hamburg-Neuwerk wurde
  // zum 01.01.2012 mit Hamburg-Mitte zusammengelegt. Auch der aktuelle
  // Hamburger Zuständigkeitsfinder weist Neuwerk Hamburg-Mitte zu.
  { name: "Neuwerk", officeId: "hamburg-mitte" },
  { name: "Rothenburgsort", officeId: "hamburg-mitte" },
  { name: "St. Georg", officeId: "hamburg-mitte" },
  { name: "St. Pauli", officeId: "hamburg-mitte" },
  { name: "Steinwerder", officeId: "hamburg-mitte" },
  { name: "Veddel", officeId: "hamburg-mitte" },
  { name: "Waltershof", officeId: "hamburg-mitte" },
  { name: "Wilhelmsburg", officeId: "hamburg-mitte" },

  // Altona
  { name: "Altona-Altstadt", officeId: "altona" },
  { name: "Altona-Nord", officeId: "altona" },
  { name: "Bahrenfeld", officeId: "altona" },
  { name: "Blankenese", officeId: "altona" },
  { name: "Groß Flottbek", officeId: "altona" },
  { name: "Iserbrook", officeId: "altona" },
  { name: "Lurup", officeId: "altona" },
  { name: "Nienstedten", officeId: "altona" },
  { name: "Osdorf", officeId: "altona" },
  { name: "Othmarschen", officeId: "altona" },
  { name: "Ottensen", officeId: "altona" },
  { name: "Rissen", officeId: "altona" },
  { name: "Sternschanze", officeId: "altona" },
  { name: "Sülldorf", officeId: "altona" },

  // Eimsbüttel
  { name: "Eidelstedt", officeId: "eimsbuettel" },
  { name: "Eimsbüttel", officeId: "eimsbuettel" },
  { name: "Harvestehude", officeId: "eimsbuettel" },
  { name: "Hoheluft-West", officeId: "eimsbuettel" },
  { name: "Lokstedt", officeId: "eimsbuettel" },
  { name: "Niendorf", officeId: "eimsbuettel" },
  { name: "Rotherbaum", officeId: "eimsbuettel" },
  { name: "Schnelsen", officeId: "eimsbuettel" },
  { name: "Stellingen", officeId: "eimsbuettel" },

  // Hamburg-Nord
  { name: "Alsterdorf", officeId: "hamburg-nord" },
  { name: "Barmbek-Nord", officeId: "hamburg-nord" },
  { name: "Barmbek-Süd", officeId: "hamburg-nord" },
  { name: "Dulsberg", officeId: "hamburg-nord" },
  { name: "Eppendorf", officeId: "hamburg-nord" },
  { name: "Fuhlsbüttel", officeId: "hamburg-nord" },
  { name: "Groß Borstel", officeId: "hamburg-nord" },
  { name: "Hoheluft-Ost", officeId: "hamburg-nord" },
  { name: "Hohenfelde", officeId: "hamburg-nord" },
  { name: "Langenhorn", officeId: "hamburg-nord" },
  { name: "Ohlsdorf", officeId: "hamburg-nord" },
  { name: "Uhlenhorst", officeId: "hamburg-nord" },
  { name: "Winterhude", officeId: "hamburg-nord" },

  // Wandsbek
  { name: "Bergstedt", officeId: "wandsbek" },
  { name: "Bramfeld", officeId: "wandsbek" },
  { name: "Duvenstedt", officeId: "wandsbek" },
  { name: "Eilbek", officeId: "wandsbek" },
  { name: "Farmsen-Berne", officeId: "wandsbek" },
  { name: "Hummelsbüttel", officeId: "wandsbek" },
  { name: "Jenfeld", officeId: "wandsbek" },
  { name: "Lemsahl-Mellingstedt", officeId: "wandsbek" },
  { name: "Marienthal", officeId: "wandsbek" },
  { name: "Poppenbüttel", officeId: "wandsbek" },
  { name: "Rahlstedt", officeId: "wandsbek" },
  { name: "Sasel", officeId: "wandsbek" },
  { name: "Steilshoop", officeId: "wandsbek" },
  { name: "Tonndorf", officeId: "wandsbek" },
  { name: "Volksdorf", officeId: "wandsbek" },
  { name: "Wandsbek", officeId: "wandsbek" },
  { name: "Wellingsbüttel", officeId: "wandsbek" },
  { name: "Wohldorf-Ohlstedt", officeId: "wandsbek" },

  // Bergedorf
  { name: "Allermöhe", officeId: "bergedorf" },
  { name: "Altengamme", officeId: "bergedorf" },
  { name: "Bergedorf", officeId: "bergedorf" },
  { name: "Billwerder", officeId: "bergedorf" },
  { name: "Curslack", officeId: "bergedorf" },
  { name: "Kirchwerder", officeId: "bergedorf" },
  { name: "Lohbrügge", officeId: "bergedorf" },
  { name: "Moorfleet", officeId: "bergedorf" },
  { name: "Neuallermöhe", officeId: "bergedorf" },
  { name: "Neuengamme", officeId: "bergedorf" },
  { name: "Ochsenwerder", officeId: "bergedorf" },
  { name: "Reitbrook", officeId: "bergedorf" },
  { name: "Spadenland", officeId: "bergedorf" },
  { name: "Tatenberg", officeId: "bergedorf" },

  // Harburg
  { name: "Altenwerder", officeId: "harburg" },
  { name: "Cranz", officeId: "harburg" },
  { name: "Eißendorf", officeId: "harburg" },
  { name: "Francop", officeId: "harburg" },
  { name: "Gut Moor", officeId: "harburg" },
  { name: "Harburg", officeId: "harburg" },
  { name: "Hausbruch", officeId: "harburg" },
  { name: "Heimfeld", officeId: "harburg" },
  { name: "Langenbek", officeId: "harburg" },
  { name: "Marmstorf", officeId: "harburg" },
  { name: "Moorburg", officeId: "harburg" },
  { name: "Neuenfelde", officeId: "harburg" },
  { name: "Neugraben-Fischbek", officeId: "harburg" },
  { name: "Neuland", officeId: "harburg" },
  { name: "Rönneburg", officeId: "harburg" },
  { name: "Sinstorf", officeId: "harburg" },
  { name: "Wilstorf", officeId: "harburg" },
] as const satisfies readonly HamburgStadtteil[];
