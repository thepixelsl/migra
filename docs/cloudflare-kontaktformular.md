# Kontaktformular auf Cloudflare Pages

Das Kontaktformular sendet an `/api/contact`. Die Pages Function validiert die Anfrage, filtert einfache Spam-Muster und gibt klare Fehler zurück.

## Aktivierung

Eine der folgenden Varianten muss eingerichtet sein, damit keine Anfrage verloren geht:

1. D1-Bindung `DB` oder `CONTACT_DB` setzen und die SQL-Dateien in `migrations/` anwenden.
2. Alternativ `CONTACT_WEBHOOK_URL` als HTTPS-Webhook setzen.
3. Optional `CONTACT_HASH_SALT` als Secret setzen, damit IP-Adressen nur gehasht gespeichert werden.

Wenn TFP-Bilder per E-Mail ankommen sollen, sollte der Webhook die Felder
`attachments[].contentBase64`, `attachments[].filename` und
`attachments[].contentType` in echte Mail-Anhänge umwandeln. In D1 werden nur
Metadaten zu den Anhängen gespeichert.

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
