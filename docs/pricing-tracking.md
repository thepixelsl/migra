# SEO- und Conversion-Messung der Preisseite

Stand: 19. Oktober 2026. Ziel ist ausschließlich `https://artbild-fotografie.de/hochzeitsfotograf-preise/`. Der Code ist vorbereitet; Produktion, Google-Berechtigungen, Server-Timer und der native GA4-E-Mail-Versand sind erst nach gesonderter Verifikation betriebsbereit. Der Benutzer hat den Versand durch Google Analytics an `info@artbild-fotografie.de` festgelegt; ChatGPT soll keine tägliche Arbeit ausführen. Ein Build beweist keine Veröffentlichung.

## Ereignisse und Einwilligung

`PricingTracking.astro` wird nur auf der Preis- und Kontaktseite eingebunden und nutzt die vorhandene `artbildTracking`-Schnittstelle. Kein zusätzlicher Google-Loader, GTM-Container, Measurement-Protocol-Endpunkt oder eigenes Besuchertracking. GA4 bleibt direkt geladen; GTM bleibt deaktiviert. Alle neuen Ereignisse und der begrenzte Zuordnungsspeicher benötigen eine wirksame Freigabe von `googleAnalytics` durch das bestehende Consent-System. Vorherige Interaktionen werden nicht nachgesendet. Widerruf entfernt die Zuordnung und stoppt den Beobachter; der vorhandene Consent-Runtime entfernt durch Neuladen den Google-Code.

| Ereignis | Auslöser |
| --- | --- |
| `price_package_view` | Mindestens 50 % der Paketüberschrift eine Sekunde sichtbar, sichtbarer Tab, einmal je Dokument und Paket |
| `price_package_click` | Expliziter Klick auf einen Paketlink oder den Anfragebutton einer Paketkarte |
| `price_calculator_change` | `change` des Stundenfeldes, niemals die initiale Standardauswahl |
| `price_contact_click` | Kontaktlink auf der Preisseite, mit definiertem Kontaktkanal |
| `generate_lead` | Bestätigtes `artbild:form_success` des Kontaktformulars nach erfolgreicher Serverantwort, mit gültiger Herkunftszuordnung |

Paketwerte: `pure_moments`, `standesamt`, `rundum_sorglos`. Parameter: `package_name`, ganzzahlige `hours` zwischen 1 und 10, `contact_channel`, `cta_position`. Zusätzlich markiert `measurement_page=hochzeitsfotograf_preise` den Messbereich auch für Anfragen, deren Abschluss auf `/kontakt/` erfolgt. Unbekannte Pakete/Stunden werden ausgelassen. Sichtkontakte selbst sind keine explizite Paketwahl. Eine bestätigte Anfrage ohne Paketwahl erscheint im Gesamtwert und lässt sich keinem Paket zuweisen.

Nur ein direkter Kontaktformular-/Sicherer-Kontakt-Klick speichert feste Kategorien und einen Zeitstempel in `sessionStorage`. Gültigkeit: höchstens 30 Minuten, aktueller Tab. Bei Navigation zum Kontaktformular werden die Klickereignisse einmalig auf der direkt folgenden Seite übergeben (höchstens 15 Sekunden alt), damit Googles Ereignisbündelung sie beim Seitenwechsel nicht verwirft. Sie werden nicht zusätzlich im Ausgangsdokument gesendet. Es werden weder Formulareingaben, Kontaktdaten, Hochzeitstermine, Orte noch Kennungen an GA4 gesendet. Die Speicherung wird nach Erfolg und Widerruf gelöscht. Für sicheren Kontakt, Telefon, E-Mail und WhatsApp kann diese Website keinen erfolgreichen Abschluss verifizieren; sie zählt dort ausschließlich Kontaktklicks. Abgeschlossene externe Anfragen bleiben unbekannt.

