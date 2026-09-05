# GA4-Direktstart: Veröffentlichung und Rollback

## Gesicherter Ausgangszustand am 5. September 2026

- Repository: `e8aff262d5bd3907376b3579baf1f95fddf3a8d6`.
- Bunny-App: `artbild-dev`, ID `K6hWkF1VHGclfGm`, Container `web`.
- Unveränderliches bisheriges Image:
  `ghcr.io/thepixelsl/migra-bunny-dev:prod-sha-e8aff26`.
- Bisheriger aktiver Pod: `Ke8geVjgB2MxmV`, Frankfurt.
- GTM: `GTM-5TM37JC`, Konto `76204675`, Container `12561320`,
  veröffentlichte Version **18**; Arbeitsbereich `24` war unverändert.
- GA4: `G-TSWGFD1YKF`, Property `254198096`.
- Sicherung von Live-HTML und veröffentlichtem GTM-Code:
  `/Volumes/Cache/migra/reports/ga4-direct-2026-09-05/`.

## Kompatible Umschaltung

Zuerst die GTM-Ausnahme veröffentlichen, dann das Website-Image wechseln.
Die neue Data-Layer-Variable `google_analytics_delivery` ist bei neuen Seiten
`direct`. Nur das GA4-Basistag (Tag-ID `35`) erhält eine Ausnahme für diesen
Wert. Es wird weder gelöscht noch pauschal pausiert. Andere Tags bleiben
unverändert. Alte Seiten ohne diesen Wert funktionieren mit dem neuen GTM
weiterhin; neue Seiten konfigurieren GA4 direkt nach Statistik-Zustimmung.

## Schneller Rollback

1. In Bunny ausschließlich `artbild-dev` / `web` wieder auf
   `prod-sha-e8aff26` stellen. Das Image nicht löschen oder überschreiben.
2. Auf einen bereiten Frankfurt-Pod und das Ende des ersetzten Pods warten.
3. Öffentliche HTML-Seiten prüfen: Im wiederhergestellten Stand fehlen
   `googleAnalyticsDelivery: direct` und der direkte GA4-Loader.
   Gegebenenfalls veralteten CDN-Inhalt erst nach Freigabe des konkreten
   Purge-Umfangs entfernen.
4. Die kompatible GTM-Ausnahme kann aktiv bleiben. Für einen vollständigen
   Rückweg erst nach Wiederherstellung des alten Website-Inhalts GTM-Version
   **18** aus der Versionshistorie erneut veröffentlichen. Version 18 nicht
   allein zurücksetzen, solange neue Seiten noch ausgeliefert werden:
   das könnte zu doppelter GA4-Initialisierung führen.
5. Consent Mode v2, Zustimmung/Widerruf, einen Seitenaufruf pro Navigation
   sowie `/readyz`, `/healthz`, Admin-Schutz und echte 404 prüfen.

Der Rückweg benötigt weder geänderte Zugangsdaten noch DNS-Änderungen.
Die bisherigen Consent-Cookies bleiben kompatibel. Kein öffentlicher
Testlink und keine Diagnose-Oberfläche werden hinzugefügt.
