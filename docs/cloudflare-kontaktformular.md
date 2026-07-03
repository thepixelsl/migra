# Kontaktformular auf Cloudflare Pages

Das Kontaktformular sendet an `/api/contact`. Die Pages Function validiert die Anfrage, filtert einfache Spam-Muster und versendet die Anfrage serverseitig über STRATO SMTP. Die SMTP-Zugangsdaten liegen ausschließlich als Cloudflare-Environment-Variablen vor.

## Aktivierung

Diese Variablen müssen in Cloudflare Pages gesetzt werden:

- `STRATO_SMTP_USER`: vollständige STRATO-E-Mail-Adresse
- `STRATO_SMTP_PASS`: Postfach-Passwort
- `CONTACT_TO`: Zieladresse für Kontaktanfragen

Optional:

- D1-Bindung `DB` oder `CONTACT_DB` setzen und die SQL-Dateien in `migrations/` anwenden, wenn Anfragen zusätzlich gespeichert und per D1 rate-limited werden sollen.
- `CONTACT_HASH_SALT` als Secret setzen, damit IP-Adressen nur gehasht gespeichert werden.

TFP-Bilder werden nach serverseitiger Prüfung als Mail-Anhänge übergeben. In D1 werden nur Metadaten zu den Anhängen gespeichert.

Für lokale Tests kann `.dev.vars.example` nach `.dev.vars` kopiert und mit echten lokalen Zugangsdaten befüllt werden. `.dev.vars` darf nicht ins Repository.

## Optionaler Turnstile-Schutz

Cloudflare Turnstile kann später ergänzt werden. Dafür `TURNSTILE_SECRET_KEY` setzen und bei Bedarf `CONTACT_REQUIRE_TURNSTILE=true` konfigurieren. Das Formular ist so aufgebaut, dass ein Turnstile-Feld ergänzt werden kann, ohne die Formularfelder umzubauen.

## Spam-Schutz

- Honeypot-Feld `website`
- Mindest-Ausfüllzeit bei JavaScript-Nutzung
- serverseitige Pflichtfeld- und Datumsprüfung
- dynamische Jahresfrage: Das aktuelle Jahr wird serverseitig automatisch geprüft
- Begrenzung der Nachrichtengröße
- Link-Limit in Freitextfeldern
- Rate-Limit über D1 nach E-Mail und gehashter IP
- TFP-Upload nur für echte Bilddateien: maximal drei Dateien, je 2 MB, nur JPG, PNG oder WebP
- Prüfung von MIME-Type und Dateisignatur, keine SVGs, Skripte oder sonstigen Dateiformate
- Ablehnung auffälliger Code-Fragmente und Sonderzeichen in Textfeldern
- Header-Injection-Schutz: Besucher-E-Mail wird nur als Reply-To genutzt, nie als From
