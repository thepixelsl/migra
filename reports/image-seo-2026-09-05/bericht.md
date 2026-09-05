# Bildindexierung und visuelle Suchergebnisse – Abschlussbericht

Stand: 5. September 2026. Ausgangsrevision: `ad5fc6c`.

Die gezielten Änderungen wurden auf Bunny veröffentlicht; die neue Bild-Sitemap und die geänderten Seiten sind öffentlich geprüft. **Ein Restpunkt ist noch offen: Der Cache von `robots.txt` liefert den neuen Sitemap-Verweis noch nicht aus; die gezielte Freigabe zur Leerung genau dieser URL wurde angefragt.** Das geschützte Mallorca-Vorschaubild der Homepage ist einschließlich URL, Dateiinhalt, Zuschnitt und Alt-Text unverändert. Es gibt keine neue Homepage-Galerie, keine zusätzlichen Homepage-Texte und keine neuen Bilddateien.

## A. Vorheriger Zustand

Vor Änderungen wurden alle 56 öffentlich indexierbaren kanonischen Seiten live abgerufen und die bestehende Astro-Architektur geprüft. Alle Seiten antworteten mit HTTP 200, korrektem Canonical und ohne blockierenden HTTP-Robots-Header. Die relevanten Bilder werden über `artbild-fotografie.de` ausgeliefert; eine zusätzliche öffentliche Bunny-Bilddomain wird in diesen Seiten nicht verwendet.

- Astro erzeugt statisches HTML. Eine eigene Nachverarbeitung erstellt die SEO-Dateien; eine Astro-Sitemap-Integration war nicht installiert und wurde nicht nachgerüstet.
- `/sitemap.xml` enthielt bereits 56 Seiten und 56 `image:image`-Referenzen, jeweils auf das ausgewählte Hauptbild. Eine vollständige separate Bild-Sitemap fehlte.
- `robots.txt` erlaubt öffentliche Seiten und Assets. Gesperrt sind ausschließlich die vorhandenen privaten Admin-Pfade. `max-image-preview:large` ist bereits vorhanden.
- Die Homepage enthält 52 `img`-Elemente im Hauptinhalt: 27 mit normalem `src`, 25 mit verzögerten Quellen. Darunter sind auch dekorative Icons und die getrennten Desktop-/Mobilinstanzen des Heros.
- Content-Fotos sind als HTML-Bilder beziehungsweise `picture` eingebunden. Es wurden keine wesentlichen ausschließlich über CSS-Hintergründe ausgegebenen Content-Fotos gefunden.
- Responsive WebP-Bilder, `srcset`, `sizes`, intrinsische Abmessungen und Lazy Loading sind bereits weitgehend vorhanden. Der Hero priorisiert sein aktives Motiv über die bestehende JavaScript-Ladesteuerung.
- OpenGraph, Twitter-Metadaten, `primaryImageOfPage`, vollständige `ImageObject`-Metadaten und geprüfte Bildrechte von York Augustin waren bereits vorhanden.

Rohdaten: [Live-Audit vorher](/Volumes/Cache/migra/migra-repo/reports/image-seo-2026-09-05/live-before.json), [HTTP-Stichprobe mit normaler und Googlebot-Image-Kennung](/Volumes/Cache/migra/migra-repo/reports/image-seo-2026-09-05/live-header-sample.json).

## B. Gefundene Probleme

| Bereich / Dateien | Betroffene Seiten | Ursache und Auswirkung |
| --- | --- | --- |
| `scripts/generate-production-seo-files.mjs` | Homepage, Galerien, Portfolio, Artikel | Die Sitemap sammelte ausschließlich `#primaryimage`. Die übrigen tatsächlich eingebundenen Motive fehlten als Bildhinweise. |
| `HeroSliderImage.astro`, `src/scripts/hero-slider.js` | Homepage | Der Hero aktivierte ausschließlich `srcset`; ein normaler `src`-Fallback fehlte auch nach dem Laden. Nicht aktive Bilder bleiben aufgrund der bewussten Ladesteuerung teilweise interaktionsabhängig. |
| `FeaturedPortfolioLinks.astro` | Homepage | Fünf echte Portfolio-Vorschaubilder hatten leere Alt-Texte, obwohl Beschreibungen schon in ihren Daten vorhanden waren. Eine Atlantic-Beschreibung passte nicht zum abgebildeten Paarportrait an der Alster. |
| `src/pages/index.astro` | Homepage | Ein Bild-Alt-Text beschrieb die Funktion als Preisverweis; ein anderer nannte einen See, obwohl das geprüfte Original eine Braut mit Blumenstrauß vor einer steinernen Säule zeigt. |
| `src/pages/portfolio/index.astro` | Portfolio | Title, Description und Einstieg betonten teilweise die alte allgemeine Landschafts-/People-Positionierung. |
| `src/data/migratedPages.json` | Standesamt Altona | Ein Beratungstext stellte Corona-Regeln und Erfahrungen aus 2021 als aktuell dar; die Rathausbilder hatten den Seitentitel statt einer Inhaltsbeschreibung als Alt-Text. Eine natürliche Verknüpfung zur eigenen Altona-Reportage fehlte. |
| `src/pages/kontakt/index.astro` | Kontakt | Der Titel begann allgemein mit „Kontakt“. Die sichtbare Anker-Grafik wurde im Alt-Text fälschlich als Person beschrieben. |
| `src/pages/about/index.astro` | About | Die Tätigkeit „Hochzeitsfotograf“ fehlte im ansonsten passenden persönlichen Title. |