In der richtigen GA4-Property `254198096` (Artbild-Fotografie, Mess-ID `G-TSWGFD1YKF`) ist bereits `generate_lead` als Schlüsselereignis vorhanden. Eine bestehende Google-Regel erzeugt es aus `event_name=form_success` und `form_id=kontakt_anfrage_form`. Diese Regel bleibt unverändert. Bei einer zugeordneten Preisseitenanfrage sendet der Browser daher ausschließlich das neue, mit Paket/Messbereich versehene `generate_lead` an GA4; das sonstige `form_success` wird für diesen einen GA4-Fall ausgelassen, damit keine Doppelzählung entsteht. Andere Anfragen sowie die vorhandene Marketing-Auslieferung von `form_success` bleiben erhalten. Die fünf neuen Ereignisdimensionen wurden am 19. Oktober in GA4 angelegt und aus der gespeicherten Tabelle zurückgelesen.

Der bestehende Analytics-Runtime entfernt Query und Fragment aus `page_location` und beschränkt den Referrer auf den Origin. Nur auf der Preisseite dürfen `utm_source=google|instagram|ig` und `utm_medium=organic|cpc|social|paid_social` als feste Kampagnenparameter weitergegeben werden. Freitext-UTMs werden verworfen; der Kampagnenname ist konstant `pricing`. Beispiel für einen Instagram-Link: `https://artbild-fotografie.de/hochzeitsfotograf-preise/?utm_source=instagram&utm_medium=social`. Für bezahlte Instagram-Anzeigen `paid_social` verwenden. Keine privaten Informationen in Linkparametern.

## Google-Zugänge außerhalb des Repository

Der Collector verwendet nur Google-Original-APIs und private Dateien. `PRICING_GOOGLE_CREDENTIALS` zeigt auf eine Datei mit Modus 0600, Eigentümer aktueller Benutzer; `service_account` und OAuth `authorized_user` werden unterstützt. Keine Schlüssel oder Tokens in Git, Browsercode, Build-Variablen oder öffentlichen Artefakten. Berichte liegen in einem privaten Verzeichnis (0700), Dateien 0600.

Erforderlich sind aktivierte Search Console API, Google Analytics Data API und Analytics Admin API im Google-Cloud-Projekt. Der Berichtszugang braucht Zugriff auf die URL-Property `https://artbild-fotografie.de/` in Search Console und mindestens Betrachterzugriff auf die richtige GA4-Property. Scopes: `webmasters.readonly` und `analytics.readonly`. Service-Account-E-Mail jeweils ausdrücklich im Google-Konto freigeben; alternativ OAuth mit einem bereits berechtigten Konto. Die numerische GA4-Property-ID ist etwas anderes als die öffentliche Measurement-ID `G-TSWGFD1YKF`.

Für OAuth ist `scripts/authorize-pricing-google.mjs` vorbereitet. Es liest einen privaten Desktop-OAuth-Client (der bereits vorhandene Keyword-Client kann technisch verwendet werden, sofern die APIs in seinem Projekt aktiviert sind) und schreibt einen separaten Berichtszugang. Es verändert den Keyword-Planner-Zugang nicht. Der Benutzer führt die Google-Zustimmung selbst aus. Beispiel mit externen Dateipfaden:

```sh
PRICING_OAUTH_CLIENT_FILE="$HOME/.config/artbild-keyword-mcp/oauth-client.json" \
PRICING_GOOGLE_CREDENTIALS="$HOME/.config/artbild-pricing-report/google-readonly.json" \
node scripts/authorize-pricing-google.mjs
```

Ein OAuth-Projekt im externen Testmodus kann kurzlebige Refresh-Tokens ausstellen. Dauerhaften Betrieb erst nach erneuter Token-Erneuerung und wiederholtem unbeaufsichtigtem Abruf bestätigen. Der Collector gibt ausschließlich Fehlerkategorien aus, keine Google-Fehlertexte mit möglichen Identitätsdaten.

