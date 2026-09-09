# Artbild Migration

Astro-Version der statischen Artbild-Migration aus `../output`.

## Start

```bash
npm install
npm run dev
```

Danach:

```text
http://127.0.0.1:4321
```

## Slider-Entscheidung

Der Hero-Slider bleibt bewusst ohne externe Carousel-Bibliothek. Die Slides werden von Astro als statisches HTML gerendert, inklusive lokaler Bildpfade und Alt-Texte. Ein kleines Vanilla-JavaScript initialisiert nur die aktive Desktop- oder Mobile-Variante, Autoplay, Hover-Pause und Swipe.

Das ist SEO-freundlicher als ein vollständig clientseitiger Slider, weil Suchmaschinen und Nutzer ohne JavaScript weiterhin semantisches HTML und Bildinhalte erhalten.

## Terminverfügbarkeit mit Cloudflare KV

Der Floating Action Button prüft einzelne Wunschdaten über:

```text
GET /api/availability?date=YYYY-MM-DD
```

Die öffentliche API gibt niemals die komplette Liste aus. Gespeichert werden nur blockierte Datumswerte im Format `YYYY-MM-DD` unter dem KV-Key `blockedDates`.
Pro pseudonymer Kurzzeitkennung können innerhalb von 24 Stunden höchstens drei unterschiedliche Kalendertage geprüft werden. Wiederholte Prüfungen desselben Datums verbrauchen keinen zusätzlichen Tag. Die Begrenzung wird serverseitig sowohl im Bunny-Runtime als auch im Cloudflare-Worker durchgesetzt.

### Cloudflare KV

Der KV-Namespace ist als Binding `AVAILABILITY_KV` vorgesehen.

Anlegen per Wrangler:

```bash
wrangler kv namespace create AVAILABILITY_KV
```

Danach den Namespace im Worker als Binding setzen:

```text
Binding name: AVAILABILITY_KV
KV namespace: AVAILABILITY_KV
```

Für dieses Repository ist der aktuelle Namespace bereits in `wrangler.toml` und `wrangler.worker.toml` eingetragen.

### Lokale Entwicklung

Für die Worker-Vorschau:

```bash
npm run build
wrangler dev --config wrangler.worker.toml
```

Die Website wird produktiv über Bunny ausgeliefert. Der frühere Cloudflare-Worker
bleibt nur als deaktivierter Rückfall im Cloudflare-Konto erhalten; seine
öffentliche `workers.dev`-Route ist in beiden Wrangler-Konfigurationen mit
`workers_dev = false` abgeschaltet:

```text
https://migra.fancy-wildflower-0608.workers.dev  # deaktiviert
```

Worker-Preview-URLs sind ebenfalls deaktiviert. Cloudflare Pages wird für dieses
Projekt nicht als zusätzliches Deployment-Ziel verwendet. Eine Reaktivierung des
Workers muss bewusst durch eine erneute Konfigurationsänderung und einen Deploy
erfolgen.

Die Bunny-App `artbild-dev` stellt den Container für die Bunny-Auslieferung bereit.
Entwicklungs-Rollouts werden bewusst mit `DEV_NOINDEX=true` betrieben. `npm run
deploy` aktualisiert ausschließlich den deaktivierten Cloudflare-Worker und darf
nicht für den Bunny-Rollout verwendet werden. Der vollständige Bunny-Ablauf steht
in [`docs/bunny-dev-deploy.md`](docs/bunny-dev-deploy.md).

Lokale Secrets gehören in `.dev.vars`. Eine Vorlage liegt in `.dev.vars.example`. Keine echten Secrets committen.

### Admin-Bereich

Die geschützte Terminpflege liegt unter:

```text
/admin-termine
```

Die Admin-API liegt unter:

```text
GET  /api/admin/availability
POST /api/admin/availability
```

Der aktuelle Bunny-Betrieb schützt alle `/api/admin/*`-Pfade und die
Terminverwaltung durch Passwort plus lokale TOTP-Zwei-Faktor-Anmeldung.
Es wird kein zusätzlicher Authentifizierungsdienst benötigt. HTTP Basic und
frühere Sitzungen ohne zweiten Faktor werden nicht akzeptiert.

Die erstmalige Einrichtung und Wiederherstellung sind in
[docs/admin-two-factor.md](docs/admin-two-factor.md) beschrieben. Vor dem
Containerwechsel müssen ein unabhängiges `ADMIN_SESSION_SECRET`, ein separates
`ADMIN_MFA_SETUP_TOKEN` und der genaue `ADMIN_PUBLIC_ORIGIN` eingerichtet sein.
Unter `/admin-security/` lassen sich einzelne oder alle Sitzungen abmelden.

Die frühere Cloudflare-Worker-Konfiguration ist ein separater Laufzeitpfad;
sie ist kein Nachweis einer vorgeschalteten Access-Kontrolle für die aktuelle
Bunny-Website.

### Datenmodell

Beispielwert in KV:

```json
["2026-07-18", "2026-08-22", "2026-09-05"]
```

Es werden keine Kundennamen, keine Kontaktdaten und keine Notizen gespeichert.

## Social Cards

Der Build erzeugt fuer jede indexierbare Seite eine statische Social Card im
Format 1200 x 630 Pixel und vereinheitlicht die Open-Graph- und Twitter-Tags.
Seitenspezifische Angaben werden zentral in `src/data/socialCards.mjs`
gepflegt. Die vollstaendige Dokumentation steht unter
[`docs/social-cards.md`](docs/social-cards.md).

## Consent und Tracking

Der Cookie-Banner, Google Consent Mode, Google Tag Manager, GA4 sowie die dort
eingerichteten Meta- und Clarity-Tags werden über eine zentrale, hostgebundene
Build-Konfiguration gesteuert. Production-Builds prüfen die Kennungen und die
Domainfreigabe vor dem Build. Meta und Clarity erhalten zusätzlich eigene
Consent-Sperren im GTM-Container.

Einrichtung, Data-Layer-Vertrag und Live-Umschaltung:
[`docs/tracking-consent.md`](docs/tracking-consent.md).
