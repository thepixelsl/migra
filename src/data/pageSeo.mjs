/**
 * Reviewed search intent and preferred original photograph per canonical page.
 * Missing description/title means keep the already suitable page-authored copy.
 * `keyword` is an editorial audit field, not a meta-keywords tag.
 * Paths are source files, never transient Astro build hashes.
 * No invented ratings, dates, locations, official status or keyword-only content.
 */
export const pageSeo = {
  "/": { keyword: "Hochzeitsfotograf Hamburg", preserveHomepage: true },
  "/about/": {
    keyword: "York Augustin Fotograf Hamburg",
    image: "public/images/portrait-riverside.jpg",
    alt: "York Augustin, Fotograf von Artbild-Fotografie, am Wasser",
  },
  "/blog/": {
    keyword: "Hochzeit Hamburg Tipps",
    description: "Hochzeit in Hamburg planen: Tipps zu Getting Ready, Locations und Trauterminen, dazu Hochzeitsreportagen und Fotowissen im Blog von Artbild-Fotografie.",
    image: "public/migrated-assets/traum-hochzeit-location-hamburg/ART_7349-scaled.jpg",
    alt: "Braut im Fensterlicht einer Hamburger Hotelsuite",
    focalPoint: "top",
  },
  "/braut-fotoshooting-fraser-suites-hamburg/": {
    keyword: "Braut Fotoshooting Fraser Suites Hamburg",
    image: "src/assets/hochzeitsfotos-hamburg/555b999643b90697.jpg",
    alt: "Braut mit Blumenstrauß auf der Treppe der Fraser Suites Hamburg",
  },
  "/brautpaar-in-zuerich/": {
    keyword: "Brautpaarshooting Zürich",
    description: "Brautpaarshooting in Zürich: Editorial mit Stephanie und Laurin an der Limmat und in der Stadt. Entdeckt natürliche Paarportraits und urbane Hochzeitsinspiration.",
    image: "src/assets/brautpaar-zuerich/ART_8515-Bearbeitet-scaled.jpg",
    alt: "Stephanie und Laurin beim Brautpaar-Editorial in Zürich",
  },
  "/brautstyling-hamburg/": {
    keyword: "Brautstyling Hamburg",
    image: "src/assets/getting-ready-hamburg/getting_ready_hochzeitsfotograf_hamburg2385-768x513.jpg",
    alt: "Braut beim Styling im Fensterlicht in Hamburg",
  },
  "/das-perfekte-getting-ready-fuer-deine-hochzeit-in-hamburg/": {
    keyword: "Getting Ready Hamburg planen",
    image: "src/assets/hochzeitsfotos-hamburg/5e02af00ed8dc76f.jpg",
    alt: "Visagistin schminkt eine Braut beim Getting Ready im Hotel",
  },
  "/datenschutz/": {
    keyword: "Artbild-Fotografie Datenschutz",
    image: "public/images/portrait-riverside.jpg",
    alt: "York Augustin, Ansprechpartner bei Artbild-Fotografie",
  },
  "/die-perfekte-hotelsuite-am-hochzeitsmorgen/": {
    keyword: "Hotelsuite Getting Ready Hamburg",
    title: "Getting Ready: Die passende Hotelsuite in Hamburg",
    image: "src/assets/die-perfekte-hotelsuite-am-hochzeitsmorgen/ART_7479-Verbessert-RR.jpg",
    alt: "Brautkleid-Editorial in einer hellen Hotelsuite mit großen Fenstern",
  },
  "/fuer-agenten/": {
    keyword: "Hochzeitsfotograf Hamburg Buchungsinformationen",
    description: "Hochzeitsfotograf Hamburg für Buchungsagenten und KI-Assistenten: Pakete, Leistungen und Konditionen prüfen, konkrete Termine abfragen und Anfragen vorbereiten.",
    image: "src/assets/hochzeitsfotograf-preise/ART9896-1-1.jpg",
    alt: "Lachendes Paar bei einem Fotoshooting von Artbild-Fotografie",
  },
  "/gallery-category/hochzeit/": {
    keyword: "Hochzeitsreportagen Hamburg Bilder",
    image: "src/assets/valerie-und-tim/ART_4449.jpg",
    alt: "Valerie und Tim mit Brautstrauß bei ihrer Hochzeit im Grünen",
  },
  "/gallery-category/travel/": {
    keyword: "Reisefotografie Landschaftsfotografie",
    image: "src/assets/travel-galleries/hamburg/ART_4908-Bearbeitet.jpg",
    alt: "Hamburger Architektur und Spiegelungen im Wasser zur blauen Stunde",
  },
  "/gallery/braeutigam-im-barberhouse-hamburg/": {
    keyword: "Bräutigam Barberhouse Hamburg",
    image: "src/assets/braeutigam-im-barberhouse-hamburg/ART_5120-Bearbeitet.jpg",
    alt: "Lachender Bräutigam und Barbier im Barberhouse Hamburg",
    focalPoint: "top",
  },
  "/gallery/brautkleid-editorial-paris/": {
    keyword: "Brautkleid Editorial Paris",
    image: "src/assets/paris-bridal-editorial/ART_4765.jpg",
    alt: "Brautkleid-Editorial mit Eiffelturm in Paris",
  },
  "/gallery/der-norden-und-die-kueste/": {
    keyword: "Landschaftsfotografie Norddeutschland Küste",
    description: "Landschaftsfotografie aus Norddeutschland: Küste, Wasser und weite Horizonte im wechselnden Licht. Entdeckt die Bildergalerie von Artbild-Fotografie.",
    image: "src/assets/travel-galleries/der-norden-und-die-kueste/K1024_poel-2.jpg",
    alt: "Sonnenuntergang über dem Meer an der norddeutschen Küste",
  },
  "/gallery/editorial-london/": {
    keyword: "Editorial Fotoshooting London",
    image: "src/assets/editorial-london/ART_7899-Bearbeitet.jpg",
    alt: "Mariam beim Editorial-Shooting vor dem Palace of Westminster in London",
  },
  "/gallery/editorial/": {
    keyword: "Portraitfotografie Hamburg",
    description: "Portraitfotografie Hamburg: Natürliche, magazinartige Portraits von Hamburgerinnen und Hamburgern – auch ohne Kameraerfahrung. Editorial-Galerie ansehen.",
    image: "src/assets/editorial/ART_9706-Bearbeitet-Bearbeitet.jpg",
    alt: "Editorial-Portrait einer Frau auf einer Hamburger Straße",
  },
  "/gallery/ella-deck-couture/": {
    keyword: "Ella Deck Couture Hamburg Brautkleider",
    title: "Ella Deck Couture Hamburg: Brautmode & Einblicke",
    image: "src/assets/ella-deck-couture/ella_deck_couture-scaled.jpg",
    alt: "Portrait von Ella Deck in ihrer Boutique in Hamburg-Eppendorf",
  },
  "/gallery/floral-art/": {
    keyword: "Floral Art florale Portraits",
    description: "Floral Art: Kreative Portraits mit Blüten, Blumen und ungewöhnlichen Bildideen von Artbild-Fotografie. Galerie entdecken und eigenes florales Shooting anfragen.",
    image: "public/migrated-assets/gallery__floral-art/blumenkopf_1-1_thumb.jpg",
    alt: "Künstlerisches Schwarzweiß-Portrait mit einem großen floralen Kopfschmuck",
  },
  "/gallery/getting-ready-hamburg/": {
    keyword: "Getting Ready Hamburg Bilder",
    image: "src/assets/getting-ready-hamburg/getting_ready_hochzeitsfotograf_hamburg3444-683x1024.jpg",
    alt: "Lachende Braut mit Schleier beim Getting Ready in Hamburg",
  },
  "/gallery/hamburg/": {
    keyword: "Hamburg Landschaftsfotografie",
    description: "Hamburg in Bildern: Architektur, Wasser und Nachtlicht, fotografiert mit Langzeitbelichtung und ND-Filter. Entdeckt Stadtansichten und ruhige Lichtstimmungen.",
    image: "src/assets/travel-galleries/hamburg/ART_4908-Bearbeitet.jpg",
    alt: "Hamburger Stadtansicht mit beleuchteten Gebäuden und Spiegelungen im Wasser",
  },
  "/gallery/hannover/": {
    keyword: "Hannover Stadtbilder",
    description: "Hannover in Bildern: Ruhige Stadtansichten, Architektur und herbstliche Landschaften. Entdeckt die Reisefotografie-Galerie von Artbild-Fotografie.",
    image: "src/assets/travel-galleries/hannover/ART_3528-HDR_print.jpg",
    alt: "Neues Rathaus Hannover mit Spiegelung im Wasser und Herbstlaub",
  },
  "/gallery/hochzeit-braut-fotoshooting-hamburg/": {
    keyword: "Braut Fotoshooting Hamburg",
    image: "src/assets/braut-fotoshooting-hamburg/ART_8686-Bearbeitet-2-scaled.jpg",
    alt: "Nahes Brautportrait mit Schleier im Hotel Atlantic Hamburg",
  },
  "/gallery/hochzeit-jahrhunderhalle-bochum/": {
    keyword: "Hochzeit Jahrhunderthalle Bochum",
    image: "src/assets/hochzeit-jahrhunderhalle-bochum/ART_1916-Bearbeitet.jpg",
    alt: "Hochzeitspaar und Begleitung vor der Industriearchitektur der Jahrhunderthalle Bochum",
  },
  "/gallery/hochzeit-valerie-und-tim/": {
    keyword: "Hochzeitsreportage Valerie Tim",
    image: "src/assets/valerie-und-tim/ART_4449.jpg",
    alt: "Tim küsst Valerie bei einem ruhigen Brautpaarportrait im Park",
  },
  "/gallery/hochzeitsfotograf-niedersachsen/": {
    keyword: "Hochzeitsfotograf Niedersachsen Lauenbrück",
    image: "src/assets/hochzeitsfotograf-niedersachsen/Hochzeit_Lauenbrueck_4794-1-1024x684.jpg",
    alt: "Kathrin und Sven küssen sich bei ihrer Hochzeit in Niedersachsen",
  },
  "/gallery/hochzeitsfotos-hamburg/": {
    keyword: "Hochzeitsfotos Hamburg Fraser Suites",
    description: "Hochzeitsfotos Hamburg als Inspiration: Brautkleid-Editorial in den Fraser Suites mit elegantem Treppenhaus, Fensterlicht und Getting-Ready-Momenten.",
    image: "src/assets/hochzeitsfotos-hamburg/ff9af8435a08e944.jpg",
    alt: "Braut hält ihren Schleier vor einer Holztür der Fraser Suites Hamburg",
  },
  "/gallery/lovebirds-am-elbstrand/": {
    keyword: "Verlobungsshooting Hamburg Elbstrand",
    title: "Verlobungsshooting Hamburg am Elbstrand",
    description: "Verlobungsshooting am Hamburger Elbstrand: Natürliche Paarbilder und gute Gründe, Euren Hochzeitsfotografen schon vor dem großen Tag kennenzulernen.",
    image: "src/assets/lovebirds-am-elbstrand/art-8413.jpg",
    alt: "Nahes Paarportrait beim Verlobungsshooting am Hamburger Elbstrand",
  },
  "/gallery/mallorca/": {
    keyword: "Mallorca Landschaftsfotografie",
    image: "src/assets/travel-galleries/mallorca/ART_1881-HDR-Bearbeitet.jpg",
    alt: "Kathedrale von Palma auf Mallorca mit Spiegelung im Wasser",
  },
  "/gallery/paarshooting-mallorca/": {
    keyword: "Paarshooting Mallorca",
    image: "src/assets/paarshooting-mallorca/ART0783-1.jpg",
    alt: "Schwarzweiß-Portrait eines küssenden Paares im Gegenlicht auf Mallorca",
    focalPoint: "top",
  },
  "/gallery/paris/": {
    keyword: "Paris Stadtfotografie",
    image: "src/assets/travel-galleries/paris/DSC_4967.jpg",
    alt: "Pariser Häuser und Brücke über die Seine",
  },
  "/gallery/standesamtliche-trauung-standesamt-altona-hochzeitsfotograf-hamburg/": {
    keyword: "Standesamt Altona Hochzeitsreportage",
    image: "src/assets/standesamt-altona/trauung_standesamt_altona_hamburg0746-1024x684.jpg",
    alt: "Roberta und Daniel küssen sich nach ihrer standesamtlichen Trauung in Hamburg-Altona",
  },
  "/gallery/steffi-dominik/": {
    keyword: "Hochzeit Buchholz Nordheide",
    image: "src/assets/steffi-dominik/ART3557-Bearbeitet-2-1024x684.jpg",
    alt: "Inniges Schwarzweiß-Portrait von Steffi und Dominik vor einer Holzfassade",
  },
  "/gallery/teneriffa/": {
    keyword: "Teneriffa Landschaftsfotografie",
    description: "Landschaftsfotografie auf Teneriffa: Entdeckt Inselansichten, besondere Lichtstimmungen und weite Landschaften in der Galerie von Artbild-Fotografie.",
    image: "src/assets/travel-galleries/teneriffa/K1024_Unbenannt-28.jpg",
    alt: "Berglandschaft auf Teneriffa mit Spiegelung im Wasser",
  },
  "/gallery/traumhochzeit-in-hamburg/": {
    keyword: "Hochzeit Hotel Atlantic Hamburg",
    image: "src/assets/portfolio/traumhochzeit-hamburg.jpg",
    alt: "Brautpaar bei einem innigen Portrait an der Hamburger Alster",
  },
  "/gallery/traumhochzeit-in-paris/": {
    keyword: "Hochzeitsfotografie Paris Editorial",
    image: "src/assets/traumhochzeit-paris-2019/ART_5851_web.jpg",
    alt: "Braut-Editorial unter den historischen Arkaden in Paris",
  },
  "/gallery/venedig/": {
    keyword: "Venedig Reisefotografie",
    description: "Venedig und Murano in Bildern: Kanäle, Architektur und italienische Stadtlandschaften. Entdeckt die Reisefotografie-Galerie von Artbild-Fotografie.",
    image: "src/assets/travel-galleries/venedig/ART_8436-HDR.jpg",
    alt: "Beleuchtete Häuser und Boote am Canal Grande in Venedig",
  },
  "/gallery/visagistin-manja-biebow/": {
    keyword: "Visagistin Manija Biebow Hamburg",
    image: "src/assets/brautstyling-hamburg/manija-biebow-brautstyling-hamburg.jpg",
    alt: "Portrait der Hamburger Visagistin Manija Biebow in ihrem Salon",
  },
  "/gallery/yildiz-duman-werner/": {
    keyword: "Yildiz Duman-Werner Brautstyling Hamburg",
    description: "Brautstyling Hamburg mit Yildiz Duman-Werner von Dizzy Dee Styles: Hair & Make-up in gemeinsamen Bridal-Editorials von Artbild-Fotografie entdecken.",
    image: "src/assets/yildiz-duman-werner/brautfrisur-offenes-haar.jpg",
    alt: "Brautportrait mit offenem Haar und Make-up von Yildiz Duman-Werner",
  },
  "/getting-ready-diese-fehler-solltest-du-unbedingt-vermeiden/": {
    keyword: "Getting Ready Fehler vermeiden",
    description: "Getting Ready planen: 3 häufige Fehler bei Hochzeitsfotos vermeiden. Tipps zu aufgeräumten Räumen, Zeitpuffer und Kennenlernshooting vor Eurer Hochzeit.",
    image: "src/assets/getting-ready-fehler/getting-ready-brautstyling-hamburg.jpg",
    alt: "Aufgeräumtes Hotelzimmer mit hellem Bett als Raum für den Hochzeitsmorgen",
  },
  "/hochzeitsfotograf-preise/": {
    keyword: "Hochzeitsfotograf Hamburg Preise",
    // Resolved from the rendered package below, so price changes cannot leave a stale promise.
    pricePackage: "pure-moments",
    image: "src/assets/hochzeitsfotograf-preise/ART9896-1-1.jpg",
    alt: "Lachendes Paar im Gegenlicht bei einem Fotoshooting von Artbild-Fotografie",
    focalPoint: "top",
  },
  "/hochzeitsfotograf-ratgeber/": {
    keyword: "Hochzeitsfotograf Kosten vergleichen",
    title: "Hochzeitsfotograf Kosten: Pakete & Budget vergleichen",
    description: "Was kostet ein Hochzeitsfotograf? So vergleicht Ihr Stundenpreise, Bildbearbeitung, Fahrtkosten und Pakete für Eure Hochzeit in Hamburg ohne Kostenfallen.",
    image: "src/assets/hochzeitsfotograf-ratgeber/hochzeitsfotograf-hamburg-ratgeber-art9666.jpg",
    alt: "Paar lacht bei einem entspannten Kennenlernshooting",
  },
  "/hochzeitsfotograf-standesamt-hamburg-altona/": {
    keyword: "Hochzeitsfotograf Standesamt Hamburg Altona",
    description: "Hochzeitsfotograf für das Standesamt Hamburg-Altona: Eure Trauung, Paarbilder am Altonaer Balkon und an der Elbe. Persönliches Festpreisangebot anfragen.",
    image: "public/migrated-assets/hochzeitsfotograf-standesamt-hamburg-altona/rathaus-altona.jpg",
    alt: "Rathaus Altona mit Reiterdenkmal und Säulenfassade",
  },
  "/impressum/": {
    keyword: "Artbild-Fotografie Impressum",
    image: "public/images/portrait-riverside.jpg",
    alt: "York Augustin, Inhaber von Artbild-Fotografie",
  },
  "/kontakt/": {
    keyword: "Hochzeitsfotograf Hamburg anfragen",
    image: "public/images/portrait-riverside.jpg",
    alt: "Euer Ansprechpartner York Augustin von Artbild-Fotografie",
  },
  "/location-scouting-in-paris/": {
    keyword: "Location Scouting Paris Fotoshooting",
    description: "Location Scouting in Paris für ein Braut-Editorial: Fotospots, Vorbereitung und Planung bei wechselndem Wetter. Einblicke und Bilder von Artbild-Fotografie.",
    image: "public/migrated-assets/location-scouting-in-paris/ART_0342-Bearbeitet-Bearbeitet-scaled.jpg",
    alt: "Louvre und gläserne Pyramide beim Location Scouting in Paris",
  },
  "/nd-filter-tabelle/": {
    keyword: "ND-Filter Tabelle PDF",
    title: "ND-Filter Tabelle als PDF: Belichtungszeiten ablesen",
    description: "ND-Filter Tabelle als kostenloses PDF zum Ausdrucken: Belichtungszeiten für Graufilter von ND 0.3 bis ND 3.0 ablesen. Mit Anleitung für Langzeitbelichtungen.",
    image: "public/migrated-assets/nd-filter-tabelle/ND-Filter-Tabelle-e1566288047251.jpg",
    alt: "ND-Filter-Tabelle mit Belichtungszeiten und Verlängerungsfaktoren",
    fit: "contain",
  },
  "/newsletter/": {
    keyword: "TFP Shootings Hamburg",
    image: "src/assets/editorial/ART_6856-Bearbeitet.jpg",
    alt: "Editorial-Portrait einer Frau auf einer Stadtstraße",
  },
  "/portfolio/": {
    keyword: "Hochzeitsfotografie Hamburg Portfolio",
    image: "src/assets/valerie-und-tim/ART_4449.jpg",
    alt: "Natürliche Hochzeitsfotografie: Valerie und Tim im Park",
  },
  "/sicherer-kontakt/": {
    keyword: "Artbild-Fotografie PGP Kontakt",
    image: "public/images/portrait-riverside.jpg",
    alt: "York Augustin, Ansprechpartner von Artbild-Fotografie",
  },
  "/standesamt-hamburg/": {
    keyword: "Standesamt Hamburg Adressen Trauorte",
    image: "public/migrated-assets/standesamt-hamburg/rathaus-altona.jpg",
    alt: "Rathaus Altona als einer der Hamburger Trauorte",
  },
  "/traum-hochzeit-location-hamburg/": {
    keyword: "Hochzeitslocations Hamburg Getting Ready",
    title: "Hochzeitslocations Hamburg: Ideen für Euren Hochzeitsmorgen",
    description: "Hochzeitslocations in Hamburg für schöne Fotos: Inspiration zu The George, Hotelsuiten und Getting Ready zu Hause. Tipps und Bilder vom Hochzeitsfotografen.",
    image: "public/migrated-assets/traum-hochzeit-location-hamburg/ART_7349-scaled.jpg",
    alt: "Braut im Tageslicht einer Hotelsuite in Hamburg",
    focalPoint: "top",
  },
  "/trautermin-hamburg-online-reservieren/": {
    keyword: "Trautermin Hamburg online reservieren",
    title: "Trautermin Hamburg online reservieren: Traukalender",
    description: "Trautermin Hamburg online reservieren: Hier findet Ihr den Link zum offiziellen Traukalender der Stadt und Hinweise zu Reservierung und Anmeldung der Trauung.",
    image: "src/assets/trautermin-hamburg-online-reservieren/trautermin-hamburg-rathaus-titel.jpg",
    alt: "Blick aus einem Fenster auf das Hamburger Rathaus und den Rathausmarkt",
  },
  "/unterwegs-in-baden-wuerttemberg/": {
    keyword: "Portraitshooting Schloss Lichtenstein",
    description: "Portraitshooting bei Schloss Lichtenstein in Baden-Württemberg: Julika mit Blumenkranz im weichen Abendlicht. Entdeckt die natürliche Outdoor-Bildstrecke.",
    image: "public/migrated-assets/unterwegs-in-baden-wuerttemberg/ART_0632-Bearbeitet.webp",
    alt: "Julika mit Blumenkranz blickt auf Schloss Lichtenstein und die Landschaft",
  },
  "/unterwegs-in-strasbourg/": {
    keyword: "Strasbourg Reisefotografie",
    image: "src/assets/unterwegs-in-strasbourg/ART_9955-Bearbeitet-Bearbeitet-Bearbeitet-scaled.jpg",
    alt: "Paulskirche in Strasbourg mit Spiegelung im Wasser an einem grauen Tag",
  },
  "/wie-sollte-man-hochzeitsfotos-sichern/": {
    keyword: "Hochzeitsfotos sichern Backup",
    description: "Hochzeitsfotos sichern: Tipps zu Festplatte, Cloud und zusätzlicher Offline-Kopie. So plant Ihr Backups und prüft, ob Eure Erinnerungen noch lesbar sind.",
    image: "public/migrated-assets/about/ART3557-Bearbeitet-2.jpg",
    alt: "Schwarzweiß-Hochzeitsfoto als bleibende Erinnerung an den Hochzeitstag",
    focalPoint: "top",
  },
};