GA4 benötigt fünf benutzerdefinierte Ereignisdimensionen (`measurement_page`, `package_name`, `hours`, `contact_channel`, `cta_position`) und `generate_lead` als Schlüsselereignis. `scripts/setup-pricing-ga4.mjs` liest den Zustand; `--apply` ergänzt ausschließlich fehlende Definitionen, ohne bestehende zu verändern. Hierfür einmalig einen getrennten Zugang mit `analytics.edit` und Editor-Rechten verwenden; `authorize-pricing-google.mjs --admin` legt ihn in einer separaten Datei an. Der tägliche Dienst bleibt beim Lesezugang. Danach erneut ohne `--apply` lesen und Data-API-Metadaten prüfen. Neue Dimensionen gelten nicht rückwirkend und benötigen Verarbeitungszeit. Der Collector verweigert fehlende Dimensionen und eine von Europe/Berlin abweichende Property-Zeitzone, statt Tagesgrenzen zu vermischen.

## Search Console und Suchvolumen

Alle Search-Console-Abfragen haben `page equals` auf die vollständige kanonische URL, `type=web`, `dataState=final`, `aggregationType=auto`. Alle Länder und Geräte zusammen. Tagesgrenzen sind bei Google Pacific Time; sie werden im Bericht ausdrücklich von GA4/Berlin getrennt. Obergrenze ist der Pacific-Kalendertag minus drei Tage; bei größerer Verzögerung verwendet der Bericht den jüngsten tatsächlich gelieferten Tag und nennt diesen. Fehlende Tage bleiben unbekannt. Der tägliche Lauf liest 35 Tage erneut, um nachträgliche Google-Korrekturen zu übernehmen.

URL-Gesamtwerte und Suchbegriffe werden getrennt abgefragt. CTR und Position kommen direkt aus der jeweiligen Google-Zeile, keine ungewichteten Mittelwerte über Keywords. Positions- und CTR-Unterschiede sind absolute Differenzen, CTR in Prozentpunkten. Vortag und Vorwoche meinen exakt D−1/D−7 des jüngsten verfügbaren Tages, keine Ersatzdaten. Suchbegriffe werden paginiert; anonymisierte und intern begrenzte Google-Query-Zeilen können trotzdem fehlen. Query-Zeilen werden niemals zu einem angeblichen URL-Gesamtwert summiert.

Keyword Planner nutzt optional die vorhandenen privaten `artbild-keyword-mcp`-Dateien. Aufruf ausschließlich `generateKeywordHistoricalMetrics`, Deutschland (2276), Deutsch (1001), Google ohne Suchpartner; keine Kampagnen-/Budget-/Keywordplan-Mutationen. Feste relevante Preisseiten-Keywords stehen in `scripts/lib/pricing-report.mjs`. Ergebnisse werden einmal monatlich aktualisiert, mit Abrufzeitpunkt und ursprünglichen Monatswerten gespeichert. Google bezeichnet diese historischen Volumina als ungefähr; einschließlich ähnlicher Varianten sind sie Schätzwerte und ausdrücklich keine gemessenen tatsächlichen Suchzahlen. Tatsächliches Gesamtsuchvolumen bleibt unbekannt. Keine Ersatzdaten bei fehlendem API-Zugang. Die laufende API-Version ist konfigurierbar.

## Kennzahlen und Datenqualität

