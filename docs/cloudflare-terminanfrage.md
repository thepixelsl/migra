# Termin-Anfrage auf Cloudflare Pages

Die Website bleibt ein statischer Astro-Build. Nur die Terminprüfung läuft als Cloudflare Pages Function unter `/api/availability`.

## Empfohlene Struktur

1. Eine Cloudflare D1-Datenbank für blockierte oder manuell gepflegte Termine anlegen.
2. In Cloudflare Pages die D1-Bindung `DB` setzen.
3. Die Migration `migrations/0001_availability_dates.sql` auf die Datenbank anwenden.
4. Vergebene Termine als `unavailable` eintragen.

Beispiel:

```sql
INSERT OR REPLACE INTO availability_dates (date, status, note)
VALUES (
  '2026-09-12',
  'unavailable',
  'Am 12. September 2026 bin ich bereits gebucht.'
);
```

Nicht eingetragene Tage gelten als vorläufig verfügbar. Die Website formuliert das bewusst unverbindlich und verweist auf die persönliche Bestätigung.

## Warum diese Lösung passt

- Der Astro-Build bleibt schnell und cache-freundlich.
- Es braucht kein WordPress-Plugin und keinen externen Formularanbieter.
- Die Verfügbarkeit kann später über ein kleines Admin-Formular, Cloudflare Access oder eine geschützte interne Seite gepflegt werden.
- Ohne D1-Bindung fällt der Button sauber auf das Kontaktformular zurück.
