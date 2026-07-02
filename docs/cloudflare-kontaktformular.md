# Kontaktformular auf Cloudflare Pages

Das Kontaktformular sendet an `/api/contact`. Die Pages Function validiert die Anfrage, filtert einfache Spam-Muster und gibt klare Fehler zurück.

## Aktivierung

Eine der folgenden Varianten muss eingerichtet sein, damit keine Anfrage verloren geht:

1. D1-Bindung `DB` oder `CONTACT_DB` setzen und `migrations/0002_contact_requests.sql` anwenden.
2. Alternativ `CONTACT_WEBHOOK_URL` als HTTPS-Webhook setzen.
3. Optional `CONTACT_HASH_SALT` als Secret setzen, damit IP-Adressen nur gehasht gespeichert werden.

## Optionaler Turnstile-Schutz

Cloudflare Turnstile kann später ergänzt werden. Dafür `TURNSTILE_SECRET_KEY` setzen und bei Bedarf `CONTACT_REQUIRE_TURNSTILE=true` konfigurieren. Das Formular ist so aufgebaut, dass ein Turnstile-Feld ergänzt werden kann, ohne die Formularfelder umzubauen.

## Spam-Schutz

- Honeypot-Feld `website`
- Mindest-Ausfüllzeit bei JavaScript-Nutzung
- serverseitige Pflichtfeld- und Datumsprüfung
- Begrenzung der Nachrichtengröße
- Link-Limit in Freitextfeldern
- Rate-Limit über D1 nach E-Mail und gehashter IP