## C. Durchgeführte Änderungen

| Datei | Änderung und Begründung |
| --- | --- |
| [Sitemap-Generator](/Volumes/Cache/migra/migra-repo/scripts/generate-production-seo-files.mjs) | Erzeugt zusätzlich `/image-sitemap.xml` und verknüpft sie in `robots.txt`. Die bestehende Seiten-Sitemap mit ihren Hauptbildern bleibt erhalten. `none` wird wie `noindex` ausgeschlossen. |
| [Bild-Sitemap-Auswahl](/Volumes/Cache/migra/migra-repo/scripts/lib/image-sitemap.mjs) | Liest tatsächliche Content-Bilder aus dem fertig nachbearbeiteten HTML. Prüft Dateien und Dimensionen, fasst responsive Varianten pro Motiv zusammen und erzeugt standardkonformes XML. |
| [Hero-Bildkomponente](/Volumes/Cache/migra/migra-repo/src/components/HeroSliderImage.astro) und [Hero-Skript](/Volumes/Cache/migra/migra-repo/src/scripts/hero-slider.js) | Hinterlegen eine vorhandene responsive Variante als `data-src` und aktivieren sie nach `srcset` als normalen Fallback. Lade-Warteschlange, Priorisierung, Zeiten, Nachbarbilder und Breakpoints bleiben erhalten. |
| [Portfolio-Vorschauen](/Volumes/Cache/migra/migra-repo/src/components/FeaturedPortfolioLinks.astro) | Nutzen die vorhandenen Beschreibungen als Alt-Texte; korrigieren die falsche Atlantic-Bildbeschreibung. Die bestehende Ausblendung rein visueller Linkvorschauen für Screenreader bleibt erhalten. |
| [Homepage](/Volumes/Cache/migra/migra-repo/src/pages/index.astro) | Präzisiert ausschließlich die beschriebenen falschen/unpassenden Alt-Texte. Der Säulen-Alt-Text gilt für beide bestehenden Hero-Instanzen. |
| [Portfolio](/Volumes/Cache/migra/migra-repo/src/pages/portfolio/index.astro) | Title: „Hochzeitsfotografie Hamburg – Portfolio \| Artbild-Fotografie“. Neue kurze Description und thematisch passender erster Intro-Satz. Vorhandene Galerien, Kategorien, Reihenfolge und Gestaltung bleiben erhalten. |
| [Altona-Seitendaten](/Volumes/Cache/migra/migra-repo/src/data/migratedPages.json:3726) | Ersetzen den veralteten Corona-Absatz durch die bestehende allgemeine Beratungsleistung, beschreiben die Rathausbilder korrekt und verlinken im vorhandenen ersten Absatz zur eigenen Altona-Hochzeitsreportage. Historische Veröffentlichungsdaten bleiben unverändert. |
| [Kontakt](/Volumes/Cache/migra/migra-repo/src/pages/kontakt/index.astro) | Title: „Hochzeitsfotograf Hamburg anfragen \| Artbild-Fotografie“; korrekter Alt-Text für die Anker-Grafik. Formular und Formularlogik wurden nicht bearbeitet. |
| [About](/Volumes/Cache/migra/migra-repo/src/pages/about/index.astro) | Title: „York Augustin – Hochzeitsfotograf in Hamburg \| Artbild-Fotografie“. |
| [Sitemap-Tests](/Volumes/Cache/migra/migra-repo/tests/image-sitemap.test.mjs), [Prüfskript](/Volumes/Cache/migra/migra-repo/scripts/verify-image-seo.mjs), [package.json](/Volumes/Cache/migra/migra-repo/package.json) | Prüfen Auswahl/Ausschlüsse, Duplikate, echte Seitenzuordnung, Bildressourcen, interne Links und den Schutz der Homepage. Ergänzen `test:image-sitemap`. |