- Besucher der Seite: `totalUsers` bei `page_view`, exakter Host und `pagePath`.
- Besucher je Paket: `totalUsers` des jeweiligen `price_package_view`; Sichtkontakte: `eventCount` desselben Ereignisses. Maximal ein Sichtkontakt je Dokument, zusätzliche Aufrufe/Neuladen zählen erneut.
- Paket-/Kontaktklicks und erfolgreiche Anfragen: getrennte `eventCount`-Werte. Paketwahl ist keine Buchung. Nur bestätigte Formularanfragen werden als Erfolg bezeichnet.
- Stundenverteilung: ausschließlich explizite Rechneränderungen, jeweils mit Paket. Wiederholte Änderungen sind mehrere Interaktionen, keine eindeutigen Wünsche verschiedener Personen.
- Anfrage-Nutzerrate: anfragende Nutzer / Seitenbesucher bzw. Paketbetrachter des jeweiligen Berichtstags. Das ist eine Tageskennzahl, keine Kohorten-/Buchungsquote; Anfragen über Mitternacht können den Vergleich verschieben.
- Google/Instagram: separate API-Abfragen auf die GA4-Sitzungsquelle. Nutzer werden nicht über Tage, Pakete oder Quellen summiert. Besucher ohne Referrer/UTM bleiben ungeklärt. Quelle und Medium werden nicht als Kausalbeweis interpretiert.
- Gestern ist vorläufig, D−3 wird zusätzlich ausgewiesen. Die Data-API-Metadaten (Schwellenwerte, Sampling, sonstige Datenverluste, Zeitzone) werden erhalten. Fehlende Reihen/Anfragen werden konservativ als nicht verfügbar dargestellt, insbesondere vor bestätigtem Messstart. Kein künstliches Null-Auffüllen.

## Tägliche Datenerfassung und Versand durch Google Analytics

Der Benutzer hat festgelegt: **Google Analytics versendet den Bericht direkt an `info@artbild-fotografie.de`; keine tägliche ChatGPT-Ausführung.** Eine bestehende ChatGPT-Aufgabe wurde nicht verändert und keine neue angelegt. Eine Drittanbieter-Anbindung ist für diesen Versand nicht vorgesehen.

`npm run report:pricing` schreibt optional zur separaten API-Auswertung `latest.json`, `latest.md` und datierte private Dateien. Unvollständiger Bericht: Exitcode 2; harter Betriebsfehler: Exitcode 1. `deploy/pricing-report` enthält einen noch nicht installierten Benutzer-systemd-Timer zur privaten API-Erfassung um 07:50 Europe/Berlin. Er versendet keine E-Mail und steuert keinen GA4-Versand. Er berücksichtigt Sommer-/Winterzeit und holt einen ausgefallenen Lauf nach.

Für die API-Erfassung auf dem erreichbaren GEEKOM: Quellstand synchronisieren, private Google-Dateien und externe `environment` einrichten, privates Berichtsverzeichnis vorher anlegen, Units nach `~/.config/systemd/user/` kopieren, `daemon-reload`, einmaliger Service-Test, dann Timer aktivieren. Die Unit verwendet die vorhandene Hub-Node-Laufzeit. Vorher `systemd-analyze --user verify` und den Kalenderausdruck prüfen; anschließend Timer, Exitstatus und echten Folgelauf verifizieren. Keine Hub-Software ersetzen.

### Native GA4-E-Mail

GA4 kann Standard- und benutzerdefinierte Berichte täglich als deutsches PDF oder CSV verschicken. Notwendig: Administratorrolle für den Planer und bestehender Zugriff des Empfängers auf die Property. Die offizielle Konfiguration nennt Startdatum, Frequenz, Laufzeit, Format und Sprache, aber keine auswählbare Versand-Uhrzeit. Ein pünktlicher Versand um 08:00 Europe/Berlin ist damit nicht zugesichert. Er muss von einem täglichen Versand ohne feste Uhrzeit unterschieden werden. Der Zeitplan läuft höchstens zwölf Monate und muss dann erneuert werden. Der Zeitpunkt eines API-Laufs verändert die Google-Versandzeit nicht.

Vorgesehene Reportfilter und getrennte Datenquellen:

| Bericht | Dauerhafter Filter | Inhalt |
| --- | --- | --- |
| Preisseite: Besucher | Host `artbild-fotografie.de`, Seitenpfad exakt `/hochzeitsfotograf-preise/` | Eindeutige Nutzer, Aufrufe, Sitzungen; Google/Instagram als Sitzungsquelle |
| Preisseite: Pakete und Anfragen | `measurement_page` exakt `hochzeitsfotograf_preise` | Ereignisname, Paket, Stunden, Kontaktkanal, CTA-Position; Ereignisanzahl und Nutzer |
| Preisseite: Google-Suche | Verknüpfte Search Console, exakte kanonische Preis-URL | Klicks, Impressionen, CTR, durchschnittliche Position und Suchbegriffe, soweit die konkrete GA4-Search-Console-Berichtsvorlage URL-Filter unterstützt |

