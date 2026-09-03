# Strukturierte Daten: Unternehmen, Standort, Preise und Bildrechte

Stand: 3. September 2026. Produktionsziel: https://artbild-fotografie.de/.

## Quellen und bewusste Grenzen

- Unternehmensname, Adresse und E-Mail: aktuelle Startseite und `/impressum/`.
- Google-Maps-Zuordnung: zwei vorhandene Bewertungslinks aus `src/data/reviews.ts` lösen zum selben Unternehmen mit CID `3631123687202652958` auf. Im Browser wurden Name, Website, Adresse und der Ortspunkt bestätigt: `53.6035183, 10.155377`. Verwendet werden die `!3d`/`!4d`-Koordinaten des Unternehmens, nicht eine Kartenansicht.
- Hamburg.de bestätigt die Adresse; dessen Ortspunkt liegt rund 26 m entfernt. Für Konsistenz mit dem Unternehmensprofil wird der Google-Pin verwendet, nicht ein aus mehreren Quellen gemittelter Punkt.
- Offizielle Social-Profile stammen aus den bereits veröffentlichten Unternehmens-/Personendaten. Das Pinterest-Profil `artbildf` wurde zusätzlich live geprüft: Profilname Artbild-Fotografie, Beschreibung Hochzeitsfotograf aus Hamburg.
- Die Telefonnummer bleibt absichtlich aus JSON-LD heraus: die Website bietet dafür eine geschützte Anzeigenfunktion. Der Schutz wird nicht durch Klartext-Metadaten unterlaufen.
- Verzeichnis-Öffnungszeiten weichen vom Google-Profil ab. Es werden keine ungeprüften Öffnungszeiten hinzugefügt und keine Profile extern bearbeitet.
- Bei den eigenen Portfolio-/Reportage-Hauptbildern sowie den Bildobjekten in den geprüften Artbild-Galerien werden York Augustin als Urheber, Bildnachweis und die bestehende Rechteklausel `/impressum/#copyright-title` verknüpft. `/kontakt/` dient als Anlaufstelle für Rechteanfragen. Das erteilt keine neue Lizenz, insbesondere keine Creative-Commons-Freigabe.
- York hat am 03.09.2026 ausdrücklich bestätigt, auch beim Porträt Fotograf und Rechteinhaber zu sein. Die bisherige Ausnahme für `portrait-riverside.jpg` entfällt deshalb auf den fünf Seiten mit diesem Hauptbild.
- Galerie-Ergänzungen gelten nur für lokale Foto-Dateien in den geprüften Galerie-Auszeichnungen. Externe Bilder, andere Urheber/Lizenzen, beliebige Bildobjekte und nicht geprüfte Galerie-URLs bleiben unberührt. Tests prüfen alle verschachtelten Bildobjekte, nicht nur die Hauptbilder.
- Bei `Lovebirds am Elbstrand` fehlten zudem die Bild-URLs in 18 vorhandenen Galerie-Bildobjekten. `contentUrl`, Breite und Höhe werden jetzt aus denselben Bildimporten wie die sichtbare Galerie erzeugt; Bildauswahl und Darstellung bleiben gleich.
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

## Produktionsnachweis des ersten Releases

- Code-Commit: `76406da7e77d383e08a85c96a2e8f665b97021d4`.
- Erfolgreicher Produktionsworkflow: https://github.com/thepixelsl/migra/actions/runs/33702225270.
- Image: `ghcr.io/thepixelsl/migra-bunny-dev:prod-sha-76406da`, Digest `sha256:bc086e3699d2f9381e435da6971b25dd1295118ad29aed2b59ebdb827cfc5c1a`.
- Bunny `artbild-dev` / `web`: Active, genau ein bereiter Frankfurt-Pod `BhLRmPO920O2fb`. Vorheriger Pod `BhdzqVGPIuxXv7` entfernt.
- 55 Tests bestanden: 34 Bunny, 4 Sanitizer, 7 strukturierte Daten und 10 SEO. Vollständiger Produktionsbuild erfolgreich, auch auf Linux in GitHub Actions.
- 56 öffentliche Seiten: Status 200, vollständiger Schema-Graph und vorhandene Inhalte entsprechen dem geprüften Build. Kein Cache-Purge erforderlich. Siehe `reports/structured-data-2026-09-03/live.json`.
- 102 unterschiedliche Haupt-/Vorschaubilder: Status 200 und Bild-MIME-Typ. Siehe `reports/structured-data-2026-09-03/images-live.json`.
- Nach Containerwechsel: `/readyz` und `/healthz` 200; `/api/admin/availability` 401 mit `noindex, nofollow, noarchive`; unbekannter Prüfpfad 404.
- Google Rich Results Test, Smartphone, 03.09.2026 03:19:37: Bild-Metadaten, LocalBusiness und Organization jeweils gültig. LocalBusiness hat nur die optionalen Hinweise `telephone` und `priceRange`; keine ungeprüften Werte ergänzt.
- Google-Test: https://search.google.com/test/rich-results/result?id=l97H7nxJ9j0cmJz4SUW8UA.
- Schema.org-Livetest der Preisseite: 0 Fehler, 0 Warnungen: https://validator.schema.org/#url=https%3A%2F%2Fartbild-fotografie.de%2Fhochzeitsfotograf-preise%2F.

