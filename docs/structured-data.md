# Strukturierte Daten: Unternehmen, Standort, Preise und Bildrechte

Stand: 3. September 2026. Produktionsziel: https://artbild-fotografie.de/.

## Quellen und bewusste Grenzen

- Unternehmensname, Adresse und E-Mail: aktuelle Startseite und `/impressum/`.
- Google-Maps-Zuordnung: zwei vorhandene Bewertungslinks aus `src/data/reviews.ts` lösen zum selben Unternehmen mit CID `3631123687202652958` auf. Im Browser wurden Name, Website, Adresse und der Ortspunkt bestätigt: `53.6035183, 10.155377`. Verwendet werden die `!3d`/`!4d`-Koordinaten des Unternehmens, nicht eine Kartenansicht.
- Hamburg.de bestätigt die Adresse; dessen Ortspunkt liegt rund 26 m entfernt. Für Konsistenz mit dem Unternehmensprofil wird der Google-Pin verwendet, nicht ein aus mehreren Quellen gemittelter Punkt.
- Offizielle Social-Profile stammen aus den bereits veröffentlichten Unternehmens-/Personendaten. Das Pinterest-Profil `artbildf` wurde zusätzlich live geprüft: Profilname Artbild-Fotografie, Beschreibung Hochzeitsfotograf aus Hamburg.
- Die Telefonnummer bleibt absichtlich aus JSON-LD heraus: die Website bietet dafür eine geschützte Anzeigenfunktion. Der Schutz wird nicht durch Klartext-Metadaten unterlaufen.
- Verzeichnis-Öffnungszeiten weichen vom Google-Profil ab. Es werden keine ungeprüften Öffnungszeiten hinzugefügt und keine Profile extern bearbeitet.
- Bei den eigenen Portfolio-/Reportage-Hauptbildern werden York Augustin als Urheber, Bildnachweis und die bestehende Rechteklausel `/impressum/#copyright-title` verknüpft. `/kontakt/` dient als Anlaufstelle für Rechteanfragen. Das erteilt keine neue Lizenz, insbesondere keine Creative-Commons-Freigabe.
- Beim Bild `portrait-riverside.jpg` ist der Fotograf nicht belegt. Die fünf Seiten mit diesem Hauptbild erhalten nur den Bildnachweis Artbild-Fotografie; keine erfundene Urheberangabe und keine Lizenzbehauptung.
- Keine Bewertungssterne, erfundenen Auszeichnungen, neuen Öffnungszeiten oder künstlich aktualisierten Publikationsdaten.

## Implementierung

- `src/data/businessSeo.mjs`: eine Quelle für LocalBusiness, WebSite, Person, Koordinaten, Profile und die Bildrechte-Policy.
- `scripts/normalize-structured-data.mjs`: nach Bildkonvertierung und vor Sitemap-Erzeugung. Führt die Artbild-Identitäten auf allen 56 indexierbaren Seiten zusammen. HTML-Inhalte und vorhandene Seitenmetadaten bleiben unverändert.
- Die bestehenden IDs `/#organization`, `/#website`, `/#person-york-augustin` bleiben erhalten. Verweise werden nicht durch neue parallele Identitäten ersetzt.
- Der veraltete Artbild-Typ ProfessionalService wird im veröffentlichten Build zu LocalBusiness. Leistungsbeschreibungen bleiben separate Service-Objekte; `serviceType` ist keine Unternehmenseigenschaft.
- WebSite steht auch auf der Startseite. Artikelautoren verweisen auf die Person mit URL `/about/`. Partner, Trauorte, fremde Autoren und Ortsangaben werden nicht zur Artbild-Identität umgeschrieben.
- `src/data/weddingPackages.ts`: sichtbare Preise und strukturierte Daten teilen sich Preis, Abrechnungseinheit sowie Mindest-/Höchstdauer. `packagePriceSchema.mjs` wird von Preis- und Agentenseite genutzt.
- Das Stundenpaket hat UnitPriceSpecification mit 249 EUR je Stunde und 3–10 Stunden. Kein irreführendes `Offer.price: 249` als Gesamtpreis und keine erfundene Aufrundungsregel. Festpreise bleiben 299 bzw. 649 EUR.
- Angebotskataloge werden über `hasOfferCatalog` statt als ungültiger Wert von `offers` verknüpft.

## Prüfung

1. `node scripts/verify-structured-data.mjs --baseline` vor dem Build erfasst sichtbare Inhalte und bestehende Metadaten.
2. `npm run build` erzeugt das endgültige Artefakt.
3. `npm run test:structured-data`, `npm run test:seo`, `npm run test:bunny`, `npm run test:migration-sanitizer`.
4. `node scripts/verify-structured-data.mjs` vergleicht 56 Seiten mit dem Ausgangszustand: Text, Links, sichtbare Bilder, Seitentitel, Descriptions, Canonicals und Robots.
5. `node scripts/verify-structured-data.mjs --live` vergleicht nach Veröffentlichung die tatsächlichen öffentlichen JSON-LD-Daten und Inhalte mit dem geprüften Build. Betriebssystembedingte WebP-Dateihashes werden beim Vergleich normalisiert, nicht die inhaltlichen Schemainformationen.

## Primärdokumentation

- https://developers.google.com/search/docs/appearance/structured-data/local-business
- https://schema.org/ProfessionalService
- https://schema.org/serviceType
- https://developers.google.com/search/docs/appearance/site-names
- https://developers.google.com/search/docs/appearance/structured-data/article
- https://developers.google.com/search/docs/appearance/structured-data/image-license-metadata
- https://schema.org/UnitPriceSpecification
- https://www.google.com/maps?cid=3631123687202652958
- https://www.hamburg.de/branchenbuch/hamburg/eintrag/10732809/

Strukturierte Daten schaffen keine Ranking- oder Darstellungs-Garantie. Standort-/Namensdaten ersetzen nicht die Pflege des Google-Unternehmensprofils.