Auf der Kontaktseite bestätigte Anfragen müssen den Messbereich-Filter verwenden, statt am Seitenpfad der Preisseite zu scheitern. Ein Paket-/Kontaktbericht darf nicht einfach auf alle Website-Ereignisse zeigen. Die erstmalig gespeicherten Filter, Vergleiche und Zeiträume werden beim nativen E-Mail-Versand übernommen; Filter und Export vor der Zeitplan-Speicherung lesen und anschließend den gespeicherten Zeitplan erneut öffnen.

Search-Console-Query-Dimensionen lassen sich in GA4 nicht beliebig mit GA4-Ereignissen kombinieren. Historische Keyword-Planner-Suchvolumina sind ebenfalls keine normale GA4-Messgröße. Deshalb darf ein nativer GA4-Export diese Daten nicht als vollständig enthalten darstellen. Ein gemeinsamer, frei gestalteter Bericht mit exakten täglichen/vorwöchentlichen API-Vergleichen und Planner-Zahlen bleibt eine separate API-Auswertung; sie wird ohne weitere Anweisung nicht über einen anderen Absender versendet. Striktes 08:00 und ein gemeinsamer Bericht würden einen anderen Versandweg erfordern und bedürfen einer Entscheidung des Benutzers.

Abnahme des GA4-Versands: richtige Property und Mess-ID, Administratorrechte und Empfängerzugriff prüfen; vorhandene Zeitpläne auf Duplikate prüfen; Bericht mit exakten Filtern erstellen/lesen; deutschsprachigen PDF-Export prüfen; täglichen Zeitplan zum bestätigten Empfänger speichern; aktiven gespeicherten Zeitplan erneut lesen und einen echten Empfang getrennt bestätigen. Laut Google kann ein Zeitplan die aktuell angewendeten Berichtsfilter übernehmen, ohne einen neuen Bibliotheksbericht zu benötigen. Eine reine Vorschau ist kein Zustellnachweis.

Live-Prüfung am 19. Oktober: fünf Dimensionen gespeichert und zurückgelesen; vorhandenes `generate_lead`-Schlüsselereignis und seine Erstellungsregel geprüft. Der einzige vorhandene E-Mail-Zeitplan „Artbild Zugriffszahlen“ ist monatlich und seit 02.05.2025 abgelaufen; er wurde nicht verändert. Das Speichern eines neuen Bibliotheksberichts quittiert Google mit internem RPC-Fehlercode 13; in der Bibliothek ist kein Preisbericht gespeichert. Deshalb wurde ein vorhandener Ereignisbericht vorübergehend exakt auf `Messbereich Preisseite` mit verankertem Regex `^hochzeitsfotograf_preise$` und dem rollierenden Zeitraum „Gestern“ gefiltert. Der native Versandentwurf ist auf täglich, PDF, Deutsch, 12 Monate, Start 20.10.2026 vorbereitet, aber **nicht gespeichert oder aktiviert**.

Die gezielte Empfängersuche liefert **keine Übereinstimmung für `info@artbild-fotografie.de`**. GA4 bietet nur bestehende Property-Nutzer zur Auswahl. Eine neue Betrachterfreigabe würde Zugang zur gesamten Property gewähren und benötigt die ausdrückliche Entscheidung des Benutzers; sie wurde nicht erteilt. Auch die Akzeptanz des täglichen Versands ohne garantierte Uhrzeit ist noch offen. Kein Bericht wurde an eine andere Adresse versendet. Der Versandentwurf und ein Screenshot bleiben lokal zur Fortsetzung erhalten. Ohne diese Entscheidungen und bestätigte Speicherung gibt es keinen aktiven täglichen Preisseitenversand.