Keine neue npm-Abhängigkeit. Keine Änderung an CSS, Navigation, FAB, Android-/iOS-Regeln, Cookie-Banner, Terminverwaltung, Analytics, Consent, Sicherheitsfunktionen oder Bunny-Konfiguration.

Bereits passende Inhalte blieben erhalten: Der Einstiegspreis von 299 € wird weiterhin aus dem gerenderten Ein-Stunden-Paket übernommen. Hotel Atlantic besitzt bereits einen eindeutigen Title, eine passende Reportage-Description und ein eigenes Motiv. Getting Ready, Standesamtfinder, Traukalender und Ratgeber behalten ihre bestehenden Suchintentionen und geeigneten Metadaten. Die geprüften natürlichen Links zu Portfolio, Preisen, Kontakt und passenden Getting-Ready-Galerien waren größtenteils bereits vorhanden.

## D. Image-Sitemap

Öffentlich erreichbare URL: [https://artbild-fotografie.de/image-sitemap.xml](https://artbild-fotografie.de/image-sitemap.xml).

**51 Seiten · 1.128 Bildreferenzen · 970 unterschiedliche Bild-URLs · 163.320 Bytes XML.** Mehrfach verwendete Bilder dürfen auf mehreren tatsächlichen Landingpages erscheinen; innerhalb einer Seite werden doppelte URLs und responsive Varianten desselben Astro-Motivs zusammengefasst.

| Landingpage | Bildreferenzen |
| --- | ---: |
| Homepage | 31 |
| Portfolio | 27 |
| Preise | 4 |
| Standesamtfinder | 2 |
| Traukalender | 7 |
| About | 8 |
| Hotel-Atlantic-Galerie | 28 |
| Standesamt-Altona-Landingpage | 1 |
| Getting-Ready-Ratgeber | 84 |
| Hochzeitsfotograf-Ratgeber | 3 |
| Kontakt | 0 |

Kontakt, Impressum, Datenschutz, die Agentenseite und der Backup-Artikel werden in der neuen Bild-Sitemap ausgelassen, weil dort keine geeigneten sichtbaren Content-Fotos vorhanden sind. Insbesondere wird das Anker-Logo der Kontaktseite nicht als Portfolio-Bild aufgenommen. Die Seiten selbst bleiben in der bestehenden Seiten-Sitemap.

Generierung: `npm run build` → Astro → vorhandene Social-/WebP-Nachverarbeitung → vorhandene Schema-Normalisierung → SEO-Dateien. Dadurch verwendet die Bild-Sitemap die endgültigen tatsächlich ausgegebenen WebP-URLs. Neue regulär indexierbare Galerien werden aus ihrem fertigen HTML automatisch erfasst; eine weitere manuelle Bildliste ist nicht nötig. Die bestehende redaktionelle Metadatenprüfung für neue Seiten bleibt bestehen.

Die Auswahl berücksichtigt `src`, `srcset`, `data-src` und `data-srcset` im Hauptinhalt. Sie nimmt die größte vorhandene Variante bis zur im HTML angegebenen intrinsischen Breite, ohne neue Größen zu erzeugen. Logos, Icons, Social-Cards, Dialog-Platzhalter, Navigation, Formulare, explizit versteckte Inhalte und sehr kleine Ressourcen werden ausgeschlossen. Vorhandene responsive oder bei Interaktion sichtbare Carousel-Bilder bleiben berücksichtigungsfähig. Keine Verzeichnisse werden pauschal als Asset-Dump veröffentlicht.

XML-Namespace, XML-Syntax und Google-Grenzen werden geprüft. Der neue `Sitemap:`-Eintrag ist im veröffentlichten Container vorhanden und macht die Datei nach Ablauf oder gezielter Leerung des noch alten `robots.txt`-Caches auch ohne manuelle Search-Console-Einreichung auffindbar. Grundlage: [Google-Dokumentation zu Bild-Sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps).

## E. Structured Data

Vorhanden waren unter anderem `LocalBusiness`, `Person`, `WebSite`, `WebPage`, `AboutPage`, `ContactPage`, `CollectionPage`, `BreadcrumbList`, `ImageObject`, `ImageGallery`, `Article`, `BlogPosting`, `ItemList` und Preis-/Leistungsobjekte.

**Es wurde kein neuer Schema-Typ und keine zusätzliche Sammlung von Bildobjekten eingeführt.** Die vorhandene Normalisierung übernimmt die gezielt geänderten Titles/Descriptions in die bereits vorhandenen Seitenobjekte. Die bestehenden Hauptbilder, Bildrechte, Urheberidentitäten und Galerieobjekte bleiben erhalten. Alle 56 Seiten besitzen syntaktisch valides JSON-LD, eindeutige oberste Objekt-IDs und konsistente Hauptbildreferenzen. Die bestehenden ausführlichen Schema-Tests bestehen.

Schema.org-Typen und Bild-Sitemaps aktivieren kein garantiertes Google-Karussell. Google beschreibt die Auswahl der Vorschaubilder ausdrücklich als automatisch; `og:image` und `primaryImageOfPage` sind Hinweise. [Google: Bild-SEO und bevorzugte Vorschaubilder](https://developers.google.com/search/docs/appearance/google-images).

## F. Homepage und geschütztes Mallorca-Bild

- Kein zusätzlicher sichtbarer Text, keine neue Galerie, keine zusätzlichen Bilder.
- 52 Bild-Elemente vorher und nachher; Reihenfolge, Layout und Stylesheets unverändert.
- Das Mallorca-Bild `ART0783-1` bleibt Hauptbild und Grundlage der Social-Vorschau. Der bestehende Alt-Text „Schwarzweiß-Portrait eines küssenden Paares im Gegenlicht auf Mallorca“ bleibt erhalten.
- Homepage-`og:image`: identische URL und byteidentische Datei. Der vorhandene Zuschnitt bleibt unverändert. Der bestehende Regressionstest bestätigt die ursprünglichen 1384 × 924 px sowie die passende 1200 × 630 px-Vorschau.
- 31 vorhandene Motive sind jetzt über die zusätzliche Bild-Sitemap der Homepage zugeordnet: unter anderem Mallorca/Paarbilder, Hero-/Brautportraits, Altona, Getting Ready, Atlantic, Barberhouse und vorhandene Reportage-/Planungsmotive.

Die bewusste verzögerte Hero-Ladung bleibt bestehen: Nicht jedes Slide-Bild hat bereits im ungeführten Roh-HTML einen aktiven `src`. Beim vorhandenen Laden erhält das Bild nun zusätzlich den normalen Fallback; die Sitemap erschließt auch die übrigen bereits vorhandenen Quellen. Es wurde keine künstliche Galerie oder reine Crawler-Ausgabe ergänzt. Dieser Kompromiss schützt die ausdrücklich priorisierte Performance.

Nachweise: [Homepage-Schutz und Ressourcenprüfung](/Volumes/Cache/migra/migra-repo/reports/image-seo-2026-09-05/verification.json), [Bytevergleich aller 970 Sitemap-Bilder](/Volumes/Cache/migra/migra-repo/reports/image-seo-2026-09-05/image-preservation.json).

## G. Validierung und Performance

- `npm run build`: erfolgreich; Astro baut 88 Routen, die bestehende Nachverarbeitung prüft 56 indexierbare Seiten.
- 46 gezielte Node-Tests für SEO, Sitemap, strukturierte Daten, HTML-Sanitizer und Android-FAB-Regeln erfolgreich.
- 34 bestehende Server-/Weiterleitungstests erfolgreich.
- 4 bestehende Browser-Tests für Homepage-Inhalt, mobilen Hero, responsive Bildauswahl und Slider-Navigation erfolgreich.
- Beide XML-Dateien zusätzlich mit einem unabhängigen XML-Parser geprüft.
- 56 kanonische Seiten und 65 unterschiedliche interne Linkziele lokal erfolgreich erreichbar; keine internen 404.
- 4.749 lokale Bildressourcen aus HTML, `srcset`, verzögerten Quellen, Vollansichten und OpenGraph: HTTP 200 und Bild-MIME-Typ. Keine fehlerhaften Bild-/`srcset`-URLs.
- Alle 970 unterschiedlichen Sitemap-Bild-URLs zusätzlich öffentlich mit `Googlebot-Image/1.0` abgerufen: HTTP 200, keine Redirects und keine blockierenden X-Robots-Header. Das ist ein Erreichbarkeitstest, keine Bestätigung eines echten Google-Crawls.
- Alle 970 vorhandenen Bilddateien gegenüber dem Ausgangsbuild bytegleich; ihre insgesamt 120.540.282 Bytes sind keine neu entstehende Seitenlast.
- Desktop, Tablet und mobile Breiten 1440/768/390/320 px im Browser geprüft. Die vollständige Homepage hat vorher/nachher dieselben Höhen; CSS unverändert. Portfolio, Altona und Atlantic wurden zusätzlich bei 1440 und 390 px kontrolliert, ohne horizontalen Seitenüberlauf.

Für einen vergleichbaren lokalen Ladeversuch wurden Browser-Cache deaktiviert, Navigationen über eine leere Seite begonnen und jeweils drei Messungen ohne Scrollen durchgeführt. Die Bild-Requests und übertragenen Bilddaten sind identisch:

| Messung | Vorher | Nachher |
| --- | ---: | ---: |
| Desktop: Bild-Requests | 11 | 11 |
| Desktop: übertragene Bilddaten | 388.924 Bytes | 388.924 Bytes |
| Mobil: Bild-Requests | 8 | 8 |
| Mobil: übertragene Bilddaten | 125.966 Bytes | 125.966 Bytes |
| Desktop: medianer lokaler LCP | 100 ms | 104 ms |
| Mobil: medianer lokaler LCP | 92 ms | 100 ms |

Die Messungen zeigen keine wesentliche Verschlechterung der lokalen Bildladung. Gemessener CLS liegt zwischen 0 und rund 0,004; diese kleinen Schwankungen werden nicht als exakt null ausgegeben. Die Detailprüfung ordnet die Verschiebung den unveränderten Textbereichen `.intro-script` und `.eyebrow` beim Schriftwechsel zu, nicht den Bildflächen. Layoutdateien und endgültige Homepage-Abmessungen bleiben gleich. [CLS-Detailprüfung](/Volumes/Cache/migra/migra-repo/reports/image-seo-2026-09-05/cls-investigation.json). Diese lokalen Laborwerte ersetzen keine öffentlichen Core-Web-Vitals-Felddaten und keinen Test auf echten Android-/iOS-Geräten.

JavaScript-Syntaxprüfungen und Astro-Kompilierung sind erfolgreich. Ein separater vollständiger `astro check` wurde nicht ausgeführt; das entsprechende Typecheck-Werkzeug ist im Projekt nicht installiert. Dafür wurde keine neue Abhängigkeit hinzugefügt.

Nachweise: [Build](/Volumes/Cache/migra/migra-repo/reports/image-seo-2026-09-05/build.log), [Node-Tests](/Volumes/Cache/migra/migra-repo/reports/image-seo-2026-09-05/tests.log), [Server-Tests](/Volumes/Cache/migra/migra-repo/reports/image-seo-2026-09-05/runtime-tests.log), [Browser-Tests](/Volumes/Cache/migra/migra-repo/reports/image-seo-2026-09-05/browser-tests.log), [Performance-Rohdaten](/Volumes/Cache/migra/migra-repo/reports/image-seo-2026-09-05/browser-performance.json).

## H. Offene Punkte und Grenzen

1. **Cache-Restpunkt:** `https://artbild-fotografie.de/robots.txt` wird noch aus dem alten CDN-Cache ausgeliefert. Nur dafür wurde eine konkrete Freigabe zur Cache-Leerung angefragt. Die neue Bild-Sitemap selbst ist bereits öffentlich mit HTTP 200 erreichbar und bytegleich zum geprüften Build. Die geänderten Seiten sind aktuell.
2. **Search Console:** Es kann zusätzlich `https://artbild-fotografie.de/image-sitemap.xml` eingereicht werden. Es wurden keine Zugangsdaten gesucht und keine Einreichung behauptet. Tatsächliche Bildindexierung und visuelle Google-Suchergebnisse bleiben dort beziehungsweise in der Suche zu beobachten.
3. **Bunny:** Die öffentlichen Tests zeigen keine Bildblockade. Interne Hotlink-/Security-Einstellungen des Kontos wurden nicht geprüft oder geändert. Es wurde kein Cache gelöscht.
4. **Bestehendes Tablet-Layout:** Bei 768 px werden längere Texte im Homepage-Portfolio-Linkblock abgeschnitten. Der Vorher-/Nachher-Vergleich zeigt denselben bereits bestehenden Zustand. Die Korrektur wäre eine separate Layoutänderung und wurde angesichts des ausdrücklichen Designschutzes nicht in diese SEO-Aufgabe aufgenommen. [Vorher](/Volumes/Cache/migra/migra-repo/output/playwright/image-seo/tablet-detail-before.png), [Nachher](/Volumes/Cache/migra/migra-repo/output/playwright/image-seo/tablet-detail-after.png).
5. **Keine SERP-Garantie:** Die Maßnahmen verbessern Auffindbarkeit, Seitenzuordnung und Bildbeschreibungen. Ob Google eine Bildreihe zeigt, entscheidet Google algorithmisch.

Der vollständige Diff einschließlich der neuen Hilfs- und Prüfdateien wurde kontrolliert. Bereits vorher vorhandene fremde/unzugeordnete Arbeitsdateien wurden nicht bearbeitet.

## I. Veröffentlichung und öffentliche Nachprüfung

- Produktionsrevision: `ce84a62dc28111091d98deeaf71c7b8c35bdf2ab`, auf `main` übertragen.
- [Produktions-Build 33960622094](https://github.com/thepixelsl/migra/actions/runs/33960622094): erfolgreich, 10 Minuten 32 Sekunden. Auch im Linux-Produktionsbuild wurden 51 Seiten und 1.128 Bildreferenzen erzeugt.
- Image: `ghcr.io/thepixelsl/migra-bunny-dev:prod-sha-ce84a62`; Digest: `sha256:685a2963f14c2335d9cadd823a4e75e347aaf18acbf50e1ae54acaa199773ac4`.
- Bunny: `artbild-dev` / `web`, **Active**, ein bereiter Frankfurt-Pod `Ki33kUs20mBIbx`; der vorherige Pod wurde entfernt.
- Öffentliche Bild-Sitemap: HTTP 200, korrekter XML-MIME-Typ, kein blockierender Robots-Header, bytegleich zum lokalen finalen XML.
- Alle 56 Seiten: HTTP 200; aktuelle Titles, Descriptions, Canonicals, Hauptbildreferenzen, Alt-Texte und Bildquellen geprüft. Sichtbare Texte und Stylesheets stimmen mit dem freigegebenen Stand überein.
- Die 13 schon vor dem Release abweichenden Hashnamen erzeugter Social-Cards zwischen lokalem Build und öffentlicher Produktion wurden gegen den öffentlichen Vorher-Snapshot geprüft: Alle öffentlichen OpenGraph-URLs sind unverändert. Ausschließlich der beim Build erzeugte `resetAt`-Zeitstempel im bestehenden JSON-Beispiel der Agentenseite wurde beim Textvergleich normalisiert.
- Alle **970 Sitemap-Bilder plus 56 unterschiedliche OpenGraph-Bilder** erneut öffentlich mit `Googlebot-Image/1.0` geprüft: 1.026 erfolgreiche Antworten mit HTTP 200 und Bild-MIME-Typ; keine Redirects oder blockierenden Robots-Header.
- Homepage-Vorschaubild: gleiche URL `/social-cards/home.webp`, unverändert 41.364 Bytes; SHA-256 `37028b346ec6ba27b6ed62d3f2ea859804769f1bca9996669fd3b35a78575535`.
- `/readyz` und `/healthz`: 200; geschütztes `/api/admin/availability`: 401 mit `noindex`; unbekannte Prüfrouten: 404.
- Öffentliche Homepage bei 1440 × 900 und 390 × 844 px visuell und anhand der tatsächlichen Geometrie geprüft: 52 Bilder, kein horizontaler Seitenüberlauf, keine defekten sichtbaren Bilder. Öffentliches Portfolio bei 390 px ebenfalls ohne Seitenüberlauf und mit dem neuen Einstieg. Die temporäre Browsergröße wurde anschließend zurückgesetzt.
- Keine neuen Cloudflare-, Sicherheits-, Skalierungs- oder Netzwerkänderungen. Der einzige noch offene technische Punkt ist die freizugebende Cache-Leerung von `robots.txt`; ein Abruf mit Release-Query zeigt bereits die korrekte neue Datei auf Hauptdomain und direktem Bunny-Endpunkt.

Nachweise: [Öffentliche Release-Prüfung](/Volumes/Cache/migra/migra-repo/reports/image-seo-2026-09-05/deployment.json), [Öffentliche Bildprüfung nach Deployment](/Volumes/Cache/migra/migra-repo/reports/image-seo-2026-09-05/deployed-image-resources.json).