### Bildrechte-Nachtrag vom 03.09.2026

- Anlass: Die Search Console meldete vier optionale Felder beim Mallorca-Hauptbild auf der Startseite, Crawl vom 02.09.2026. Diese konkrete Meldung bezog sich auf den Stand vor dem ersten Release. Ein frischer Google-Test vom 03.09.2026, 12:02:28 bestätigte das vollständige Hauptbild: https://search.google.com/test/rich-results/result?id=GhzludN8uxDOzZgv3_yGwA.
- Die zusätzliche Bestandsprüfung fand fehlende Rechteangaben in Galerie-Bildobjekten. Nach Yorks ausdrücklicher Bestätigung als Fotograf und Rechteinhaber gilt die Ergänzung auch für sein Porträt.
- Code-Commit `00bb0ae2b5d5de89cd2529676d8e29fed1ca2723`, Produktionsworkflow erfolgreich: https://github.com/thepixelsl/migra/actions/runs/33741729820.
- Image `ghcr.io/thepixelsl/migra-bunny-dev:prod-sha-00bb0ae`, Digest `sha256:dc9913ca54c63878605b7b3a2b00110583be6456f9d95d9d1635b3d90483cd8a`.
- Bunny `artbild-dev` / `web`: Active, ein bereiter Frankfurt-Pod `OmV2fxh0Ycn2D9`, alter Pod `BhLRmPO920O2fb` entfernt.
- 57 Tests bestanden: 34 Bunny, 4 Sanitizer, 9 strukturierte Daten und 10 SEO. Texte, sichtbare Bilder, Links und vorhandene Seitenmetadaten auf 56 Seiten unverändert.
- Zwei vollständige öffentliche Abgleiche: 56/56 Seiten stimmen mit dem Build überein; zuerst 56 Cache-Status EXPIRED, danach 56 HIT. Kein Cache-Purge nötig. Alle 1.074 ImageObject-Vorkommen tragen vollständige Bildrechte; alle 918 unterschiedlichen referenzierten Bilddateien antworten mit HTTP 200 und Bild-MIME-Typ.
- Google-Livetest der Elbstrand-Galerie, 03.09.2026 12:12:41: 20 gültige Bild-Metadaten-Elemente ohne Bild-Metadaten-Warnungen: https://search.google.com/test/rich-results/result?id=Vk1Z5r1ulf0J-FcvwzE8HQ.
- Search Console: Nachprüfungen der vier ursprünglichen Warnungen gestartet; die endgültige Google-Validierung ist noch offen. Kein Versprechen einer SERP-Bildanzeige oder eines Rankinggewinns.
- Maschinenlesbare Nachweise: `reports/structured-data-2026-09-03/image-rights-followup.json`.

### Separater Bestandsbefund: Galerie-Listen sind keine Google-Karussells

Der Google-Test meldet zusätzlich zwei nicht qualifizierte Karussell-Elemente für die bestehenden IDs `/#home-lower-sections` und `/#portfolio-featured`: mehrere ItemLists, wiederholte Ziel-URLs sowie die gleichzeitige Verwendung von URL und eingebettetem Item. Beide Listen stammen unverändert aus `src/pages/index.astro` beziehungsweise `src/components/FeaturedPortfolioLinks.astro` (bereits vor diesem Release vorhanden).

Dieser Befund ist von der gültigen Standort-/Bildauszeichnung zu trennen. Googles Host-Karussell unterstützt spezielle Inhaltstypen, keine allgemeinen Fotogalerien: https://developers.google.com/search/docs/appearance/structured-data/carousel. Es wurden keine falschen Rezept-, Film- oder Produkt-Typen ergänzt und keine Galerie-Inhalte entfernt, nur um den Rich-Results-Test grün zu färben. Die Galerie-Listen bleiben außerhalb der hier beauftragten hoch/mittel priorisierten Standort-, Identitäts-, Autoren-, Bildrechte- und Preisänderungen unverändert. Der Bericht behauptet deshalb ausdrücklich nicht, dass sämtliche Google-Rich-Results-Prüfungen fehlerfrei sind.