Quelle: [Google Analytics: Berichte planen](https://support.google.com/analytics/answer/13722168?hl=de).

## Veröffentlichung und Abnahme

Website über den vorhandenen Hub-Prozess vorbereiten: Commit veröffentlichen, GEEKOM synchronisieren, `{scope:"website"}` privat bauen und genau die Preis-/Kontaktseite prüfen. Der manuelle Veröffentlichungsklick bleibt gemäß `AGENTS.md` beim Benutzer, solange er keine konkrete Ausnahme erteilt. Erst nach Veröffentlichung die genaue Produktionsroute und echte GA4-Verarbeitung prüfen und `PRICING_TRACKING_LIVE_SINCE` setzen. Browser-Transporttests beweisen weder GA4-Property-Eingang noch rückwirkende Daten. Neue Zahlen entstehen erst ab Messstart und erteilter Einwilligung.

Aktuell fehlend: gültige Google-Leseautorisierung für die GSC-/GA4-APIs, Prüfung der Property-Zeitzone über die API, erneuerte Keyword-Planner-Autorisierung (`invalid_grant` beim geprüften MCP-Zugang), erreichbarer GEEKOM, bestätigter Empfängerzugriff, Entscheidung zur nativen Versandzeit, verifizierter GA4-E-Mail-Zeitplan und tatsächlicher Berichtsempfang. Die GA4-Browseranmeldung funktioniert, ersetzt jedoch keinen API-Zugang. Der Benutzer befindet sich außerhalb des Heimnetzes; kein LAN-/SSH-Zugriff. Die genaue öffentliche Preisroute liefert HTTP 200 mit korrektem Canonical, enthält aber noch keine neuen Paket-Tracking-Markierungen. Diese Zustände sind keine abgeschlossene produktive Implementierung.

## Lokale Prüfnachweise

Produktionsbuild erfolgreich, einschließlich vier Inhaltsprüfungen; neun neue Vertrags-/Zuordnungstests, neun vorhandene Tracking-Konfigurationstests, zehn SEO-Tests und 64 Bunny-Laufzeittests bestanden. Die vier vorhandenen Preisseitentests bestehen gegen die gebaute Vorschau bei 390, 810 und 1440 Pixeln. Ein erneuter Test gegen den Entwicklungsserver traf zusätzliche H1-Elemente der Astro-Entwicklungswerkzeuge; die Prüfung der gebauten Vorschau bestätigt genau die Produktionsausgabe ohne diese Werkzeuge.

Zusätzlich bestand ein Playwright-Browsertest mit dem originalen Google-SDK und synthetischer Test-ID bei vollständig abgefangener Anbieterkommunikation: keine Messung vor Einwilligung, alle drei Pakete und numerischen Stundenwerte, keine Standardauswahl als Interesse, keine Anfrage bei Formularfehler, genau eine zugeordnete bestätigte Anfrage, keine doppelte GA4-Formularableitung, keine Formular-/URL-Testdaten in den tatsächlich erzeugten Transportdaten, kein GTM-Loader, Widerruf und Bildschirmgrößen 1440/768/390 ohne horizontalen Überlauf. Kein Testereignis wurde an Google weitergeleitet, keine echte Anfrage versendet. Die serverseitige Verarbeitung in der produktiven GA4-Property bleibt separat zu prüfen.

Primärquellen: [Search Analytics API](https://developers.google.com/webmaster-tools/v1/searchanalytics/query), [GA4 Data API-Schema](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema), [GA4-Kampagnen](https://developers.google.com/analytics/devguides/collection/ga4/campaigns), [GA4 Admin API](https://developers.google.com/analytics/devguides/config/admin/v1/rest), [Keyword Planner historische Werte](https://developers.google.com/google-ads/api/docs/keyword-planning/generate-historical-metrics?hl=de).
